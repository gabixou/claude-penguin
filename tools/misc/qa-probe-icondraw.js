async () => {
  const s = window.__penguin.scene;
  // importar Clip via modulo nao e trivial; usar o movie do modal? Testar via
  // textura do modal: contar pixels nao-transparentes na regiao do icone.
  const s2 = s.petNameModal;
  if (!s2?.isOpen) { await s2.open('puffle_blue', () => {}); await new Promise(r=>setTimeout(r,1500)); }
  // textura do canvas efemero
  const keys = Object.keys(s.textures.list).filter(k=>k.startsWith('petname_ui_'));
  const tex = s.textures.get(keys[keys.length-1]);
  const img = tex.getSourceImage();
  const c = document.createElement('canvas'); c.width=img.width; c.height=img.height;
  const x = c.getContext('2d'); x.drawImage(img,0,0);
  const d = x.getImageData(0,0,c.width,c.height).data;
  // regiao esperada do icone: mundo ~(381,146) -> px (762,292); area 150x150
  let cnt=0, minx=1e9,miny=1e9,maxx=-1,maxy=-1;
  for(let yy=200;yy<420;yy++)for(let xx=640;xx<900;xx++){
    if(d[(yy*c.width+xx)*4+3]>30){cnt++;if(xx<minx)minx=xx;if(xx>maxx)maxx=xx;if(yy<miny)miny=yy;if(yy>maxy)maxy=yy;}
  }
  return {texKey:keys[keys.length-1], w:img.width,h:img.height, cnt, box:[minx,miny,maxx,maxy], dbg:window.__petnameIconDbg};
}
