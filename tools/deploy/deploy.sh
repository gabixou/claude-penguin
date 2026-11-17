#!/bin/bash
# deploy.sh — envia server + client/dist para o VPS e (re)inicia.
# Uso: bash tools/deploy/deploy.sh ubuntu@IP [-i chave]
set -euo pipefail
cd "$(dirname "$0")/../.."

DEST="${1:?uso: bash tools/deploy/deploy.sh ubuntu@IP [-i chave]}"
KEY="${2:-$HOME/.ssh/oracle_clubpenguin}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new"
SCP="scp -i $KEY -o StrictHostKeyChecking=accept-new"

echo "==> build do client"
(cd client && npm run build)

echo "==> compactando"
tar -czf /tmp/cp-server.tgz -C server --exclude=node_modules --exclude='./data' .
tar -czf /tmp/cp-dist.tgz -C client dist
ls -lh /tmp/cp-*.tgz

echo "==> enviando"
$SCP /tmp/cp-server.tgz /tmp/cp-dist.tgz "$DEST:/tmp/"
$SSH "$DEST" 'set -e
mkdir -p /opt/club-penguin/server /var/www/club-penguin
mkdir -p /opt/club-penguin/server/src/data
tar -xzf /tmp/cp-server.tgz -C /opt/club-penguin/server
tar -xzf /tmp/cp-dist.tgz -C /var/www/club-penguin
# catalog.js precisa do items.json — copia do dist (mesma fonte do cliente)
cp /var/www/club-penguin/dist/assets/items.json /opt/club-penguin/server/src/data/items.json
cd /opt/club-penguin/server && npm install --omit=dev
sudo systemctl restart clubpenguin || true
sudo systemctl status clubpenguin --no-pager | head -5'
echo "==> deploy concluido"
