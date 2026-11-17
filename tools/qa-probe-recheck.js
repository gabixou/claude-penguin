async () => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  s._enterIgloo();
  for (let i = 0; i < 80; i++) { await sleep(500); if (s.currentRoom === 'igloo' && s.movie) break; }
  let anyV = null;
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    anyV = [...(s.iglooPetViews?.values() || []), ...(s.petViews?.values() || [])][0];
    if (anyV?._ready) break;
  }
  if (!anyV) return { err: 'no puffle view' };
  const PV = anyV.constructor;
  s._syncIglooPets = () => {};
  const CASES = [
    ['black', 'gum', 218, 218],   // [species, action, expectedFrames, stopFrame]
    ['yellow', 'gum', 321, 319],
    ['purple', 'play', 60, 36],   // stop() aos 36 — anim segmentada, authêntico
  ];
  const out = {};
  for (let i = 0; i < CASES.length; i++) {
    const [sp, act, exp, stopExp] = CASES[i];
    const view = new PV(s, { petRowId: 900100 + i, species: 'puffle_' + sp, name: sp }, null, { igloo: true });
    s.iglooPetViews.set(900100 + i, view);
    for (let j = 0; j < 80 && !view._ready; j++) await sleep(300);
    if (!view._ready) { out[sp + '/' + act] = 'NOT_READY'; view.destroy(); s.iglooPetViews.delete(900100 + i); continue; }
    await sleep(300);
    for (let j = 0; j < 100 && view._care; j++) await sleep(300);
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
    out[sp + '/' + act] = {
      exp, stopExp, maxFrame, wrap: sawWrap,
      stoppedFrame: stopped?.frame ?? null,
      ok: maxFrame >= stopExp - 1 && !sawWrap && stopped !== null,
      careEndMs: careEnd && Math.round(careEnd * 1000),
    };
    view.destroy(); s.iglooPetViews.delete(900100 + i);
  }
  return out;
}
