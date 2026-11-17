async () => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const pets = s.network?.social?.pets || [];
  const eq = pets.find(p=>p.equipped) || pets[0];
  if (eq && !pets.find(p=>p.equipped)) { s.network.petEquip(eq.petRowId); await sleep(1500); }
  let v=null;
  for(let i=0;i<60;i++){ await sleep(300); v=[...(s.petViews?.values()||[])].find(x=>x.pet?.petRowId===eq.petRowId); if(v?._ready)break; }
  if(!v) return {err:'no follower'};
  const list = s.children.list;
  const idx = (o)=>list.indexOf(o);
  const out={puffleIdx:idx(v.container), ownerIdx:idx(v.owner), ownerDepth:v.owner?.depth, puffleDepth:v.container.depth};
  s.network.petCare(v.pet.petRowId,'play');
  await sleep(1500);
  out.during={puffleIdx:idx(v.container), ownerIdx:idx(v.owner), puffleDepth:+v.container.depth.toFixed(2), ownerDepth:+v.owner.depth.toFixed(2)};
  // quem mais esta entre os dois na display list?
  const lo=Math.min(out.during.puffleIdx,out.during.ownerIdx), hi=Math.max(out.during.puffleIdx,out.during.ownerIdx);
  out.between=list.slice(lo,hi+1).map(o=>({t:o.type,d:+(o.depth??-1).toFixed(2)}));
  return out;
}
