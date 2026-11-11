// rooms.js - Lista fixa de salas e limites do mundo.
// As chaves são os roomIds que o cliente usa (MOVIE_ROOM_MAP em
// client/src/scenes/RoomScene.js). O servidor só aceita JOIN_ROOM
// para salas daqui — qualquer outro id é rejeitado.
//
// bounds: área andável em coordenadas do mundo (WORLD_W x WORLD_H =
// 760x480, ver client/src/display.js). Todas as salas atuais usam o
// mundo inteiro; mantenha os campos para salas futuras com áreas
// menores (ex.: caves ou iglus).

export const WORLD_BOUNDS = { minX: 0, minY: 0, maxX: 760, maxY: 480 };

// Lotação máxima por sala. Salas sociais comportam mais gente;
// salas de minigame/instância ficam menores.
const SOCIAL = 50;
const STANDARD = 40;
const SMALL = 25;

export const ROOMS = {
    town:     { maxPlayers: SOCIAL,  bounds: WORLD_BOUNDS },
    coffee:   { maxPlayers: SOCIAL,  bounds: WORLD_BOUNDS },
    dance:    { maxPlayers: SOCIAL,  bounds: WORLD_BOUNDS },
    pizza:    { maxPlayers: SOCIAL,  bounds: WORLD_BOUNDS },
    plaza:    { maxPlayers: SOCIAL,  bounds: WORLD_BOUNDS },
    forts:    { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    dojo:     { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    beach:    { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    dock:     { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    lodge:    { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    mine:     { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    rink:     { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    shop:     { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    book:     { maxPlayers: SMALL,    bounds: WORLD_BOUNDS },
    boiler:   { maxPlayers: SMALL,    bounds: WORLD_BOUNDS },
    lounge:   { maxPlayers: SMALL,    bounds: WORLD_BOUNDS },
    pet:      { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    cave:     { maxPlayers: SMALL,    bounds: WORLD_BOUNDS },
    stage:    { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    forest:   { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    light:    { maxPlayers: SMALL,    bounds: WORLD_BOUNDS },
    ship:     { maxPlayers: SMALL,    bounds: WORLD_BOUNDS },
    village:  { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    attic:    { maxPlayers: SMALL,    bounds: WORLD_BOUNDS },
    dojoext:  { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    cavemine: { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    mtn:      { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    cove:     { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    shack:    { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
    berg:     { maxPlayers: STANDARD, bounds: WORLD_BOUNDS },
};

export function getRoomConfig(roomId) {
    return ROOMS[roomId] || null;
}

// Recompensas de minigame calculadas no servidor — o cliente só informa
// o jogo e o nível concluído; `amount` enviado pelo cliente é ignorado.
// perLevel: coins por nível; maxLevel: teto de nível aceito por pacote.
export const MINIGAME_REWARDS = {
    pufflescape:  { perLevel: 50, maxLevel: 12 },
    beancounters: { perLevel: 50, maxLevel: 10 },
    pizzatron:    { perLevel: 50, maxLevel: 8 },
    icefishing:   { perLevel: 50, maxLevel: 5 },
};

export const REWARD_MAX_PER_PACKET = 500;
export const REWARD_MAX_PER_MINUTE = 10; // pacotes de reward por jogador/min
