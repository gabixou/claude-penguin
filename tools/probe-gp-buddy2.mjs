import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('https://gopenguin.lol/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(8000);
// fecha o guia
for (let i = 0; i < 8; i++) {
    const skip = await p.$('.gp-guide-skip');
    if (skip) { await skip.click().catch(() => {}); }
    await p.waitForTimeout(400);
    if (!(await p.$('.gp-guide'))) break;
}
await p.waitForTimeout(1500);
await p.screenshot({ path: 'tools/shots/gp-room.png' });
// HUD dock fica embaixo — botao buddy e o 2o icone do grupo social (apos chat?)
// clica na regiao do dock: tenta coordenadas provaveis e verifica mudanca
// Em CP 2008 o dock tem: chat, acoes(X), snowball, map, igloo, help, playercard, buddy...
// Vou clicar sequencialmente nos icones do dock e checar se abriu janela
const cands = [
    [660, 915], [700, 915], [740, 915], [780, 915], [820, 915], [860, 915], [900, 915],
    [620, 915], [580, 915], [540, 915], [500, 915], [460, 915],
];
for (const [x, y] of cands) {
    await p.mouse.click(x, y);
    await p.waitForTimeout(900);
    const opened = await p.evaluate(() => {
        // procura janelas/divs novos ou texto "Buddy"
        return document.body.innerText.includes('Buddy') || document.body.innerText.includes('buddy');
    });
    if (opened) { console.log('buddy abriu em', x, y); break; }
}
await p.screenshot({ path: 'tools/shots/gp-buddy.png' });
await b.close();
console.log('done');
