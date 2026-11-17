async () => {
  const s = window.__penguin.scene;
  // entra no iglu
  s._enterIgloo();
  for (let i=0;i<60;i++){ await new Promise(r=>setTimeout(r,500)); if(s.currentRoom==='igloo'&&s.movie)break; }
  // injeta pet fake nao equipado
  const pet = { petRowId: 999777, species: 'puffle_blue', name: 'Test', hunger:50, happiness:50, rest:50, equipped:0 };
  s.network.social = s.network.social || {};
  s.network.social.pets = [pet];
  s._syncIglooPets();
  let v=null;
  for (let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,400)); v=s.iglooPetViews?.get(999777); if(v?._ready)break; }
  if(!v) return {err:'no view', room:s.currentRoom};
  // força estado: anda pra algum lugar primeiro
  await new Promise(r=>setTimeout(r,1500));
  const samples=[];
  v.react('eat');
  const t0=Date.now();
  for(let i=0;i<20;i++){
    await new Promise(r=>setTimeout(r,500));
    samples.push({
      t:((Date.now()-t0)/1000).toFixed(1),
      care: v._care? (v._care.acc/v._care.max).toFixed(2) : null,
      walking: v.walking, frame: v.frame,
      pos: Math.round(v.x)+','+Math.round(v.y),
    });
  }
  return { room: s.currentRoom, species: v.pet.species, samples };
}
