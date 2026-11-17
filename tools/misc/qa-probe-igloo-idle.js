async () => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  s._enterIgloo();
  for (let i = 0; i < 80; i++) { await sleep(500); if (s.currentRoom === 'igloo' && s.movie) break; }
  // espera pets ficarem prontos
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    const vs = [...(s.iglooPetViews?.values() || []), ...(s.petViews?.values() || [])];
    if (vs.length && vs.every(v => v._ready)) break;
  }
  await sleep(2500); // deixa vagar um pouco
  return { room: s.currentRoom, pets: (s.iglooPetViews?.size || 0) + (s.petViews?.size || 0) };
}
