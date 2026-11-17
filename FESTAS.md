# FESTAS.md — calendário de festas do Club Penguin

Referência de datas das festas clássicas do Club Penguin (horário de
Brasília, UTC-3). Use estas datas para agendar festas com as funções de
`server/src/parties.js` (veja **Como agendar**).

> As datas abaixo são as janelas históricas aproximadas do CP original.
> Ajuste ano/dia conforme a edição que quiser reviver.

| Festa | Início | Fim | Observações |
|---|---|---|---|
| Water Party | 19/dez | 7/jan | quinzes na neve, pinguins de água |
| Night Club Party | 9/jan | 27/jan | disco, sala dance temática |
| Chinese New Year | 8/fev | 23/fev | lanternas,  |
| Card-Jitsu Party | 15/fev | 1/mar | tournaments de card-jitsu |
| St. Patrick's Day | 15/mar | 30/mar | verde, sorte |
| April Fools | 1/abr | 7/abr | trocas de salas/brincadeiras |
| Earth Day | 20/abr | 5/mai | natureza |
| Cinco de Mayo | 25/abr | 10/mai | fiesta |
| Mother's Day | 1/mai | 14/mai | selos/flores |
| Western Party | 15/mai | 30/mai | faroeste |
| Anniversary / Summer Kickoff | 1/jul | 15/jul | festa de aniversário |
| Hallowe'en Party | 15/out | 31/out | fantasmas, candy |
| Club Penguin Winter Fiesta | 1/dez | 18/dez | natalidade |
| Night of the Living Sled | sazonal | — | corrida de trenó noturna |

## Como agendar

O painel admin (`/admin`) e a API `/api/parties` ainda não estão no
master — o `server/admin-panel.html` existe, mas o servidor não o serve.
Por enquanto as festas são gravadas direto no SQLite pelas funções de
`server/src/parties.js`, rodando um script dentro de `server/`:

```js
// server/agendar-festa.mjs  ->  node agendar-festa.mjs
import * as parties from './src/parties.js';

const id = parties.createParty({
    name: 'Water Party',
    startAt: Date.parse('2026-12-19T00:00:00-03:00'),
    endAt: Date.parse('2027-01-07T23:59:00-03:00'),
    timezone: 'America/Sao_Paulo',
});
parties.setSubstitution(id, { roomId: 'town', kind: 'package', value: 'town' });
parties.setSubstitution(id, { kind: 'music', value: '{"*":"<programId>"}' });
```

- **Agendar** — `createParty({ name, startAt, endAt, timezone })`
  (datas em ms UTC).
- **Ativar agora / encerrar** — `updateParty(id, { startAt, endAt })`;
  `updateParty(id, { status: 'cancelled' })` tira a festa do ar.
- **Trocas** — `setSubstitution(id, { roomId, kind, value })`:
  - `package` (por `roomId`): pacote alternativo em
    `client/public/assets/movies-party/<partyId>/<pack>/`
  - `music` (global ou por sala): programId de música ou JSON
    `{"<room>":"<id>","*":"<id>"}`
  - `catalogue`, `free_items`, `extra_rooms`, `map`: aceitos e enviados
    ao cliente, mas ainda sem consumidor no jogo
- **Desfazer** — `deleteParty(id)` exclui a festa e suas trocas.

O relógio **do servidor** decide a festa ativa: o cliente recebe
`party` no `PLAYER_DATA` e um `PARTY_UPDATE` quando a festa vira
(checado a cada 60 s). A tabela `player_party` guarda progresso do
jogador (tarefas, mensagens vistas), mas os ops `PARTY_INFO`/
`PARTY_PROGRESS` ainda não existem no master.
