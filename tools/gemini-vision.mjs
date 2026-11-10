// Sends one or more images + a text prompt to the Gemini API and prints the text response.
// Usage: node tools/gemini-vision.mjs "<prompt>" <image1> [image2 ...]
//        node tools/gemini-vision.mjs <prompt-file.txt> <image1> [image2 ...]
//        node tools/gemini-vision.mjs --model <model> "<prompt>" <image...>
// Reads GEMINI_API_KEY from .env in the project root. Images: png/jpg/jpeg/webp.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const args = process.argv.slice(2);
let model = 'gemini-3.5-flash';
if (args[0] === '--model') { model = args[1]; args.splice(0, 2); }
if (args.length < 2) {
  console.error('Usage: node tools/gemini-vision.mjs [--model <model>] "<prompt>" <image...>');
  process.exit(1);
}

let [promptArg, ...images] = args;
// If the first arg is an existing file, treat it as the prompt text.
const promptPath = resolve(root, promptArg);
if (existsSync(promptPath) && /\.(txt|md)$/i.test(promptArg)) {
  promptArg = readFileSync(promptPath, 'utf8');
}
const prompt = promptArg;

const mime = (p) => ({
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif',
}[extname(p).toLowerCase()] || 'image/png');

const parts = [{ text: prompt }];
for (const img of images) {
  const abs = resolve(root, img);
  if (!existsSync(abs)) { console.error(`Image not found: ${img}`); process.exit(1); }
  parts.push({ inline_data: { mime_type: mime(abs), data: readFileSync(abs).toString('base64') } });
}

const key = process.env.GEMINI_API_KEY;
if (!key) { console.error('GEMINI_API_KEY not set (checked env and .env)'); process.exit(1); }

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const body = JSON.stringify({
  contents: [{ parts }],
  generationConfig: { maxOutputTokens: 16384 },
});

// Retry em erros transitorios (5xx / rede), 3 tentativas com backoff.
let data, res, lastErr;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    data = await res.json();
    if (res.ok || (res.status >= 400 && res.status < 500)) break;
    lastErr = `HTTP ${res.status}`;
  } catch (e) {
    lastErr = String(e);
    data = null;
  }
  if (attempt < 3) await new Promise((r) => setTimeout(r, 5000 * attempt));
}
if (!res) { console.error(`Gemini API falhou apos 3 tentativas: ${lastErr}`); process.exit(1); }
if (!res.ok) {
  console.error(`Gemini API error ${res.status}:`, JSON.stringify(data?.error ?? data ?? lastErr, null, 2));
  process.exit(1);
}
const candidate = data.candidates?.[0];
if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
  console.error(`Aviso: finishReason=${candidate.finishReason} (resposta pode estar truncada)`);
}
// Ignora partes de "thought" (raciocinio interno do modelo) — so texto final.
const text = candidate?.content?.parts
  ?.filter((p) => p.text && p.thought !== true)
  .map((p) => p.text)
  .join('') ?? '';
if (!text) {
  console.error('Empty response:', JSON.stringify(data, null, 2));
  process.exit(1);
}
console.log(text);
