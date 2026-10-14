#!/usr/bin/env bash
# Wrapper de eas-cli: carga EXPO_TOKEN (auth no-interactiva) desde un archivo
# protegido si no está en el entorno, y luego ejecuta `eas` con los argumentos.
# Token: ~/.expo-token  o  app/.eas-token  (ambos fuera de git). Crea uno en
# https://expo.dev/settings/access-tokens y guárdalo con:
#   umask 077 && printf %s 'TU_TOKEN' > ~/.expo-token
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/.."

if [ -z "${EXPO_TOKEN:-}" ] && ! pnpm exec eas whoami --non-interactive >/dev/null 2>&1; then
  # A local EAS login may be valid while an old token file is not. Prefer the
  # active login; load the token only when no local session is available.
  for f in "$HOME/.expo-token" "$HERE/../.eas-token"; do
    if [ -f "$f" ]; then
      EXPO_TOKEN="$(tr -d '\r\n' < "$f")"
      export EXPO_TOKEN
      break
    fi
  done
fi

exec pnpm exec eas "$@"
