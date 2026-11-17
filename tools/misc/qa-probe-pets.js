() => {
  const s = window.__penguin.scene;
  const pets = s.network?.social?.pets || [];
  return {
    room: s.currentRoom,
    playerId: s.network?.playerId,
    pets: pets.map(p => ({ id: p.petRowId, sp: p.species, eq: p.equipped, name: p.name })),
    iglooPets: s.iglooPetViews ? [...s.iglooPetViews.keys()] : null,
    petViews: s.petViews ? [...s.petViews.keys()] : null,
  };
}
