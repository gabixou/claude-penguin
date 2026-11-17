async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  if (!movie._warmed) { movie.warmPlayheads?.(); }
  await movie.ensureFonts?.();
  const out = {};
  out.gotoRet = movie.goto('interface_mc.prompt_mc', 9);
  out.promptFrame = movie.currentFrame('interface_mc.prompt_mc');
  out.playheadKeys = [...(movie._playheads?.keys()||[])].filter(k=>/prompt|interface/.test(k));
  movie.collectInteractive();
  out.nodeKeys = [...(movie._nodes?.keys()||[])].filter(k=>/prompt/.test(k));
  // interface_mc sprite: quantos frames e qual frame o playhead resolveu
  const imEntry = (movie._mainTl.frames[movie._mainFrame-1]||[]).find(e=>e.name==='interface_mc');
  const imSp = imEntry && movie.sprites?.[String(imEntry.id)];
  out.imFrames = imSp?.frames?.length;
  out.imLabels = imSp?.labels;
  const h = movie._playhead('interface_mc', String(imEntry?.id));
  out.imPlayheadFrame = h?.frame;
  // frame do playhead contem prompt_mc?
  const fr = h ? (imSp.frames[h.frame-1]||[]) : [];
  out.imFrameHasPrompt = fr.some(e=>e.name==='prompt_mc');
  const fr0 = imSp?.frames?.[0]||[];
  out.imFrame0HasPrompt = fr0.some(e=>e.name==='prompt_mc');
  return out;
}
