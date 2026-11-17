async () => {
  const s = window.__penguin.scene;
  const lp = s.localPlayer;
  // estado inicial: pink equipado
  lp.pet = { petRowId: 1, species: 'puffle_pink', name: 'Pink' };
  s._syncPetView(lp);
  await new Promise(r => setTimeout(r, 300));
  const v1 = s.petViews.get(lp.playerId);
  const before = { species: v1?.pet?.species, color: v1?.color, dead: v1?._dead };
  // swap: blue equipado (server ja desequipou pink)
  lp.pet = { petRowId: 2, species: 'puffle_blue', name: 'Blue' };
  s._syncPetView(lp);
  await new Promise(r => setTimeout(r, 300));
  const v2 = s.petViews.get(lp.playerId);
  return {
    before,
    after: { species: v2?.pet?.species, color: v2?.color, sameView: v1 === v2, dead: v2?._dead },
  };
}
