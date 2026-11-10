# Deploy $0 — Club Penguin Browser

Plano para colocar o jogo no ar para testes, sem custo. Site estático +
servidor WebSocket + SQLite, tudo gratuito.

## Arquitetura (o que vai para onde)

| Peça | O que é | Onde fica |
|---|---|---|
| `client/dist/` | Site estático (HTML/JS/assets ~80MB) | Hospedagem estática ou o próprio VPS |
| `server/` | Node.js + `ws`, porta interna | VPS sempre ligado |
| `penguin.db` | SQLite (pinguins, coins, inventário) | Disco do VPS + backup |

O jogador baixa o site de graça e ele conecta via `wss://` no servidor.

## O que já está pronto no código

- `NetworkClient.js`: WS URL configurável — `VITE_WS_URL` > `wss://host/ws`
  (quando servido em HTTPS, mesmo domínio via proxy `/ws`) > `ws://host:8080` local.
- `server/index.js`: rate limit por socket (30 pkt/s, burst 60), `maxPayload`
  16KB, clamp de coordenadas, validação de `roomId`, chat já limitado a 120 chars.

## Caminho recomendado: VPS único (mais simples)

Um único VPS serve site + WebSocket + banco. Um domínio, zero CORS.

### Etapa 1 — VPS grátis
- **Oracle Cloud Always Free**: conta → VM.Standard.E2.1.Micro (ARM, 1GB) ou
  Ampere A1 (até 4 OCPU/24GB). Ubuntu 22.04/24.04. IP público fixo.
- Alternativa mais rápida porém depende do PC ligado: **Cloudflare Tunnel**
  (`cloudflared`) na sua máquina — HTTPS grátis, sem abrir porta no roteador.

### Etapa 2 — Domínio grátis
- `sslip.io`: `SEU_IP.sslip.io` funciona na hora, sem DNS.
- Ou afraid.org (subdomínio grátis) apontando para o IP do VPS.

### Etapa 3 — Servidor na máquina
```bash
# Node 20+ (NodeSource ou nvm)
# Caddy (HTTPS automático — instala e já emite certificado Let's Encrypt)
sudo apt install caddy nodejs npm
# subir o server como serviço systemd (Restart=always)
# Caddyfile:
#  seudominio.com {
#     root * /var/www/club-penguin/client/dist
#     file_server
#     reverse_proxy /ws localhost:8080   # ws upgrade automático
#   }
```

### Etapa 4 — Deploy do client
- `cd client && npm ci && npm run build` → copiar `dist/` para `/var/www/...`
- Alternativa: Cloudflare Pages/Netlify (grátis) com `VITE_WS_URL=wss://seudominio.com/ws`
  — separa site do servidor, mas adiciona uma conta e CORS de WS (funciona,
  WS não tem CORS, mas complica debugging). VPS único é mais simples.

### Etapa 5 — Backup do banco
- Cron diário: `sqlite3 penguin.db ".backup backup/penguin-$(date +%F).db"`
- Upload opcional para Cloudflare R2 (10GB grátis) ou manter 7 cópias locais.

## Checklist de segurança mínima (já aplicado)

- [x] Rate limit por conexão
- [x] Limite de payload
- [x] Clamp de coordenadas
- [x] roomId validado
- [ ] Rate limit por IP no AUTH_GUEST (criação de pinguins infinitos) — fazer se houver abuso
- [ ] Backup automático do SQLite (etapa 5)
- [ ] HTTPS via Caddy (obrigatório p/ wss)

## Custos

Tudo $0: Oracle Always Free (VPS), sslip.io/afraid.org (domínio),
Caddy/Let's Encrypt (HTTPS), SQLite local, Cloudflare R2 (backup opcional).

## Próximos passos sugeridos

1. Criar conta Oracle Cloud e subir a VM (etapa 1) — ~30min de clique.
2. Apontar domínio sslip.io para o IP.
3. Instalar Node + Caddy + subir server com systemd.
4. Build do client e publicar.
5. Convidar testers — cada um ganha pinguim `Penguin_XXXX` automaticamente.
