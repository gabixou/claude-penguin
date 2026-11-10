# Visual Review — Prompt de compra autenticico (2026-11-09)

Escopo: dialogs de confirmacao de compra / aviso de moedas insuficientes /
"already have this item" no catalogo da Gift Shop.

## Implementacao

- Novo `client/src/ui/Prompt.js`: renderiza o clip real
  `interface_mc.prompt_mc` do `interface.swf` (sprite 788) — o mesmo que o
  gopenguin usa em `INTERFACE.notice`. Frame 2 = Yes/No, frame 4 = Okay.
  Textos via `editTexts` + fontes Burbank do SWF; botoes `yes_btn`/`no_btn`/
  `ok_btn` com bounds reais dos button records; `block_mc` oculto (como no gp).
- `movie.js` `_drawEditText`: adicionado word-wrap/multiline (o
  `message_txt` do prompt tem wordWrap — mensagens longas de compra
  estourariam a caixa de 283px).
- `Catalogue.js`: `_confirm`/`_notice` agora usam `PromptUI` (o painel azul
  desenhado a mao foi removido). Avisos migrados de `_confirm` para
  `_notice` (Okay unico, como no original — antes apareciam Yes/No).
- `RoomScene.js`: prompt e modal — `pointerdown`/`pointermove` retornam
  quando `catalogue.promptOpen`; `_promptClosedAt` evita vazamento do
  clique do botao para o catalogo (mesmo padrao do wardrobe).

## Verificado por probes (cliques reais)

| Fluxo | Resultado |
|---|---|
| Buy item nao possuido | prompt frame 2 (Yes/No) com texto original |
| Yes | coins 1500->1480, inventario 1->2, notice "has been added" (frame 4) |
| coins=0 + Buy | prompt frame 4 "You need more coins." |
| Item ja possuido | notice "You already have this item." (frame 4) |
| pageerror | zero |

Screenshots: `tools/shots/prompt-confirm.png`, `prompt-done.png`,
`prompt-lowcoin.png`.

## Pendente

- Revisao Gemini nao rodada: cota diaria da API esgotada (retry ~10h).
  Validacao visual pendente — os assets sao 100% SWF original, risco baixo.
