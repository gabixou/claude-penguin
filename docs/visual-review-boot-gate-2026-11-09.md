# Visual/behavior review — boot loading gate (2026-11-09)

## Problema

Ao logar, a sala `town` aparecia parcialmente rasterizada antes de carregar
por completo. Causa raiz em `client/src/scenes/RoomScene.js`:

1. `_initMovie()` começa a rasterizar as layers do movie **em paralelo** com a
   autenticação WebSocket.
2. O handler `player-data` chamava `loadingScreen.hide()` incondicionalmente —
   quando o `PLAYER_DATA` chegava no meio do load das layers, a loading screen
   era escondida e a town parcial ficava visível.
3. As layer images ficavam visíveis progressivamente conforme cada
   `renderLayer` terminava.

## Correção

- `_buildMovieLayers()`: cada layer `img` nasce com `setVisible(false)`.
- Novo `reveal()` dentro de `_initMovie`: só roda ao final do boot (ou no hit
  de cache IndexedDB), torna todas as layers visíveis, seta `_movieReady`,
  esconde o loader e aplica o safe spawn. Caminho cacheHit agora também passa
  por `reveal()` (antes setava `_movieReady` direto, sem `_applySafeSpawn`).
- Handler `player-data`: `loadingScreen.hide()` agora só executa se
  `this._movieReady` — não derruba mais um load de sala em andamento.

Efeito: nenhum pixel da sala aparece antes do load completo; pinguins e
itens (que ficam sob o loader, depth < 21M) surgem junto com a sala.

## Verificação (probes Playwright, headless)

- `tools/probe-bootgate.mjs` — cold load (IDB vazio):
  - t≈6.6s: loader visível, movie não pronto, player já autenticado
  - t≈7.8s: 13 layers construídas, renderizando, loader na tela
  - t≈42.6s: reveal atômico — 13/13 visíveis, loader off, pinguim presente
  - **0 violações** (nenhuma layer visível antes de `_movieReady`), 0 pageerror
- `tools/probe-bootgate-warm.mjs` — warm load (IDB cache hit, reload):
  - reveal com 13/13, **0 violações**, 0 amostras parciais
- `npm run build` OK; `dist/` atualizado.

## Limitação

Comparação visual Gemini↔gopenguin não se aplica a estado transitório de
loading (e a cota do Gemini seguia esgotada); QA feito por probes de estado
 instrumentados. Gemini quota permanece indisponível se necessário re-tentar.
