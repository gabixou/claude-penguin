# FESTAS.md — calendário de festas do Club Penguin

Referência de datas das festas clássicas do Club Penguin (horário de
Brasília, UTC-3). Use estas datas para agendar festas no painel admin
(`/admin` → Festas) ou via `POST /api/parties`.

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

Painel admin (`http://<server>:<porta>/admin` → aba **Festas**):

1. **Agendar** — nome + início/fim (datetime-local) + fuso.
2. **Ativar** — força a festa a começar agora por N minutos
   (desativa sobreposições automaticamente).
3. **Trocas** — por festa, cadastre substituições:
   - `package` (por `roomId`): pacote alternativo em
     `client/public/assets/movies-party/<partyId>/<pack>/`
   - `music` (global ou por sala): programId de música ou JSON
     `{"<room>":"<id>","*":"<id>"}`
   - `catalogue`, `free_items`, `extra_rooms`, `map`: valores
     livres consumidos pelo cliente/sistemas
4. **Desfazer** — exclui a festa e suas trocas (rollback).

O relógio **do servidor** decide a festa ativa: o cliente recebe
`party` no `PLAYER_DATA` e um `PARTY_UPDATE` quando a data vira.
Progresso do jogador (tarefas, mensagens vistas) fica em
`player_party` e é acessível via `PARTY_INFO`/`PARTY_PROGRESS`.
