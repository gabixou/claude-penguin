async () => {
  const s = window.__penguin.scene;
  await s.petNameModal.open('puffle_blue', () => {});
  await new Promise(r=>setTimeout(r,1500));
  const keys = Object.keys(s.textures.list).filter(k=>k.startsWith('petname_ui_'));
  const tex = s.textures.get(keys[keys.length-1]);
  const img = tex.getSourceImage();
  const c = document.createElement('canvas'); c.width=600; c.height=480;
  const x = c.getContext('2d');
  x.fillStyle='#336699'; x.fillRect(0,0,600,480);
  x.imageSmoothingEnabled=false;
  x.drawImage(img, 757, 235, 200, 160, 0, 0, 600, 480);
  return {url: c.toDataURL('image/png'), w: img.width, h: img.height, dbg: window.__petnameIconDbg};
}
