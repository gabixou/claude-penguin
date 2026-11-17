async () => {
  const s = window.__penguin.scene;
  s.petNameModal.open('puffle_blue', () => {});
  for (let i = 0; i < 60 && !s.petNameModal.isOpen; i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 800));
  return { open: s.petNameModal.isOpen, dbg: window.__petnameIconDbg };
}
