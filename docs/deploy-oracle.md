# Deploy Oracle Cloud VPS — Club Penguin Browser

Guia passo a passo para colocar o jogo no ar em um VPS Oracle Always Free,
com HTTPS automático, WebSocket e backup do SQLite. Custo total: $0.

---

## Visão geral da arquitetura final

```
Jogador (browser)
   │  https://SEUIP.sslip.io
   ▼
Caddy (VPS :443)                      ← HTTPS automático (Let's Encrypt)
   ├── /            → arquivos estáticos  /var/www/club-penguin/dist
   └── /ws          → proxy WebSocket    localhost:8080
                              │
                        Node.js server (systemd)
                              │
                        SQLite penguin.db  (+ backup diário)
```

Um domínio só, sem CORS. O `wss://` é obrigatório — navegadores bloqueiam
`ws://` em páginas HTTPS.

---

## ETAPA 0 — O que já está pronto no código

- `client/src/network/NetworkClient.js`: resolve a URL do WS assim:
  `VITE_WS_URL` > `wss://<host>/ws` (em HTTPS) > `ws://host:8080` (local).
  Em produção servido via Caddy, cai automaticamente no `wss://dominio/ws`.
- `server/src/index.js`: rate limit por socket (30 pkt/s, burst 60),
  `maxPayload` 16KB, clamp de coordenadas, `roomId` validado, chat ≤120 chars.

Nada mais precisa mudar no código para o deploy funcionar.

---

## ETAPA 1 — Conta Oracle Cloud

1. Criar conta em https://cloud.oracle.com (Always Free).
   - Pedem cartão de crédito **só para verificação** — não cobram.
   - Home region: escolha **São Paulo (sa-saopaulo-1)** ou a mais próxima
     (menor latência para testers no Brasil).
2. No console: **Compute → Instances → Create instance**.

### Configuração da VM (sempre grátis)

| Campo | Valor |
|---|---|
| Name | `club-penguin` |
| Image | **Ubuntu 24.04 (aarch64)** — ARM |
| Shape | **VM.Standard.A1.Flex** (Ampere) — marque "Always Free Eligible" |
| OCPUs | 2 (até 4 grátis) |
| Memory | 12 GB (até 24 GB grátis) |
| Boot volume | 50 GB (Always Free) |
| SSH keys | "Generate a key pair for me" → **baixar a chave privada** |

3. Na página da instância: anotar o **IP público** (ex.: `150.136.x.x`).

> Se a região estiver "out of capacity" para A1.Flex, tentar outra região
> Always Free (ex.: us-ashburn-1, eu-frankfurt-1) ou shape
> VM.Standard.E2.1.Micro (AMD, 1GB RAM — suficiente, mas menor).

---

## ETAPA 2 — Domínio grátis

Opção A — **sslip.io** (zero configuração, funciona na hora):
- Domínio = `SEU_IP.sslip.io` → `150.136.x.x.sslip.io`
- Exemplo: IP `150.136.10.20` → `https://150.136.10.20.sslip.io`

Opção B — **afraid.org FreeDNS** (subdomínio mais bonito):
- Criar subdomínio tipo `clubpenguin.mooo.com` apontando para o IP.

Nesta doc usamos `SEU_IP.sslip.io` como placeholder.

---

## ETAPA 3 — Preparar o VPS (primeira vez, ~15 min)

Conectar via SSH (Windows: PowerShell ou Git Bash com a chave baixada):

```bash
ssh -i CAMINHO_DA_CHAVE ubuntu@SEU_IP
```

### 3.1 Atualizar sistema + instalar Node 22

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # deve mostrar v22.x
```

### 3.2 Instalar Caddy (HTTPS automático)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

### 3.3 Estrutura de diretórios

```bash
sudo mkdir -p /var/www/club-penguin /opt/club-penguin/server
sudo chown -R ubuntu:ubuntu /var/www/club-penguin /opt/club-penguin
```

---

## ETAPA 4 — Caddyfile (HTTPS + site + proxy WS)

Editar `/etc/caddy/Caddyfile`:

```
SEU_IP.sslip.io {
    root * /var/www/club-penguin/dist
    encode gzip
    file_server

    # WebSocket do jogo -> servidor Node na 8080
    # Caddy faz upgrade WS automaticamente no reverse_proxy
    reverse_proxy /ws* localhost:8080

    # fallback SPA (index.html para rotas desconhecidas)
    try_files {path} /index.html
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

> O certificado Let's Encrypt é emitido na primeira requisição HTTPS —
> leva ~30s. sslip.io resolve DNS automaticamente.

---

## ETAPA 5 — Servidor Node como serviço systemd

### 5.1 Enviar o código

Do seu PC (na pasta do projeto):

```bash
# compacta server/ + client/dist prontos
cd E:\project\club-penguin-browser
# gera o build do client se ainda nao tiver:
cd client && npm run build && cd ..

# envia (ajuste o caminho da chave)
scp -i CHAVE -r server ubuntu@SEU_IP:/opt/club-penguin/
scp -i CHAVE -r client/dist ubuntu@SEU_IP:/var/www/club-penguin/
```

### 5.2 Instalar dependências no VPS

```bash
cd /opt/club-penguin/server
npm install --omit=dev
```

### 5.3 Serviço systemd

`/etc/systemd/system/clubpenguin.service`:

```ini
[Unit]
Description=Club Penguin Browser WS Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/club-penguin/server
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=3
Environment=PORT=8080
# Opcional: IPs que recebem o pinguim de teste "Arenovisk" (padrao: so
# loopback/local). Para o SEU IP publico receber o Arenovisk em producao,
# descubra-o (ex.: curl ifconfig.me) e adicione:
# Environment=ARENOVISK_IPS=127.0.0.1,::1,::ffff:127.0.0.1,SEU_IP_PUBLICO

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now clubpenguin
sudo systemctl status clubpenguin   # deve estar active (running)
```

---

## ETAPA 6 — Backup do SQLite

`penguin.db` fica em `/opt/club-penguin/server/` (verificar `db.js` para o
caminho exato — ajustar se necessário).

Script `/opt/club-penguin/backup.sh`:

```bash
#!/bin/bash
DB=/opt/club-penguin/server/penguin.db
BK=/opt/club-penguin/backups
mkdir -p "$BK"
sqlite3 "$DB" ".backup '$BK/penguin-$(date +%F).db'"
# mantem ultimos 14 dias
find "$BK" -name 'penguin-*.db' -mtime +14 -delete
```

```bash
chmod +x /opt/club-penguin/backup.sh
# cron diario as 4h
(crontab -l 2>/dev/null; echo "0 4 * * * /opt/club-penguin/backup.sh") | crontab -
```

Opcional (ainda $0): sincronizar backups para Cloudflare R2 (10GB grátis)
com `rclone` ou `aws s3 sync`.

---

## ETAPA 7 — Verificação

1. `https://SEU_IP.sslip.io` → jogo carrega (tela de loading → Town).
2. DevTools → Network → WS connection para `wss://SEU_IP.sslip.io/ws` = 101.
3. Abrir em 2 navegadores/dispositivos → pinguins se veem andar/chat.
4. `sudo journalctl -u clubpenguin -f` → logs do servidor.

---

## ETAPA 8 — Atualizações futuras

Deploy incremental sem derrubar o servidor:

```bash
# no PC: build + enviar so o que mudou
cd client && npm run build
scp -i CHAVE -r dist ubuntu@SEU_IP:/var/www/club-penguin/
# server: enviar arquivos alterados e reiniciar
scp -i CHAVE server/src/*.js ubuntu@SEU_IP:/opt/club-penguin/server/src/
ssh -i CHAVE ubuntu@SEU_IP "sudo systemctl restart clubpenguin"
```

Caddy serve `dist/` direto — não precisa reload para assets novos
(cache do navegador resolve com fingerprint do Vite).

---

## Checklist final

- [ ] Conta Oracle + VM A1.Flex rodando
- [ ] IP público anotado
- [ ] Domínio sslip.io resolvendo
- [ ] Caddy com HTTPS emitido
- [ ] systemd `clubpenguin` active
- [ ] `wss://dominio/ws` conectando (101)
- [ ] 2 clientes se vendo na mesma sala
- [ ] Backup diário do SQLite agendado

## Custos

| Item | Custo |
|---|---|
| Oracle Always Free VM | $0 (para sempre) |
| sslip.io / afraid.org | $0 |
| Caddy + Let's Encrypt | $0 |
| SQLite + backups locais | $0 |
| Cloudflare R2 (opcional) | $0 (10GB) |
| **Total** | **$0/mês** |
