#!/usr/bin/env bash
# Stop-hook gate para visual-qa.
# Bloqueia o fim do turno do agente quando client/src mudou desde o ultimo
# review do Gemini E o localhost:3000 esta no ar E passou o throttle de 30min.
# Imprime JSON de decisao no stdout; sempre sai 0 (nunca quebra a sessao).
set -u

ROOT="${DEVIN_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT" 2>/dev/null || exit 0

STATE_DIR="tools/.visual-qa"
LAST_BLOCK="$STATE_DIR/last-block"
THROTTLE=1800   # 30 minutos entre ciclos forcados
mkdir -p "$STATE_DIR" 2>/dev/null || exit 0

# 1. Servidor do jogo fora do ar -> libera (nao ha o que comparar)
# NOTA: o exec/hooks rodam em WSL, onde localhost NAO enxerga o Windows.
# Testa localhost e o gateway do host Windows (ip route default).
HOST_IP=$(ip route show default 2>/dev/null | awk '{print $3; exit}')
server_up() {
  curl -sf -o /dev/null -m 3 http://localhost:3000/ 2>/dev/null && return 0
  [ -n "$HOST_IP" ] && curl -sf -o /dev/null -m 3 "http://$HOST_IP:3000/" 2>/dev/null && return 0
  return 1
}
server_up || exit 0

now=$(date +%s)

# 2. Throttle: no maximo 1 bloqueio a cada 30min
if [ -f "$LAST_BLOCK" ]; then
  last=$(cat "$LAST_BLOCK" 2>/dev/null || echo 0)
  case "$last" in ''|*[!0-9]*) last=0 ;; esac
  if [ $((now - last)) -lt "$THROTTLE" ]; then exit 0; fi
fi

mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }

# 3. Epoch do review mais recente
latest_review=0
shopt -s nullglob
for f in docs/visual-review-*.md; do
  case "$f" in *-ERRO.md) continue ;; esac
  m=$(mtime "$f")
  [ "$m" -gt "$latest_review" ] && latest_review=$m
done

# 4. Epoch do arquivo mais recente em client/src
newest_src=0
while IFS= read -r f; do
  m=$(mtime "$f")
  [ "$m" -gt "$newest_src" ] && newest_src=$m
done < <(find client/src -type f 2>/dev/null)

# Sem mudancas em client/src desde o ultimo review -> libera
if [ "$newest_src" -le "$latest_review" ]; then exit 0; fi

# 5. Bloqueia o stop e instrui o agente
echo "$now" > "$LAST_BLOCK"
cat <<'EOF'
{"decision":"block","reason":"QA visual pendente: client/src mudou desde o ultimo review do Gemini. Antes de encerrar, invoque a skill visual-qa (screenshots via Playwright MCP das paginas localhost:3000 e https://gopenguin.lol/?room=town, analise via tools/gemini-vision.mjs), salve o review em docs/visual-review-<cena>-<data>.md e aplique as correcoes visivas em client/. Se a skill falhar por infraestrutura (servidor fora, MCP indisponivel), registre o motivo em docs/visual-review-ERRO.md e encerre."}
EOF
exit 0
