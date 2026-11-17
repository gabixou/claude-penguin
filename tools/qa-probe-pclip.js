() => new Promise(res => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  (async () => {
    if (s.currentRoom !== 'igloo') s.handleHudButton('igloo');
    await sleep(4000);
    // pet fake no estado social -> _syncIglooPets cria PuffleView real
    s.network.social = s.network.social || {};
    s.network.social.pets = [{ petRowId: 77, species: 'puffle_blue', name: 'Clip', equipped: false }];
    s._syncIglooPets();
    await sleep(2500);
    const v = [...(s.iglooPetViews?.values()||[])][0];
    if (!v) { res({err:'no pet view'}); return; }
    v.react('play');
    await sleep(600);
    // mede pixels do canvas do puffle: conteudo encosta no topo?
    const ctx = v.canvas.getContext('2d');
    const d = ctx.getImageData(0,0,v.canvas.width,v.canvas.height).data;
    let top=-1, bot=-1, left=-1, right=-1;
    for(let y=0;y<v.canvas.height;y++)for(let x=0;x<v.canvas.width;x++){const a=d[(y*v.canvas.width+x)*4+3];if(a>10){if(top<0)top=y;bot=y;if(left<0||x<left)left=x;if(x>right)right=x;}}
    res({ canvas:[v.canvas.width,v.canvas.height], top, bot, left, right, margins:{top, bottom:v.canvas.height-1-bot, left, right:v.canvas.width-1-right}, ready:v._ready });
  })();
})
