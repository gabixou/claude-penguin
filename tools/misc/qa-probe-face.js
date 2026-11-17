() => {
  const s = window.__penguin.scene;
  const p = s.localPlayer;
  const r = {};
  p.x = 380; p.y = 320; p.isMoving = false;
  // idle em pe: deve girar
  p.setAction(1);
  p.facePoint(600, 320); // mouse a direita
  r.idleDir = p.direction;
  // sentado: NAO deve girar
  p.sit();
  const sitDir = p.direction, sitAction = p.action;
  p.facePoint(100, 100); // mouse em outra direcao
  r.sitFrozen = p.direction === sitDir && p.action === sitDir + 16;
  // dance: nao gira
  p.playEmote('dance');
  const d0 = p.direction;
  p.facePoint(600, 320);
  r.danceFrozen = p.direction === d0;
  // levanta e volta idle: gira de novo
  p.stand(); p.setAction(1);
  p.facePoint(100, 450);
  r.standRotates = p.direction !== 1 || p.action === p.direction;
  return r;
}
