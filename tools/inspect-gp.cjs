const fs = require('fs');
const src = fs.readFileSync('gp-index.js', 'utf8');
const pats = ['swf/${e}', 'swf/${r}', 'swf/${i.package}', 'swf/${gd', 'swf/${ud', 'swf/${si'];
for (const pat of pats) {
    const i = src.indexOf(pat);
    if (i >= 0) { console.log('>>>', pat); console.log(src.slice(Math.max(0, i - 500), i + 500)); console.log('======'); }
}
