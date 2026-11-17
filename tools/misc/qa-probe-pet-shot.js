async () => {
  const s = window.__penguin.scene;
  const net = s.network;
  if (!net.social.pets) net.social.pets = [];
  const fake = { petRowId: 999006, species: 'puffle_blue', name: 'Shot', equipped: true, hunger: 50, happiness: 50, rest: 50 };
  if (!net.social.pets.find(p => p.petRowId === fake.petRowId)) net.social.pets.push(fake);
  s._syncLocalPet();
  await new Promise(r => setTimeout(r, 2500)); // puffle spawn + movie load + draw
  const v = s.petViews?.get(s.network.playerId);
  return { room: s.currentRoom, petView: !!v, ready: v?._ready, frame: v?.frame, x: Math.round(v?.x||0), y: Math.round(v?.y||0) };
}
