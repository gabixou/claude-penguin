# Visual Review — Igloo (Fase 3, issues #34-#38) — 2026-11-16

## Escopo
Primeira entrega do sistema de igloo: backend de dados, catálogo de mobília,
registro de interiores, permissões, editor funcional e visita a igloo alheio.

## Comparado
- `http://localhost:3000/?room=igloo` (interior loc1 + cadeira posicionada)
- Referência: assets do wand (`igloo/locations/sprites/N.swf`,
  `igloo/flooring/N.swf`, `furniture/sprites/N.swf`) — fonte oficial.

## O que veio de fonte oficial vs aproximação
- **Oficial (wand)**: interiores `igloo-loc1..8` (locations/sprites 1-8),
  pisos `igloo-floor1..23` (flooring/), mobília `furniture/<id>` (1382 SWFs
  convertidos via `tools/convert-igloo-assets.mjs` — conversão em lote
  rodando; itens ainda não convertidos renderizam vazio).
- **Oficial (yukon-server/data)**: `igloo-catalog.json` — 1384 mobílias
  (nome/custo/max), 24 pisos, 96 tipos de iglu, 8 locations.
- **Aproximação**: painel do editor é DOM próprio (não o `iglooedit.swf`
  original); grade 27x11 células de 24px calibrada visualmente; mobília
  escalada para ~96px (sem footprint real dos crumbs); posição y-sort
  aproximada.

## Divergências encontradas e corrigidas
1. **Mobília invisível**: stage do SWF de mobília é ~550x400 e a arte ocupa
   ~60x73px — `setDisplaySize` encolhia o canvas inteiro. Fix: textura
   recortada nos bounds da arte (`_boundsOf`). Verificado: cadeira rosa
   renderiza no chão do iglu.
2. **Piso cobrindo a sala inteira**: `flooring/N.swf` é full-stage; a
   máscara da área do piso não foi extraída. **Desativado** — floor>0
   persiste no servidor mas não desenha overlay até extrair os bounds
   reais do `iglooedit.swf`. TODO em `IglooManager._setupFloor`.
3. **Boot direto em `?room=igloo`**: `igloo.enter()` não era chamado
   (só rodava em `changeRoom`) e `playerId` ainda não existia — fix com
   espera por `player-data`.

## Verificado
- Backend: `IGLOO_GET/SAVE/PERMS/BUY/INVENTORY` — compra cobra coins,
  inventário persiste, layout salva (floor/location/items), entrada em
  `igloo-<playerId>` com checagem de senha/amigos.
- Editor: palette com catálogo (120+ itens à venda), itens possuídos
  posicionáveis, place/move/remove, selects de piso/local, permissões,
  salvar → `IGLOO_STATE` → re-render + broadcast p/ visitantes.
- Visita: player card `home_mc` → `visitIgloo(ownerId)`; senha via prompt
  no `IGLOO_PASSWORD`; pets seguem ambientando (Fase 1).
- Gemini vision: interior correto, cadeira visível, HUD ok, sem arte
  quebrada. Build `vite build` OK.

## Pendente
- Conversão das ~1382 mobílias em lote (em andamento — itens não
  convertidos aparecem vazios até o pack existir).
- Máscara real da área do piso (desativado até extrair bounds).
- Footprint/tamanho real por mobília (crumbs do Yukon `assets/` não
  acessíveis; hoje escala uniforme ~96px).
- UI do editor fiel ao `iglooedit.swf` original (hoje DOM funcional).
- Música do iglu (`music` persistido, sem playback).
- Exterior do igloo no mapa da ilha por tipo (`igloos/N.swf` não usados).
- Igloo pets com rotina de habitat completa (hoje só vagam).

## Update — conversão de mobília concluída
- **1382/1382** packs de mobília gerados em `client/public/assets/movies/furniture/<id>/`
  (timelines.json + chars/*.pack), cobrindo 100% do catálogo.
- IDs 318/319 (Sleeping Bag, Bunk Bed) **removidos do catálogo**: não
  existe sprite SWF no wand (só restam hits de música/stamps) — itens
  pré-2008 delistados. Sem pack = item invisível, então foram excluídos
  de `server/src/data/igloo-catalog.json` (1384 → 1382).
- Verificação: todo id do catálogo tem `timelines.json` válido (0 missing).
- Build `vite build` OK após conclusão.
