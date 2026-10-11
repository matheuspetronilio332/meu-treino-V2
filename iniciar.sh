#!/usr/bin/env sh
# Inicia um servidor local para usar o Meu treino no computador.
# Uso: ./iniciar.sh [porta]     (padrão: 8080)
cd "$(dirname "$0")" || exit 1
PORTA="${1:-8080}"

if command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
else
  echo "Python não encontrado. Instale em https://www.python.org/downloads/ ou publique no GitHub Pages."
  exit 1
fi

echo "Meu treino em http://localhost:${PORTA}  (Ctrl+C para parar)"
( sleep 1; { xdg-open "http://localhost:${PORTA}" || open "http://localhost:${PORTA}"; } >/dev/null 2>&1 ) &
exec "$PY" -m http.server "$PORTA"
