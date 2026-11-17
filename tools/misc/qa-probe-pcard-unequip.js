async () => {
  const s = window.__penguin.scene;
  const net = s.network;
  if (!net.social.pets) net.social.pets = [];
  const fake = { petRowId: 999003, species: 'puffle_pink', name: 'ProbePet', equipped: true, hunger: 50, happiness: 50, rest: 50 };
  if (!net.social.pets.find(p => p.petRowId === fake.petRowId)) net.social.pets.push(fake); else Object.assign(net.social.pets.find(p=>p.petRowId===999003), {equipped:true});
  s._syncLocalPet();
  await s.playerCard.open(s.localPlayer);
  await new Promise(r => setTimeout(r, 800));
  const pc = s.playerCard;
  const z = pc._puffleZone;
  const info = {
    cardOpen: pc.isOpen,
    hasPet: !!s.localPlayer.pet,
    puffleRect: pc._puffleRect,
    zone: z ? { visible: z.visible, enabled: z.input?.enabled, x: Math.round(z.x), y: Math.round(z.y), w: Math.round(z.width), h: Math.round(z.height) } : null,
  };
  // simula clique na zona
  let sent = null;
  const orig = net.petEquip.bind(net);
  net.petEquip = (id) => { sent = id; };
  if (z && z.input?.enabled) z.emit('pointerdown', { worldX: z.x, worldY: z.y });
  net.petEquip = orig;
  info.equipCall = sent;
  return info;
}
