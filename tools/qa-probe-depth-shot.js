async () => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const net = s.network;
  const pets = net?.social?.pets || [];
  const equipped = pets.find(p => p.equipped) || pets[0];
  if (!equipped) return { err: 'no pets' };
  if (!pets.find(p => p.equipped)) { net.petEquip(equipped.petRowId); await sleep(1500); }
  let v = null;
  for (let i = 0; i < 60; i++) {
    await sleep(300);
    v = [...(s.petViews?.values() || [])].find(x => x.pet?.petRowId === equipped.petRowId);
    if (v?._ready) break;
  }
  if (!v) return { err: 'no follower' };
  net.petCare(equipped.petRowId, 'play');
  await sleep(4500); // meio da animacao de play (black=231f ~9.6s)
  return { care: !!v._care, puffleDepth: v.container.depth, ownerDepth: v.owner?.depth, pos: [Math.round(v.x), Math.round(v.y)] };
}
