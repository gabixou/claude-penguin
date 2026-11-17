// Wrapper do @playwright/mcp: forca cwd = raiz do club-penguin-browser.
// O playwright-mcp restringe as file tools (screenshots, uploads) ao cwd
// do processo — sem isso as roots ficam na pasta onde o Devin foi aberto
// (gopenguin-3ds-main) e salvar em tools/shots/ falha com "file access denied".
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const child = spawn('npx', ['-y', '@playwright/mcp@latest'], {
    stdio: 'inherit',
    shell: true,
    cwd: root,
});
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (e) => { console.error('[mcp-playwright]', e); process.exit(1); });
