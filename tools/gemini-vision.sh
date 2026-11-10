#!/usr/bin/env bash
# Wrapper cross-ambiente para gemini-vision.mjs.
# - Linux/Git Bash com `node` de verdade: roda direto.
# - WSL: usa o node.exe do Windows via interop e converte paths p/ formato Windows.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"

if command -v node >/dev/null 2>&1 && [ "$(command -v node)" != "${NODE_EXE:-__none__}" ]; then
  case "$(command -v node)" in
    *.exe|*/node.exe) IS_WIN=1 ;;
    *) IS_WIN=0 ;;
  esac
else
  IS_WIN=1
fi

if [ "$IS_WIN" = "0" ]; then
  exec node "$DIR/gemini-vision.mjs" "$@"
fi

NODE_BIN="$(command -v node.exe || command -v node || true)"
[ -n "$NODE_BIN" ] || { echo "gemini-vision: node nao encontrado" >&2; exit 1; }

# Converte DIR e args que sejam arquivos existentes para paths Windows.
DIR_ARG="$DIR"
args=()
if command -v wslpath >/dev/null 2>&1; then
  DIR_ARG="$(wslpath -w "$DIR")"
  for a in "$@"; do
    if [ -f "$a" ]; then args+=("$(wslpath -w "$a")"); else args+=("$a"); fi
  done
else
  args=("$@")
fi
exec "$NODE_BIN" "$DIR_ARG/gemini-vision.mjs" "${args[@]}"
