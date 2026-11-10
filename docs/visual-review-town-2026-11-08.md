# Visual Review — Town (2026-11-08)

## Contexto
Sessão focada no port do pinguim vetorial + remoção do fallback estático (PNG/SWL).

## Mudanças aplicadas
- **Fallback removido**: RoomScene agora renderiza exclusivamente o pacote vetorial
  `/assets/movies/<pack>/` (timelines.json + SVGs). Sem PNG/SWL.
- **`_showRoomFail()`**: se o pack falhar, mostra retângulo `#263238` + texto de erro
  (em vez do PNG com zonas de trigger/polígonos verdes).
- **BootScene**: removidos preloads de `room_*.png`, `.swl`, atlas SWL, penguin-atlas/body,
  penguin-frames e ui_icons (não usados pelo renderer vetorial).
- **Warmup de SVGs**: após `MovieRoom.load`, todos os arquivos SVG são decodificados em
  paralelo (`movie._svgImage`) — sem isso o primeiro frame demorava muito.
- **Fix crítico de textura**: `renderLayer(...).then(refresh)` só atualizava a texture
  quando a promise resolvia; como `renderLayer` é async e lenta, a texture ficava presa
  no canvas em branco do `addCanvas` → fundo preto. Agora `.catch().then(refresh)`
  garante refresh mesmo em caso de erro/lentidão.

## QA
- Screenshots: `tools/shots/clone-town.png` (após freeze do loop) e `ref-town.png`.
- Gemini: quota diária estourada (429, retry ~1h45) — análise feita com qwen3.5:4b local.
- Resultado qwen: fundo 100% renderizado (céu, Coffee Shop, Nightclub, Gift Shop),
  sem polígonos verdes, pinguim vetorial visível, sem glitches.
- Cores médias sky: clone (106,142,165) vs ref (111,119,120) — equivalente.

## Pendências conhecidas (de reviews anteriores)
- Letterboxing: mundo lógico 760×480 com FIT — barras laterais em telas widescreen
  (ref tem enquadramento próprio; mudar exigiria repensar proporção do mundo).
- Nametag/anel de seleção: Gemini anterior reportou ausência — verificar visualmente
  (probe indica que existem; possível falso negativo do modelo).
- Spawn de jogadores sobrepostos e roupas de outros jogadores (dados de papel).
