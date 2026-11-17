async () => {
  const s = window.__penguin.scene;
  const pets = s.network?.social?.pets || [];
  const pet = pets.find(p=>!p.equipped) || pets[0];
  if (!pet) return {err:'no pets', user: s.network?.username};
  s._enterIgloo();
  for (let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,500)); if(s.currentRoom==='igloo'&&s.movie)break; }
  let v=null;
  for (let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,400)); v=[...(s.iglooPetViews?.values()||[])].find(x=>x.pet?.petRowId===pet.petRowId); if(v?._ready)break; }
  if(!v) return {err:'no igloo view', room:s.currentRoom, petRowId:pet.petRowId, user:s.network?.username, iglooViews:[...(s.iglooPetViews?.keys()||[])]};
  await new Promise(r=>setTimeout(r,1200));
  // caminho REAL: petCare via rede
  s.network.petCare(pet.petRowId, 'eat');
  const t0=Date.now();
  const samples=[];
  for(let i=0;i<18;i++){
    await new Promise(r=>setTimeout(r,500));
    samples.push({t:((Date.now()-t0)/1000).toFixed(1),
      care: v._care? (v._care.acc/v._care.max).toFixed(2):null,
      walking:v.walking, frame:v.frame, pos:Math.round(v.x)+','+Math.round(v.y)});
  }
  return {user:s.network?.username, species:pet.species, petRowId:pet.petRowId, samples};
}
