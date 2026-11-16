// Salas do clone -> pacote vetorial /assets/movies/<pack>/ (timelines.json +
// chars/*.pack). Sem fallback: se o pack falhar, a sala mostra um aviso.
export const MOVIE_ROOM_MAP = {
    town: 'town', coffee: 'coffee', dance: 'dance', pizza: 'pizza',
    plaza: 'plaza', forts: 'forts', dojo: 'dojo', beach: 'beach',
    dock: 'dock', lodge: 'lodge', mine: 'mine', rink: 'rink',
    // salas extras ligadas por triggers_mc das salas base
    shop: 'shop', book: 'book', boiler: 'boiler', lounge: 'lounge',
    pet: 'pet', cave: 'cave', stage: 'stage', forest: 'forest',
    light: 'light', ship: 'ship', village: 'village', attic: 'attic',
    dojoext: 'dojoext', cavemine: 'cavemine',
    // destinos do mapa da ilha (map.swf)
    mtn: 'mtn', cove: 'cove', shack: 'shack', berg: 'berg',
    // iglu proprio do jogador (Fase 3) — pack igloos/1.swf do wand
    igloo: 'igloo'
};

// Sala inicial (?room=<id>), mesma regra do RoomScene
export function initialRoom() {
    try { return new URLSearchParams(location.search).get('room') || 'town'; }
    catch { return 'town'; }
}

// Ciclo dia/noite: salas externas com pack noturno (*-night) gerado por
// remap de paleta a partir das versoes Halloween 2008 — geometria do pack
// dia, zero decoracao. O plano noturno e o ALTERNADO (crossfade); o pack
// primario da sala continua sendo o de dia.
export const NIGHT_ROOM_MAP = {
    town: 'town-night', plaza: 'plaza-night', dock: 'dock-night',
    beach: 'beach-night', cove: 'cove-night', forest: 'forest-night',
    berg: 'berg-night', mtn: 'mtn-night',
    village: 'village-night', forts: 'forts-night', dojoext: 'dojoext-night',
};

// Base do pack noturno alternativo da sala (null = sala nao participa
// do ciclo — internas e salas sem pack -night).
export function nightBaseFor(roomKey) {
    const pack = NIGHT_ROOM_MAP[roomKey];
    return pack ? `/assets/movies/${pack}` : null;
}

// Fase forçada por URL para testes: ?daynight=day|night. Sem override,
// a fase vem do servidor (relogio America/Sao_Paulo). Na porta 3100 o
// default continua sendo noite (preview).
export function phaseOverride() {
    try {
        const v = new URLSearchParams(location.search).get('daynight');
        if (v === 'day' || v === 'night') return v;
    } catch {}
    try {
        if (location.port === '3100') return 'night';
    } catch {}
    return null;
}

// Base do pacote vetorial da sala — durante uma festa, o servidor pode
// mandar package alternativo (assets/movies-party/<id>/<pack>). A URL
// diferente ja versiona os caches (packs e layers) por festa.
// Fase do ciclo dia/noite ('day'|'night'|null). null = sem ciclo
// (party substitution / ?moviepack= / sala interna tratam por si).
export function movieBaseFor(roomKey, party = null, phase = null) {
    const pack = MOVIE_ROOM_MAP[roomKey];
    if (!pack) return null;
    const sub = party?.substitutions?.byRoom?.[roomKey];
    if (sub?.package) return `/assets/movies-party/${party.id}/${sub.package}`;
    // debug/exploracao: ?moviepack=<dir> forca um pacote de movie qualquer
    try {
        const mp = new URLSearchParams(location.search).get('moviepack');
        if (mp) return `/assets/movies/${mp}`;
    } catch {}
    // ciclo: o pack primario e o da fase ATUAL — quem entra 21h ja carrega
    // a sala noturna direto, sem flash do pack dia. O pack oposto vira o
    // plano alternativo do crossfade.
    if (phase === 'night' && NIGHT_ROOM_MAP[roomKey]) {
        return `/assets/movies/${NIGHT_ROOM_MAP[roomKey]}`;
    }
    return `/assets/movies/${pack}`;
}
