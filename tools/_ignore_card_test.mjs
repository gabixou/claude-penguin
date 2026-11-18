import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_B = 'd06bd531bfed4adbb8f62e6420bcdaa04c6b4b8ebfd35072b96a4a6add312e56';
const GETSC = '(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene(\'RoomScene\'); })()';
const READY = '(() => { const s = ' + GETSC + '; return s && s._playerReady && s._movieReady && s.localPlayer; })()';

const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
await p.goto('http://localhost:3000/?token=' + TOK_B + '&room=town', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
await p.waitForFunction(READY, null, { timeout: 90000 });
await p.waitForTimeout(1500);

const r = await p.evaluate(`(async () => {
  const s = ${GETSC};
  const out = {};
  // 1. card proprio continua abrindo (self nao e afetado pelo ignore)
  s.playerCard.open(s.localPlayer);
  await new Promise((r) => setTimeout(r, 6000));
  out.selfCardOpens = s.playerCard.isOpen;
  s.playerCard.close();

  // 2. pinguim "ignorado": injeta ignore fake no estado social e tenta abrir
  const fakeId = 'p_ignoretest0001';
  s.network.social.ignores = [{ playerId: fakeId, username: 'IgnoredPenguin' }];
  s.playerCard.open({ playerId: fakeId, username: 'IgnoredPenguin', penguinColor: 0x336699 });
  await new Promise((r) => setTimeout(r, 800));
  out.ignoredCardBlocked = !s.playerCard.isOpen;

  // 3. mesmo id sem ignore: card abre normalmente
  s.network.social.ignores = [];
  s.playerCard.open({ playerId: fakeId, username: 'IgnoredPenguin', penguinColor: 0x336699 });
  await new Promise((r) => setTimeout(r, 1500));
  out.unignoredCardOpens = s.playerCard.isOpen;
  s.playerCard.close();

  // 4. isIgnored helper
  s.network.social.ignores = [{ playerId: fakeId, username: 'IgnoredPenguin' }];
  out.isIgnoredWorks = s.network.isIgnored(fakeId) === true && s.network.isIgnored('p_other') === false;
  s.network.social.ignores = [];
  return out;
})()`);
console.log(JSON.stringify(r, null, 1));
await p.screenshot({ path: 'tools/shots/ignore-card-guard.png' });
await b.close();
const ok = r.selfCardOpens && r.ignoredCardBlocked && r.unignoredCardOpens && r.isIgnoredWorks;
console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
