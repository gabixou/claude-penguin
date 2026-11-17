import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';
const svg = readFileSync('tools/shots/sample-7.svg', 'utf8');
const mini = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>';
for (const headless of [true, false]) {
  const b = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless,
    args: headless ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });
  const p = await (await b.newContext()).newPage();
  const r = await p.evaluate(async ({ svg, mini }) => {
    const test = (s) => new Promise((res) => {
      const img = new Image();
      img.onload = () => res('OK ' + img.naturalWidth + 'x' + img.naturalHeight);
      img.onerror = () => res('ERR');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
      setTimeout(() => res('TIMEOUT'), 4000);
    });
    return { mini: await test(mini), real: await test(svg) };
  }, { svg, mini });
  console.log(headless ? 'HEADLESS' : 'HEADED', JSON.stringify(r));
  await b.close();
}
