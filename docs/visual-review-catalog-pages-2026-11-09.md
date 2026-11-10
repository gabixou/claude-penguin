# Visual review — catálogos: arte vazando entre páginas (2026-11-09)

## Bug
Páginas internas dos catálogos (Gift Shop/Penguin Style etc.) renderizavam
arte de uma página em outra.

## Causa raiz
`MovieRoom._playheads` era keyed apenas pelo path dot-notation
(ex.: `book.secret`). Catálogos reutilizam o MESMO nome de instância em
páginas diferentes com sprite ids distintos:

- clothing: `secret` = sprites 515/583/665 (páginas 4/5/6), `flag` = 31 ids (páginas 19/20)
- costume: `secret` = 316/413
- pets: `art` = 6/140/155, `secret` = 179/216/268
- sport: `art` = 24/346/352

O playhead criado na primeira página era reutilizado nas demais → a página
nova desenhava a timeline do sprite antigo.

## Fix (`client/src/movie/movie.js`)
- Novo `_playheadAll`: Map `path+spriteId → playhead` — cada instância
  (path, spriteId) tem playhead próprio, como no Flash.
- `_playheads[path]` mantido como "ativo" (último resolvido) para
  `goto`/`currentFrame`/`gotoPath`.
- `tick()` itera `_playheadAll` → todas as instâncias animam
  independentemente (flags dos catálogos voltam a animar).

## Verificação (probes Playwright, pixel-exact)
`tools/probe-catseq.mjs`: render sequencial (mesmo MovieRoom percorrendo
páginas) vs render isolado (MovieRoom novo por página) — dataURLs idênticos:

- clothing: 18/18 páginas OK
- sport: 7/7 OK
- costume: 6/6 OK
- pets: 5/5 OK
- `pageerror`: zero em todos

Build OK (`npm run build`), `dist/` atualizado.

## Nota QA
Playwright MCP e cota do Gemini indisponíveis nesta sessão — verificação
feita por probes playwright-core com comparação pixel-exact contra render
de referência, o que é mais estrito que comparação visual.
