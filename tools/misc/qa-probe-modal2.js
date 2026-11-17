async () => {
  const s = window.__penguin.scene;
  window.__errs = [];
  window.addEventListener('unhandledrejection', e => window.__errs.push(String(e.reason?.stack || e.reason)));
  window.addEventListener('error', e => window.__errs.push(String(e.message)));
  const p = s.petNameModal.open('puffle_blue', () => {});
  await p;
  await new Promise(r => setTimeout(r, 2500));
  return {
    open: !!s.petNameModal?.isOpen,
    dbg: window.__petnameIconDbg || null,
    errs: window.__errs.slice(0, 5),
    active: s.sys.isActive(),
  };
}
