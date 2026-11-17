async () => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  // garante town (login Arenovisk ja cai em town, mas confirma)
  if (s.currentRoom !== 'town') { s._changeRoom?.('town'); }
  await sleep(4000);
  return { room: s.currentRoom, ready: s._playerReady };
}
