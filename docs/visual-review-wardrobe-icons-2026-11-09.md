# Visual review — Wardrobe item icons (2026-11-09)

## Escopo
Verificação dos previews (ícones) de todos os itens do inventário após varredura
completa das abas (All/Head/Face/Neck/Body/Hand/Feet).

## Problemas encontrados e correções
1. `_iconTexture` resolvia só 2 níveis (main→sprite→character). Ícones com
   sprites aninhados (36 packs) ou `sprites:{}` com character direto no main
   (12 packs) retornavam null → célula em branco. Corrigido para usar
   `MovieRoom.renderFrame(0)` que resolve a timeline inteira.
2. **5 ícones ausentes no upstream** (355, 1000–1003): gopenguin.lol não serve
   `icons/<id>` para esses ids. Fallback adicionado: renderiza `paper/<id>`
   (stage 100×100, formato idêntico ao de ícone).
3. **Itens sem nome** (1000–1003, type 2, cost 0, `name:""` — itens internos):
   filtrados do wardrobe (`it.name` obrigatório em `_filteredItems`).
4. **"Texture key already in use"**: guard `textures.exists(key)` antes de
   `addCanvas`.

## Verificação (probe Playwright, Arenovisk)
- Varredura de TODAS as abas/páginas: `total: 237` ícones no cache
- `failed: []` — nenhum load/render falhou
- `blank: []` — nenhum canvas vazio (checagem de pixels alpha>20)
- `pageerror`: zero; build Vite OK

## QA Gemini
Indisponível — cota diária da API esgotada (retry ~9h). Verificação feita por
probe de pixels (alpha coverage) + screenshot em `tools/shots/wardrobe-icons.png`.
