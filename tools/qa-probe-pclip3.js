() => new Promise(res => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  (async () => {
    if (s.currentRoom !== 'igloo') s.handleHudButton('igloo');
    await sleep(4000);
    s.network.social = s.network.social || {};
    s.network.social.pets = [{ petRowId: 77, species: 'puffle_blue', name: 'Clip', equipped: false }];
    s._syncIglooPets();
    await sleep(3000);
    const v = [...(s.iglooPetViews?.values()||[])][0];
    if (!v) { res({err:'no pet'}); return; }
    const measure = () => {
      const ctx = v.canvas.getContext('2d');
      const d = ctx.getImageData(0,0,v.canvas.width,v.canvas.height).data;
      let top=1e9,bot=-1,left=1e9,right=-1,n=0;
      for(let y=0;y<v.canvas.height;y++)for(let x=0;x<v.canvas.width;x++){const a=d[(y*v.canvas.width+x)*4+3];if(a>10){n++;if(y<top)top=y;if(y>bot)bot=y;if(x<left)left=x;if(x>right)right=x;}}
      return n?{top,bot,h:bot-top+1,left,right,w:right-left+1,n}:{empty:true};
    };
    const idle = measure();
    v.react('play');
    const plays = [];
    for (let i=0;i<6;i++){ await sleep(350); plays.push({f:v.frame, ...measure()}); }
    res({ idle, plays });
  })();
})
