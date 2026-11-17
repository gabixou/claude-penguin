import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
for (const args of [
  ['--use-angle=d3d11'],
  ['--use-gl=angle', '--use-angle=d3d11'],
  [],
]) {
  try {
    const b = await chromium.launch({ executablePath: EXE, headless: true, args });
    const p = await b.newPage();
    const r = await p.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return 'no-webgl';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
    console.log(JSON.stringify(args), '->', r);
    await b.close();
  } catch (e) { console.log(JSON.stringify(args), 'ERR', String(e).slice(0, 160)); }
}
