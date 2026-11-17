import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 160)));
p.on('console', (m) => { if (m.text().startsWith('SLOW')) console.log(m.text()); });
const t0 = Date.now();
await p.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
console.log('room ready', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await p.evaluate(() => window.__penguin.scene.changeRoom('shop', 500, 280));
await p.waitForFunction(() => { const s = window.__penguin.scene; return s.currentRoom === 'shop' && s._movieReady === true; }, null, { timeout: 120000 });
console.log('shop ready', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await p.waitForTimeout(1500);

const tc = Date.now();
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen === true, null, { timeout: 120000 });
// page1 pronta = primeiro snapshot no _pageCache
await p.waitForFunction(() => (window.__penguin.scene.catalogue?._pageCache?.size || 0) > 0, null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(500);
console.log('catalogue open+page1', ((Date.now() - tc) / 1000).toFixed(1) + 's');

// instrumenta: tempo de _render, _show, renders e decodes pendentes
await p.evaluate(() => {
  const c = window.__penguin.scene.catalogue;
  window.__cat = { renders: 0, renderMs: 0, shows: 0, showMs: 0, lastRenderEnd: 0 };
  const m = c.movie;
  const origRender = c._render.bind(c);
  c._render = async (...a) => {
    const t = performance.now();
    try { return await origRender(...a); }
    finally { window.__cat.renders++; window.__cat.renderMs += performance.now() - t; window.__cat.lastRenderEnd = performance.now(); }
  };
  const origShow = c._show.bind(c);
  c._show = async (...a) => {
    const t = performance.now();
    try { return await origShow(...a); }
    finally { window.__cat.shows++; window.__cat.showMs += performance.now() - t; }
  };
  const origInner = c._renderInner.bind(c);
  window.__cat.inner = [];
  c._renderInner = async (uc) => {
    const t = performance.now();
    const before = c._pageCache.size;
    c.__renderBusy = true;
    try { return await origInner(uc); }
    finally {
      c.__renderBusy = false;
      window.__cat.inner.push({ uc, ms: +(performance.now() - t).toFixed(0), cache: `${before}->${c._pageCache.size}` });
      if (window.__cat.inner.length > 30) window.__cat.inner.shift();
    }
  };
  // detecta awaits que nunca resolvem dentro do render
  window.__cat.pending = {};
  const origArt = m.artCanvas.bind(m);
  m.artCanvas = async (file, ch, scale) => {
    const k = file + '|' + scale;
    window.__cat.pending[k] = (window.__cat.pending[k] || 0) + 1;
    const t = performance.now();
    try { return await origArt(file, ch, scale); }
    finally {
      window.__cat.pending[k]--;
      const ms = performance.now() - t;
      if (ms > 3000) console.log('SLOW artCanvas', ms.toFixed(0) + 'ms', file.slice(-40));
    }
  };
  const origSvg = m._svgImage.bind(m);
  m._svgImage = (file) => {
    const p = origSvg(file);
    p.then(() => {}, () => {});
    return p;
  };
  c.__showDone = true;
  window.__cat.page1 = { svgs: m._imgCache.size, art: m._artCache.size };
});

const snap = () => p.evaluate(() => {
  const c = window.__penguin.scene.catalogue;
  const m = c.movie;
  return {
    f: m.currentFrame('book'),
    cache: c._pageCache.size,
    stats: { ...window.__cat, inner: undefined, pending: undefined },
    inner: window.__cat.inner.slice(-6),
    pending: Object.entries(window.__cat.pending).filter(([, n]) => n > 0),
    svgs: m._imgCache.size,
    art: m._artCache.size,
  };
});

for (let i = 0; i < 20; i++) {
  const before = await snap();
  const t = Date.now();
  await p.evaluate(() => {
    const c = window.__penguin.scene.catalogue;
    const btn = c.controls.find((b) => b.label === 'Next page')
      || c.controls.filter((b) => /next/i.test(b.label)).pop();
    window.__clicked = btn?.label || null;
    if (btn?.action) btn.action();
  });
  // espera o frame mudar E o render terminar
  await p.waitForFunction((prev) => {
    const c = window.__penguin.scene.catalogue;
    return c && c.movie.currentFrame('book') !== prev && !c.__renderBusy;
  }, before.f, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(300);
  const after = await snap();
  const d = {
    renders: after.stats.renders - before.stats.renders,
    renderMs: (after.stats.renderMs - before.stats.renderMs).toFixed(0),
    shows: after.stats.shows - before.stats.shows,
    showMs: (after.stats.showMs - before.stats.showMs).toFixed(0),
  };
  console.log(`turn f${before.f}->f${after.f} [${await p.evaluate(() => window.__clicked)}]: wall=${((Date.now() - t) / 1000).toFixed(2)}s ${JSON.stringify(d)} cache=${after.cache} svgs=${after.svgs} art=${after.art} inner=${JSON.stringify(after.inner)} pending=${JSON.stringify(after.pending.slice(0, 5))}`);
  await p.waitForTimeout(2500); // tempo de "leitura" p/ warm da proxima pagina drenar
}
// revisita: volta 3 paginas e mede cache hit
for (let i = 0; i < 3; i++) {
  const before = await snap();
  const t = Date.now();
  await p.evaluate(() => {
    const c = window.__penguin.scene.catalogue;
    const btn = c.controls.find((b) => b.label === 'Previous page');
    if (btn?.action) btn.action();
  });
  await p.waitForFunction((prev) => {
    const c = window.__penguin.scene.catalogue;
    return c && c.movie.currentFrame('book') !== prev && !c.__renderBusy;
  }, before.f, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(300);
  const after = await snap();
  console.log(`back f${before.f}->f${after.f}: wall=${((Date.now() - t) / 1000).toFixed(2)}s renders=${after.stats.renders - before.stats.renders} renderMs=${(after.stats.renderMs - before.stats.renderMs).toFixed(0)} cache=${after.cache}`);
}
// idle: quantos renders o tick dispara em 3s parado na pagina?
const s0 = await snap();
await p.waitForTimeout(3000);
const s1 = await snap();
console.log(`idle 3s: renders=${s1.stats.renders - s0.stats.renders} renderMs=${(s1.stats.renderMs - s0.stats.renderMs).toFixed(0)} inner=${JSON.stringify(s1.inner)}`);
await b.close();
