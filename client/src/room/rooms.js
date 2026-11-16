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
    shack: 'shack-night', // Mine Shack: sem versao HP2008, mesma receita de paleta
};

// Base do pack noturno alternativo da sala (null = sala nao participa
// do ciclo — internas e salas sem pack -night).
export function nightBaseFor(roomKey) {
    const pack = NIGHT_ROOM_MAP[roomKey];
    return pack ? `/assets/movies/${pack}` : null;
}

// Pack de crepusculo ("avermelhado", nascer/pôr do sol) — derivado do
// pack dia por transform de paleta. Mesmo conjunto de salas do ciclo.
export function twilightBaseFor(roomKey) {
    const pack = MOVIE_ROOM_MAP[roomKey];
    return NIGHT_ROOM_MAP[roomKey] ? `/assets/movies/${pack}-twilight` : null;
}

// Fase/zona forçada por URL para testes: ?daynight=day|night|dawn|dusk.
// Sem override, a zona vem do relogio local (America/Sao_Paulo, mesma
// tabela do servidor). Na porta 3100 o default e 'night'.
export function zoneOverride() {
    try {
        const v = new URLSearchParams(location.search).get('daynight');
        if (v === 'day' || v === 'night' || v === 'dawn' || v === 'dusk') return v;
        if (v === 'daynight') return 'dusk';
    } catch {}
    try {
        if (location.port === '3100') return 'night';
    } catch {}
    return null;
}

// ?zprog=0..1 — trava o progresso dentro da zona forçada (QA do fade:
// ex. ?daynight=dusk&zprog=0.5 mostra o pack twilight puro).
export function zoneProgressOverride() {
    try {
        const v = parseFloat(new URLSearchParams(location.search).get('zprog'));
        if (Number.isFinite(v)) return Math.min(1, Math.max(0, v));
    } catch {}
    return null;
}

// ?dayauto=<segundosPorZona> — loop de QA do ciclo completo:
// dia -> dusk -> noite -> dawn -> dia, tempo igual por zona.
// Ex.: ?dayauto=20 faz um ciclo de ~80s com os fades visiveis.
// Tem precedencia sobre ?daynight/?zprog.
export function dayAutoSeconds() {
    try {
        const v = parseFloat(new URLSearchParams(location.search).get('dayauto'));
        if (Number.isFinite(v) && v > 0) return v;
        if (new URLSearchParams(location.search).has('dayauto')) return 20;
    } catch {}
    return null;
}

// Base do pacote vetorial da sala — durante uma festa, o servidor pode
// mandar package alternativo (assets/movies-party/<id>/<pack>). A URL
// diferente ja versiona os caches (packs e layers) por festa.
// Zona do ciclo ('day'|'dawn'|'dusk'|'night'|null). null = sem ciclo.
// O pack PRIMARIO segue a zona do momento do load: de dia = pack dia,
// janelas de transicao = pack twilight, de noite = pack -night — quem
// entra 21h ja nasce na sala noturna, sem flash. Os outros packs viram
// planos alternativos e o crossfade e por peso do relogio.
export function movieBaseFor(roomKey, party = null, zone = null) {
    const pack = MOVIE_ROOM_MAP[roomKey];
    if (!pack) return null;
    const sub = party?.substitutions?.byRoom?.[roomKey];
    if (sub?.package) return `/assets/movies-party/${party.id}/${sub.package}`;
    // debug/exploracao: ?moviepack=<dir> forca um pacote de movie qualquer
    try {
        const mp = new URLSearchParams(location.search).get('moviepack');
        if (mp) return `/assets/movies/${mp}`;
    } catch {}
    if (zone === 'night' && NIGHT_ROOM_MAP[roomKey]) {
        return `/assets/movies/${NIGHT_ROOM_MAP[roomKey]}`;
    }
    if ((zone === 'dawn' || zone === 'dusk') && NIGHT_ROOM_MAP[roomKey]) {
        return `/assets/movies/${pack}-twilight`;
    }
    return `/assets/movies/${pack}`;
}
