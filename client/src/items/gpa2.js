/**
 * gpa2.js - Decodificador do formato de sprites GPA2 do gopenguin-3ds
 * Layout (little-endian):
 *   header 64B | actions*12B | frames*12B | pages*16B | blobs LZ11->RGBA
 * Textura: blob { u16 ver=1, u8 dims, u16 subX,subY, 4xu16 subrect/1024, LZ11 }
 */

const te = new TextDecoder();

function u16(dv, o) { return dv.getUint16(o, true); }
function i16(dv, o) { return dv.getInt16(o, true); }
function u32(dv, o) { return dv.getUint32(o, true); }

// Descompressão LZ11 (3DS): 0x11 + u32 size, grupos de 8 com flag byte
function lz11Decompress(src, srcPos, expectedSize) {
    if (src[srcPos] !== 0x11) throw new Error('LZ11: bad magic');
    // header real do gopenguin: tamanho em 3 bytes LE (igual LZ10)
    const size = src[srcPos + 1] | (src[srcPos + 2] << 8) | (src[srcPos + 3] << 16);
    if (size !== expectedSize) throw new Error(`LZ11: size mismatch ${size} != ${expectedSize}`);
    const dst = new Uint8Array(size);
    let sp = srcPos + 4, dp = 0;
    while (dp < size) {
        const flags = src[sp++];
        for (let i = 0; i < 8 && dp < size; i++) {
            if (flags & (1 << i)) {
                dst[dp++] = src[sp++];
            } else {
                const b1 = src[sp++], b2 = src[sp++];
                const len = (b1 >> 4) + 3;
                const dist = 0x1000 - (((b1 & 0x0f) << 8) | b2);
                for (let j = 0; j < len && dp < size; j++) {
                    dst[dp] = dst[dp - dist];
                    dp++;
                }
            }
        }
    }
    return dst;
}

function decodeTextureBlob(buf, offset) {
    const dv = new DataView(buf);
    const bytes = new Uint8Array(buf);
    if (u16(dv, offset) !== 1) throw new Error('texture blob: bad version');
    const dc = bytes[offset + 2];
    if (bytes[offset + 3] !== 0 || bytes[offset + 4] !== 0) throw new Error('texture blob: bad flags');
    const width = 8 << (dc & 7);
    const height = 8 << ((dc >> 3) & 7);
    const sub = {
        x: u16(dv, offset + 5),
        y: u16(dv, offset + 7),
        left: u16(dv, offset + 9) / 1024,
        bottom: u16(dv, offset + 11) / 1024,
        right: u16(dv, offset + 13) / 1024,
        top: u16(dv, offset + 15) / 1024
    };
    const pixels = lz11Decompress(new Uint8Array(buf), offset + 17, width * height * 4);
    const imageData = new ImageData(width, height);
    imageData.data.set(pixels);
    return { width, height, imageData, sub };
}

export function parseGpa2(arrayBuffer) {
    const dv = new DataView(arrayBuffer);
    if (te.decode(new Uint8Array(arrayBuffer, 0, 4)) !== 'GPA2') throw new Error('GPA2: bad magic');
    if (u32(dv, 4) !== 2) throw new Error('GPA2: unsupported version');
    const total = u32(dv, 8);
    if (total !== arrayBuffer.byteLength) throw new Error('GPA2: length mismatch');

    const count = u32(dv, 12);
    const pages = u32(dv, 16);
    const actions = u32(dv, 20);
    const scaleFlag = u32(dv, 24);
    const scale = scaleFlag === 0x3f000000 ? 0.5 : scaleFlag === 0x3f800000 ? 1 : 0;
    if (!scale) throw new Error('GPA2: bad scale flag');
    const fps = u16(dv, 28);
    const nativeTimeline = u16(dv, 30);

    let p = 64;
    const seqs = [];
    for (let i = 0; i < actions; i++, p += 12) {
        seqs.push({
            start: u16(dv, p), count: u16(dv, p + 2), loop: u16(dv, p + 4),
            page: u16(dv, p + 6), rotation: u16(dv, p + 8), variation: u16(dv, p + 10)
        });
    }
    const frames = [];
    for (let i = 0; i < count; i++, p += 12) {
        frames.push({
            x: u16(dv, p), y: u16(dv, p + 2), w: u16(dv, p + 4), h: u16(dv, p + 6),
            left: i16(dv, p + 8), top: i16(dv, p + 10)
        });
    }
    const textures = [];
    for (let i = 0; i < pages; i++, p += 16) {
        const offset = u32(dv, p), bytes = u32(dv, p + 4);
        const tw = u16(dv, p + 8), th = u16(dv, p + 10);
        if (u32(dv, p + 12) !== 0) throw new Error('GPA2: bad texture record');
        textures.push({ offset, bytes, width: tw, height: th });
    }

    for (const t of textures) {
        t.image = decodeTextureBlob(arrayBuffer, t.offset);
        if (t.image.width !== t.width || t.image.height !== t.height) {
            throw new Error('GPA2: texture size mismatch');
        }
    }

    return { count, pages, actions, fps, nativeTimeline, scale, sequences: seqs, frames, textures };
}

// sprite_frame() do cliente C: tick = clock*fps/24; loop após count
export function frameForPose(sprite, rotation, variation, clock) {
    const seq = sprite.sequences.find(s => s.rotation === rotation && s.variation === variation);
    if (!seq) return null;
    const tick = Math.floor(clock * sprite.fps / 24);
    let idx;
    if (tick < seq.count) idx = seq.start + tick;
    else if (seq.count > seq.loop) idx = seq.start + seq.loop + ((tick - seq.loop) % (seq.count - seq.loop));
    else idx = seq.start + seq.count - 1;
    return sprite.frames[idx] || null;
}

export function textureToCanvas(sprite, pageIndex) {
    const t = sprite.textures[pageIndex];
    const canvas = document.createElement('canvas');
    canvas.width = t.width;
    canvas.height = t.height;
    canvas.getContext('2d').putImageData(t.image.imageData, 0, 0);
    return canvas;
}

export function listPoses(sprite) {
    return sprite.sequences.map(s => ({ rotation: s.rotation, variation: s.variation, start: s.start, count: s.count, loop: s.loop, page: s.page }));
}

export async function loadGpa2(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GPA2 fetch failed: ${url}`);
    return parseGpa2(await res.arrayBuffer());
}
