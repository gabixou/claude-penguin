// Reconstroi chunks.entries do IceFishing: os offsets/lengths gravados no
// timelines.json nao batem com o conteudo real dos packs (cada SVG fica
// alguns bytes mais longo que o len declarado — drift acumulado deixa
// todos os arquivos truncados/shifted => SVGs invalidos => tela em branco).
// Os packs contem os SVGs completos, back-to-back, na MESMA ordem dos
// entries — basta re-alinhar: posicoes reais de '<?xml' == ordem declarada.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dir = 'client/public/assets/movies/games/fish/IceFishing';
const tp = join(dir, 'timelines.json');
const tl = JSON.parse(readFileSync(tp, 'utf8'));
const files = tl.chunks.files;
const ents = tl.chunks.entries;

let fixed = 0, skipped = 0;
for (let ci = 0; ci < files.length; ci++) {
    const buf = readFileSync(join(dir, 'chars', files[ci]));
    const s = buf.toString('latin1');
    // posicoes reais de cada SVG dentro do chunk
    const xmlPos = [];
    let i = -1;
    while ((i = s.indexOf('<?xml', i + 1)) !== -1) xmlPos.push(i);
    // entries deste chunk ordenados pelo offset declarado (ordem de gravacao)
    const list = Object.entries(ents)
        .filter(([, e]) => (e.length === 3 ? e[0] : 0) === ci)
        .map(([name, e]) => ({ name, off: e.length === 3 ? e[1] : e[0], e }))
        .sort((a, b) => a.off - b.off);
    if (list.length !== xmlPos.length) {
        console.log(`chunk ${ci}: MISMATCH entries=${list.length} xmls=${xmlPos.length} — pulando`);
        skipped++;
        continue;
    }
    for (let k = 0; k < list.length; k++) {
        const { name, e } = list[k];
        const off = xmlPos[k];
        const len = (xmlPos[k + 1] ?? buf.length) - off;
        if (e.length === 3) { e[1] = off; e[2] = len; }
        else { e[0] = off; e[1] = len; }
        fixed++;
    }
    console.log(`chunk ${ci}: ${list.length} entries re-alinhados`);
}
writeFileSync(tp, JSON.stringify(tl));
console.log(`DONE fixed=${fixed} skippedChunks=${skipped}`);
