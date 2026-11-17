import { execFileSync } from 'node:child_process';
const [img, prompt] = process.argv.slice(2);
const out = execFileSync('node', ['tools/qwen-vision.mjs', prompt, img], { cwd: 'E:/project/club-penguin-browser', encoding: 'utf8' });
console.log(out);
