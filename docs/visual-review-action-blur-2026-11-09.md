# Visual review — blur/pixelacao de itens em acoes (dance/throw) — 2026-11-09

## Sintoma reportado
Itens equipados ficavam "embaçados / baixa resolução / pixelados" durante dance e
throw de bola de neve; idle e walk pareciam corretos.

## Diagnostico

1. Render pipeline: `PenguinView.render` → `Clip.draw(ctx, af, ss)` → `_drawShape`
   rasteriza cada SVG via `MovieRoom.artCanvas(file, ch, scale)` com `scale` fixo
   (= supersampling ss ≈ 1.75).
2. Instrumentacao de `_drawShape` (probe-scale.mjs) mediu a escala linear da
   matriz `world` por frame:
   - idle:  {1.00, 0.10, 2.10}
   - dance: {1.00, 0.10, 2.10}
   - throw: {4.20, 0.20, 0.19}
3. As poses de throw/dance posicionam sprites de roupa com matrices de escala
   2–4.2x. O bitmap rasterizado em ss fixo era esticado pelo world transform →
   effective resolution caia para ~ss/4.2 ≈ 0.42x → pixelacao.

## Correcao

- `client/src/movie/clip.js` `_drawShape`: rasteriza em
  `eff = scale * min(|world_linear|, 8)` — canvas tem px suficientes para o
  fator de ampliacao da pose. `w/h` continuam em unidades de mundo.
- `client/src/movie/movie.js`:
  - `_drawShape` (renderLayer/renderFrame — salas, icones, catalogo): mesma
    correcao (bug latente identico).
  - `artCanvas`: chave de cache passou a incluir `scale`
    (`file|scale`) — antes um unico canvas por arquivo causaria thrash com as
    novas escalas efetivas.
  - `tintedCanvas`: idem (`...|scale`).
- `client/src/entities/PenguinArt.js`: pre-decode dos SVGs dos packs
  (penguin base + cada item de roupa) em idle, em lotes de 16 a cada 30ms —
  elimina o pop-in de ~1s em que os itens renderizavam parcialmente na
  primeira acao (frames de dance/throw usam shapes ainda nao decodificados).

## Verificacao

- probe-eff.mjs: `eff` observado = {0.17..7.35}; k=4.20 → eff=7.35 ✓
- Nitidez (energia de gradiente alpha-weighted, canvas 5x upscale):
  - throw: 8.22 → 13.37 (+63%)
  - idle: 19.48 → 19.48 (inalterado)
- `pageerror`: zero em todos os probes.
- `npm run build`: OK (dist atualizado).

## Limitacao
Gemini API sem cota no momento da verificacao (retry ~5h) — analise visual
feita por metricas de pixel + probes; screenshots em tools/shots/pg3-*.png
para revisao humana.

---

# Addendum — player card photo (fundo) — 2026-11-09

## Sintoma
Foto de fundo (item type 9) ocupava espaco demais e cobria badge "Member",
botoes e demais elementos do card.

## Causa
Em `PlayerCard.paint()` a foto era desenhada DEPOIS do frame inteiro do card,
ignorando a ordem de profundidade do Flash: `photo_mc` esta na depth 33,
logo apos `background_mc` — badge (`icon_mc`, depth 183), botoes (185/193),
nome e paperdoll (106) devem renderizar por cima. Alem disso o conteudo do
pack `photos/<id>` (stage 210x210, arte ~225px) excede a janela reservada e
precisa de clip.

## Correcao (`client/src/ui/PlayerCard.js`)
- Entries divididos por `photoE.depth`: desenha os entries com depth <= 33,
  depois a foto, depois os entries restantes — foto fica atras de tudo.
- Foto clipada nos bounds reais do sprite do `photo_mc` (sprite 600 = janela
  ~205x203) composados com a matrix do photo_mc — so ocupa a area azul escura.

## Verificacao
- Diff foto on/off no canvas do card: bbox alterado = exatamente o retangulo
  da janela (canvas 777x1005, diff x66-681 y196-806 = window 8-213 x 40-243
  em coords do card) — sem vazamento para badge/botoes.
- `pageerror`: zero. Build OK.

---

# Addendum — player card photo (fundo) — 2026-11-09

## Sintoma
Foto de fundo (item type 9) ocupava espaco demais e cobria badge "Member",
botoes e demais elementos do card.

## Causa
Em  a foto era desenhada DEPOIS do frame inteiro do card
(), ignorando a ordem de profundidade do Flash:
 esta na depth 33, logo apos  — badge (,
depth 183), botoes (185/193), nome e paperdoll (106) devem renderizar por
cima. Alem disso o conteudo do pack  (stage 210x210, arte ~225px)
excede a janela reservada e precisa de clip.

## Correcao ()
- Entries divididos por : desenha os entries com depth <= 33,
  depois a foto, depois os entries restantes — foto fica atras de tudo.
- Foto clipada no bounds reais do sprite do  (sprite 600 = janela
  ~205x203) composados com a matrix do photo_mc — so ocupa a area azul escura.

## Verificacao
- Diff foto on/off no canvas do card: bbox alterado = exatamente o retangulo
  da janela (canvas 777x1005, diff x66-681 y196-806 = window 8-213 x 40-243
  em coords do card) — sem vazamento para badge/botoes.
- : zero. Build OK.
