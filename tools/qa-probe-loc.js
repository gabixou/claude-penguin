() => new Promise(res => {
  const s = window.__penguin.scene;
  if (s.currentRoom !== 'igloo') s.handleHudButton('igloo');
  setTimeout(() => {
    const g = s.game || s.sys?.game;
    const r = g?.renderer;
    if (!r?.snapshot) { res({err:'no snapshot', room:s.currentRoom, loc:!!s._locationImg}); return; }
    r.snapshot(img => {
      const c = document.createElement('canvas'); c.width=img.width; c.height=img.height;
      const x = c.getContext('2d'); x.drawImage(img,0,0);
      const w=c.width,h=c.height;
      const s2=(fx,fy)=>{const p=x.getImageData(Math.floor(w*fx),Math.floor(h*fy),1,1).data;return[p[0],p[1],p[2]]};
      res({room:s.currentRoom, loc:!!s._locationImg, pets:s.iglooPetViews?.size,
           top:s2(.5,.04), skyL:s2(.12,.2), midR:s2(.85,.5), floor:s2(.5,.85)});
    });
  }, 4000);
})
