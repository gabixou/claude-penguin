const urls = [
  'https://gopenguin.lol/swf/games/fish/IceFishing/timelines.json',
  'https://gopenguin.lol/swf/games/fish/lang/en/title/chars/',
  'https://gopenguin.lol/swf/games/beans/',
];
for (const u of urls) {
  try {
    const r = await fetch(u);
    const t = r.status === 200 ? (await r.text()).slice(0, 200) : '';
    console.log(r.status, u, '\n ', t.replace(/\n/g,' ').slice(0,150));
  } catch (e) { console.log('ERR', u, e.message); }
}
