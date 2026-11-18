// Verifica o fix: mouse do box ate cada filtro nao fecha o selector,
// e o clique abre o gridview.
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 160)));
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(20000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.igloo); })()`;

const setup = await page.evaluate(`(async () => {
    const s = ${scene};
    const mgr = s.igloo;
    if (!mgr.isOwner) return { owner: false };
    mgr.toggleEditor();
    await new Promise(r => setTimeout(r, 3000));
    const ed = mgr.editor;
    ed._toggleSelector(true);
    await new Promise(r => setTimeout(r, 300));
    return { owner: true, selVis: ed._selector?.visible, zones: ed._selectorZones.length };
})()`);
console.log('setup:', JSON.stringify(setup));

// simula pointermove em world coords ao longo do caminho box->cada zona
const hover = await page.evaluate(`(async () => {
    const s = ${scene};
    const ed = s.igloo.editor;
    const p = s.input.activePointer;
    const cam = s.cameras.main;
    const move = async (wx, wy) => {
        p.worldX = wx; p.worldY = wy;
        s.input.emit('pointermove', p, []);
        await new Promise(r => setTimeout(r, 40));
    };
    const log = [];
    // caminho realista: box (707,228) -> cada zona, em segmentos
    for (const z of ed._selectorZones) {
        const steps = 12;
        let closed = null;
        for (let i = 1; i <= steps; i++) {
            const x = 707 + (z.x - 707) * (i / steps);
            const y = 228 + (z.y - 228) * (i / steps);
            await move(x, y);
            if (!ed._selector?.visible) { closed = i; break; }
        }
        log.push({ zone: [z.x, z.y], closedAtStep: closed });
        if (closed !== null) ed._toggleSelector(true); // reabre p/ proximo teste
        await new Promise(r => setTimeout(r, 100));
    }
    // tambem testa sair da area (deve fechar — comportamento AS2)
    await move(300, 100);
    log.push({ fora: true, visAposSair: ed._selector?.visible });
    return log;
})()`);
console.log('hover:', JSON.stringify(hover));
await page.screenshot({ path: 'tools/shots/igloo-selector-fix.png' });
await browser.close();
