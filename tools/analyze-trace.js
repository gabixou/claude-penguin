// Analisa Chrome trace (JSON) do DevTools: top self-time, long tasks, network.
const fs = require('fs');
const file = process.argv[2];
const trace = JSON.parse(fs.readFileSync(file, 'utf8'));
const ev = trace.traceEvents || [];
console.log('events:', ev.length);

const names = {};
for (const e of ev) names[e.name] = (names[e.name] || 0) + 1;
console.log('--- top event names ---');
console.log(Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([n, c]) => c + ' ' + n).join('\n'));
