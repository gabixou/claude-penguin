# Visual review — fixes loader / player card / chat input / balão (2026-11-08)

Escopo: 4 correções reportadas pelo usuário após fases 2-5.

## 1. Loading screen
- `LoadingScreen.js` reescrito: gradiente azul (`#0b3a6e → #1a6ab5`), "LOADING..."
  branco, anel de 12 setinhas tangentes rotacionando, **barra de progresso**
  (trilho escuro + fill claro) alimentada por `setProgress()` — fração do pack
  (0.15) + layers rasterizadas (0.15→1.0) em `RoomScene._initMovie`.
- Gemini confirmou: gradiente, texto, setas e barra todos presentes.
- Screenshot: `tools/shots/loader-new.png`.

## 2. Player card
- **Bug raiz do preview invisível**: `dollWorld` era pré-multiplicado por
  RENDER_SCALE e pelo offset dos bounds, mas `_drawListFrame` já compõe
  `world × entry.matrix` e o ctx já tinha o transform — resultado ~9×,
  desenhado fora do canvas. Corrigido para `world = matrix do paper_doll_mc`
  puro. Verificação por pixels: 36k px na cor do pinguim (0x1c2f4a) + 27k px
  brancos (barriga) no canvas do card.
- **Async**: card agora aparece imediatamente com corpo+outline
  (`paint(false)`); roupas `paper/<id>` carregam em background e repintam
  (`paint(true)` + `texture.refresh()`).
- **Close**: verificado com clique real — zona fecha o card. O que o usuário
  via era provavelmente o card "vazio" demorando (papers bloqueavam o build).
- Bug extra: `paperMovie(0)` para slots vazios → 404; corrigido com filtro de ids.

## 3. Input de chat no cilindro do dock
- **Bug raiz**: `chatPillRect()` lido sincronamente antes do build async do
  VectorHud → input ficava no rect fallback pequeno (76×30) à direita.
  Além disso **dois `<input>` coexistiam** (scene restart vaza DOM) — o
  primeiro, stale, ficava sobre o send_btn.
- Corrigido: `_layoutChatInput` lê o rect fresco; VectorHud emite
  `vectorhud:ready`; inputs antigos removidos por classe `cp-chat-input`;
  input removido no shutdown da scene.
- Verificado: 1 input em (436,680,347,24)px cobrindo o cilindro
  (chat_mc real: 239.8,451.3,239.5,19.9 logical).

## 4. Balão de chat
- Extraído o `layoutBalloon()`/`drawText()` **exatos** do bundle GoPenguin
  (`tools/gp-index.js`): sprite 161 frame "text", `balloon_mc`#114 matrix
  `[0.5,0,0,0.832,-82.3]`→(S=0), `pointer_mc`#156 ty `w=-48.25`,
  `lineHeight = size*1.15+leading(0) = 13.8`, `f = n*13.8 + 8 + 3`,
  baseline wy = `i*13.8 - f - 27.45` (antes: `-29.45-f + i*11.8` — offset e
  entrelinha errados → texto alto demais e vão embaixo).
- Textura verificada: texto ocupa faixa y 37-62 de 135 (dentro da região do
  corpo, alinhado abaixo como no original).

## Limitações
- Gemini fora do ar (quota diária, retry ~11h) — verificações por pixel/probe.
- Ollama local indisponível (MCP ollama-worker sem conexão).
