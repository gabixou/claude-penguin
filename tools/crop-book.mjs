import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
// crop central do livro nas duas imagens (1280x800 screenshots)
const jobs = [
    ['tools/shots/cat3-p2.png', 'tools/shots/crop-ours-p2.png'],
    ['tools/shots/refcat2-p1.png', 'tools/shots/crop-ref-p2.png'],
    ['tools/shots/cat3-p1.png', 'tools/shots/crop-ours-p1.png'],
    ['tools/shots/refcat2-p0.png', 'tools/shots/crop-ref-p1.png'],
];
for (const [src, dst] of jobs) {
    const b64 = fs.readFileSync(src).toString('base64');
    const data = await p.evaluate(async (b64) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        // livro ocupa ~ x 330-980, y 90-720 em 1280x800
        c.width = 700; c.height = 700;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 330, 90, 700, 700, 0, 0, 700, 700);
        return c.toDataURL('image/png').split(',')[1];
    }, b64);
    fs.writeFileSync(dst, Buffer.from(data, 'base64'));
    console.log('wrote', dst);
}
await b.close();
