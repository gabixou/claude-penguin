async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  const MR = movie.constructor;
  const im = await MR.load('/assets/puffle-icons/blue');
  const out = { loaded: !!im };
  if (im) {
    const entries = im._mainTl?.frames?.[0] || [];
    out.n = entries.length;
    // desenha num canvas de teste com _drawEntries (mesmo pipeline do modal)
    const c = document.createElement('canvas'); c.width = 400; c.height = 400;
    const ctx = c.getContext('2d');
    const ID = {a:1,b:0,c:0,d:1,x:0,y:0};
    const COL = {mult:[1,1,1,1],add:[0,0,0,0]};
    // bounds do conteudo
    const bb = im._boundsOfEntries ? im._boundsOfEntries(entries, ID, '') : null;
    out.bb = bb;
    let b = bb || [-24,-20,24,25];
    const sc = 300/Math.max(b[2]-b[0], b[3]-b[1]);
    const W = {a:sc,b:0,c:0,d:sc, x:200-sc*(b[0]+b[2])/2, y:200-sc*(b[1]+b[3])/2};
    try {
      await im._drawEntries(ctx, entries, W, '', COL, 4, 1);
      out.drawn = true;
    } catch(e) { out.err = String(e.stack||e); }
    const d = ctx.getImageData(0,0,400,400).data;
    let cnt=0; for(let i=3;i<d.length;i+=4) if(d[i]>30) cnt++;
    out.opaquePx = cnt;
    out.dataUrl = cnt>100 ? c.toDataURL('image/png') : null;
  }
  return out;
}
