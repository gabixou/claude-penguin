// Probe generico do jogo via playwright-core (Chrome headless, sem MCP).
// Uso:
//   node tools/qa-probe.mjs <url> [--wait <ms>] [--ready] [--eval <js|@file>] [--shot <path>] [--full]
// Exemplos:
//   node tools/qa-probe.mjs http://localhost:3000/ --ready --shot tools/shots/x.png
//   node tools/qa-probe.mjs http://localhost:3000/ --ready --eval "window.__penguin.scene.currentRoom"
//   node tools/qa-probe.mjs http://localhost:3000/ --eval @tools/probe.js --shot out.png
// Sai com codigo != 0 em erro de navegacao/probe. Timeout total: 60s.
import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const url = args[0];
if (!url) { console.error('uso: qa-probe.mjs <url> [--wait ms] [--ready] [--eval js|@file] [--shot path]'); process.exit(2); }

const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const has = (name) => args.includes(name);
const waitMs = Number(opt('--wait') || 0);
const ready = has('--ready');
const evalArg = opt('--eval');
const shot = opt('--shot');

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 1038, height: 607 } })).newPage();
  page.setDefaultTimeout(30000);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (waitMs) await page.waitForTimeout(waitMs);
  if (ready) {
    await page.waitForFunction(() => window.__penguin?.scene?._playerReady, null, { timeout: 45000 });
    await page.waitForTimeout(1500); // assets/movies do room assentam
  }
  if (evalArg) {
    const src = evalArg.startsWith('@') ? readFileSync(resolve(evalArg.slice(1)), 'utf8') : evalArg;
    // aceita "() => {...}" (function) ou expressao pura
    const isFn = /=>|^\s*function|^\s*\(.*\)\s*=>/.test(src);
    const out = await page.evaluate(isFn ? `(${src})()` : src);
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
  }
  if (shot) {
    const p = resolve(shot);
    if (!existsSync(resolve(p, '..'))) { /* dir deve existir */ }
    await page.screenshot({ path: p });
    console.log(`shot -> ${p}`);
  }
} finally {
  await browser.close();
}
