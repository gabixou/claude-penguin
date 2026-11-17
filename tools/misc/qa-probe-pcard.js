() => new Promise(res => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  (async () => {
    // pet fake so p/ testar a doll com puffle (conta guest nao tem pets)
    s.localPlayer.pet = { petRowId: 1, species: 'puffle_blue', name: 'Teste' };
    s.playerCard.open(s.localPlayer);
    await sleep(3000);
    const out = { cardOpen: !!s.playerCard?.container };
    res(out);
  })();
})
