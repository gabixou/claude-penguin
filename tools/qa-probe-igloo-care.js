async () => {
  const s = window.__penguin.scene;
  const net = s.network;
  if (!net.social.pets) net.social.pets = [];
  const fake = { petRowId: 999002, species: 'puffle_blue', name: 'Probe', equipped: false, hunger: 50, happiness: 50, rest: 50 };
  if (!net.social.pets.find(p => p.petRowId === fake.petRowId)) net.social.pets.push(fake);
  if (s.currentRoom !== 'igloo') s._enterIgloo();
  for (let i = 0; i < 120; i++) { s._syncIglooPets(); if (s.iglooPetViews?.has(999002)?. _ready) break; await new Promise(r => setTimeout(r, 100)); }
  const v = s.iglooPetViews?.get(999002);
  if (!v) return { err: 'no view' };
  s.events.emit('player-pet-care', { playerId: net.playerId, petRowId: 999002, action: 'eat' });
  // come amostra ate o cuidado acabar (eat/blue = 145 ticks ~6s)
  const t0 = Date.now();
  let careEnd = null, maxSeen = 0;
  while (Date.now() - t0 < 15000) {
    await new Promise(r => setTimeout(r, 200));
    if (v._care) maxSeen = Math.max(maxSeen, v._care.acc);
    if (!v._care && Date.now() - t0 > 500) { careEnd = Date.now() - t0; break; }
  }
  // apos terminar, anda de novo?
  let movedAfter = null; const x0 = v.x, y0 = v.y;
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 100)); if (Math.hypot(v.x - x0, v.y - y0) > 8) { movedAfter = i * 100; break; } }
  return { careMaxTicks: +maxSeen.toFixed(1), careDurationMs: careEnd, movedAfterCareMs: movedAfter, expectedTicks: 145 };
}
