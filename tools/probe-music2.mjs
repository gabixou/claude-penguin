import { chromium } from 'playwright-core';
import WebSocket from '../server/node_modules/ws/index.js';

// garante um jogador de teste no servidor e pega o sessionToken
function wsApi() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:8080');
        let token = null;
        const to = setTimeout(() => reject(new Error('ws timeout')), 10000);
        ws.on('open', () => ws.send(JSON.stringify({ op: 'AUTH_GUEST', data: { sessionToken: null } })));
        ws.on('message', (m) => {
            const p = JSON.parse(m.toString());
            if (p.op === 'ERROR' && p.data?.code === 'NEED_CREATE') {
                ws.send(JSON.stringify({ op: 'CREATE_PLAYER', data: { username: 'Probe' + Date.now().toString(36).slice(-6), colorItemId: 1 } }));
            } else if (p.op === 'PLAYER_DATA') {
                token = p.data.sessionToken;
                clearTimeout(to); ws.close(); resolve(token);
            }
        });
        ws.on('error', reject);
    });
}

const token = await wsApi();
console.log('token', token ? 'ok' : 'FAIL');

const b = await chromium.launch({
    executablePath: 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript((t) => localStorage.setItem('penguin_session', t), token);
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 200)));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
try {
    await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 180000 });
    console.log('READY');
    await p.waitForTimeout(2500);
    console.log('TESTPENGUIN', JSON.stringify(await p.evaluate(() => ({
        inv: window.__penguin.scene.network.inventory.length,
        out: window.__penguin.gpaOutfit,
    }))));
    const audioState = () => p.evaluate(() => ({
        fetched: performance.getEntriesByType('resource')
            .map((e) => e.name).filter((n) => n.includes('/assets/music/')),
        // HTMLAudioElement nao entra no DOM; acha via GC nao da — checa pelo player
        player: window.__musicPlayer ? {
            programId: window.__musicPlayer.programId,
            paused: window.__musicPlayer.audio?.paused,
            src: window.__musicPlayer.audio?.src,
            ct: window.__musicPlayer.audio?.currentTime,
        } : null,
    }));
    console.log('AUDIO', JSON.stringify(await audioState()));
    await p.evaluate(() => window.__penguin.scene.changeRoom('coffee', 380, 312));
    await p.waitForTimeout(5000);
    console.log('AUDIO2', JSON.stringify(await audioState()));
} catch (e) { console.log('ERR', e.message.slice(0, 150)); }
await b.close();
