# Visual Review — Chat Bubble (Fase 5) — 2026-11-08

## Escopo
Balão de fala fiel ao `balloons_mc` do interface pack (Club Penguin), substituindo o balão Phaser desenhado à mão.

## Implementação
- `client/src/entities/PenguinArt.js`: `bubbleArt()` renderiza os masters vetoriais **sprite 114** (corpo, `balloon_mc`) e **sprite 156** (faixa inferior + rabinho, `pointer_mc`) do interface pack, excluindo `message_txt`. Carrega a fonte embarcada `font_157.ttf` (Burbank Small Medium) via `FontFace`. `bubbleLines()` faz word-wrap a 114px como o original.
- `client/src/entities/Penguin.js` `showChat()`: port do `layoutBalloon()` do bundle GoPenguin web (`tools/gp-index.js`):
  - `d = min(114, maxLineW + 4) + 14` (largura), `f = nLines * 13.8 + 11` (altura do corpo)
  - corpo escalado `(d/bw, f/bh)` com base em y=-48.25; rabinho `scaleX=d/vw`, y=-48.25
  - texto preto 12px BurbankSmallMedium centrado na área do corpo, clipado ao corpo
  - ponta do rabinho posicionada em y≈-52 (topo da cabeça); balão some após 5s
  - funciona para jogador local e remotos (mesmo `showChat`)

## Bugs encontrados e corrigidos
1. **Texto invisível**: `ctx.rect()` do clip era definido depois do `setTransform` — o retângulo era transformado para coords erradas e clipava todo o texto. Fix: `setTransform` identidade antes do `rect/clip`.
2. **Primeira versão (slice 9-slice + sprite159 inteiro)**: Gemini apontou cor avermelhada, "rabinhos duplos" e fonte errada — o original não usa 9-slice; escala o sprite inteiro não-uniformemente. Reescrito como port fiel do `layoutBalloon()`.

## Verificação
- Probe E2E: `showChat()` → textura `bubble_*` 351×135 com **1990 pixels escuros** (texto presente), fonte `BurbankSmallMedium:loaded`.
- qwen3.5:4b no crop: formato correto (retângulo arredondado + rabinho triangular), texto "Waddle on! Teste de balão fiel do Club Penguin." legível, balão branco. Rabinho offset à esquerda = fiel ao SWF original (tab em x≈-55 do shape 155).
- Gemini: quota diária esgotada (20 req/dia, retry ~13h) — análise feita com qwen local.

## Screenshots
- `tools/shots/bubble-test.png` (balão sobre o pinguim em town)
- `tools/shots/bubble-crop.png` (recorte)

## Pendente
- `log_mc` (histórico de chat vetorial) ainda não implementado — Phase 4 remanescente.
- Balões de emote (frame 1 com `icon_mc`) não implementados.

---

# Loading Screen (extra) — 2026-11-08

## Escopo
Tela de carregamento estilo CP original (fundo azul, "LOADING..." branco, anel de setinhas girando) exibida durante carga inicial e troca de salas.

## Implementação
- `client/src/ui/LoadingScreen.js` (novo): container depth 21M — retângulo azul `#0e4d92`, texto GoPenguin bold 22px branco, 12 setas brancas em círculo (raio 34, tangentes) rotacionando via tween 1.4s.
- `client/src/scenes/RoomScene.js`: `loadingScreen.show()` no início de `_initMovie()`; `hide()` quando `_movieReady=true` (cache hit e fim do boot sequencial) e em `_showRoomFail()`.

## Verificação
- Probe: `loader:true, ready:false` durante carga; screenshot `tools/shots/loader-1.png` — centro `(14,77,146)` = `#0e4d92`, ~1760 px brancos (texto+setas) na posição esperada.
- Cobre a janela inteira de rasterização (primeira visita ~85s headless, ~9s com cache) — mesmo comportamento do loader original.
- Observação: `loader.swf`/`load.swf` do Wand exigiriam parser SWF completo (ffdec ausente); recriação vetorial Phaser é aproximação fiel do layout descrito pelo usuário.
- Gemini indisponível (quota diária) — verificação por pixel/probe.

---

# Player Card — preview frontal (extra) — 2026-11-08

## Escopo
Player card deve exibir preview do pinguim de frente (paperdoll), como o original/GoPenguin — não a visão lateral da sala.

## Implementação
- Baixados 20 packs `clothing/paper/<id>` do gopenguin.lol para `client/public/assets/paper/` (vista frontal dos itens).
- `client/src/ui/PlayerCard.js`: removido o `PenguinView` lateral. Agora desenha no próprio canvas do card:
  - `paper_doll_mc.body` (sprite 179/char 178) com `veColor(penguinColor)` — mesmo colorTransform do original
  - `paper_doll_mc.outline` (sprite 183)
  - cada item equipado via pack `paper/<id>` no anchor (110.7,142.9), ordem feet→body→neck→face→head→hand (io do GoPenguin)
- `tools/fetch-paper.mjs` criado para baixar os packs.

## Verificação
- Probe E2E: card abre, qwen confirma pinguim **de frente, inteiro** (corpo, barriga, pés, olhos), nome abaixo, sem roupas (jogador local sem outfit — esperado).
- Roupas frontais só aparecem para jogadores com `gpaOutfit` populado (dados do servidor).

---

# Look-at-cursor (extra) — 2026-11-08

## Escopo
Pinguim local deve "olhar" para o ponteiro do mouse quando parado, com as 8 direcoes fixas do original.

## Implementação
- `client/src/entities/Penguin.js`: `directionToward(x,y)` (atan2-90 em passos de 45°, identico ao `bs(gs(...))` do GoPenguin) e `facePoint(x,y)` — so atua quando `!isMoving` e `action===direction` (idle puro; sentado/emote nao giram). Troca `direction` + `setAction(dir)` = frame idle da nova direcao (o "giro").
- `client/src/scenes/RoomScene.js`: `_pointerWorld` atualizado em `pointermove` (worldX/Y) + `facePoint` no movimento do mouse; ao completar `moveTo`, `facePoint` reorienta para o cursor.

## Verificacao
- Probe: cursor em (380,100)/(700,312)/(60,312)/(380,450) → direction 5/7/3/1 corretas (cima/direita/esquerda/baixo).
- Andar continua usando direction+8 (walk); remoto nao e afetado (sem cursor).
