#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${FRONTEND_DIR}/.." && pwd)"

source "${ROOT_DIR}/scripts/install-common.sh"
# pm2 app names (PM2_BACKEND/PM2_FRONTEND) — pure defs, no side effects on source.
source "${ROOT_DIR}/scripts/lib/build-flow.sh"

require_root
require_command node
require_command npm

# pnpm is the project's package manager (there is a pnpm-lock.yaml). The root
# install.sh enables it via corepack; ensure it here too so this script also
# works when invoked directly. (Both helpers live in install-common.sh.)
corepack_activate_pnpm
require_command pnpm

ensure_pm2_global

require_command pm2

APP_DOMAIN="${APP_DOMAIN:-$DEFAULT_APP_DOMAIN}"
APP_SCHEME="${APP_SCHEME:-http}"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-$(get_env_value "${ROOT_DIR}/backend/.env" PORT || printf '%s' "${DEFAULT_BACKEND_PORT}")}"
BACKEND_URL="${BACKEND_URL:-http://${BACKEND_HOST}:${BACKEND_PORT}}"

FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
PREFERRED_FRONTEND_PORT="${FRONTEND_PORT:-$(get_env_value "${FRONTEND_DIR}/.env" PORT || get_env_value "${FRONTEND_DIR}/.env" PORT_FRONTEND || printf '%s' "${DEFAULT_FRONTEND_PORT}")}"

info "Preparing frontend installation"

pm2 delete panel-frontend luxipanel-frontend >/dev/null 2>&1 || true

FRONTEND_PORT="$(resolve_free_port "Frontend" "${PREFERRED_FRONTEND_PORT}")"

ENV_FILE="${FRONTEND_DIR}/.env"
if [[ -f "${ENV_FILE}" && ! -f "${FRONTEND_DIR}/.env.install.bak" ]]; then
  cp "${ENV_FILE}" "${FRONTEND_DIR}/.env.install.bak"
fi

ensure_env_file "${ENV_FILE}" "${FRONTEND_DIR}/.env.example"

set_env_value "${ENV_FILE}" "HOST" "${FRONTEND_HOST}"
set_env_value "${ENV_FILE}" "PORT" "${FRONTEND_PORT}"
set_env_value "${ENV_FILE}" "PORT_FRONTEND" "${FRONTEND_PORT}"
set_env_value "${ENV_FILE}" "BACKEND_URL" "${BACKEND_URL}"
set_env_value "${ENV_FILE}" "BACKEND_PORT" "${BACKEND_PORT}"
set_env_value "${ENV_FILE}" "SITE_URL" "${APP_SCHEME}://${APP_DOMAIN}"
set_env_value "${ENV_FILE}" "LUXIPANEL_URL" "${APP_SCHEME}://${APP_DOMAIN}"

# Self-hosted: host-only cookie (mirror of backend/install.sh). A leftover
# `.luxipanel.com` wildcard would make the logout-landing cookie cleanup target
# the wrong domain; empty keeps everything scoped to this host.
set_env_value "${ENV_FILE}" "COOKIE_DOMAIN" ""

info "Installing frontend dependencies"
cd "${FRONTEND_DIR}"
pnpm install

info "Building frontend"
set -a
source "${ENV_FILE}"
set +a
pnpm run build

info "Starting frontend with PM2"
start_pm2_app "${ROOT_DIR}" "${PM2_FRONTEND}" "${FRONTEND_PORT}" "Frontend" \
  "Frontend is listening on 127.0.0.1:${FRONTEND_PORT}" true

info "Frontend installation completed"
