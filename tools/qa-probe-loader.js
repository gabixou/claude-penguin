() => new Promise(res => {
  const s = window.__penguin.scene;
  const t0 = performance.now();
  const samples = [];
  const iv = setInterval(() => {
    const ls = s.loadingScreen;
    const visible = ls?.container?.visible ?? ls?._visible ?? null;
    samples.push({ t: Math.round(performance.now()-t0), room: s.currentRoom, loc: !!s._locationImg, loader: visible, ready: s._movieReady });
    if (s.currentRoom === 'igloo' && s._locationImg && !visible) { clearInterval(iv); res(samples.filter((_,i)=>i%3===0).concat(samples.slice(-3))); }
    if (performance.now() - t0 > 30000) { clearInterval(iv); res({timeout:true, samples:samples.slice(-15)}); }
  }, 200);
  s.handleHudButton('igloo');
})
