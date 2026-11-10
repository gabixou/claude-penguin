# Visual Review — town — 2026-11-07 (sessão 3, pós-correções)

Fonte: `tools/shots/review-town-raw.txt` (clone `clone-town.png` vs ref `ref-town.png`).

Ambas as cenas: sala **Town** (Coffee Shop, Night Club, Gift Shop, HUD inferior).

## Divergências apontadas pelo Gemini nesta rodada

### Enquadramento/canvas
- Clone: barra lateral escura à esquerda (pillarbox por aspecto) e canvas com bordas arredondadas/traço branco.
- Ref: jogo preenche a janela.
- Correção provável: `Phaser.Scale.FIT` + `CENTER_BOTH` (já aplicado) e remover border/padding do canvas no CSS. **Não aplicado**: pillarbox é inerente ao aspecto da viewport (~1.88) vs mundo 4:3; o `border-radius: 8px` + `box-shadow` do canvas em `index.html` (fora de `client/src`? — na verdade `client/index.html`) gera o "traço branco"; fora do escopo `client/src`.

### Cenário/background
- Feixes de luz do Night Club cortam seco no topo; ref sai suavemente da tela. **Provável asset** (camadas SWL), não corrigido.
- Nitidez geral (antialias do scaler). Não aplicável diretamente.

### Personagens/penguins
- Anel de seleção: Gemini descreveu borda escura/centro azul escuro — provavelmente o shadow ellipse + sprite; o anel já foi simplificado para stroke cyan `#00a0e9` na sessão anterior.
- Nametag: clone parecendo cinza clara (halo branco do stroke) e ~12px abaixo da aura; ref preto bold junto aos pés.

### HUD inferior
- Barra ainda lida como "flutuando": causa real era a faixa clara de 4px no rodapé (gradiente parava em `BAR_Y+BAR_H-4`, deixando a cor de moldura `0x8ecdf2` visível) + cantos inferiores muito arredondados.
- Ícone MAP flutuando acima da barra (centro y=424 vs centro da barra 450).
- Pill de chat `#001c3d` mais escura que o ref (`#002D62` aprox).

### HUD superior
- Envelope com moldura cinza do asset e afastado da borda (~15px).

## Correções aplicadas nesta sessão

- **`ui/WebHud.js`**:
  - Barra: cantos inferiores `bl/br` 12→3 (moldura e stroke), e preenchimento explícito da faixa final de 4px com `BOTTOM` (`0x123f63`) — elimina a linha clara sob a barra.
  - Pill de chat: fundo `0x001c3d` → `0x002b5c`.
  - Ícone MAP: `(26,424)` → `(24,444)` — ancorado sobre a ponta esquerda da barra.
  - Envelope: `(41,35)` → `(32,26)` — mais próximo do canto.
- **`entities/Penguin.js`**:
  - Nametag: `y 12→10`, cor `#1a1a1a`→`#000000`, `strokeThickness 1→0` (o halo branco deixava o texto cinzento).

## Não aplicado (justificativa)
- **Letterbox/pillarbox e borda do canvas**: aspecto da janela vs mundo 4:3; `border-radius`/`box-shadow` estão em `client/index.html` (fora de `client/src`).
- **Feixes de luz do Night Club**: assets de cenário fora de `client/src`.
- **Moldura cinza do envelope / anel com aparência densa**: limitados pelos assets/sprites existentes.
- **NPCs/puffles**: estado multiplayer, não é bug visual do clone.
