# Visual review — pins e backgrounds do player card (2026-11-09)

## Pedido
Pins e planos de fundo do pinguim não apareciam no wardrobe/player card,
apesar de o Arenovisk possuir todos os itens.

## Diagnóstico
No protocolo original (Houdini/WAND), pins e backgrounds são itens:
- **type 8 = flag** → pin do player card (`upl`) / bandeira do igloo
- **type 9 = photo** → fundo do player card (`upp`)

Nosso `items.json` já tinha os dois tipos (460 + 387 itens), mas:
- `TYPE_TO_SLOT` só mapeava types 2–7 → wardrobe ignorava 8/9
- Servidor rejeitava slots fora do paperdoll
- PlayerCard não renderizava `photo_mc`/`flag_mc`

Referência autoritativa encontrada no bundle do gopenguin.lol:
- tabs do wardrobe: `['colour', ...slots, 'pin', 'background']`
- card: `clothing/photos/<id>` attach em `photo_mc` (matriz do entry)
- pin: `clothing/icons/<id>` attach em `flag_mc` com scale **0.66**

## Implementado
- **Assets**: 718 ícones `icons/<id>` (types 8/9) + 380 packs `photos/<id>` baixados do gopenguin.lol; `icons/index.json` gerado (1031 ids)
- **`items/catalog.js`**: types 8→slot `flag`, 9→slot `photo`; `wardrobeItems()` inclui ambos filtrados pelo manifesto de ícones; `SLOT_LABELS` = Pins/Backgrounds
- **`Wardrobe.js`**: categorias `flag`/`photo` no menu
- **`Penguin.js`**: `equip`/`applyOutfit` aceitam `flag`/`photo` em `gpaOutfit` (não desenham no paperdoll — `PenguinArt.setLook` ignora)
- **Servidor**: `EQUIP_SLOTS` = paperdoll + flag/photo; `getEquipped` retorna os 8 slots; `equipItem` valida tipo (flag→8, photo→9) via catálogo
- **`PlayerCard.js`**: desenha `photos/<id>` na matriz do `photo_mc` e `icons/<id>` na matriz do `flag_mc` ×0.66 (port exato do gp); repaint ao equipar
- **Bug bônus**: `JOIN_ROOM` log usava `x`/`y` indefinidos → exceção abortava o envio de `ROOM_STATE` (corrigido para `jx`/`jy`)

## Verificado
- WS: `EQUIP_ITEM flag=500 photo=901` → persistido no SQLite (`equipped` table)
- UI real (Arenovisk): abas Pins/Backgrounds com itens, clique equipa → `gpaOutfit.flag=7225`, `photo=9063` → `[EQUIP]` no server
- Pixel-diff A/B no canvas do card: **270.469 px alterados (34,6%)** ao togglear photo+flag — fundo e pin renderizam
- `pageerror`: zero; build OK

## Limitações conhecidas
- Pins/fundos de **outros jogadores** não aparecem no card deles (servidor não faz broadcast desses slots — `paperdoll` da sala só carrega os 6 slots)
- 68 ícones type8/9 e 7 photos não existem no upstream gopenguin.lol (ficam fora do wardrobe)

Playwright MCP/Gemini indisponíveis — verificação por probes playwright-core + pixel-diff.
