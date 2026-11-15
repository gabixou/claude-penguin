// issue-triage.mjs — triagem automática de issues novas (CI).
// Roda no GitHub Actions (self-hosted) quando uma issue é aberta:
//  1. Baixa título/corpo/comentários do issue via REST
//  2. Baixa imagens anexadas (user-attachments)
//  3. Analisa com Gemini (texto + visão)
//  4. Comenta no issue com briefing estruturado e aplica labels
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, ISSUE_NUMBER, GEMINI_API_KEY
// Uso: node tools/issue-triage.mjs
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const NUM = process.env.ISSUE_NUMBER;
const GEMINI = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
if (!TOKEN || !REPO || !NUM) { console.error('faltam GITHUB_TOKEN/GITHUB_REPOSITORY/ISSUE_NUMBER'); process.exit(1); }

const API = `https://api.github.com/repos/${REPO}`;
const gh = async (method, path, body) => {
    const r = await fetch(`${API}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    if (!r.ok) throw new Error(`GitHub ${method} ${path} -> ${r.status}: ${String(text).slice(0, 300)}`);
    return data;
};

// ---------- 1. issue ----------
const issue = await gh('GET', `/issues/${NUM}`);
console.log(`issue #${NUM}: ${issue.title}`);
const body = issue.body || '';

// ---------- 2. imagens anexadas ----------
const imgUrls = [...body.matchAll(/https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+/g)]
    .map((m) => m[0]).slice(0, 4);
// tambem cobre links de blob do proprio repo (ex.: /blob/...png?raw=true)
for (const m of body.matchAll(/https:\/\/github\.com\/[^\s)]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s)]*)?/gi)) {
    if (!imgUrls.includes(m[0])) imgUrls.push(m[0]);
}
const imgs = [];
const mime = (u) => (/\.jpe?g(\?|$)/i.test(u) ? 'image/jpeg' : /\.webp(\?|$)/i.test(u) ? 'image/webp' : /\.gif(\?|$)/i.test(u) ? 'image/gif' : 'image/png');
for (const u of imgUrls.slice(0, 4)) {
    try {
        const r = await fetch(u, { redirect: 'follow', headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'issue-triage' } });
        if (!r.ok) { console.log(`img ${r.status}: ${u}`); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 8_000_000) { console.log(`img grande demais, pulando: ${u}`); continue; }
        imgs.push({ mime: mime(u), data: buf.toString('base64') });
        console.log(`img ok (${(buf.length / 1024).toFixed(0)}KB): ${u}`);
    } catch (e) { console.log(`img falhou: ${u} ${e}`); }
}

// ---------- 3. Gemini ----------
let analysis = '';
if (GEMINI) {
    const prompt = `Voce e um triador tecnico do projeto "Club Penguin Browser" — clone do Club Penguin original feito com Phaser 3 (client/) + backend Node.js/WebSocket (server/). O jogo original e a referencia visual.

Analise o issue abaixo${imgs.length ? ' e as IMAGENS anexadas (screenshots do bug/comportamento)' : ''} e responda EM PORTUGUES no formato markdown:

## Resumo
<o que o reportante esta relatando, em 1-3 frases>

## Analise
<causa provavel, comportamento esperado vs atual; se houver imagem, descreva o que ve e o que esta errado>

## Area provavel
<client (Phaser/UI/render), server (WebSocket/dados), assets, ou outros — com palpite de arquivos em client/src ou server/src se possivel>

## Reproducao sugerida
<passos objetivos para reproduzir, se inferiveis>

## Tipo
<bug | feature | duvida | visual>

Issue #${NUM} — ${issue.title}
Reportante: ${issue.user?.login}
Labels atuais: ${(issue.labels || []).map((l) => l.name).join(', ') || 'nenhum'}

--- Corpo do issue ---
${body.slice(0, 12000) || '(vazio)'}`;

    const parts = [{ text: prompt }, ...imgs.map((i) => ({ inline_data: { mime_type: i.mime, data: i.data } }))];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI}`;
    const payload = { contents: [{ parts }], generationConfig: { maxOutputTokens: 4096 } };
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        try {
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await r.json();
            if (r.ok) {
                analysis = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
                ok = !!analysis;
            } else console.log(`gemini ${r.status}: ${JSON.stringify(data?.error?.message || data).slice(0, 200)}`);
        } catch (e) { console.log(`gemini tentativa ${attempt}: ${e}`); }
        if (!ok && attempt < 3) await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
    if (!ok) analysis = '_Gemini indisponivel — triagem apenas com dados do issue._';
} else {
    analysis = '_GEMINI_API_KEY ausente — triagem pulada._';
}

// ---------- 4. comentario + labels ----------
const hasVisual = imgs.length > 0;
const comment = `## 🤖 Triagem automática

${analysis}

---
<sub>Análise gerada automaticamente por Gemini${hasVisual ? ' com análise visual das imagens anexadas' : ''}. Para resolver, peça ao Devin: <code>resolve issue #${NUM}</code></sub>`;

await gh('POST', `/issues/${NUM}/comments`, { body: comment });
console.log('comentario postado');

// labels: garante 'triaged' e 'visual' se houver imagem
const ensureLabel = async (name, color, desc) => {
    try { await gh('GET', `/labels/${encodeURIComponent(name)}`); }
    catch {
        try { await gh('POST', '/labels', { name, color, description: desc }); } catch (e) { console.log(`label ${name}: ${e}`); }
    }
};
await ensureLabel('triaged', '0e8a16', 'Issue passou pela triagem automatica');
if (hasVisual) await ensureLabel('visual', 'd93f0b', 'Issue envolve problema visual com screenshot');
try {
    const cur = new Set((issue.labels || []).map((l) => l.name));
    const add = ['triaged', ...(hasVisual ? ['visual'] : [])].filter((l) => !cur.has(l));
    if (add.length) await gh('POST', `/issues/${NUM}/labels`, { labels: add });
} catch (e) { console.log(`labels: ${e}`); }

console.log('TRIAGE OK');
