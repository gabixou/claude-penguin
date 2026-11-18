import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc';
const TOK_B = 'd06bd531bfed4adbb8f62e6420bcdaa04c6b4b8ebfd35072b96a4a6add312e56';
const GETSC = '(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene(\'RoomScene\'); })()';
const READY = '(() => { const s = ' + GETSC + '; return s && s._playerReady && s._movieReady && s.localPlayer; })()';

const b = await chromium.launch({ executablePath: EXE, headless: true });
const boot = async (token) => {
  const p = await b.newPage();
  await p.goto('http://localhost:3000/?token=' + token + '&room=town', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await p.waitForFunction(READY, null, { timeout: 90000 });
  return p;
};
await boot(TOK_A);
const B = await boot(TOK_B);
await B.waitForTimeout(2500);

const r = await B.evaluate(`(async () => {
  const s = ${GETSC};
  const remote = [...s.remotePlayers.values()][0];
  await s.playerCard.open(remote);
  await new Promise((r) => setTimeout(r, 500));
  const clip = s.playerCard._clip;
  const st = clip?.state?.get('moderatorButtonEditPlayer');
  // lista entries do frame OTHER (1) do sprite 701 p/ ver se o sprite existe
  const movie = await import('/src/movie/movie.js').then(m => m.MovieRoom.load('/assets/movies/interface'));
  const sp = movie.sprites['701'];
  const namesOther = (sp?.frames?.[1] || []).map((e) => e.name).filter(Boolean);
  const namesSelf = (sp?.frames?.[0] || []).map((e) => e.name).filter(Boolean);
  return {
    cardOpen: s.playerCard.isOpen,
    state: st,
    hasModOther: namesOther.includes('moderatorButtonEditPlayer'),
    hasModSelf: namesSelf.includes('moderatorButtonEditPlayer'),
    otherBtns: namesOther.filter((n) => /btn|mc|moderator/i.test(n)),
  };
})()`);
console.log(JSON.stringify(r, null, 1));
await b.close();
process.exit(0);
