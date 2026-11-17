async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  if (!movie._warmed) { movie.warmPlayheads?.(); }
  await movie.ensureFonts?.();
  movie.goto('interface_mc.prompt_mc', 9);
  movie.set('interface_mc.prompt_mc.block_mc', { visible: false });
  movie.set('interface_mc.prompt_mc.message_txt', { text: '' });
  movie.set('interface_mc.prompt_mc.continue_txt', { text: 'Continue' });
  movie.collectInteractive();
  const out = {};
  for (const n of ['icon_mc','text_input','continue_btn','close_btn','yes_btn','message_txt','continue_txt']) {
    out[n] = movie.boundsFor();
  }
  // lista nodes que contenham 'icon' ou 'prompt'
  out.nodesSample = [...(movie._nodes?.keys()||[])].filter(k=>/icon|prompt|text_input|continue/.test(k)).slice(0,30);
  return out;
}
