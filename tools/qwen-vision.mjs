// Envia imagens ao qwen3.5:4b (ollama local, Windows) para analise visual.
// Uso: node tools/qwen-vision.mjs "<prompt>" <img1> [img2...]
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.cwd());
const args = process.argv.slice(2);
const [prompt, ...imgs] = args;
const images = imgs.map((p) => readFileSync(resolve(root, p)).toString('base64'));
const res = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen3.5:4b',
    stream: false,
    messages: [{ role: 'user', content: prompt, images }],
  }),
});
const j = await res.json();
console.log(j.message?.content || JSON.stringify(j).slice(0, 500));
