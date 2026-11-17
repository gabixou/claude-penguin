// analise somente-leitura do penguin.db — rodar no VPS:
//   node analyze-db.mjs /caminho/penguin.db
import { DatabaseSync } from 'node:sqlite';

const path = process.argv[2] || '/opt/club-penguin/server/data/penguin.db';
const db = new DatabaseSync(path, { readOnly: true });
const q = (sql) => db.prepare(sql).all();
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

console.log('=== TOTAIS ===');
for (const t of ['players', 'inventory', 'equipped', 'buddies', 'ignores', 'pets', 'cardjitsu', 'parties', 'player_party']) {
    try { console.log(t.padEnd(14), q(`SELECT COUNT(*) c FROM ${t}`)[0].c); }
    catch (e) { console.log(t.padEnd(14), 'ERRO', e.message); }
}

console.log('\n=== PLAYERS: criados por dia (UTC) ===');
for (const r of q(`SELECT created_at c, COUNT(*) n FROM players GROUP BY c ORDER BY c`))
    console.log(day(r.c), String(r.n).padStart(4));

console.log('\n=== last_seen por dia (UTC) — ultima atividade conhecida ===');
for (const r of q(`SELECT last_seen c, COUNT(*) n FROM players GROUP BY c ORDER BY c DESC LIMIT 20`))
    console.log(day(r.c), String(r.n).padStart(4));

console.log('\n=== jogadores com atividade nos ultimos 7 dias ===');
const now = Date.now();
for (let i = 0; i < 7; i++) {
    const d0 = now - (i + 1) * 86400000, d1 = now - i * 86400000;
    const n = q(`SELECT COUNT(*) c FROM players WHERE last_seen >= ? AND last_seen < ?`)[0];
    // refaz com params
    const r = db.prepare('SELECT COUNT(*) c FROM players WHERE last_seen >= ? AND last_seen < ?').get(d0, d1);
    console.log(day(d0), String(r.c).padStart(4));
}

console.log('\n=== players distintos por janela de 1h no ultimo dia ===');
for (let h = 0; h < 24; h++) {
    const d0 = now - 86400000 + h * 3600000, d1 = d0 + 3600000;
    const r = db.prepare('SELECT COUNT(*) c FROM players WHERE last_seen >= ? AND last_seen < ?').get(d0, d1);
    if (r.c) console.log(day(d0), String(h).padStart(2) + 'h', String(r.c).padStart(4));
}

console.log('\n=== amostra de players ===');
for (const r of q(`SELECT username, coins, created_at, last_seen FROM players ORDER BY last_seen DESC LIMIT 15`))
    console.log(`${r.username.padEnd(20)} coins=${String(r.coins).padStart(7)} criado=${day(r.created_at)} visto=${day(r.last_seen)}`);

console.log('\n=== coins: top 10 ===');
for (const r of q(`SELECT username, coins FROM players ORDER BY coins DESC LIMIT 10`))
    console.log(`${r.username.padEnd(20)} ${r.coins}`);

console.log('\n=== social ===');
for (const r of q(`SELECT status, COUNT(*) c FROM buddies GROUP BY status`))
    console.log('buddies', r.status, r.c);
for (const r of q(`SELECT COUNT(DISTINCT player_id) c FROM pets`))
    console.log('pets distinct owners', r.c);

db.close();
