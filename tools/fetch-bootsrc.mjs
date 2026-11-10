const r = await fetch('http://localhost:3000/src/scenes/BootScene.js');
const t = await r.text();
console.log('status', r.status, 'len', t.length);
const m = t.match(/delayedCall\((\d+)/g);
console.log(m);
console.log(t.includes('logo.svg') ? 'has logo.svg' : 'NO logo.svg');
