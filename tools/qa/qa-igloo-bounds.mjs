// Computa os bounds REAIS dos filhos do sprite 114 (igloo-as2) em coords
// de stage, usando o Clip._boundsOf do proprio movie — para posicionar
// as zones de hover/clique do selector sem chute.
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(15000);
const out = await page.evaluate(`(async () => {
    const { MovieRoom } = await import('/src/movie/movie.js');
    const { Clip } = await import('/src/movie/clip.js');
    const mv = await MovieRoom.load('/assets/movies/igloo-as2');
    mv.setScale(1);
    const clip = new Clip(mv);
    const IDENT = { a:1,b:0,c:0,d:1,x:0,y:0 };
    // sprite 114 esta na timeline principal? procura entries com id 114
    const main = mv.data.main;
    const found = [];
    const walk = (entries, path, world) => {
        for (const e of entries || []) {
            const sp = mv.sprites?.[String(e.id)];
            if (sp) {
                const m = e.matrix || IDENT;
                const w = { a: world.a*m.a + world.b*m.c, b: world.a*m.b + world.b*m.d,
                            c: world.c*m.a + world.d*m.c, d: world.c*m.b + world.d*m.d,
                            x: world.x + world.a*m.x + world.b*m.y, y: world.y + world.c*m.x + world.d*m.y };
                for (const fr of sp.frames || []) walk(fr, path + '/' + (e.name || e.id), w);
            } else {
                const ch = mv.characters?.[String(e.id)];
                if (ch?.file) found.push({ path, file: ch.file, size: ch.size, e });
            }
        }
    };
    // acha onde o sprite 114 e instanciado no main
    for (const fr of main.frames || []) {
        for (const e of fr) if (String(e.id) === '114') {
            const sp = mv.sprites['114'];
            const m = e.matrix || IDENT;
            for (const f2 of sp.frames) walk(f2, '114', m);
        }
    }
    return found.slice(0, 60);
})()`);
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
await browser.close();
