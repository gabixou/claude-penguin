# Plano de Moderação — Club Penguin Browser

> Objetivo: proteger o chat contra discurso de ódio, racismo, homofobia,
> palavrões e spam, inspirado no modelo do Club Penguin original.

## Como o Club Penguin original fazia (referência)

- **Whitelist, não blacklist**: ~300.000 palavras/frases aprovadas; o que
  não estava na lista não passava ("Safe Chat"). Versão extrema ("Ultimate
  Safe Chat") nem deixava digitar — só frases de menu.
- **Ban automático** instantâneo para palavrões flagrados.
- **200+ moderadores humanos**: reports enviavam o log da sala inteira;
  mensagens filtradas ficavam visíveis aos mods.
- **Escala de punição**: 24h → 72h → permanente (4+ ofensas).
- **Anti-"dictionary dancing"**: bloqueio de variações fonéticas e números
  no lugar de letras.
- **Filtro de username** na criação (nomes reais/impróprios bloqueados).

## Decisões tomadas (com o usuário)

| Tema | Decisão |
|---|---|
| Abordagem | **Blacklist PT-BR + EN** (não whitelist por ora) |
| Punição | **Só avisar/bloquear a mensagem** (sem mute/ban por ora) |
| Moderação | **Admin fixo** (IDs no `.env`), sem sistema de reports |
| Escopo atual | **Apenas documentar o plano** |

## Arquitetura proposta

```
Cliente digita msg
   → SEND_CHAT (WebSocket)
   → Servidor: chatFilter.check(message)
        ├─ normaliza (minúsculas, sem acentos, leetspeak→letras, colapsa repetições)
        ├─ match contra blacklist (word boundaries)
        └─ resultado:
             ├─ LIMPO → broadcast SEND_CHAT normal
             └─ BLOQUEADO → sendError(ws, 'CHAT_FILTERED', motivo)
                            + log interno [FILTER] para auditoria
```

**Regra de ouro: o filtro vive SOMENTE no servidor.** Filtro no cliente é
contornável; o servidor é a autoridade.

## Componentes

### 1. `server/src/chatFilter.js` (novo)

- `BAD_WORDS`: array de termos PT-BR + EN (palavrões, slurs raciais,
  homofóbicos/transfóbicos, pedofilia, etc.). Manter em arquivo separado
  (`badwords.js` ou JSON) para edição fácil sem mexer na lógica.
- `normalize(text)`:
  - `toLowerCase()`
  - remove acentos: `normalize('NFD').replace(/[\u0300-\u036f]/g,'')`
  - leetspeak: `@→a 4→a 3→e 1→i 0→o 5→s 7→t $→s !→i` (aplicado antes/depois
    de remover não-letras, cuidado com falsos positivos)
  - colapsa repetições: `/(.)\1{2,}/g → '$1$1'` (fuuuck → fuck, mas "ooo"
    legítimo → "oo"; avaliar)
- `containsBadWord(text)`: regex com **word boundaries** `\b` para evitar o
  problema de Scunthorpe ("class" contém "ass", "Dick" contém "ick").
  Exceção: slurs graves podem usar substring match mesmo sem boundary.
- Retorno: `{ blocked: bool, term?: string }` — logar o termo casado para
  auditoria (nunca logar a mensagem inteira com dados sensíveis? logar
  hash/trecho).

### 2. Aplicar nos pontos certos (`server/src/index.js`)

- `SEND_CHAT`: antes de sanitizar/broadcast → `chatFilter.check()`.
  Bloqueado → `sendError(ws, 'CHAT_FILTERED', 'Mensagem bloqueada pelo filtro')`
  e **não** retransmite.
- `RENAME_PLAYER` / `CREATE_PLAYER`: validar `username` com o mesmo filtro
  (CP bloqueava nomes impróprios/nomes reais).
- `JOIN_ROOM`/`publicPlayer`: username já filtrado na entrada, ok.

### 3. Filtro de username

- Reusar `chatFilter.containsBadWord()` em `playerStore.isValidUsername()`
  ou no handler — nome rejeitado → `CREATE_FAILED`/`RENAME_FAILED` com
  mensagem clara ("nome não permitido").

### 4. Rate limit anti-spam (barato, incluir junto)

- Por socket/sessão: máx. **5 mensagens a cada 10s** (token bucket em
  memória, `Map<playerId, timestamps[]>>`).
- Estourou → `sendError(ws, 'CHAT_SPAM', 'Calma aí! Aguarde um pouco.')`
  sem broadcast. Estado em memória (some no restart — aceitável).

### 5. Feedback no cliente (mínimo)

- `NetworkClient` já emite `net-error` → RoomScene mostra no chat.
  Opcional: toast DOM dedicado para `CHAT_FILTERED` (já existe
  `_showDomToast`).
- **Não** mostrar no chat qual palavra foi pega (ensina o bypass);
  mensagem genérica apenas.

### 6. Auditoria

- Log servidor: `[FILTER] playerId=X term=hash(term) room=Y` — sem a
  mensagem completa em produção (privacidade).
- Futuro: `chat_logs` no SQLite se quisermos histórico para mods.

## Fases futuras (não implementar agora)

1. **Mute/Ban persistido**: tabelas `moderation_actions`, comandos admin
   `/ban /mute /unban` restritos a `ADMIN_IDS` no `.env`.
2. **Reports**: botão `report` do PlayerCard (já stubado) →
   `chat_reports` + log da sala → fila de revisão admin.
3. **Safe Chat whitelist**: dicionário aprovado PT-BR (começar com ~500
   frases essenciais), toggle por jogador. É o modelo real do CP e o mais
   seguro para crianças — mas exige curadoria de conteúdo.
4. **Anti-evasão avançada**: deteção de separadores (`f.u.c.k`),
   leetspeak completo, variações fonéticas PT-BR.
5. **Lista de slurs atualizável**: arquivo JSON editável + reload via
   comando admin, sem restart.

## Riscos conhecidos

- **Blacklist nunca é completa** — sempre haverá bypass (gírias novas,
  codificação). Por isso as fases 1-2 (mute/ban + reports) são o complemento
  real: o filtro reduz, os humanos decidem.
- **Falsos positivos** — palavras legítimas contendo termos banidos
  (ex.: nomes próprios, "escroto" vs slur). Mitigar com word boundaries e
  lista de exceções (`allowlist`) para casos comuns.
- **Idioma**: lista inicial PT-BR + EN; gírias regionais BR vão surgir —
  manter a lista em arquivo separado facilita atualização.

## Estimativa de esforço (quando for implementar)

- Fase 1 (filtro + rate limit + username): ~meio dia, 2-3 arquivos.
- Fase 2 (mute/ban + comandos admin): ~1 dia.
- Fase 3 (reports + UI admin): ~1-2 dias.
- Safe Chat whitelist: projeto separado de conteúdo.
