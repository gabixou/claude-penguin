async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  const MR = movie.constructor;
  // Clip nao esta exposto; _boundsOfEntries do MovieRoom faz o mesmo calculo
  const IDENT = {a:1,b:0,c:0,d:1,x:0,y:0};
  const out = {};
  for (const d of ['blue','red','black','green','pink']) {
    const m = await MR.load('/assets/puffle/' + d);
    if (!m) { out[d] = null; continue; }
    const frames = m._mainTl.frames;
    const bAll = m._boundsOfEntries(frames.flat(), IDENT, '');
    const bStand = m._boundsOfEntries(frames.slice(0, 8).flat(), IDENT, '');
    const bWalk = m._boundsOfEntries(frames.slice(8, 16).flat(), IDENT, '');
    out[d] = {
      all: bAll && bAll.map(v=>+v.toFixed(1)),
      stand: bStand && bStand.map(v=>+v.toFixed(1)),
      walk: bWalk && bWalk.map(v=>+v.toFixed(1)),
    };
  }
  return out;
}
