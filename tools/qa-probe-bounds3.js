async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  if (!movie._warmed) { movie.warmPlayheads?.(); }
  await movie.ensureFonts?.();
  // sequencia EXATA do PetNameModal._build
  movie.goto('interface_mc.prompt_mc', 9);
  movie.set('interface_mc.prompt_mc.block_mc', { visible: false });
  movie.set('interface_mc.prompt_mc.message_txt', { text: '' });
  movie.set('interface_mc.prompt_mc.continue_txt', { text: 'Continue' });
  movie.collectInteractive();
  const out = {};
  for (const n of ['continue_btn','close_btn','text_input','icon_mc']) {
    out[n] = movie.boundsFor();
  }
  return out;
}
