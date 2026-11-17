async () => {
  const s = window.__penguin.scene;
  await s.petNameModal.open('puffle_pink', () => {});
  await new Promise(r=>setTimeout(r,1500));
  return { open: !!s.petNameModal?.isOpen, info: s.petNameModal?.infoText?.text || null };
}
