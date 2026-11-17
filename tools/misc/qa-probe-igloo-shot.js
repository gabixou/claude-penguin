async () => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pets = s.network?.social?.pets || [];
  const green = pets.find(p => p.species === 'puffle_green' && !p.equipped);
  if (!green) return { err: 'no green pet' };
  s._enterIgloo();
  for (let i = 0; i < 80; i++) { await sleep(500); if (s.currentRoom === 'igloo' && s.movie) break; }
  let v = null;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    v = [...(s.iglooPetViews?.values() || [])].find(x => x.pet?.petRowId === green.petRowId);
    if (v?._ready) break;
  }
  if (!v) return { err: 'no view' };
  await sleep(800);
  for (let i = 0; i < 60 && v._care; i++) await sleep(400);
  // bath = animacao mais longa (278 frames ~11.6s) — screenshot no meio
  s.network.petCare(green.petRowId, 'bath');
  await sleep(5500);
  return { careActive: !!v._care, frame: v.frame, x: Math.round(v.x), y: Math.round(v.y), walking: v.walking };
}
