# Visual/functional review — Pufflescape minigame integration (2026-11-09)

## Escopo

- Porta direita do Pet Shop (`triggers_mc.roundup_mc` → `ENGINE.sendJoinGame("roundup",true)`)
  agora abre o minigame **Pufflescape** (recriação Phaser do repo
  `clubpenguinadvanced/pufflescape`, vendored em `client/public/minigames/pufflescape/`).

## Mudanças

- `client/src/movie/movie.js`: parser de interações agora reconhece
  `sendJoinGame(` além de `sendGame(` (a sala Pet Shop usa a variante JoinGame).
- `client/src/minigames/MinigameOverlay.js` (novo): overlay DOM com iframe
  1520×960 escalado via `transform: scale()` para caber na viewport;
  botão ✕ para sair; mapeamento `roundup|pufflescape → pufflescape`.
- `client/src/scenes/RoomScene.js`: `_showGameUnavailable` tenta abrir o
  overlay primeiro (fallback: aviso "em breve"); música da sala pausa ao
  abrir e retoma ao fechar; overlay fecha em `changeRoom` e no shutdown
  da cena.
- `client/public/minigames/pufflescape/`: projeto standalone copiado
  (Phaser 3.50 próprio + Matter + plugin `phaser-matter-collision-plugin`
  agora servido localmente de `lib/` — CDN removido do index.html).

## Verificação (probes Playwright, clique real calibrado)

| Teste | Resultado |
|---|---|
| Pet Shop carrega, triggers parseados | `roundup_mc → game:'roundup'` ✓ |
| Clique real na porta direita | pinguim anda até (682,247), trigger dispara |
| Overlay abre | iframe `/minigames/pufflescape/index.html`, canvas interno 1520×960 ✓ |
| Fechar (botão ✕) | overlay removido, sala intacta ✓ |
| `pageerror` | zero |
| Assets do minigame | nenhum request 404 (exceto favicon) |

Screenshots: `tools/shots/pet-puffle2.png`, `tools/shots/puffle-overlay.png`,
`tools/shots/puffle-boot3.png`.

## Recompensa de coins (implementada depois)

- O jogo **não credita coins** — o fluxo de vitória é o sensor `Exit`
  (bola chega na saída → `endScreen` "Level N Complete!").
- `assets/components/Exit.js`: ao detectar a chegada da bola, dispara
  `window.parent.postMessage({source:'pufflescape', type:'level-complete', level:N})`.
- `MinigameOverlay`: valida `e.source === iframe.contentWindow`, envia
  `MINIGAME_REWARD {level}` via WebSocket e mostra toast "+50 coins".
- Servidor: novo op `MINIGAME_REWARD` → `playerStore.addCoins(+50)` por
  evento, **repetível** (level 1 feito 3x = 3×50), responde `PLAYER_DATA`
  que atualiza `network.coins` (player card/HUD/wardrobe).
- Verificado e2e: `1500 → 1550 → 1600` coins; toast visível; `pageerror` zero.

## Fix icones do wardrobe (deslocados/cortados)

- Causa raiz: a arte dos packs `icons/<id>` e centrada na **origem (0,0)**,
  nao no stage 100x100. `renderFrame` clipava no stage -> so o quadrante
  inferior-direito do item era visivel (bbox media [0,0,~20,~10]).
- `movie.js`: `renderFrame(frameIdx, canvas, scale, offX, offY)` ganhou
  offset opcional em unidades de mundo.
- `Wardrobe._iconTexture`: calcula `_boundsOfEntries` do frame e renderiza
  so a regiao do conteudo (com margem), em vez do stage inteiro; alpha-crop
  final mantido como seguranca. Escala de exibicao CELL-14/16 centralizada.
- Verificado: texturas 75x39 (metade clipada) -> 150x85 (arte completa);
  exibicao 40px centrada na celula de 54px.

## Limitações

- **Gemini visual-qa indisponível** (cota diária da API esgotada em sessões
  anteriores) — verificação foi por probes funcionais + screenshots.
  Comparação com gopenguin.lol não se aplica: o original não roda Pufflescape
  na web (era mini-game do cliente 3DS/Flash).
- O minigame roda em **iframe com Phaser próprio** — isolado do bundle
  principal (nuance: duas instâncias Phaser na página; áudio do jogo é
  independente e a música da sala é pausada enquanto aberto).
- Recompensa de coins implementada (ver seção acima). Persistência de
  progresso/level-select do minigame ainda não integrada.
- `LevelSelect` do jogo pode não ser alcançável pelo fluxo do Pet Shop
  (o Boot do projeto vai direto para LevelSelect; se quiser lock de fases,
  é polish posterior).
