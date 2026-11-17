() => new Promise(res => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  (async () => {
    const v = [...(s.iglooPetViews?.values()||[])][0];
    if (!v) { res({err:'no pet', room:s.currentRoom}); return; }
    const samples=[];
    v.react('play');
    const t0=performance.now();
    const iv=setInterval(()=>{
      samples.push({t:Math.round(performance.now()-t0), frame:v.frame, care:!!v._care, careTicks:v._care?.ticks, x:Math.round(v.x), y:Math.round(v.y), walking:v.walking});
      if(performance.now()-t0>3500){clearInterval(iv);res(samples.filter((_,i)=>i%4===0).concat(samples.slice(-2)));}
    },200);
  })();
})
