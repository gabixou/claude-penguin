() => {
  const s = window.__penguin.scene;
  const stub = { owner: s.localPlayer, _ready: true, x: 400, y: 300, pet: {petRowId:9,species:'puffle_pink'} };
  s.petViews.set('stub', stub);
  const r1 = { followerOwner: s._petFollowerAt(400, 290) === s.localPlayer,
               iglooPet: !!s._iglooPetAt(400, 290) };
  s.petViews.delete('stub');
  // no igloo: pet follower nao pode abrir puffle card
  s.iglooPetViews.set(9, { _ready:true, x:400, y:300, pet:{petRowId:9} });
  const r2 = { iglooHitInTown: !!s._iglooPetAt(400,290) };
  s.iglooPetViews.clear();
  return { room: s.currentRoom, ...r1, ...r2 };
}
