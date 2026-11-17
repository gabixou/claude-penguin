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

## Update 2026-11-17 — Botoes/UI originais do igloo.swf (wand)

- _syncEditBtn (botao DOM falso "Edit Igloo") substituido por _syncRoomButtons:
  renderiza os button-records reais do client/igloo.swf via IglooWidgets.js
  (igloo-wand pack): sprite 254 = catalogo (livro), 262 = edit (chave+lapis),
  com posicoes/escala exatas do matrix do sprite iglooRoom (276):
  catalogo (713.35,324.6), edit (688,418.35). Estados up/over/down nativos.
  Apenas esses 2 — backyard/contest sao vanilla-media AS3, removidos.
- Bug corrigido: texturas rasterizadas em SS_FIXED=2.25 exibiam 2.25x maiores;
  iglooButton agora divide por SS_FIXED.
- Editor: painel reconstruido com o topBar real (sprite 252) como header,
  abas do tabPane (206) filtrando o palette (all/local/iglu/mobília/piso),
  grade/place/move/remove/save/perms preservados.
- IglooCatalogue.js (novo): janela de catalogo estilo CP com abas
  Furniture/Flooring/Location, icones reais dos packs furniture/<id>,
  compra via IGLOO_BUY -> igloo-inventory.
- Pendente (precisa de asset/dados): paginas internas do catalog_igloofurniture
  vinham do webservice (shell swf so tem moldura+preview); editor original
  completo (iglooedit.swf: inventoryBar, recycleBin, musicMenu) ainda e
  aproximacao DOM sobre o chrome real.

## Update 2026-11-17b — Editor AS2 identico ao original

- Convertido client/igloo.swf do legacy-media (AS2, versao classica) para
  assets/movies/igloo-as2 e extraido o ActionScript (ffdec) — o fluxo de
  edicao real esta em frame_1 DoAction.as.
- Botoes da sala agora sao os sprites AS2: lock_igloo_btn (131) e edit_btn
  (122) do edit_tools_mc (143), nas posicoes reais do stage. So o dono ve.
- Edit mode portado: background_cover_mc (19, papel quadriculado) cobre a
  cena, HUD/players/pets escondidos, edit_controls com furniture_list_btn
  (View Items), furniture_catalog_btn (Buy Items) e igloo_upgrade_btn
  (Upgrade Igloo) — sprites 64/84/86 — e save_btn (133, flipX) no lugar do
  edit_btn. Fecha so pelo Save (como no AS2).
- Mobília: drag & drop real (pointer drag, depth por y, soltar fora da
  area 20..740/20..460 remove — checkTrash do AS). Sem grade de clique.
- furniture_selector_mc (114): painel azul com as 6 abas de categoria
  (all/floor/room/wall/puffle/igloo) renderizado do SWF; cada aba abre o
  IglooCatalogue filtrado pelo sort do catalogo (1=room,2=wall,3=floor,4=pet).
- IglooCatalogue ganhou aba Igloo (96 tipos, EQUIP -> IGLOO_SAVE iglooType).
- Pendente: gridview.swf original (browser de itens com icones dedicados)
  ainda nao portado — o selector abre nosso catalogo DOM; posicoes das
  zonas das abas sao aproximadas dos matrices dos filhos.
