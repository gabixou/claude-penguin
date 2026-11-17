async () => {
  const s = window.__penguin.scene;
  const card = s.puffleCard;
  for (let i=0;i<30 && !card._ready;i++) await new Promise(r=>setTimeout(r,500));
  const pet = { petRowId: 999001, species: 'puffle_blue', name: 'Blob', hunger: 80, happiness: 80, rest: 80, equipped: 0 };
  s.network.social = s.network.social || {};
  s.network.social.pets = [pet];
  card.open(pet);
  await new Promise(r=>setTimeout(r,1000));
  const before = { ready: card._ready, pet: card.pet?.petRowId, visible: card.container?.visible };
  s.events.emit('net-error', { code: 'CARE_COOLDOWN', message: 'x' });
  await new Promise(r=>setTimeout(r,300));
  return { before, statusVisible: card.statusText?.visible, statusText: card.statusText?.text };
}
