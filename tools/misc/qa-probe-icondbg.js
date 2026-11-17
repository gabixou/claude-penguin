async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  movie.goto('interface_mc.prompt_mc', 9);
  movie.collectInteractive();
  const out = {};
  for (const n of ['icon_mc','text_input','continue_btn','close_btn']) {
    out[n] = movie.boundsFor();
  }
  // carrega o pack do icone direto
  const { MovieRoom } = await import('/src/movie/movie.js').catch(() => ({}));
  let im = null, err = null;
  try {
    const mod = await import('/src/movie/movie.js');
    im = await mod.MovieRoom.load('/assets/puffle-icons/blue');
  } catch(e) { err = String(e); }
  if (im) {
    const { Clip } = await import('/src/movie/clip.js');
    const c = new Clip(im);
    const entries = im._mainTl?.frames?.[0] || [];
    out.iconEntries = entries.length;
    out.iconBounds = c._boundsOf(entries, {a:1,b:0,c:0,d:1,x:0,y:0}, '');
    out.iconSprites = Object.keys(im.sprites||{});
    out.iconChars = Object.keys(im.characters||{}).slice(0,8);
  } else out.iconErr = err;
  return out;
}
