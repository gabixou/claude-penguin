async () => {
  // clica "Next"/"Done"/"Start" do tutorial do gopenguin ate sumir
  for (let i = 0; i < 10; i++) {
    const btns = [...document.querySelectorAll('button, div, span, a')];
    const b = btns.find(el => /^(next|done|start|got it|ok)$/i.test((el.textContent||'').trim()) && el.offsetParent);
    if (!b) break;
    b.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    await new Promise(r=>setTimeout(r,700));
  }
  await new Promise(r=>setTimeout(r,3000));
  return { title: document.title, url: location.href };
}
