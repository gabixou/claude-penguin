#!/bin/bash
# setup-vps.sh — provisiona o VPS Oracle para o Club Penguin Browser.
# Rodar UMA vez como ubuntu@IP:  bash setup-vps.sh dominio.com.br
set -euo pipefail

DOMAIN="${1:?uso: bash setup-vps.sh DOMINIO}"
APP=/opt/club-penguin
WWW=/var/www/club-penguin

echo "==> apt update + Node 22"
sudo apt update -y
sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs sqlite3
node -v

echo "==> Caddy"
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo apt update -y
sudo apt install -y caddy

echo "==> diretorios"
sudo mkdir -p "$WWW" "$APP/server" "$APP/backups"
sudo chown -R ubuntu:ubuntu "$WWW" "$APP"

echo "==> firewall local (iptables) — libera 80/443"
# A imagem Ubuntu da Oracle bloqueia tudo exceto SSH via iptables.
# ATENCAO: o Security List/NSG do OCI tambem precisa liberar 80/443
# (console: VCN > Subnets > Security List > Add Ingress Rules).
sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 5 -p tcp -m state --state NEW -m tcp --dport 80 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 6 -p tcp -m state --state NEW -m tcp --dport 443 -j ACCEPT
sudo DEBIAN_FRONTEND=noninteractive apt install -y iptables-persistent
sudo netfilter-persistent save

echo "==> cron (backup diario precisa do pacote cron)"
sudo DEBIAN_FRONTEND=noninteractive apt install -y cron

echo "==> Caddyfile"
# - handle /ws* ANTES do fallback: try_files reescreveria /ws para
#   /index.html e o proxy nunca veria o upgrade WebSocket.
# - map {clientip}: IP real do cliente. cloudflared chega de loopback e
#   usa CF-Connecting-IP (setado pela edge da Cloudflare); demais clientes
#   usam o IP real da conexao TCP. O Node le isso via X-Forwarded-For.
# - ATENCAO: nome do placeholder nao pode ter underscore ({clientip} ok,
#   {client_ip} quebra o parse do Caddyfile).
sudo tee /etc/caddy/Caddyfile >/dev/null <<CADDY
{
	acme_ca https://acme-v02.api.letsencrypt.org/directory
	email admin@$DOMAIN
}

$DOMAIN {
	encode gzip
	map {http.request.remote.host} {clientip} {
		default {http.request.remote.host}
		127.0.0.1 {http.request.header.CF-Connecting-IP}
		::1 {http.request.header.CF-Connecting-IP}
		::ffff:127.0.0.1 {http.request.header.CF-Connecting-IP}
	}
	handle /ws* {
		reverse_proxy localhost:8080 {
			header_up X-Forwarded-For {clientip}
		}
	}
	handle {
		root * $WWW/dist
		try_files {path} /index.html
		file_server
	}
}

# catch-all :80 — origem HTTP para o tunel cloudflared (ponte
# temporaria enquanto o Security List do OCI estiver fechado).
:80 {
	encode gzip
	map {http.request.remote.host} {clientip} {
		default {http.request.remote.host}
		127.0.0.1 {http.request.header.CF-Connecting-IP}
		::1 {http.request.header.CF-Connecting-IP}
		::ffff:127.0.0.1 {http.request.header.CF-Connecting-IP}
	}
	handle /ws* {
		reverse_proxy localhost:8080 {
			header_up X-Forwarded-For {clientip}
		}
	}
	handle {
		root * $WWW/dist
		try_files {path} /index.html
		file_server
	}
}
CADDY
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy

echo "==> ponte cloudflared (opcional — so se as portas 80/443 do OCI"
echo "    estiverem fechadas no Security List; URL temporaria *.trycloudflare.com)"
if ! command -v cloudflared >/dev/null; then
  curl -sL -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
  sudo dpkg -i /tmp/cloudflared.deb || true
fi
if ! systemctl list-unit-files | grep -q cloudflared-tunnel; then
  sudo tee /etc/systemd/system/cloudflared-tunnel.service >/dev/null <<UNIT
[Unit]
Description=Cloudflare quick tunnel - Club Penguin
After=network.target caddy.service

[Service]
ExecStart=/usr/bin/cloudflared tunnel --url http://localhost:80 --no-autoupdate
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
  sudo systemctl daemon-reload
  sudo systemctl enable --now cloudflared-tunnel
  sleep 8
  sudo journalctl -u cloudflared-tunnel --no-pager | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1
fi

echo "==> systemd clubpenguin"
sudo tee /etc/systemd/system/clubpenguin.service >/dev/null <<UNIT
[Unit]
Description=Club Penguin Browser WS Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$APP/server
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=3
Environment=PORT=8080
# Arenovisk so p/ IPs listados (default: so loopback). Descubra o IP publico
# com 'curl ifconfig.me' e adicione-o aqui se quiser o pinguim de teste:
# Environment=ARENOVISK_IPS=127.0.0.1,::1,::ffff:127.0.0.1,SEU_IP

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable clubpenguin

echo "==> backup diario do SQLite (04:00)"
cat > "$APP/backup.sh" <<'BK'
#!/bin/bash
DB=/opt/club-penguin/server/data/penguin.db
BK=/opt/club-penguin/backups
mkdir -p "$BK"
[ -f "$DB" ] && sqlite3 "$DB" ".backup '$BK/penguin-$(date +%F).db'"
find "$BK" -name 'penguin-*.db' -mtime +14 -delete
BK
chmod +x "$APP/backup.sh"
(crontab -l 2>/dev/null | grep -v club-penguin-backup; echo "0 4 * * * $APP/backup.sh") | crontab -

echo "==> FIM. Proximo passo: subir o codigo (deploy.sh) e:"
echo "    sudo systemctl start clubpenguin"
echo "    sudo systemctl status clubpenguin"
