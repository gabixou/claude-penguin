async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  if (!movie._warmed) { movie.warmPlayheads?.(); }
  await movie.ensureFonts?.();
  const P = 'interface_mc.prompt_mc';
  movie.goto(P, 9);
  movie.set(P + '.block_mc', { visible: false });
  movie.set(P + '.message_txt', { text: '' });
  movie.set(P + '.continue_txt', { text: 'Continue' });
  movie.collectInteractive();
  const out = {};
  for (const n of ['continue_btn','close_btn','text_input','icon_mc']) {
    out[n] = movie.boundsFor(P + '.' + n);
  }
  return out;
}
