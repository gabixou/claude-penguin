// Decodifica arquivos .t3x (tex3ds/citro3d) para PNG.
// Formato: header(subtextures) + dados comprimidos (GBA-style: 0x10=LZ10, 0x11=LZ11, 0x00=none, outros=huff/rle)
// Pixels em ordem "swizzled" Morton por tiles de 8x8 -> unswizzle para RGBA linear.
import fs from 'node:fs';
import zlib from 'node:zlib';

// ---------- PNG encoder (RGBA8) ----------
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) { const b = Buffer.alloc(8 + data.length + 4); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); data.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length); return b; }
export function encodePNG(w, h, rgba) {
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- LZ10/LZ11 decode (formato tex3ds) ----------
function lz10decode(src, dstSize) {
    const dst = Buffer.alloc(dstSize); let sp = 0, dp = 0;
    while (dp < dstSize) {
        const flags = src[sp++];
        for (let i = 0; i < 8 && dp < dstSize; i++) {
            if (flags & (0x80 >> i)) {
                const b = src[sp++]; const len = ((b >> 4) & 0xF) + 3; let disp = ((b & 0xF) << 8) | src[sp++]; disp += 1;
                for (let k = 0; k < len && dp < dstSize; k++) { dst[dp] = dst[dp - disp]; dp++; }
            } else { dst[dp++] = src[sp++]; }
        }
    }
    return dst;
}
function lz11decode(src, dstSize) {
    const dst = Buffer.alloc(dstSize); let sp = 0, dp = 0;
    while (dp < dstSize) {
        const flags = src[sp++];
        for (let i = 0; i < 8 && dp < dstSize; i++) {
            if (flags & (0x80 >> i)) {
                let len, disp;
                const b0 = src[sp];
                switch (b0 >> 4) {
                    case 0: len = ((src[sp++] << 4) | (src[sp] >> 4)) + 0x11; break;
                    case 1: len = (((src[sp++] & 0xF) << 12) | (src[sp++] << 4) | (src[sp] >> 4)) + 0x111; break;
                    default: len = (b0 >> 4) + 1; break;
                }
                disp = ((src[sp++] & 0xF) << 8) | src[sp++]; disp += 1;
                if (len > dstSize - dp) len = dstSize - dp;
                for (let k = 0; k < len; k++) { dst[dp] = dst[dp - disp]; dp++; }
            } else { dst[dp++] = src[sp++]; }
        }
    }
    return dst;
}

// ---------- unswizzle Morton 8x8 (inverso de swizzle.cpp reverse=true) ----------
const TABLE = [
    [2, 8, 16, 4], [3, 9, 17, 5], [6, 10, 24, 20], [7, 11, 25, 21],
    [14, 26, 28, 22], [15, 27, 29, 23], [34, 40, 48, 36], [35, 41, 49, 37],
    [38, 42, 56, 52], [39, 43, 57, 53], [46, 58, 60, 54], [47, 59, 61, 55],
];
const PAIRS = [[12, 18], [13, 19], [44, 50], [45, 51]];
// p = array de 64 pixels (cada pixel = {r,g,b,a} ou bytes). Aplica permutacao inversa.
function unswizzleTile(px) {
    // px: Uint8Array de 64*4 (RGBA por pixel)
    const tmp = Buffer.alloc(256);
    for (const [a, b, c, d] of TABLE) {
        // reverse: tmp=p[d]; p[d]=p[c]; p[c]=p[b]; p[b]=p[a]; p[a]=tmp  (4-cycle)
        const pb = Buffer.from(px.subarray(d * 4, d * 4 + 4));
        px.copy(px, d * 4, c * 4, c * 4 + 4);
        px.copy(px, c * 4, b * 4, b * 4 + 4);
        px.copy(px, b * 4, a * 4, a * 4 + 4);
        pb.copy(px, a * 4);
    }
    for (const [a, b] of PAIRS) {
        const pa = Buffer.from(px.subarray(a * 4, a * 4 + 4));
        px.copy(px, a * 4, b * 4, b * 4 + 4);
        pa.copy(px, b * 4);
    }
    return px;
}

// unswizzleTile agora trabalha sobre Buffer RGBA de 256 bytes (64 px * 4)

// Converte 1 tile de 64 pixels do formato GPU para RGBA (Buffer 256 bytes).
function tileToRGBA(tileBytes, format, bpp) {
    const out = Buffer.alloc(256);
    for (let p = 0; p < 64; p++) {
        const s = p * bpp, d = p * 4;
        switch (format) {
            case 0: // RGBA8 armazenado como ABGR
                out[d] = tileBytes[s + 3]; out[d + 1] = tileBytes[s + 2]; out[d + 2] = tileBytes[s + 1]; out[d + 3] = tileBytes[s]; break;
            case 1: // RGB8 -> BGR? encode escreve B,G,R
                out[d] = tileBytes[s + 2]; out[d + 1] = tileBytes[s + 1]; out[d + 2] = tileBytes[s]; out[d + 3] = 255; break;
            case 2: { const v = tileBytes.readUInt16LE(s); out[d] = ((v >> 11) & 0x1F) * 255 / 31; out[d + 1] = ((v >> 6) & 0x1F) * 255 / 31; out[d + 2] = (v & 0x1F) * 255 / 31; out[d + 3] = (v & 0x8000) ? 255 : 0; break; }
            case 3: { const v = tileBytes.readUInt16LE(s); out[d] = ((v >> 11) & 0x1F) * 255 / 31; out[d + 1] = ((v >> 5) & 0x3F) * 255 / 63; out[d + 2] = (v & 0x1F) * 255 / 31; out[d + 3] = 255; break; }
            case 4: { const v = tileBytes.readUInt16LE(s); out[d] = ((v >> 12) & 0xF) * 17; out[d + 1] = ((v >> 8) & 0xF) * 17; out[d + 2] = ((v >> 4) & 0xF) * 17; out[d + 3] = (v & 0xF) * 17; break; }
            case 5: { const l = tileBytes[s], a = tileBytes[s + 1]; out[d] = out[d + 1] = out[d + 2] = l; out[d + 3] = a; break; }
            case 7: { const l = tileBytes[s]; out[d] = out[d + 1] = out[d + 2] = l; out[d + 3] = 255; break; }
            case 8: { out[d + 3] = tileBytes[s]; break; }
            default: throw new Error('formato de pixel nao suportado: ' + format);
        }
    }
    return out;
}

function tilesToRGBA(raw, format, w, h) {
    // raw = tiles 8x8 contiguos row-major; cada tile: 64 px row-major local, bpp bytes/px.
    // ETC1/ETC1A4 (12/13) tem layout proprio -> nao suportado aqui.
    const bppMap = { 0: 4, 1: 3, 2: 2, 3: 2, 4: 2, 5: 2, 7: 1, 8: 1 };
    const bpp = bppMap[format];
    if (!bpp) throw new Error('formato nao suportado: ' + format);
    const tileBytes = 64 * bpp;
    const out = Buffer.alloc(w * h * 4);
    const tilesX = w / 8, tilesY = h / 8;
    for (let ty = 0; ty < tilesY; ty++) for (let tx = 0; tx < tilesX; tx++) {
        const tileIdx = ty * tilesX + tx;
        const src = raw.subarray(tileIdx * tileBytes, (tileIdx + 1) * tileBytes);
        const rgba = tileToRGBA(src, format, bpp);
        const unsw = unswizzleTile(rgba);
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const si = (y * 8 + x) * 4, di = ((ty * 8 + y) * w + (tx * 8 + x)) * 4;
            unsw.copy(out, di, si, si + 4);
        }
    }
    return out;
}

// ---------- parser principal ----------
export function decodeT3X(buf) {
    let off = 0;
    const numSub = buf.readUInt16LE(off); off += 2;
    const params = buf[off++];
    const format = buf[off++];
    const numMip = buf[off++];
    const w = 1 << (((params & 7) + 3));
    const h = 1 << ((((params >> 3) & 7) + 3));
    const type = (params >> 6) & 1;
    const subs = [];
    for (let i = 0; i < numSub; i++) {
        subs.push({ w: buf.readUInt16LE(off), h: buf.readUInt16LE(off + 2), left: buf.readUInt16LE(off + 4) / 1024, top: buf.readUInt16LE(off + 6) / 1024, right: buf.readUInt16LE(off + 8) / 1024, bottom: buf.readUInt16LE(off + 10) / 1024 });
        off += 12;
    }
    // dados comprimidos
    const ctype = buf[off++];
    let size = buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16); off += 3;
    if (buf[off - 3] & 0x80) { // tamanho estendido ( improvavel )
        size |= buf[off] << 24; off += 4;
    }
    let raw;
    if (ctype === 0x00) raw = buf.subarray(off, off + size);
    else if (ctype === 0x10) raw = lz10decode(buf.subarray(off), size);
    else if (ctype === 0x11) raw = lz11decode(buf.subarray(off), size);
    else throw new Error('compressao nao suportada: 0x' + ctype.toString(16));
    const rgba = tilesToRGBA(raw, format, w, h);
    return { width: w, height: h, format, numSub, subs, rgba: Buffer.from(rgba) };
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('t3x2png.mjs')) {
    const [,, inp, outp] = process.argv;
    const t = decodeT3X(fs.readFileSync(inp));
    console.log(`${inp}: ${t.width}x${t.height} fmt=${t.format} subs=${t.numSub}`, t.subs);
    fs.writeFileSync(outp || inp.replace(/\.t3x$/, '.png'), encodePNG(t.width, t.height, t.rgba));
    console.log('->', outp || inp.replace(/\.t3x$/, '.png'));
}
