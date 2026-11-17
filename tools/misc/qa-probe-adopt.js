async () => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const species = s.network?.social?.petSpecies || [];
  s.openContent('adopt_catalogue');
  for (let i=0;i<60;i++){ await sleep(400); if(s.catalogue?._ready && s.catalogue.key==='adopt') break; }
  const cat = s.catalogue;
  if (!cat || cat.key !== 'adopt') return {err:'catalogue not open'};
  let adopt = null, pages = 0;
  for (let p=0;p<12 && !adopt;p++){
    adopt = (cat.controls||[]).find(c=>/adopt/i.test(c.label||''));
    if (adopt) break;
    const next = (cat.controls||[]).find(c=>/next page/i.test(c.label||''));
    if (!next) break;
    next.action(); await sleep(700); pages++;
  }
  if (!adopt) return {err:'no adopt control after '+pages+' pages', labels:(cat.controls||[]).map(c=>c.label)};
  adopt.action();
  await sleep(900);
  return { speciesCosts: species.map(x=>x.name+'='+x.cost), clicked: adopt.label, pages };
}
