import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(15000);
const r = await page.evaluate(`(async () => {
    const { MovieRoom } = await import('/src/movie/movie.js');
    const movie = await MovieRoom.load('/assets/movies/igloo-music');
    await movie.ensureFonts();
    movie.prefetchSvgs?.(30);
    await new Promise(r2=>setTimeout(r2,4000));
    const cv = document.createElement('canvas');
    cv.width = 760; cv.height = 480;
    await movie.renderFrame(0, cv, 1);
    const ctx = cv.getContext('2d');
    const d = ctx.getImageData(0,0,760,480).data;
    let x0=1e9,y0=1e9,x1=-1,y1=-1;
    for(let y=0;y<480;y++)for(let x=0;x<760;x++){
      const a=d[(y*760+x)*4+3];
      if(a>8){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
    }
    return {bbox:[x0,y0,x1,y1]};
})()`);
console.log(JSON.stringify(r));
await browser.close();
