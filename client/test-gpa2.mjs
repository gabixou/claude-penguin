globalThis.ImageData = class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } };
import { readFile } from 'node:fs/promises';
import { parseGpa2, listPoses, frameForPose } from './src/items/gpa2.js';

const dir = new URL('./public/assets/outfits/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
for (const f of ['avatar-1.gpa', '101.gpa', '104.gpa', '171.gpa', '1000.gpa']) {
    try {
        const buf = await readFile(dir + f);
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        const s = parseGpa2(ab);
        const tex = s.textures.map(t => t.width + 'x' + t.height).join(',');
        console.log(f, 'OK frames=' + s.count, 'pages=' + s.pages, 'actions=' + s.actions, 'fps=' + s.fps, 'scale=' + s.scale, 'tex=' + tex);
        const poses = listPoses(s);
        console.log('  first poses:', JSON.stringify(poses.slice(0, 4)));
        const fr = frameForPose(s, poses[0].rotation, poses[0].variation, 10);
        console.log('  frame:', JSON.stringify(fr));
        // sanity: non-zero pixels in first texture
        const d = s.textures[0].image.imageData.data;
        let nz = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) nz++;
        console.log('  opaque px page0:', nz, '/', d.length / 4);
    } catch (e) { console.log(f, 'FAIL', e.message); }
}
