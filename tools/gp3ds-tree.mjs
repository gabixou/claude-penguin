import { writeFileSync } from 'node:fs';
for (const br of ['main','master']) {
  const r = await fetch('https://api.github.com/repos/Tweebbo/gopenguin-3ds/git/trees/' + br + '?recursive=1');
  const t = await r.json();
  console.log(br, 'status', r.status, 'truncated:', t.truncated, 'count:', t.tree?.length);
  if (r.status === 200) {
    writeFileSync('tools/gp3ds-paths.txt', (t.tree || []).map(x => x.path).join('\n'));
    break;
  }
}
