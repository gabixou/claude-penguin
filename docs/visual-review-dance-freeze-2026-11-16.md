# Visual QA — dance freeze (penguin-actions pack-less)

Data: 2026-11-16. Contexto: relato de que o pinguim "fica parado após
alguns movimentos" ao dançar.

## Causa raiz
12 dos 65 movies `penguin-actions/<n>` estavam **sem pack** — cada SVG
era servido como arquivo individual (`chars/<file>`), ou seja, a primeira
dance que mapeava para um deles disparava até ~574 fetches HTTP
sequenciais. `frameReady()` só libera o desenho quando TODOS os SVGs do
frame decodificam — com centenas de requests pendentes o pinguim ficava
congelado por minutos (parecendo bug permanente).

Movies afetados: 85, 136, 138, 139, 141, 142, 143, 153, 155, 157, 159, 161
(144–574 SVGs cada).

## Correções
1. `tools/pack-loose-actions.mjs` — converteu os 12 para `chars.pack`
   (mesmo formato `{file, entries:{f:[off,len]}}` dos movies packed).
   ~21MB no total; arquivos .svg soltos removidos. `_looseChars` não é
   mais disparado para esses movies.
2. `client/src/preload.js` — após `PenguinLibrary.load()`, baixa os 65
   packs de penguin-actions para o IDB via `MovieRoom.prefetchRoom` em
   `requestIdleCallback` (sequencial). Custo único por navegador; a
   primeira dance de cada pose não espera fetch de pack.
3. `client/src/entities/PenguinArt.js` — `_frameWait()`: se o frame ficar
   >4s sem ficar pronto (decode estagnado), libera desenho parcial em
   vez de congelar para sempre.
4. `client/src/entities/Penguin.js` — watchdog de 15s no `_render`:
   se `view.render()` nunca resolver, `_rendering` é resetado
   (antes ficaria `true` eternamente = freeze garantido).

## Verificação ao vivo (playwright, localhost:3000)
- Outfit `body:24199` → dance frame 26 resolve para action movie **159**
  (ex-pack-less, 528 SVGs).
- 1ª dance: `frameReady` em ~6.2s (decode único dos SVGs; antes:
  centenas de fetches individuais).
- 2ª dance: `frameReady` em **307ms**, 20/20 hashes de canvas únicos =
  animação fluida.
- Playheads do action clip avançam 1→176 e param no `stop()` do frame
  176 — comportamento fiel ao SWF (rotina de ~7.3s, pose final retida
  até mover; como no original).
- Gemini vision: pinguim visível, sem artefatos/partes faltando
  (a pose final da rotina é neutra — não é freeze).
- `vite build` OK.

## Pendente
- Outfits que usam IDs de roupa fora dos 316 packs de `clothing/` não
  desenham as camadas (assinatura ainda resolve o action frame
  corretamente — corpo anima, roupa ausente). Ampliar cobertura de
  clothing fica para outra tarefa.
