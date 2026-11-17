async () => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  s._enterIgloo();
  for (let i = 0; i < 80; i++) { await sleep(500); if (s.currentRoom === 'igloo' && s.movie) break; }
  // qualquer PuffleView serve p/ clonar a classe
  let anyV = null;
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    anyV = [...(s.iglooPetViews?.values() || []), ...(s.petViews?.values() || [])][0];
    if (anyV?._ready) break;
  }
  if (!anyV) return { err: 'no puffle view to clone', room: s.currentRoom };
  const PV = anyV.constructor;
  s._syncIglooPets = () => {}; // impede o sync de culpar os views fake

  const SPECIES = ['blue', 'pink', 'black', 'green', 'purple', 'red', 'yellow', 'white', 'orange', 'brown'];
  // frames reais medidos nos timelines.json de cada especie (play,rest,eat,cookie,gum,bath)
  const EXPECT = {
    blue:   { play: 256, rest: 210, eat: 145, cookie: 114, gum: 160, bath: 212 },
    pink:   { play: 132, rest: 210, eat: 145, cookie: 140, gum: 260, bath: 254 },
    black:  { play: 231, rest: 365, eat: 145, cookie: 122, gum: 218, bath: 327 },
    green:  { play: 170, rest: 290, eat: 145, cookie: 180, gum: 220, bath: 278 },
    purple: { play:  60, rest: 195, eat: 190, cookie: 210, gum: 299, bath: 283 },
    red:    { play: 311, rest: 210, eat: 145, cookie: 148, gum: 222, bath: 223 },
    yellow: { play: 397, rest: 210, eat: 267, cookie: 222, gum: 321, bath: 223 },
    white:  { play: 220, rest: 287, eat: 145, cookie: 149, gum: 179, bath: 253 },
    orange: { play: 152, rest: 147, eat: 116, cookie:  99, gum: 177, bath: 182 },
    brown:  { play: 220, rest: 349, eat: 168, cookie: 301, gum: 208, bath: 201 },
  };
  const ACTS = ['play', 'rest', 'eat', 'cookie', 'gum', 'bath'];
  const out = {};

  for (let i = 0; i < SPECIES.length; i++) {
    const sp = SPECIES[i];
    const view = new PV(s, { petRowId: 900000 + i, species: 'puffle_' + sp, name: sp }, null, { igloo: true });
    s.iglooPetViews.set(900000 + i, view);
    for (let j = 0; j < 80 && !view._ready; j++) await sleep(300);
    if (!view._ready) { out[sp] = 'NOT_READY'; view.destroy(); s.iglooPetViews.delete(900000 + i); continue; }
    await sleep(300);
    out[sp] = {};
    for (const act of ACTS) {
      for (let j = 0; j < 100 && view._care; j++) await sleep(300);
      const exp = EXPECT[sp][act];
      const t0 = Date.now();
      view.react(act);
      let maxFrame = 0, sawWrap = false, stopped = null, careEnd = null;
      for (let j = 0; j < 700; j++) {
        await sleep(200);
        const el = (Date.now() - t0) / 1000;
        if (!view._care && careEnd === null) careEnd = el;
        const misc = [...(view.clip?.playheads?.values() || [])]
          .filter(p => (p.timeline?.frames?.length || 0) === exp);
        for (const p of misc) {
          if (p.frame > maxFrame) maxFrame = p.frame;
          if (p.frame < maxFrame - 2 && maxFrame > 10) sawWrap = true;
          if (!p.playing && stopped === null) stopped = { el: +el.toFixed(2), frame: p.frame };
        }
        if (careEnd !== null && (stopped || el > exp / 24 + 4)) break;
        if (el > 45) break;
      }
      out[sp][act] = {
        exp, maxFrame, wrap: sawWrap,
        stoppedFrame: stopped?.frame ?? null,
        ok: maxFrame >= exp - 1 && !sawWrap && stopped !== null,
        careEndMs: careEnd && Math.round(careEnd * 1000),
      };
    }
    view.destroy();
    s.iglooPetViews.delete(900000 + i);
  }
  return out;
}
