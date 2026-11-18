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
await B.waitForTimeout(2500); // ROOM_STATE traz o remoto

// B abre o player card do pinguim remoto (Arenovisk)
const r = await B.evaluate(`(async () => {
  const s = ${GETSC};
  const remote = [...s.remotePlayers.values()][0];
  if (!remote) return { err: 'sem remoto' };
  s.playerCard.open(remote);
  await new Promise((r) => setTimeout(r, 1500));
  const clip = s.playerCard._clip;
  const vis = {};
  for (const name of ['moderatorButtonEditPlayer', 'close_btn', 'buddy_mc', 'home_mc']) {
    try { vis[name] = clip?.sprite?.(name)?.visible ?? clip?._vis?.(name); } catch (e) { vis[name] = 'err:' + e.message; }
  }
  // fallback: procura nos paths do clip
  const paths = [];
  try {
    const dump = (c, d) => { if (d > 4) return; for (const [k, v] of Object.entries(c?.sprites || c?.children || {})) { paths.push(k + ':' + (v.visible !== false)); if (v && typeof v === 'object') dump(v, d + 1); } };
    dump(clip, 0);
  } catch {}
  return { remoteId: remote.playerId, isSelfCard: remote === s.localPlayer, vis, samplePaths: paths.filter((p) => /moderator|rename/i.test(p)).slice(0, 5) };
})()`);
console.log(JSON.stringify(r, null, 1));
await B.screenshot({ path: 'tools/shots/playercard-other.png' });

// card proprio para comparar
const r2 = await B.evaluate(`(async () => {
  const s = ${GETSC};
  s.playerCard.open(s.localPlayer);
  await new Promise((r) => setTimeout(r, 1200));
  return { canRename: s.network?.canRename, open: !!s.playerCard };
})()`);
console.log('self:', JSON.stringify(r2));
await B.screenshot({ path: 'tools/shots/playercard-self.png' });
await b.close();
process.exit(0);
