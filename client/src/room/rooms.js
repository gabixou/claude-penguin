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

// Exploracao dia/noite: salas externas com pack noturno gerado por remap
// de paleta a partir das versoes Halloween 2008 (geometria do pack dia,
// zero decoracao). So usado no preview :3100.
export const NIGHT_ROOM_MAP = {
    town: 'town-night', plaza: 'plaza-night', dock: 'dock-night',
    beach: 'beach-night', cove: 'cove-night', forest: 'forest-night',
    berg: 'berg-night', mtn: 'mtn-night',
    village: 'village-night', forts: 'forts-night',
};

// Preview de testes na porta 3100 mostra sempre a versao noturna das
// salas externas mapeadas; qualquer outra porta/ambiente segue o normal.
function nightMode() {
    try { return location.port === '3100'; } catch { return false; }
}

// Base do pacote vetorial da sala — durante uma festa, o servidor pode
// mandar package alternativo (assets/movies-party/<id>/<pack>). A URL
// diferente ja versiona os caches (packs e layers) por festa.
export function movieBaseFor(roomKey, party = null) {
    const pack = MOVIE_ROOM_MAP[roomKey];
    if (!pack) return null;
    const sub = party?.substitutions?.byRoom?.[roomKey];
    if (sub?.package) return `/assets/movies-party/${party.id}/${sub.package}`;
    // debug/exploracao: ?moviepack=<dir> forca um pacote de movie qualquer
    try {
        const mp = new URLSearchParams(location.search).get('moviepack');
        if (mp) return `/assets/movies/${mp}`;
    } catch {}
    if (nightMode() && NIGHT_ROOM_MAP[roomKey]) {
        return `/assets/movies/${NIGHT_ROOM_MAP[roomKey]}`;
    }
    return `/assets/movies/${pack}`;
}
