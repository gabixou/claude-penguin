async () => {
  const s = window.__penguin.scene;
  await s.petNameModal.open('puffle_blue', () => {});
  await new Promise(r => setTimeout(r, 800));
  const dbg = window.__petnameIconDbg || null;
  const open = !!s.petNameModal?.isOpen;
  const info = s.petNameModal?.infoText?.text || null;
  return { open, info, dbg };
}
