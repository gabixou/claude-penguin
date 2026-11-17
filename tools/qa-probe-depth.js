async () => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const net = s.network;
  const pets = net?.social?.pets || [];
  // garante um pet equipado
  let equipped = pets.find(p => p.equipped);
  if (!equipped) {
    const cand = pets[0];
    if (cand) { net.petEquip(cand.petRowId); await sleep(1200); }
    equipped = (net.social?.pets || []).find(p => p.equipped) || cand;
  }
  if (!equipped) return { err: 'no pets at all' };
  // espera follower spawnar
  let v = null;
  for (let i = 0; i < 60; i++) {
    await sleep(300);
    v = [...(s.petViews?.values() || [])].find(x => x.pet?.petRowId === equipped.petRowId);
    if (v?._ready) break;
  }
  if (!v) return { err: 'no follower view', equipped };
  const owner = v.owner;
  const out = { petRowId: equipped.petRowId, species: equipped.species, ownerDepth: owner?.depth };
  const depthNow = () => ({ puffle: +v.container.depth.toFixed(3), owner: +(owner?.depth ?? -1).toFixed(3), care: !!v._care, emote: !!v._emoteActive });
  out.before = depthNow();
  // dispara cuidado play (animacao misc que cruza o pinguim)
  net.petCare(equipped.petRowId, 'play');
  await sleep(700); // meio da animacao
  out.during = depthNow();
  // espera acabar (play ~2.5-16s por especie — poll ate _care sumir, cap 20s)
  for (let i = 0; i < 70 && v._care; i++) await sleep(300);
  await sleep(300);
  out.after = depthNow();
  return out;
}
