# Visual Review — Gift Shop catalogue open (2026-11-09)

Comparacao: clone `http://localhost:3000/?room=shop` + `openContent('clothing_catalogue')`
vs `https://gopenguin.lol/?room=shop` (catalogo aberto via clique no botao de roupa).

Screenshots: `tools/shots/shop-cat-open.png` (clone), `tools/shots/ref-shop-cat.png` (ref),
`tools/shots/cat-canvas.png` (canvas do catalogo isolado).

## Bugs encontrados e corrigidos nesta sessao

1. **Clique no botao de roupa nao abria o catalogo** — `clothing_btn` da Gift Shop
   fica em y 408-465, abaixo do `blockY=416` do HUD; o handler de `pointerdown`
   retornava antes de consultar as interacoes da sala. Corrigido em `RoomScene.js`:
   `clickTarget` com `content`/`game` resolve antes do bloqueio da faixa do HUD.

2. **Botoes do catalogo com bounds errados (fora do stage)** — `collectInteractive`
   passava a matriz do mundo (ja com `e.matrix`) para `_boundsOfEntries`, que
   aplicava `e.matrix` novamente: transform dupla. "Next page" cobria
   x 739-1024 num stage de 760 e "Close" ficava fora da tela. Corrigido em
   `movie.js` (passar matrix/path do pai; `nodes` agora guarda `parent` para
   `boundsFor`). Bounds reais: Next [241,18-526,412], Close [463,20-526,130].

3. **pageerror ao fechar** — `_render` em andamento continuava chamando
   `this._tex.refresh()` apos `close()` remover a texture. `_tex` agora e
   anulado no close e o intervalo verifica `this.movie`.

## Verificado por probes

- Clique real no `clothing_btn` -> loading screen visivel -> catalogo abre
- Clique na capa -> pagina 2 com 12 itens "Buy X for 20 coins" + Prev/Next/Close
- Clique no X -> fecha sem pageerror
- `pageerror`: zero

## Pontos do Gemini a revalidar

- "Dark rectangular artifact" na base da capa: provavelmente a faixa
  transparente abaixo do livro (bbox do livro y 18-421 de 480) mostrando o
  cenario escuro — no original o catalogo tambem fica sobre a sala. Se o
  usuario reportar, avaliar backdrop.
- "Missing page-turn button": a capa nao tem seta visivel — o hit area de
  "Next page" cobre a pagina esquerda inteira (comportamento do SWF: clicar
  no livro abre). Confirmar se no original ha indicacao visual de clique.
