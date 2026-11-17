// Smoke atlas: entra na town, verifica render do pinguim e dispara dance.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, 'shots');
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
const atlasReqs = [];
page.on('request', (r) => { if (r.url().includes('atlas-')) atlasReqs.push(r.url()); });
page.on('requestfailed', (r) => { if (r.url().includes('atlas')) console.log('[atlas-fail]', r.url()); });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(22000);
const scene = `(() => {
    const g = window.__game || window.game;
    return Object.values(g.scene.keys).find((s) => s.currentRoom === 'town' || s.localPlayer);
})()`;
const hasPenguin = await page.evaluate(`(() => {
    const s = ${scene};
    return !!(s && s.localPlayer);
})()`);
console.log('localPlayer:', hasPenguin);
await page.screenshot({ path: path.join(SHOTS, 'atlas-room.png') });
// dance
await page.evaluate(`(() => { const s = ${scene}; s.handleAction && s.handleAction('dance'); })()`);
await page.waitForTimeout(6000);
await page.screenshot({ path: path.join(SHOTS, 'atlas-dance.png') });
console.log('atlas requests:', atlasReqs.length);
const byBase = {};
for (const u of atlasReqs) { const m = u.split('/assets/')[1]?.split('/chars/')[0]; byBase[m] = (byBase[m] || 0) + 1; }
console.log(byBase);
await browser.close();
