const urls = [
  'https://gopenguin.lol/swf/games/fish/timelines.json',
  'https://gopenguin.lol/swf/games/fish/lang/en/title/timelines.json',
  'https://gopenguin.lol/swf/games/fish/lang/en/canoworms/timelines.json',
  'https://gopenguin.lol/swf/games/beans/timelines.json',
  'https://gopenguin.lol/swf/games/sled/timelines.json',
  'https://gopenguin.lol/swf/games/pizzatron/timelines.json',
];
for (const u of urls) {
  try {
    const r = await fetch(u);
    console.log(r.status, u, r.status === 200 ? (await r.text()).length : '');
  } catch (e) { console.log('ERR', u, e.message); }
}
