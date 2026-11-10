# Visual QA — Todas as salas (2026-11-08)

## Escopo
Verificação das 12 salas renderizadas via pacotes vetoriais `/assets/movies/<pack>/`
(timelines.json + chunks SVG do gopenguin.lol). Sem fallback PNG/SWL.

## Bugs encontrados e corrigidos (client/src/movie/movie.js)

1. **Ordem de camadas top-level errada** — `topLevelLayers()` ordenava TODAS as
   entradas por `floor(y)*1000+floor(x)`. O cliente web (`depthOf` em gp-index.js)
   usa `e.depth` para `background_mc` e entries não-sprite, e a fórmula y-based
   só para sprites. Na mine, `background_mc` (depth 2) subia para z≈240379 e
   cobria os sprites de mobília → "mancha branca" onde ficavam lampião, mesa e
   vassoura. Corrigido portando `depthOf()` fielmente (foreground_mc=900001,
   casos especiais cavemine/igloo não se aplicam aos packs atuais).

2. **Máscaras clipDepth com transform errado** — `_drawMasked` usava
   `setTransform(scale,...)` + matrix que já inclui supersampling → escala
   dupla e composite em coordenadas erradas. Reescrito em device px
   (bounds absolutos, translate simples). Verificado com instrumentação:
   rink tem 179 grupos mascarados, 0 com conteúdo perdido após o fix.

3. **colorTransform aproximado** — `tintedCanvas` usava multiply+'lighter',
   gerando glow/fringing (dançar: quadros de piso errados, luzes como blocos;
   rink: bloco branco nas arquibancadas; forts: retângulo na bandeira).
   Trocado por transformação por pixel exata (mult+add RGBA), igual a
   `clip.js._pixelTint`.

## Resultado por sala (probe browser, build de produção)

| sala   | movie | layers | painted | tempo  |
|--------|-------|--------|---------|--------|
| town   | ok    | 13     | sim     | ~60s   |
| coffee | ok    | 9      | sim     | ~15s   |
| dance  | ok    | 14     | sim*    | ~22min |
| pizza  | ok    | 20     | sim     | ~167s  |
| plaza  | ok    | 6      | sim     | ~146s  |
| forts  | ok    | 9      | sim     | ~127s  |
| dojo   | ok    | 11     | sim     | ~243s  |
| beach  | ok    | 14     | sim     | ~29s   |
| dock   | ok    | 16     | sim     | ~125s  |
| lodge  | ok    | 15     | sim     | ~134s  |
| mine   | ok    | 15     | sim     | ~30-180s|
| rink   | ok    | 40     | sim     | ~128-285s|

*dance: camada do meio é transparente por natureza; screenshot confirma sala
renderizada (~80% tons médios).

## QA visual (Gemini) — estado após correções

- **dance**: poster "DANCE CONTEST", quadros de piso e luzes agora corretos.
  Restam: nota roxa no chão (estado de script), refletores acesos vs apagados
  (estado de script), anel de seleção (feature do jogo).
- **rink**: bloco branco das arquibancadas RESOLVIDO. Restam: variante de time
  verde vs azul (estado de script da sala), livro "Snow and Sports" ausente,
  anel de seleção.
- **mine**: mancha branca RESOLVIDA (lampião/mesa/vassoura visíveis).
- **town**: feixes de luz da nightclub (animados/script), tapete da nightclub
  levemente diferente, nametag sobreposto (bug do Penguin.js, não da sala).
- **coffee/pizza/plaza/forts/dojo/beach/dock/lodge**: renderização essencialmente
  correta; diferenças restantes são textos dinâmicos (relógio de forts),
  estado de sprites controlado por script AS3 (fogo do caldeirão dojo, variantes
  de cor), ou artefatos do nosso HUD (fora do escopo das salas).

## Colisão e transições entre salas (adicionado depois)

- `movie.js`: `_parseExits()` extrai `sendJoinRoom(room,x,y)` dos
  `triggerFunction` em `main.actions[*].source`; `buildCollision(scale)`
  rasteriza `block_mc` (áreas bloqueadas) e cada `triggers_mc.<nome>_mc`
  (zonas de saída) em grids de alpha; `hitBlock/findPath/triggerAt` portados
  do `Room` do cliente web (limites x 20..740, y 20..430).
- `Penguin.moveTo` aceita `onDone`; `RoomScene` clique -> findPath -> anda ->
  triggerAt -> `changeRoom(room, spawnX, spawnY)`.
- 14 packs novos baixados de gopenguin.lol para cobrir todos os destinos:
  shop, book, boiler, lounge, pet, cave, stage, forest, light, ship, village,
  attic, dojoext, cavemine — `MOVIE_ROOM_MAP` e modal do mapa atualizados
  (26 salas).
- Verificado E2E: pinguim anda até a borda esquerda de town -> trigger
  `dock_mc` -> `changeRoom('dock', 600, 200)` -> sala dock carrega no spawn.
- Novas salas probe: village/shop/cavemine carregam sem fail.

## Limitação conhecida
Os pacotes não executam os scripts AS3 das salas (`main.actions.source/custom`,
ex.: `initArcheryCompetition`, variantes de time/cor, relógios, estados de
lights). O renderer executa apenas `stop/play/gotoAndStop` dos `commands`.
Elementos controlados por script podem divergir do gopenguin.lol — gap
consciente, não bug de renderização.

## Arquivos
- Screenshots clone: `tools/shots/room-<sala>.png`
- Referências: `tools/shots/ref-<sala>.png`
- Probe: `tools/probe-rooms-seq.mjs`, `tools/probe-maskstats.mjs`

## QA visual town (2026-11-08, pós-otimização)

Screenshots: tools/shots/clone-town.png + ref-town.png; review bruto em
tools/shots/review-town-raw.txt (Gemini 3.5 flash).

### Otimizações de performance aplicadas nesta rodada
- movie.tick() agora rastreia _dirtyRoots (root top-level por playhead) —
  salas animadas re-renderizam só as layers afetadas, não todas a cada tick.
  Medido na dance: ~20 renders/s vs ~120/s antes.
- Boot das layers sequencial com yields (antes: todas em paralelo → main
  thread saturada, tela preta por minutos, screenshot/browser travando).
- buildCollision atrasado 1.5s para não competir com o 1º render.
- Cache IndexedDB de layers (store penguin-movie-layers): rasterização das
  layers salva como WebP por (pack, supersampling, fingerprint). Town:
  85s → 8.6s na 2ª visita (headless swiftshader; em GPU real é bem
  mais rápido). Cada sala cacheia independentemente.

### Divergências apontadas pelo Gemini (avaliadas)
- Barras pretas laterais (letterbox FIT 760x480 em tela 16:9) — mantido FIT
  para não distorcer; ref estica o canvas. Candidato futuro: scale CSS fill.
- "HUD esticada" — HUD já é vetorial 760x480 full-width como o CP original;
  provavelmente efeito do letterbox. Sem ação.
- Anel de seleção: clone tem sprite 'ring' (#3399ff) oculto
  (visible:false verificado em runtime); ref mostra anel dourado no
  próprio jogador. Melhoria futura: exibir ring só no player local com
  tint dourado (precisa variante de asset ou pixel-tint).
- Nametag: texto preto bold, possível artefato de hinting da font
  GoPenguin em 12px — monitorar.
- NPCs da ref ausentes no clone — depende de backend/servidores, não de render.

## Player card (player card do Club Penguin)

- client/src/ui/PlayerCard.js: renderiza o sprite 701 frame 2 do pacote
  /assets/movies/interface (aba paperdoll: background, botoes profile/home/
  buddy/mail/stamps/ignore/report/close) via Clip._drawListFrame num canvas
  com supersampling 3x. Sobrepoe nome (name_txt -> Phaser.Text Arial Bold 16
  #000) e preview do pinguim via PenguinView (mesmo pipeline vetorial).
- Hit-test _penguinAt() no RoomScene: bounds da arte vetorial; clique no
  pinguim abre o card em vez de andar. Funciona para local e remotos
  (usa penguinColor + gpaOutfit ja sincronizados — sem op nova no server).
- Botoes: close e clique no fundo fecham; 'profile' no proprio jogador abre o
  modal de roupas; demais acoes sociais mostram mensagem "em breve" (backend
  ainda nao tem buddy/ignore/report/mail/stamps).
- Verificado: card abre em ~9s (carga lazy do interface pack), 11 filhos,
  janela pintada. Screenshot: tools/shots/pc-test2.png.

## Mapa da ilha (map.swf)

- `client/src/ui/IslandMap.js`: renderiza o frame principal de
  /assets/movies/map via Clip (supersampling 2x), converte os botoes
  *_btn + labels langtown/langplaza em zonas clicaveis; close_btn e clique
  no fundo fecham. Destinos parseados do AS3 do map.swf (clickMap).
- Novas salas baixadas: mtn, cove, shack, berg (packs existem no
  gopenguin.lol) — MOVIE_ROOM_MAP agora com 30 salas.
- Mapeamento: dock,beach,village,mine->shack,berg,cove,forest,fort->forts,
  igloos->lodge,rink,dojo->dojoext,mtn; langtown->town, langplaza->plaza.
  igloos_btn nao tem onRelease no AS3 original — mapeado para lodge por
  posicao (aproximacao).
- Verificado E2E: toggleMap -> mapa visivel (~6s 1a carga) -> clique na zona
  do dock -> changeRoom('dock') -> sala carrega. Screenshots:
  tools/shots/map-open.png, map-dock.png.

## HUD vetorial (dock_mc + icons_mc)

- `client/src/ui/VectorHud.js`: renderiza sprites 228 (dock_mc) e 334
  (icons_mc) do interface pack num canvas 760x480 transparente, com zonas
  nos botoes nomeados -> mesmas acoes do handleHudButton. Substitui o
  WebHud bitmap. icones condicionais ocultados (phone/hudIconView/mod/
  egg_timer/news/buddy do topo, buddy_online_mc) — no gopenguin.lol so
  aparecem correio e mapa por padrao.
- Bug real corrigido em clip.js `_localBounds`: branches sprite/button
  retornavam bounds ja em coords de mundo e eram transformados DE NOVO
  pela matriz world (aplicacao dupla) — afetava zonas do HUD, player card
  e island map. Agora retornam direto.
- Anel de selecao azul (#3399ff) exibido so no jogador local ( PenguinView
  escondia sempre); nametag regular 11px.
- Botoes dock: safe/emote/action/throw/chat/player/buddy/home/help +
  player_icon; icones: map -> toggleMap, mail -> stub.
- Verificado: 13 elementos, map_mc abre mapa, chatRect sobre chat_mc
  (235-523). Screenshot: tools/shots/hud-vector.png; reviews
  tools/shots/review-hud-raw.txt e review-hud2-raw.txt.
- Pendente: log_mc (historico de chat) e balloons_mc (baloes de fala)
  precisam de text fields dinamicos do Flash — mantido balão canvas atual.
