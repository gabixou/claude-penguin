# Performance review — load + FPS (2026-11-10)

## Sintomas reportados

- Load demorando muito mesmo após F5
- Jogo lagado/lento em gameplay

## Diagnóstico (probes instrumentados)

1. **Load cold ~64s**: pipeline de desenho das layers é sequencial —
   cada `renderLayer` fazia `await` por shape e cada SVG novo esperava um
   decode de `Image` por vez (~100 round-trips serializados na town).
2. **Agravante — warm-up de SVGs**: o pré-decode adicionado no fix de blur
   (`PenguinArt.js`) disparava `new Image()` em lotes de 16 a cada 30ms,
   ~500 SVGs/seg por minutos — saturava a fila de decode durante o load
   **e** durante o jogo (micro-travadas contínuas).
7. **Versões intermediárias piores**: burst paralelo dos ~1831 SVGs do pack
   base do pinguim saturava a fila da mesma forma; chunks via `setTimeout(0)`
   faminto o rAF (FPS caiu para ~9).

## Correções

- `movie.js`: `prefetchSvgs()` — dispara decode de todos os SVGs do pack em
  paralelo (o `_imgCache` deduplica promises; o draw sequencial seguinte
  encontra tudo pronto). Modo `chunk` usa `requestIdleCallback` sem timeout.
- `RoomScene._initMovie`: `movie.prefetchSvgs()` logo após `warmPlayheads()`.
- `PenguinArt.js`: warm-up virou **fila adiada** — packs do pinguim/roupas só
  decodificam quando a sala termina de carregar (`PenguinLibrary.startWarm()`
  chamado no `reveal()`); chunks de 4 (pinguim, ~1831 arquivos) e 8 (roupas)
  agendados em idle, sem timeout.

## Resultados medidos (Playwright headless, viewport 1280×800)

| Métrica | Antes | Depois |
|---|---|---|
| Cold load town | ~64s | **5.0–6.9s** |
| Warm load (IDB) | ~36s+ | **2.7–2.9s** |
| FPS idle | ~39 (e caindo com warm-up) | **55** |
| FPS walk | ~25 | **51** |
| Longtasks em idle | vários 70–140ms | **0** |
| Room change (cache) | — | **0.1–1.4s** |

Nota: headless Chrome usa SwiftShader (GL por software) — FPS real no GPU do
usuário tende a ser >= 60. `pageerror`: zero.

## Segunda frente: uploads de textura por frame (mesmo dia)

### Problema

Cada top-level layer da sala era um canvas fullscreen (1330×840 a ss=1.75,
~4.5MB; até 2280×1440/~13MB a ss=3) virando `CanvasTexture` do Phaser.
A cada tick (~24fps) as layers "sujas" faziam `renderLayer` (repaint CPU do
canvas inteiro) + `tex.refresh()` (re-upload do canvas inteiro pra GPU).
O gopenguin.lol não tem esse custo: renderiza a sala inteira em canvas2d
imediato (`roomCache` 760×480, um único blit por frame, sem texturas).

### Solução: sprites animados como overlays

Na town só existem **8 sprites animados** (vs 13 layers fullscreen).
Novo pipeline em `movie.js` + `RoomScene.js`:

- `collectDynamics()` varre as layers e isola sprites com `frames>1` e
  ancestrais estáticos (máscaras e botões ficam de fora — preservam
  clipping e estados up/over/down).
- Cada um vira um **overlay próprio**: canvas pequeno (bounds de todos os
  frames, device px) + `CanvasTexture` + `Phaser.Image` na depth da layer
  (z-order idêntico ao anterior — penguins continuam intercalando certo).
- `_skipDynamic` faz a layer estática pular esses sprites na rasterização
  (sem ghosting do frame congelado).
- `tick()` agora expõe `_dirtyPaths` (paths completos que avançaram) e
  `_dirtyForced` (sujeira por interação). `frame()` repinta **só** os
  overlays cujo playhead/descendente avançou; layers estáticas só
  re-renderizam em interação (hover/botão).
- Fallback: sala com >60 dynamics ou sem dynamics usa o caminho antigo.

### Medido

- `renderLayer` de layer: **0 chamadas/2s** em idle (antes ~48/2s)
- Overlay renders: ~25/s mas em canvases de 94–511px (maior ~0.9MP vs
  layer 1.1MP+; maioria <0.1MP)
- coffee: 7 dynamics = **0.14MP** total vs 9 layers fullscreen
- dance: 20 dynamics = 1.25MP vs 14 layers fullscreen
- Load cold 5–7s, warm ~3s, FPS idle ~55 (headless/SwiftShader)

## Arquivos

- `client/src/movie/movie.js` — `prefetchSvgs(chunk)`, `collectDynamics`,
  `dynBounds`, `renderSpriteDynamic`, `_dirtyPaths`/`_dirtyForced`,
  `_skipDynamic` em `_drawEntry`
- `client/src/entities/PenguinArt.js` — fila de warm-up + `startWarm()`
- `client/src/scenes/RoomScene.js` — prefetch, `_setupDynamics`,
  `_renderDynamics`, `frame()` por overlays, `startWarm()` no reveal

## Fix: sala sumia ao abrir PlayerCard / resize (2026-11-10)

Dois bugs reais encontrados:

1. **Vazamento de CanvasTexture no PlayerCard** — cada `open()` criava `playercard_<ts>` e `close()` nunca removia. Aberturas repetidas acumulavam texturas GPU → pressão de memória → perda de contexto WebGL intermitente ("a sala some"). Fix: `close()` agora remove a textura.
2. **`applySupersampling` recriava layers invisíveis** — se o ss mudava após o reveal (resize de janela / zoom do navegador), `_buildMovieLayers()` gerava imgs com `setVisible(false)` sem re-render nem re-exibição → sala em branco até reload. Fix: após rebuild, re-renderiza todas as layers + dynamics na nova resolução e re-exibe atomicamente.

Verificado via probe: 3x open/close do card → `playercard_*` textures = 0, totalTex estável; resize 1280→900→1280 → ss 1.75→1.25→1.75, 13/13 layers visíveis em todos os estados.

## Fix: overlays dinamicos congelados (separador '#' + forced paths) (2026-11-10)

Regressao do sistema de overlays: filhos sem nome usam path `pai#depth` — o match de dirty path so testava `pai.` → sprites animados aninhados (dancefloor#1, stagelights#1, disco03#1, djtable#N, speakerfront#6#4) nunca disparavam re-render do overlay pai → floor/luzes/disco/DJ congelados no frame 1.

Fixes:
- `frame()`: dirty-path match aceita `pai.` E `pai#`.
- `_markRoot()` registra o path completo em `_forcedPaths` → `_dirtyForcedPaths`; overlays que CONTEM botoes/textos/gotoPaths (porta coffee shop, hover canopy/poster) re-renderizam na interacao.
- `_setupDynamics` filtra dynamics sem bounds validos antes de marcar `_skipDynamic`.

Verificado: dance room — 12 overlays re-renderizando ~24fps (disco03, dancefloor, stagelights, djtable, speakers); town — `gotoPath('dance_canopy_mc')` dispara re-render do overlay.

## Perf: cache de assets compartilhado + ss fixo + prefetch idle (2026-11-10)

Implementado o plano `plan-957e2e3ad8b402cf.md` (prioridade: tempo de entrada/revisita):

### P0 — `MovieRoom._sharedAssets` (LRU 24)
- `MovieRoom.load` agora separa assets imutaveis (timelines parseado, packs, indice `files`, exits/interactions, caches `_svg/_img/_art/_tint/_font`) de estado de playback (playheads, buttonStates, dirty sets — recriado por instancia, sem reset bugs).
- Revisita de sala/roupa/catalogo pula fetch+parse+decode de arte — caches quentes.
- Auditoria: nenhum codigo muta `data`/`sprites`/`characters`/`files` (playheads/estados em maps do room).
- `setScale()` nao limpa mais caches (chaves ja incluem scale; eram compartilhados — clear apagaria arte de outras salas).

### P1 — tempo morto do boot
- `BootScene` delayedCall 1500→400ms; `main.js` font race 1500→600ms.

### P2 — ss fixo 2.25
- `computeSupersample()` retorna `SS_FIXED=2.25` para tudo (layers+pinguins+HUD). Antes adaptativo (1.25–3) fragmentava o cache IDB por resolucao e re-rasterizava todas as layers em resize/zoom.
- CacheKey IDB colapsa para entrada unica por sala+fingerprint; `applySupersampling` em resize vira no-op (so zoom/centerOn).

### P4 — prefetch idle de packs
- `workers/manifest.worker.js`: parse de timelines.json fora da main thread.
- `MovieRoom.prefetchRoom(base)`: baixa packs → IDB `penguin-packs`; `chars.pack` agora cacheado com chave `url@source` (source = hash do timelines).
- `RoomScene._prefetchRoomsIdle()`: apos reveal, 1 sala por `requestIdleCallback` (timeout 8s), serial.

### Medicoes (probe-revisit.mjs, viewport 1280x800)

| Trecho | Antes | Depois |
|---|---|---|
| BOOT town cold | ~5.4s | 3.8s |
| town → dance (1a visita) | ~12.5s | ~17s* |
| dance → town | re-parse+re-decode | **0.7–0.9s** |
| town → dance | | **0.8–1.2s** |

*dance cold inclui parse 8.6MB + raster ss2.25 (mais pesado que ss1.75 anterior); uma vez por sala/versao — depois IDB hit.

### FPS em GPU real (probe-fps-headed.mjs, Chrome headed)
- IDLE 38.2fps / WALK 28.4fps — gap confirmado real (nao e SwiftShader). P3/P3b (atlas de animacao) fica como proximo passo SE priorizado.

### Pendente
- Dance cold ~17s: raster de segments e CPU-bound na main thread; proximo nivel = OffscreenCanvas em workers (refactor grande) ou aceitar (1x por sala).
- Atlas de animacoes para FPS — condicional a priorizacao.

## Perf: rasterizacao/tint em Web Workers (2026-11-10, experimento)

Backup pre-experimento em `E:\project\club-penguin-browser-backup` (robocopy /MIR sem .git/node_modules). Branch local `main` a frente do origin (push pendente de credenciais).

### O que mudou
- `workers/tint.worker.js`: pool de workers recebe ImageData + color-transform Flash (mult/add por canal, clamp), devolve bitmap transferido.
- `movie.js`: `artCanvas` agora rasteriza via `createImageBitmap(img, {resizeWidth, resizeHeight})` — decode SVG segue na main thread (limitacao do Chrome: `createImageBitmap` de SVG falha em worker — testado), mas o resize/raster e assincrono. `tintedCanvas` delega ao worker com fallback canvas. `_pixelTint` do clip.js virou wrapper de `movie.tintedCanvas` (cache compartilhado, sem getImageData duplicado por Clip).
- `_solidCanvas` (composite `source-in`) permanece — ja e GPU, sem getImageData.

### Medicoes
| Metrica | Antes | Depois |
|---|---|---|
| BOOT town cold | 3.8s | 3.4s |
| town → dance cold | ~17s | 9.9–14s |
| Revisitas | 0.7–1.3s | 0.37–1.07s |
| FPS headed idle/walk | 38.2 / 28.4 | 40 / 32 |

### Profile (probe-phases.mjs, dance cold)
- `_svgImage` decode: 786 SVGs — **gargalo dominante** (~897s acumulado; decode SVG e inerentemente main-thread no Chrome).
- `tintedCanvas` no worker: 3926 calls / 6.3s acumulado — tint praticamente saiu da main thread.
- `artCanvas` createImageBitmap: 8186 calls / 21s.

### Conclusao
Worker de tint valeu (~30% no dance cold, +12% FPS walk). Proximo degrau para dance cold = prefetch de DECODE em idle (nao so pack): decode antecipado dos SVGs da sala provavel enquanto usuario esta em outra sala. Alternativa: cache IDB de bitmaps rasterizados por sala (cold→warm entre sessoes).

### Visual QA
- Screenshots town/dance/revisit sem pageerror; usuario validou visualmente.
- Gemini quota esgotada (20/dia free tier) — review-town gerado antes do limite; dance sem analise Gemini nesta rodada. Reviews em tools/shots/review-*-worker-raw.txt.
