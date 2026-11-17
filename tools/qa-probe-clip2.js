() => new Promise(res => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const measure = (canvas) => {
    const ctx = canvas.getContext('2d');
    const d = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let top=1e9,bot=-1,left=1e9,right=-1,n=0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const a=d[(y*canvas.width+x)*4+3];if(a>10){n++;if(y<top)top=y;if(y>bot)bot=y;if(x<left)left=x;if(x>right)right=x;}}
    return n?{top,bot,h:bot-top+1,left,right,w:right-left+1,n,edge:{t:top===0,b:bot===canvas.height-1,l:left===0,r:right===canvas.width-1}}:{empty:true};
  };
  (async () => {
    const out = {};
    // pinguim: idle vs dance
    const p = s.localPlayer;
    p.setAction(1); await sleep(400);
    out.penguinIdle = measure(p._canvas);
    p.playEmote('dance'); await sleep(700);
    out.penguinDance = measure(p._canvas);
    p.playEmote('wave'); await sleep(500);
    out.penguinWave = measure(p._canvas);
    p.stand();
    // puffle no iglu
    if (s.currentRoom !== 'igloo') s.handleHudButton('igloo');
    await sleep(4000);
    s.network.social = s.network.social || {};
    s.network.social.pets = [{ petRowId: 77, species: 'puffle_blue', name: 'Clip', equipped: false }];
    s._syncIglooPets();
    await sleep(3000);
    const v = [...(s.iglooPetViews?.values()||[])][0];
    if (v) {
      out.puffleIdle = measure(v.canvas);
      v.react('play');
      await sleep(400);
      out.pufflePlay = measure(v.canvas);
      // alinhamento pes: mundo-y do fundo opaco dos dois
      const pFeet = p.y + p._lib.bounds.y0 + (out.penguinIdle.bot/ (p._canvas.height/p._lib.viewH ));
      // puffle: img displayH e frac do canvas
      const img = v.img;
      const dispH = img.displayHeight, dispW = img.displayWidth;
      const feetFrac = (v.canvas.height-10)/v.canvas.height;
      out.puffleFeetWorld = v.y + img.y + (feetFrac-0.5)*dispH;
      out.penguinFeetWorld = pFeet;
      out.puffleScaleCheck = {dispW, dispH};
    }
    res(out);
  })();
})
