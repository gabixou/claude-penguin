# tools/ — pipeline de conteúdo

Ferramentas para auditar, versionar e preparar os assets do Claude
Penguin. Os assets em `client/public/assets` são derivados dos SWF
originais do Club Penguin (timelines.json + SVGs packed + packs
`chars/` por item) — o mesmo formato servido pelo Wand/legacy-media.

## Scripts

| Script | Uso |
|---|---|
| `audit-assets.mjs` | Auditoria de cobertura: quais itens do `items.json` não têm arte em `paper/`, `clothing/` e `outfits/`; salas sem pack em `movies/`; catálogos sem `timelines.json`. `--json` para saída máquina. |
| `set-edition.mjs` | Grava `validFrom`/`validTo` em itens do `items.json` para rodar edições de catálogo por data. `--clear` remove a vigência. |
| `make-state-pins.mjs` | Gera os pins das bandeiras dos 26 estados + DF (itens `9500`–`9526`, 20 moedas): ícones em `icons/<id>/`, entradas no `items.json`/`icons/index.json` e a variante `catalogues/clothing-br` (páginas 19–20 do catálogo de roupas com os estados; reaproveita os packs do original). O jogador alterna "Países / Estados do Brasil" no topo dessas páginas. Idempotente; depois de rodar, reinicie o servidor. Conferência visual: `catalogues/clothing-br/preview.html`. |

Exemplos:

```bash
node tools/audit-assets.mjs
node tools/set-edition.mjs --from 2026-12-01 --to 2027-01-31 --ids 5000-5100
node tools/set-edition.mjs --clear --ids 5001
```

## Vigência de catálogo

Itens podem ter `validFrom`/`validTo` (data ISO `AAAA-MM-DD`) no
`items.json`. O servidor (`server/src/catalog.js`) só vende e lista
itens dentro da janela — `BUY_ITEM` e `SET_COLOR` usam
`getAvailableItem`. Quem já possui o item não é afetado.

Para trocar de edição: rode `set-edition.mjs` com a nova janela e
reinicie o servidor (o catálogo carrega no boot).

## Origem dos assets

- **SWF originais**: `wand/legacy-media` (clone de
  `https://github.com/solero/wand-legacy-media`) contém os `.swf`
  por sala/jogo em `media/play/`. O `vanilla-media` (GitLab do
  solero) tem os packs de catálogo e papel — se tiver acesso,
  clone com `--recurse-submodules`.
- **Formato consumido pelo cliente**: cada sala tem
  `movies/<sala>/timelines.json` + layers SVG packed; cada item de
  roupa tem `clothing/<id>/` (chars + timelines) e `paper/<id>/`
  (paperdoll para player card); outfits completos ficam em
  `outfits/<id>.gpa`.
- A conversão SWF→JSON foi feita fora do repositório; para novos
  assets, o pipeline esperado é: extrair o display list do SWF
  (JPEXS/FFDec), gerar `timelines.json` + SVGs por layer e gravar
  em `client/public/assets/movies/<sala>/` ou
  `client/public/assets/clothing/<id>/`.

## Estado atual (auditoria)

Rode `node tools/audit-assets.mjs` para o relatório atualizado.
Historicamente faltavam ~241 itens de roupa (paper/clothing/outfit)
e algumas salas de minigame — a auditoria lista os ids exatos.
