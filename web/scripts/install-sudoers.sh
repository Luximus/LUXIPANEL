#!/usr/bin/env bash
# Install the LUXIPANEL sudoers rules. Must run as root.
#
#   sudo bash /var/www/LUXIPANEL/scripts/install-sudoers.sh [user]
#
# If `user` is omitted, the script tries to detect the user that runs the
# `luxipanel-backend` pm2 process.

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${SCRIPTS_DIR}/luxipanel-modules.sudoers"
DST="/etc/sudoers.d/luxipanel-modules"

# `install_sudoers_dropin` (chmod 0440 + `visudo -cf` + atomic install) is the
# same helper install.sh's setup_modules_sudoers uses. install-common.sh also
# narrows IFS for its own callers; this script never relied on that, so restore
# the shell default right after sourcing to keep behaviour byte-identical.
source "${SCRIPTS_DIR}/install-common.sh"
# pm2 app names (PM2_BACKEND/PM2_FRONTEND) — pure defs, no side effects on source.
source "${SCRIPTS_DIR}/lib/build-flow.sh"
IFS=$' \t\n'

if [[ $EUID -ne 0 ]]; then
  echo "Este script debe correr como root. Ejecuta:" >&2
  echo "  sudo bash $0 ${1:-}" >&2
  exit 1
fi

if [[ ! -f "$SRC" ]]; then
  echo "No se encontró el template en: $SRC" >&2
  exit 1
fi

TARGET_USER="${1:-}"
if [[ -z "$TARGET_USER" ]]; then
  TARGET_USER=$(pm2 jlist 2>/dev/null \
    | grep -oE "\"name\":\"${PM2_BACKEND}\"[^}]*\"username\":\"[^\"]+\"" \
    | grep -oE '"username":"[^"]+"' \
    | head -n1 \
    | sed 's/.*"\([^"]*\)"/\1/' || true)
fi

if [[ -z "$TARGET_USER" ]]; then
  echo "No pude detectar el usuario que corre luxipanel-backend." >&2
  echo "Pásalo como argumento:  sudo bash $0 <usuario>" >&2
  exit 2
fi

if ! id -u "$TARGET_USER" >/dev/null 2>&1; then
  echo "Usuario '$TARGET_USER' no existe en este sistema." >&2
  exit 3
fi

echo "==> Instalando sudoers para usuario: $TARGET_USER"

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
sed "s/^User_Alias LUXIPANEL_USERS = .*/User_Alias LUXIPANEL_USERS = ${TARGET_USER}/" "$SRC" > "$TMP"

# Validate before installing (then install 0440 root:root, atomically).
if ! install_sudoers_dropin "$TMP" "$DST"; then
  echo "El archivo generado tiene errores de sintaxis. Abortando." >&2
  exit 4
fi

# Final validation against the actual sudoers tree.
if ! visudo -c >/dev/null; then
  echo "visudo -c falló tras instalar. Revirtiendo." >&2
  rm -f "$DST"
  exit 5
fi

echo "==> Instalado en $DST"
echo "==> Listo. Ahora $TARGET_USER puede ejecutar los comandos de los módulos sin contraseña."
