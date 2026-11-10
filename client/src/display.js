// Resolucao fixa: o mundo do jogo e sempre 760x480 (coords classicas
// do Club Penguin); backing store e camera zoom escalam o mundo para a tela.
export const WORLD_W = 760, WORLD_H = 480;
export const SS_MAX = 3; // teto de supersampling (custo do renderer canvas SWL)

// ss fixo ~2.25 para TUDO (layers, pinguins, HUD): mais nitido que o
// gopenguin (renderiza a 1x), rasterizacao barata, cache IDB de layers
// vira entrada unica por sala e resize/zoom/troca de monitor nunca
// re-rasteriza. Em 4K o upscale GPU e suave (vetor -> filtro linear).
export const SS_FIXED = 2.25;

// Mantida por compatibilidade: retorna o fator fixo. Antes era adaptativo
// (cssW*dpr/760, cap SS_MAX) — o re-raster por mudanca de ss custava um
// rebuild inteiro das layers e fragmentava o cache IDB por resolucao.
export function computeSupersample() {
    return SS_FIXED;
}
