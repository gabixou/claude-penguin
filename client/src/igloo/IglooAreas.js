// IglooAreas — hitTest das areas do igloo type (room_area/wall_area/
// trash_area) extraidas dos igloo/igloos/<type>.swf do wand.
// Dados: assets/igloo-areas.json (tools/extract-igloo-areas.mjs).
// Cada area = lista de {d (SVG path), rule, matrix [a,b,c,d,tx,ty]}.
// Teste: converte o ponto mundo p/ espaco local via matriz inversa e
// usa ctx.isPointInPath — equivalente ao hitTest do Flash.

let _dataP = null;
export function iglooAreas() {
    if (!_dataP) {
        _dataP = fetch('/assets/igloo-areas.json')
            .then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    }
    return _dataP;
}

const _ctx = document.createElement('canvas').getContext('2d');
_ctx.setTransform(1, 0, 0, 1, 0, 0);

const _cache = new Map(); // `${type}:${area}` -> [{path, inv, rule}]

function inv(m) {
    const [a, b, c, d, tx, ty] = m;
    const det = a * d - b * c || 1e-9;
    return [
        d / det, -b / det, -c / det, a / det,
        (c * ty - d * tx) / det, (b * tx - a * ty) / det,
    ];
}
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

async function tester(type, area) {
    const key = `${type}:${area}`;
    if (_cache.has(key)) return _cache.get(key);
    const data = await iglooAreas();
    const entry = data?.[String(type)]?.[area];
    const list = (entry?.paths || []).map((p) => ({
        path: new Path2D(p.d),
        rule: p.rule === 'evenodd' ? 'evenodd' : 'nonzero',
        matrix: p.matrix,
        inv: inv(p.matrix),
    }));
    _cache.set(key, list);
    return list;
}

// ponto (wx,wy) esta dentro de alguma sub-area?
// retorna true/false, ou null se nao ha dados pro tipo (caller faz fallback)
export async function iglooHit(type, area, wx, wy) {
    const list = await tester(type, area);
    if (!list.length) return null;
    for (const it of list) {
        const [lx, ly] = apply(it.inv, wx, wy);
        if (_ctx.isPointInPath(it.path, lx, ly, it.rule)) return true;
    }
    return false;
}

// paths crus (Path2D + matrix + rule) — p/ clip de canvas (ex.: mascara
// do piso). Retorna [] se nao ha dados pro tipo.
export async function iglooAreaClipList(type, area) {
    return tester(type, area);
}
