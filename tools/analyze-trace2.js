// Analise profunda do trace: self-time por funcao, long tasks, network.
const fs = require('fs');
const file = process.argv[2];
const trace = JSON.parse(fs.readFileSync(file, 'utf8'));
const ev = trace.traceEvents || [];

// ---- 1. Self time por evento X (complete) no thread renderer/main ----
// conta duracao por (name + args.functionName ou url curta)
const selfTime = new Map();
const longTasks = [];
const t0 = Math.min(...ev.filter(e => e.ts !== undefined).map(e => e.ts));
const t1 = Math.max(...ev.filter(e => e.ts !== undefined && e.dur).map(e => e.ts + e.dur));
console.log('trace span s:', ((t1 - t0) / 1e6).toFixed(1));

for (const e of ev) {
  if (e.ph !== 'X' || !e.dur) continue;
  const dur = e.dur / 1000; // ms
  let key = e.name;
  const fn = e.args && (e.args.functionName || e.args.data?.functionName);
  const url = e.args && (e.args.url || e.args.data?.url);
  if (fn) key += ' ::' + fn;
  else if (url) key += ' ::' + String(url).slice(0, 90);
  selfTime.set(key, (selfTime.get(key) || 0) + dur);
  if (e.name === 'RunTask' && dur > 80) {
    longTasks.push({ t: ((e.ts - t0) / 1e6).toFixed(1), dur: dur.toFixed(0), tid: e.tid });
  }
}

console.log('\n--- top 40 self-time (ms) ---');
[...selfTime.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
  .forEach(([k, v]) => console.log(v.toFixed(0).padStart(8), k.slice(0, 140)));

console.log('\n--- long tasks >80ms (top 30) ---');
longTasks.sort((a, b) => b.dur - a.dur).slice(0, 30)
  .forEach(l => console.log(l.t.padStart(8) + 's', l.dur.padStart(7) + 'ms', 'tid', l.tid));
console.log('total long tasks:', longTasks.length);

// ---- 2. Network: ResourceSendRequest/ReceiveResponse/Finish ----
const reqs = new Map();
for (const e of ev) {
  if (e.name === 'ResourceSendRequest') {
    const u = e.args?.data?.url || e.args?.url;
    if (u) reqs.set(e.args?.data?.requestId || e.id, { url: u, send: e.ts });
  } else if (e.name === 'ResourceReceiveResponse') {
    const id = e.args?.data?.requestId || e.id;
    const r = reqs.get(id); if (r) { r.resp = e.ts; r.status = e.args?.data?.statusCode; r.mime = e.args?.data?.mimeType; }
  } else if (e.name === 'ResourceFinish') {
    const id = e.args?.data?.requestId || e.id;
    const r = reqs.get(id); if (r) { r.end = e.ts; r.enc = e.args?.data?.encodedDataLength; r.dec = e.args?.data?.decodedBodyLength; }
  }
}
const list = [...reqs.values()].filter(r => r.url && !r.url.startsWith('data:'));
console.log('\n--- requests:', list.length, '---');
// agrega por origem+path base
const agg = new Map();
for (const r of list) {
  try {
    const u = new URL(r.url);
    const key = u.origin + u.pathname.split('/').slice(0, 4).join('/');
    const a = agg.get(key) || { n: 0, bytes: 0, total: 0 };
    a.n++; a.bytes += (r.dec || r.enc || 0); a.total += ((r.end || 0) - (r.send || 0)) / 1000;
    agg.set(key, a);
  } catch {}
}
[...agg.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 35)
  .forEach(([k, a]) => console.log((a.bytes / 1048576).toFixed(1).padStart(8) + 'MB', String(a.n).padStart(5), 'x', a.total.toFixed(0).padStart(7) + 'ms', k.slice(0, 110)));

// maiores requests individuais
console.log('\n--- top 20 maiores requests (decoded bytes) ---');
list.filter(r => r.dec).sort((a, b) => b.dec - a.dec).slice(0, 20)
  .forEach(r => console.log(((r.dec) / 1048576).toFixed(2).padStart(8) + 'MB', ((r.end - r.send) / 1000).toFixed(0).padStart(7) + 'ms', String(r.url).slice(0, 120)));
