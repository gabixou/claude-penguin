async () => {
  const s = window.__penguin.scene;
  const pets = s.network?.social?.pets || [];
  const green = pets.find(p=>p.species==='puffle_green' && !p.equipped);
  if (!green) return {err:'no green', pets:pets.map(p=>p.petRowId+':'+p.species)};
  s._enterIgloo();
  for (let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,500)); if(s.currentRoom==='igloo'&&s.movie)break; }
  let v=null;
  for (let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,400)); v=[...(s.iglooPetViews?.values()||[])].find(x=>x.pet?.petRowId===green.petRowId); if(v?._ready)break; }
  if(!v) return {err:'no view', igloo:[...(s.iglooPetViews?.keys()||[])]};
  await new Promise(r=>setTimeout(r,800));
  const results={};
  for (const act of ['cookie','bath','eat','play']) {
    // espera care anterior acabar
    for(let i=0;i<40 && v._care;i++) await new Promise(r=>setTimeout(r,500));
    const t0=Date.now();
    s.network.petCare(green.petRowId, act);
    let firstWalk=null, careEnd=null;
    for(let i=0;i<60;i++){
      await new Promise(r=>setTimeout(r,250));
      const el=(Date.now()-t0)/1000;
      if(v._care && careEnd===null && el>0.3){ /* still caring */ }
      if(v.walking && firstWalk===null) firstWalk=el;
      if(!v._care && careEnd===null) careEnd=el;
      if(firstWalk!==null && careEnd!==null) break;
      if(el>25) break;
    }
    results[act]={firstWalkMs: firstWalk&&Math.round(firstWalk*1000), careEndMs: careEnd&&Math.round(careEnd*1000), maxTicks: v._care? 'n/a':'done'};
  }
  return {species:green.species, petRowId:green.petRowId, results};
}
