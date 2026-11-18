import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo&penguin=Penguin_ZDNT', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(18000);
const r = await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.igloo && x.igloo.editor !== undefined);
    const mgr = s.igloo;
    mgr.toggleEditor();
    await new Promise(r2 => setTimeout(r2, 3000));
    const ed = mgr.editor;
    await ed._openMusic();
    await new Promise(r2 => setTimeout(r2, 5000));
    const w = ed._musicWin;
    if (!w) return { err: 'no window' };
    // pega a zona do meio da lista (um select(N)) — zones[0] e close (depth order varia)
    // identifca pelo handler: dispara pointerdown na zona que NAO e close
    // zones nao guardam id; re-detecta via bounds dos botoes
    const movie = w.img ? null : null;
    // dispara click real no centro da zona index 5 (provavel select)
    const z = w.zones[5];
    const b = z.getBounds ? z.getBounds() : null;
    // fallback: emite pointerdown direto no game object
    z.emit('pointerdown', { x: 0, y: 0 });
    await new Promise(r2 => setTimeout(r2, 1500));
    const { musicPlayer } = await import('/src/audio/MusicPlayer.js');
    return { closed: !ed._musicWin, programId: musicPlayer.programId,
             layoutMusic: mgr.layout?.music };
})()`);
console.log(JSON.stringify(r));
await browser.close();
