// catalog.js — catalogo de itens do Club Penguin (items.json do gopenguin)
// + manifesto dos itens com arte local (paper/<id>).
// type -> slot: 2=head 3=face 4=neck 5=body 6=hand 7=feet (paperdoll)
// 8=flag (pin do player card / bandeira do igloo) 9=photo (fundo do card)
// 1=cor do pinguim (tratada a parte, aba Color)

const TYPE_TO_SLOT = {
    2: 'head', 3: 'face', 4: 'neck', 5: 'body', 6: 'hand', 7: 'feet',
    8: 'flag', 9: 'photo',
};

let _catalog = null;
let _manifest = null;
let _iconManifest = null;

export async function loadCatalog() {
    if (_catalog) return _catalog;
    const [itemsRes, manifestRes, iconRes] = await Promise.all([
        fetch('/assets/items.json').then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch('/assets/paper/index.json').then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch('/assets/icons/index.json').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    const byId = new Map(itemsRes.map((i) => [i.id, i]));
    _manifest = new Set(manifestRes);
    _iconManifest = new Set(iconRes);
    _catalog = { byId, manifest: _manifest, iconManifest: _iconManifest };
    return _catalog;
}

// itens equipaveis que temos arte local: [{id,name,type,slot}]
// paperdoll (types 2-7): exige arte paper/<id> (manifest)
// pins/backgrounds (types 8-9): exigem icone icons/<id> (manifest de icones)
export async function wardrobeItems() {
    const { byId, manifest, iconManifest } = await loadCatalog();
    const out = [];
    for (const id of manifest) {
        const it = byId.get(id);
        if (!it || !it.name) continue;
        const slot = TYPE_TO_SLOT[it.type];
        if (!slot || (it.type >= 8 && !iconManifest.has(id))) continue;
        out.push({ id, name: it.name, type: it.type, slot, cost: it.cost ?? 0 });
    }
    // types 8/9 nao estao no manifest paper — entram via iconManifest
    for (const id of iconManifest) {
        if (manifest.has(id)) continue;
        const it = byId.get(id);
        if (!it || !it.name) continue;
        const slot = TYPE_TO_SLOT[it.type];
        if (!slot || it.type < 8) continue;
        out.push({ id, name: it.name, type: it.type, slot, cost: it.cost ?? 0 });
    }
    return out.sort((a, b) => a.type - b.type || a.name.localeCompare(b.name));
}

export const SLOT_LABELS = {
    head: 'Head', face: 'Face', neck: 'Neck',
    body: 'Shirt', hand: 'Hand', feet: 'Feet',
    flag: 'Pins', photo: 'Backgrounds',
};

// cores classicas de pinguim (type 1 do catalogo) — swatches do guarda-roupa
// tons = tabela oficial do gp (items/colors.js e a fonte canonica)
export const PENQUIN_COLORS = [
    { name: 'Blue',    color: 0x003366 },
    { name: 'Black',   color: 0x333333 },
    { name: 'Red',     color: 0xcc0000 },
    { name: 'Pink',    color: 0xff3399 },
    { name: 'Green',   color: 0x009900 },
    { name: 'Yellow',  color: 0xffcc00 },
    { name: 'Orange',  color: 0xff6600 },
    { name: 'Purple',  color: 0x660099 },
    { name: 'White',   color: 0xf0f0f0 },
    { name: 'Brown',   color: 0x996600 },
];
