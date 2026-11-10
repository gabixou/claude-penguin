// Resolucao adaptativa: o mundo do jogo e sempre 760x480 (coords classicas
// do Club Penguin); o backing store e a camera zoom escalam conforme a tela.
export const WORLD_W = 760, WORLD_H = 480;
export const SS_MAX = 3; // teto de supersampling (custo do renderer canvas SWL)

// Fator de supersampling ideal: backing ~= tamanho CSS exibido * devicePixelRatio.
// Ex.: 1080p dpr1 -> ~2.25x | 1440p -> ~3x (cap) | 4K -> cap 3x | mobile -> ~1-1.5x
export function computeSupersample() {
    const vw = window.innerWidth || 1280, vh = window.innerHeight || 720;
    const cssW = Math.min(vw, vh * (WORLD_W / WORLD_H));
    const dpr = window.devicePixelRatio || 1;
    const ss = (cssW * dpr) / WORLD_W;
    return Math.min(SS_MAX, Math.max(1, Math.round(ss * 4) / 4));
}
