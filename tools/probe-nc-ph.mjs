import { chromium } from 'playwright-core';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(2000);

const r = await p.evaluate(async () => {
    const scene = window.__penguin.scene;
    const m = scene.movie;
    const inter = scene._interactions;
    const out = { movieKeys: Object.keys(m).filter(k => /playhead|dirty|state|button/i.test(k)) };
    const dance = inter.buttons.find(b => b.path.includes('dance_btn'));
    const [x0, y0, x1, y1] = dance.bounds;
    inter.hoverAt((x0 + x1) / 2, (y0 + y1) / 2);
    await new Promise(r => setTimeout(r, 900));
    // _playheads keys
    out.phKeys = [...(m._playheads?.keys() || [])].filter(k => /dance|canopy|nightclub|#132|btn/.test(k));
    out.phAllType = m._playheadsAll?.constructor?.name;
    out.phAllSize = m._playheadsAll?.size;
    // sprite 88 playhead — tenta paths candidatos
    out.candidates = {};
    for (const cand of [
        'background_mc.dance_btn_states.dance_btn#1',
        'background_mc.dance_btn_states.dance_btn.over#1',
        'dance_btn#1',
    ]) {
        const h = m._playheads?.get(cand);
        out.candidates[cand] = h ? { f: h.frame, stopped: h.stopped, tlFrames: h.tl?.frames?.length } : null;
    }
    // varre _playheadsAll se existir
    if (m._playheadsAll) {
        out.allDance = [];
        for (const [k, v] of m._playheadsAll) if (/dance_btn|canopy/.test(k)) out.allDance.push(k + '=' + v.frame + (v.stopped ? 'S' : ''));
    }
    // estado do botao
    out.btnState = m._buttonStates.get(dance.path);
    // dirty paths atuais
    out.dirtyPaths = [...(m._dirtyPaths || [])].slice(0, 15);
    out.dirtyForced = [...(m._dirtyForcedPaths || [])].slice(0, 15);
    return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
