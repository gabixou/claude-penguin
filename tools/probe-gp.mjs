const names = ['icefishing','ice_fishing','fishing','fish','ice','beans','sled','pizzatron','roundup','thinice','astro','fire','hydro'];
for (const n of names) {
  try {
    const r = await fetch('https://gopenguin.lol/swf/' + n + '/timelines.json');
    const t = r.status === 200 ? (await r.text()).length : '';
    console.log(n, r.status, t);
  } catch(e) { console.log(n, 'ERR', e.message); }
}
