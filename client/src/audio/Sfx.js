// SFX de cenario — sons extraidos dos SWFs originais das salas
// (vanilla-media rooms/*.swf -> client/public/assets/sfx/<room>/sound_N.mp3).
// O mapa interacao->som e configurado em RoomInteractions/ROOM_SCRIPTS.

const cache = new Map();
let volume = 0.8;

export function setSfxVolume(v) {
    volume = Math.max(0, Math.min(1, v));
}

// Toca /assets/sfx/<room>/sound_<index>.mp3 (index = ordem do DefineSound no SWF).
export function playRoomSfx(room, index) {
    if (index === undefined || index === null) return;
    const key = `${room}/${index}`;
    let a = cache.get(key);
    if (!a) {
        a = new Audio(`/assets/sfx/${room}/sound_${index}.mp3`);
        a.preload = 'auto';
        cache.set(key, a);
    }
    try {
        a.volume = volume;
        a.currentTime = 0;
        a.play().catch(() => {});
    } catch { /* autoplay policy */ }
}
