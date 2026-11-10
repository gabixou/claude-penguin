# Visual Review — Inventory/Wardrobe vs Club Penguin original

Data: 2026-11-09
Refs: `tools/shots/ref-inventory.png` (Inventory_image.png, wikia via weserv),
`tools/shots/ref-inv-cats.png`. Clone: `tools/shots/inv-side.png`.
Reviews brutos: `tools/shots/review-inv{,2,3,4,5}-raw.txt`.

## O que foi feito no Wardrobe.js

- Inventário somente-leitura de itens possuídos (`ownedIds`), zero UI de loja
  (sem preços, cadeados, buyItem, contadores x/y, busca).
- Aba "All" (todas as categorias) + pills de categoria via menu "All Items"
  no rodapé (estilo original).
- Layout: painel lateral direito do PlayerCard (azul), grade 3x4 de ícones
  sem rótulos, células com borda cinza clara (#c8c8c8) e verde quando equipado,
  scroll vertical com calha cinza + botões circulares metálicos,
  aba azul lateral direita que fecha o painel.
- Mantido: equip/unequip via clique, sendEquip, cores possuídas.
- Compras continuam só via Catalogue.js nas salas.

## Verificações

- Probe: tab All = 61 itens / 6 páginas / 12 células; todas as abas allOwned;
  zero textos de preço/cadeado; pageerror = 0. Build OK.

## Descoberta importante (próximo passo)

O pack `/assets/movies/interface` sprite **701 frame 3** já contém o chrome
autêntico do inventário: `tab_mc` (painel branco, bounds sprite
x 110→477, y -4→304), `sort_mc` (botão+pill "All Items", y 288→312),
`next_btn`/`back_btn` (setas de página, x 436→464), `menu_mc_holder`.
A grade de itens NÃO existe no movie — o AS original posicionava os ícones
dinamicamente. Caminho fiel: PlayerCard renderiza frame 3 quando o
inventário abre (frame 2 = card fechado) e o Wardrobe desenha os ícones
sobre a área do tab_mc usando o transform sprite→tela do card.

## Pendências apontadas pelo Gemini (rodadas 4-5)

- PlayerCard: textos "Your Coins:" / "Your Stamps:" ao lado dos ícones;
  ícone do Spy Phone no canto inferior direito do quadro do pinguim;
  botão "?" possivelmente divergente.
- Texto `Coins: N` foi movido para o rodapé do card (ainda pode precisar
  de ajuste fino de posição).
- Pill "All Items": stroke preto contínuo com a moldura (detalhe menor).
