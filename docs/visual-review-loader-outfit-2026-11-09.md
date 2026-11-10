# Visual review — loader GIF + roupa no pinguim (2026-11-09)

## Escopo
- `client/src/ui/LoadingScreen.js`: spinner trocado para `loader_arrows.gif` autentico (DOM `<img>` animado), fundo radial azul medio, barra fina + status.
- Assets: packs `clothing/{170,221,233,374,2114}` baixados de `gopenguin.lol/swf/assets/clothing/sprites/` (so existiam 58 packs; os ids do outfit de teste nao estavam entre eles — por isso so o chapeu 407 aparecia).

## Evidencias
- `tools/shots/probe-outfit4.png`: pinguim em Town com os 6 itens visiveis (qwen3.5:4b confirmou chapeu, mascara, cachecol, moletom, botas e guitarra).
- `tools/shots/probe-outfit3.png` / clone-loader-*.png: tela "Joining Town..." com GIF de setas, gradiente radial e barra.

## Resultado
- `view.items.size === 6` ~15s apos load a frio (packs de roupa competem com o load da sala; aceitavel, melhora com cache).
- Render identico ao GoPenguin: `PenguinView.render` desenha cada item no mesmo `animationFrame` (frame secreto) — conferido contra o bundle do cliente web.

## Animacao de salas (mesma data, adendo)
- Causa: cache IndexedDB de layers pulava `renderLayer` → playheads nunca criados → `tick()` sem dirty roots → animacao congelada. So animava na 1a visita (sem cache) — por isso "as vezes sim, as vezes nao" (town/dance congelavam em revisita; cove animava por ainda nao estar cacheada).
- Fix: `MovieRoom.warmPlayheads()` (traversal sincrono que cria playheads sem rasterizar) chamado em `RoomScene._initMovie` para todo load.
- Verificado: town (cached) com 52 playheads, dirtyRoots ativos, ~24 renders/s na layer animada.
