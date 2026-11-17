() => new Promise(res => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  (async () => {
    s.localPlayer.pet = { petRowId: 1, species: 'puffle_blue', name: 'Teste' };
    s.playerCard.open(s.localPlayer);
    for (let i=0;i<20;i++){ await sleep(500); if (s.playerCard?.container) break; }
    res({ cardOpen: !!s.playerCard?.container });
  })();
})
