async () => {
  const { MovieRoom } = await import('/src/movie/movie.js').catch(() => ({}));
  // MovieRoom nao e exportado global — pega via um PuffleView existente ou import dinamico do bundle nao da.
  // Alternativa: instancia via scene se houver pet; senao carrega direto pelo cache interno.
  const s = window.__penguin.scene;
  // forca spawn de um pet igloo p/ acessar movie+clip
  const net = s.network;
  if (!net.social.pets) net.social.pets = [];
  const fake = { petRowId: 999005, species: 'puffle_blue', name: 'B', equipped: false };
  if (!net.social.pets.find(p => p.petRowId === fake.petRowId)) net.social.pets.push(fake);
  if (s.currentRoom !== 'igloo') s._enterIgloo();
  for (let i = 0; i < 120; i++) { s._syncIglooPets(); const v = s.iglooPetViews?.get(999005); if (v?._ready) break; await new Promise(r => setTimeout(r, 100)); }
  const v = s.iglooPetViews?.get(999005);
  if (!v?.movie) return { err: 'no movie' };
  const IDENT = { a:1,b:0,c:0,d:1,x:0,y:0 };
  const out = {};
  const groups = { stand: [1,8], walk: [9,16], misc: [25,36] };
  for (const [g,[a,b2]] of Object.entries(groups)) {
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for (let f=a; f<=b2; f++) {
      const fr = v._main.frames[f-1]; if (!fr) continue;
      const bb = v.clip._boundsOf(fr, IDENT, '');
      if (!bb) continue;
      x0=Math.min(x0,bb[0]);y0=Math.min(y0,bb[1]);x1=Math.max(x1,bb[2]);y1=Math.max(y1,bb[3]);
    }
    out[g] = { x0:+x0.toFixed(1), y0:+y0.toFixed(1), x1:+x1.toFixed(1), y1:+y1.toFixed(1), w:+(x1-x0).toFixed(1), h:+(y1-y0).toFixed(1) };
  }
  out.all = { cx:+v._cx.toFixed(1), fy:+v._fy.toFixed(1), tx:+v._tx.toFixed(1), ty:+v._ty.toFixed(1) };
  // bounds por frame misc individual
  out.miscFrames = {};
  for (let f=25; f<=36; f++) {
    const fr = v._main.frames[f-1]; if (!fr) continue;
    const bb = v.clip._boundsOf(fr, IDENT, '');
    if (bb) out.miscFrames[f] = [+bb[0].toFixed(0),+bb[1].toFixed(0),+bb[2].toFixed(0),+bb[3].toFixed(0)];
  }
  return out;
}
