() => new Promise(res => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  (async () => {
    const v = [...(s.iglooPetViews?.values()||[])][0];
    if (!v) { res({err:'no pet', room:s.currentRoom}); return; }
    await sleep(1500);
    const rows = [];
    const ctx = v.canvas.getContext('2d');
    const d = ctx.getImageData(0,0,v.canvas.width,v.canvas.height).data;
    for(let y=0;y<v.canvas.height;y+=8){let n=0;for(let x=0;x<v.canvas.width;x++)if(d[(y*v.canvas.width+x)*4+3]>10)n++;rows.push(n);}
    res({ frame:v.frame, walking:v.walking, dir:v.dir, ready:v._ready, _fy:v._fy, _ty:v._ty, _tx:v._tx, _cx:v._cx, rows });
  })();
})
