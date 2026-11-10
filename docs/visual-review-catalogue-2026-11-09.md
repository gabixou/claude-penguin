# Visual review — catálogo de roupas (2026-11-09)

## Escopo
Reescrita do `Catalogue.js` como port do player de catálogos do gopenguin (`xo`),
após relato de "crops errados" e "ações de compra não funcionam".

## O que foi verificado por probe (sem Gemini — cota diária esgotada)

- Página 1 (capa): controles "Next page" + "Close catalogue" ✓
- Virar página via `nextFrame()` real do botão ✓
- Página 2: 12 botões de cor com nome/preço reais do items.json ("Buy Blue for 20 coins") ✓
- Página 3: customizador de camiseta — 5 cores + 5 designs + "Buy custom T-shirt" ✓
- Compra: diálogo de confirmação → simula em localhost → coins 1500→1480, inventário 61→62, aviso "has been added to your inventory" ✓
- 11 catálogos abrem sem pageerror (sport, costume, pets, cove, ninja, dance, light, dock, lodge, mtn, pirate) ✓

## Achados visuais

- O "castelo/mansão" na página direita do catálogo de roupas é **arte legítima**:
  sprite 342 → char 327 (479×450) = cenário do "penguin painter" da edição
  atual (Halloween). Catálogos rotacionam edições como revistas — o pack local
  é o mesmo `/swf/catalogue-clothing/` do gopenguin.lol.
- Diff de pixels vs referência mostrou página direita mais escura no clone —
  provável diferença de posicionamento/escala do preview do pintor ou
  alinhamento do recorte; **pendente de re-validação com Gemini** (cota
  free-tier de 20 req/dia esgotada em 2026-11-09).
- Texto "YOUR COINS: N" agora é renderizado com a fonte TTF real do SWF
  (Burbank, `editTexts` + FontFace) — antes era SVG estático "YOUR COINS: 0".

## Pendências

- `furniture`/`igloo`/`adoptPuffle`/`archive` não portados (sem packs locais).
- Ações AS com `if/for/while` customizadas ficam sem efeito (mesmo comportamento
  do gp, que também as ignora — exceto páginas especiais já tratadas).

## Fix capa branca + loading (mesma data, 2ª rodada)

- **Causa da capa branca**: character `246` tem `maskFile: 'mask_246.svg'` — o gp
  renderiza a silhueta da máscara a partir de `maskFile` quando `masking=true`
  (`this.masking && b.maskFile ? b.maskFile : b.file`). Nosso `_drawMasked`
  desenhava `246.svg` (shape visível) como máscara → recorte errado → capa
  quase toda branca. Corrigido em `movie.js` (`_drawMasked` usa `maskFile`,
  `_drawShape` aceita override de arquivo). Verificado: pixels coloridos na
  área do livro subiram de ~30%/60% para **100%/99%** (referência gp ~96%/98%).
- **Modo carregando**: `Catalogue.open()` agora mostra `loadingScreen`
  ("Loading catalogue...") durante `MovieRoom.load` + fontes + 1ª render —
  equivalente ao catalog_viewer.swf do CP original. `_render()` passou a dar
  `refresh()` periódico na texture durante `renderFrame` (paint progressivo).
- Gemini confirmou capa completa (título, arte, botão X); único artefato:
  retângulo semi-transparente fraco atrás da arte do pinguim (provável sombra
  legítima do entry 288, desenhado após a máscara).
- Screenshot de referência `gp-catalogue-cover.png` saiu sem o catálogo
  (openCatalogue não abriu na captura) — comparação visual fina da capa fica
  pendente de nova captura.
