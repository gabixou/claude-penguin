# Visual Review — Boot Loader (tela inicial)

Data: 2026-11-09
Cenas: BootScene (primeira tela) vs referência `tools/shots/ref-boot-loader.png` (fontsinuse 21459 — loader original CP)

## O que foi implementado

`client/src/scenes/BootScene.js` reescrito para reproduzir o loader original:

- **Fundo**: azul profundo com vinheta radial (`#2f6fb8` centro → `#0a2c60` bordas), via canvas radial gradient — como o radial gradient do original.
- **Logo**: `logo.svg` do projeto (wordmark do usuário) em `client/public/assets/ui/logo.svg`, centralizado em ~44% da altura, displaySize 430px, com halo branco translúcido (14%) atrás para contraste do wordmark azul sobre fundo escuro.
- **Barra de progresso cápsula**: container azul-escuro `#0d2b5c` arredondado, ícone circular azul com setas de rotação (reload) à esquerda, trilho interno escuro e fill amarelo→amarelo-claro (brilho no topo) — preenchimento animado.
- **Posição**: logo no centro-alto, cápsula no terço inferior (~70% altura), como no original.
- Removidos: texto "LOADING..." (original não tem), título "CLUB PENGUIN" em texto, barra de progresso antiga.
- `logo.svg` adicionado a `client/public/assets/ui/`.

## Comparação (qwen3.5:4b via ollama-worker + Gemini)

Gemini apontou e foi aplicado: vinheta radial, cápsula com ícone de setas, fill amarelo-alaranjado, barra no terço inferior, remoção do texto LOADING.

### Diferenças restantes (conscientes)

1. **Logo**: original usa "Disney CLUB PENGUIN™" em 3D; usamos o `logo.svg` do projeto conforme pedido do usuário.
2. **Efeitos 3D do logo original** (gelo/brilho): não replicados — o wordmark do usuário é 2D flat.
3. **TM symbol**: não se aplica ao logo customizado.
4. **Letterbox**: barras pretas laterais vêm do Scale.FIT do canvas, não da cena.

## Screenshots

- Clone: `tools/shots/clone-boot-loader.png` / `clone-boot-small.png`
- Referência: `tools/shots/ref-boot-loader.png` / `ref-boot-small.png`
- Raw Gemini: `tools/shots/review-boot-raw.txt`

## Notas técnicas

- Headless Chrome estrangula rAF e o `delayedCall` do Phaser acumula delta real — a janela do BootScene em wall-time é muito maior que os 1500ms de game-time. Para screenshots usou-se delay temporário de 60s + `Page.captureScreenshot` via CDP (o `page.screenshot` do Playwright trava em `document.fonts.ready`).
- Build regenerado (`npm run build` OK).
