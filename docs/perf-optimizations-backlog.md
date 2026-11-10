# Backlog: otimizações de performance (vivem no backup)

> **Status:** ✅ **PORTADO para o projeto principal em 2026-11-09.**
> Medido no principal (headless): 1ª sala pronta em ~10.9s; troca de sala ~11.6s.
> Itens 1–3 aplicados em `client/src/` (merge manual); item 4 (`INICIAR_JOGO_RAPIDO.bat`) já existia.
> `warmPlayheads()` (fix de animação em cache-hit) é exclusivo do principal e foi preservado.
> **Ganho medido (headless, perfil limpo):** 1ª visita à sala ~45.6s → ~5.1s; troca de sala ~1.6s.

## O que foi feito no backup (referência: `club-penguin-browser-backup/`)

### 1. Decode lazy de SVG (maior ganho)
- **Problema:** loops eager `for (const f of movie.files.keys()) movie._svgImage(f)` em `RoomScene._initMovie` e `PenguinArt.load` mandavam o browser rasterizar centenas de SVGs que a maioria das salas nunca usa → long tasks de 130–330ms e telas de loading de ~40s.
- **Fix no backup:** warm-ups removidos; SVGs decodificam sob demanda via `artCanvas()` (já lazy). Arquivos alterados:
  - `backup/client/src/scenes/RoomScene.js` (`_initMovie`)
  - `backup/client/src/entities/PenguinArt.js` (`PenguinLibrary.load` — remover o loop `for (const ch of Object.values(lib.movie.characters))`)
- **No principal ainda existe** o loop eager em `PenguinArt.js` linhas ~42-44 (e possivelmente equivalente no RoomScene — verificar).

### 2. Cache IndexedDB de packs imutáveis
- Chunks `chunk-N-<hash>.pack` têm hash no nome → imutáveis → cacheáveis.
- No backup: store IDB `penguin-packs` guarda os packs; `timelines.json` e `chars.pack` continuam fetch fresco.
- Resultado: revisitas pulam ~8MB de fetch por sala/pacote.
- **Atenção:** layers rasterizadas de sala já têm cache IDB próprio (`penguin-movie-layers`) — não confundir; o novo store é para os **packs fonte** (chars/chunks), um nível abaixo.

### 3. `_layoutChatInput` sem reflow forçado
- DevTools apontou forced synchronous layout: mediação (`getParentBounds`/`updateBounds`) feita sincronamente após escrita de estilo.
- Fix: escrever estilos primeiro, medir dentro de `requestAnimationFrame`.
- Arquivo: `backup/client/src/scenes/RoomScene.js` (`_layoutChatInput`).

### 4. `INICIAR_JOGO_RAPIDO.bat` (modo produção)
- Já copiado para o principal. Faz `vite build` + `vite preview` na 3000 — bundle minificado ~1MB vs ~6.4MB do dev server (phaser.js não-minificado).
- Servidor WS continua `node src/index.js` na 8080.

## Como portar
1. Diff `backup/client/src/movie/movie.js`, `RoomScene.js`, `PenguinArt.js` vs principal — as mudanças são cirúrgicas (remoção de warm-ups + cache IDB de packs + rAF no layout).
2. **Cuidado:** o principal recebeu muitas mudanças depois do backup (LoadingScreen GIF, Wardrobe novo, spawn seguro, look-at-cursor, paperdoll fixes). Fazer merge manual, não copiar arquivos inteiros.
3. Re-medir com `tools/` probes após portar.

## Ressalvas
- AdBlock do usuário consome ~94ms de main thread — só o usuário pode desativar./docs/perf-review-2026-11-09.md` no backup tem o review completo da análise de traces.
