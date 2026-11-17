async () => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pets = s.network?.social?.pets || [];
  const green = pets.find(p => p.species === 'puffle_green' && !p.equipped);
  if (!green) return { err: 'no green pet', pets: pets.map(p => p.petRowId + ':' + p.species + ':eq' + p.equipped) };
  s._enterIgloo();
  for (let i = 0; i < 80; i++) { await sleep(500); if (s.currentRoom === 'igloo' && s.movie) break; }
  let v = null;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    v = [...(s.iglooPetViews?.values() || [])].find(x => x.pet?.petRowId === green.petRowId);
    if (v?._ready) break;
  }
  if (!v) return { err: 'no igloo view', igloo: [...(s.iglooPetViews?.keys() || [])] };
  await sleep(800);

  // frames esperados dos sub-clips misc do green (medido nos timelines.json)
  const EXPECT = { eat: 145, cookie: 180, play: 170, bath: 278 };
  const out = { petRowId: green.petRowId, species: green.species, actions: {} };

  for (const act of ['eat', 'cookie', 'play', 'bath']) {
    for (let i = 0; i < 60 && v._care; i++) await sleep(400);
    const t0 = Date.now();
    s.network.petCare(green.petRowId, act);
    const exp = EXPECT[act];
    let maxFrame = 0, sawWrap = false, stopped = null, careEnd = null, firstWalk = null;
    const phSamples = [];
    for (let i = 0; i < 400; i++) {
      await sleep(200);
      const el = (Date.now() - t0) / 1000;
      if (!v._care && careEnd === null) careEnd = el;
      if (v.walking && firstWalk === null && el > 0.3) firstWalk = el;
      const misc = [...(v.clip?.playheads?.values() || [])]
        .filter(p => (p.timeline?.frames?.length || 0) === exp);
      for (const p of misc) {
        if (p.frame > maxFrame) maxFrame = p.frame;
        if (p.frame < maxFrame - 2 && maxFrame > 10) sawWrap = true;
        if (!p.playing && stopped === null) stopped = { el: +el.toFixed(2), frame: p.frame };
      }
      if (i % 10 === 0) phSamples.push(misc.map(p => p.frame + (p.playing ? 'p' : 's')).join(','));
      if (careEnd !== null && firstWalk !== null) break;
      if (el > 30) break;
    }
    out.actions[act] = {
      expected: exp, maxFrame, sawWrap,
      stoppedAt: stopped, // {el, frame} — stop() honrado?
      careEndMs: careEnd && Math.round(careEnd * 1000),
      firstWalkMs: firstWalk && Math.round(firstWalk * 1000),
      phTrail: phSamples.slice(-8),
    };
  }
  return out;
}
