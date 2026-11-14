// smoke-ci.mjs — smoke test determinístico do cliente no browser (CI).
// Sobe `vite preview` do build em client/dist, abre o jogo headless com o
// pinguim loopback Arenovisk e valida: boot sem tela preta, penguin anda,
// troca de sala funciona, sem pageerror/console error/request 4xx-5xx.
// Uso: node tools/smoke-ci.mjs [baseUrl]   (default http://localhost:3100)
// Requer: client/dist buildado, servidor ws em ws://localhost:8090 (VITE_WS_URL
// embutido no build), playwright-core em tools/node_modules e Chrome instalado.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:3100';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let failures = 0;
const check = (name, cond, extra = '') => {
    if (cond) console.log(`  PASS ${name}`);
    else { failures++; console.log(`  FAIL ${name} ${extra}`); }
};

// ---- sobe vite preview do build ----
const preview = spawn(process.execPath,
    [join(ROOT, 'client/node_modules/vite/bin/vite.js'), 'preview',
     '--port', '3100', '--host', '127.0.0.1', '--strictPort'],
    { cwd: join(ROOT, 'client'), stdio: ['ignore', 'pipe', 'pipe'] });
preview.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));

async function waitHttp(url, tries = 60) {
    for (let i = 0; i < tries; i++) {
        try { const r = await fetch(url); if (r.ok || r.status === 304) return true; } catch {}
        await delay(500);
    }
    return false;
}

try {
    if (!(await waitHttp(`${BASE}/`))) { console.log('FAIL preview não subiu'); process.exit(1); }

    const browser = await chromium.launch({ executablePath: CHROME, headless: true });
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

    const pageErrors = [], consoleErrors = [], badResponses = [], failedReqs = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) badResponses.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', (r) => failedReqs.push(`${r.url()} :: ${r.failure()?.errorText}`));

    console.log(`== smoke-ci: ${BASE}/?penguin=Arenovisk`);
    await page.goto(`${BASE}/?penguin=Arenovisk`, { waitUntil: 'domcontentloaded' });

    // boot: sai do loading e o pacote da sala inicial renderiza
    await page.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 180000 });
    check('movieReady (sala inicial renderizou)', true);
    // _warmDone e warm-up de performance (practice-render dos frames do
    // paperdoll), nao corretude — em CI/headless sem GPU pode demorar
    // varios minutos. Timeout vira WARN e o teste segue; os checks
    // seguintes (andar, trocar de sala, erros) sao os que reprovam.
    const warmDone = await page.waitForFunction(
        () => window.__penguin?.scene?.localPlayer?.view?._warmDone === true,
        null, { timeout: 90000 }).then(() => true).catch(() => false);
    console.log(warmDone ? '  PASS paperdoll quente (_warmDone)'
        : '  WARN _warmDone não concluiu em 90s — warm-up lento no CI, seguindo');

    const st = await page.evaluate(() => {
        const s = window.__penguin.scene;
        const lp = s.localPlayer;
        return { room: s.currentRoom, x: lp?.x, y: lp?.y, hasView: !!lp?.view };
    });
    check('localPlayer existe com posição válida', st.hasView && Number.isFinite(st.x) && Number.isFinite(st.y), JSON.stringify(st));
    console.log(`   sala=${st.room} pos=(${Math.round(st.x)},${Math.round(st.y)})`);

    // anda: clique no canvas e confere mudança de posição
    const box = await page.locator('canvas').first().boundingBox();
    check('canvas presente', !!box);
    if (box) {
        // alvo ~160px a direita/cima do pinguim (longe o bastante para nao
        // acertar o proprio pinguim nem ficar na area do HUD)
        const tx = Math.min(700, st.x + 140), ty = Math.max(60, st.y - 80);
        const cx = box.x + (tx / 760) * box.width, cy = box.y + (ty / 480) * box.height;
        await page.mouse.click(cx, cy);
        const moved = await page.waitForFunction((p) => {
            const lp = window.__penguin?.scene?.localPlayer;
            return lp && (Math.abs(lp.x - p.x) > 8 || Math.abs(lp.y - p.y) > 8);
        }, st, { timeout: 12000 }).then(() => true).catch(() => false);
        check('pinguim anda após clique', moved);
    }

    // troca de sala
    await page.evaluate(() => window.__penguin.scene.changeRoom('beach'));
    const switched = await page.waitForFunction(() => window.__penguin?.scene?.currentRoom === 'beach', null, { timeout: 60000 })
        .then(() => true).catch(() => false);
    check('troca de sala (town -> beach)', switched);
    if (switched) {
        const ready = await page.waitForFunction(
            () => window.__penguin?.scene?.currentRoom === 'beach'
                && window.__penguin?.scene?._movieReady === true
                && !!window.__penguin?.scene?.localPlayer?.view,
            null, { timeout: 120000 }).then(() => true).catch(() => false);
        check('sala beach renderizou com penguin', ready);
    }

    await page.screenshot({ path: join(ROOT, 'tools/shots/ci-smoke.png') }).catch(() => {});
    await browser.close();

    check('sem pageerror', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
    check('sem console.error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
    check('sem resposta >=400', badResponses.length === 0, badResponses.slice(0, 5).join(' | '));
    check('sem request falha', failedReqs.length === 0, failedReqs.slice(0, 5).join(' | '));
} catch (e) {
    failures++;
    console.log(`  FAIL exceção: ${String(e).slice(0, 400)}`);
} finally {
    preview.kill('SIGTERM');
}

console.log(failures === 0 ? 'SMOKE OK' : `SMOKE FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
