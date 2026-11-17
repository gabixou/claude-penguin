async () => {
  const s = window.__penguin.scene;
  const movie = await s.game._interfaceMoviePromise;
  const MR = movie.constructor;
  const im = await MR.load('/assets/puffle-icons/blue');
  const matMul = (p,q)=>({a:p.a*q.a+p.c*q.b,b:p.b*q.a+p.d*q.b,c:p.a*q.c+p.c*q.d,d:p.b*q.c+p.d*q.d,x:p.a*q.x+p.c*q.y+p.x,y:p.b*q.x+p.d*q.y+p.y});
  const arrMat = (m)=>({a:m[0],b:m[1],c:m[2],d:m[3],x:m[4],y:m[5]});
  const ID = {a:1,b:0,c:0,d:1,x:0,y:0};
  const COL = {mult:[1,1,1,1],add:[0,0,0,0]};
  // replica EXATA do modal: goto prompt 9 + collectInteractive
  movie.goto('interface_mc.prompt_mc', 9);
  movie.collectInteractive();
  const node = movie._nodes.get('interface_mc.prompt_mc.icon_mc');
  const w = matMul(node.matrix||ID, arrMat(node.entry?.matrix||ID));
  const entries = im._mainTl.frames[0]||[];
  const bb = im._boundsOfEntries(entries, ID, '');
  const ss = s._ss || 2;
  const s2 = 52/Math.max(1,bb[3]-bb[1]);
  const W = {a:s2,b:0,c:0,d:s2,x:w.x-s2*(bb[0]+bb[2])/2,y:w.y-s2*(bb[1]+bb[3])/2};
  // canvas do tamanho do prompt canvas: WORLD*ss
  const cw=760*ss, ch=480*ss;
  const c=document.createElement('canvas'); c.width=cw; c.height=ch;
  const ctx=c.getContext('2d');
  ctx.setTransform(ss,0,0,ss,0,0);
  await im._drawEntries(ctx, entries, W, '', COL, ss*2, 1);
  // conta pixels na regiao esperada e no canvas todo
  const d=ctx.getImageData(0,0,cw,ch).data;
  let cnt=0,box=[1e9,1e9,-1,-1];
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
    if(d[(y*cw+x)*4+3]>30){cnt++;if(x<box[0])box[0]=x;if(y<box[1])box[1]=y;if(x>box[2])box[2]=x;if(y>box[3])box[3]=y;}
  }
  return {ss, w, W, bb, cnt, box, cw, ch};
}
