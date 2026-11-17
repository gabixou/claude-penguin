async () => {
  const s = window.__penguin.scene;
  const net = s.network;
  if (!net.social.pets) net.social.pets = [];
  const fake = { petRowId: 999004, species: 'puffle_blue', name: 'Clip', equipped: false, hunger: 50, happiness: 50, rest: 50 };
  if (!net.social.pets.find(p => p.petRowId === fake.petRowId)) net.social.pets.push(fake);
  if (s.currentRoom !== 'igloo') s._enterIgloo();
  for (let i = 0; i < 120; i++) { s._syncIglooPets(); const v = s.iglooPetViews?.get(999004); if (v?._ready) break; await new Promise(r => setTimeout(r, 100)); }
  const v = s.iglooPetViews?.get(999004);
  if (!v) return { err: 'no view' };
  const edgeStats = () => {
    const { ctx, width: w, height: h } = { ctx: v.ctx, width: v.canvas.width, height: v.canvas.height };
    const d = ctx.getImageData(0, 0, w, h).data;
    let minX = w, maxX = -1, minY = h, maxY = -1, edge = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if (d[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x < 8 || x > w - 9 || y < 8 || y > h - 9) edge++;
      }
    }
    return { w, h, minX, maxX, minY, maxY, edgePx: edge };
  };
  const out = {};
  for (const act of ['play', 'eat', 'rest', 'bath']) {
    v.react(act);
    let worst = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250));
      const st = edgeStats();
      if (!worst || st.edgePx > worst.edgePx) worst = st;
      if (!v._care) break;
    }
    out[act] = worst;
    // espera acabar antes da proxima
    while (v._care) await new Promise(r => setTimeout(r, 300));
  }
  return out;
}
