#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${BACKEND_DIR}/.." && pwd)"

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

ENV_FILE="${BACKEND_DIR}/.env"

REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-$DEFAULT_REDIS_PORT}"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
PREFERRED_BACKEND_PORT="${BACKEND_PORT:-$(get_env_value "${BACKEND_DIR}/.env" PORT || printf '%s' "${DEFAULT_BACKEND_PORT}")}"

LUXIPANEL_CONFIG_DIR_VALUE="${LUXIPANEL_CONFIG_DIR:-/etc/luxipanel}"

info "Preparing backend installation"

pm2 delete panel-backend luxipanel-backend >/dev/null 2>&1 || true

BACKEND_PORT="$(resolve_free_port "Backend" "${PREFERRED_BACKEND_PORT}")"

systemctl enable --now redis-server >/dev/null 2>&1 || true

ENV_FILE_ALREADY_EXISTS="false"
if [[ -f "${ENV_FILE}" ]]; then
  ENV_FILE_ALREADY_EXISTS="true"
fi

if [[ "${ENV_FILE_ALREADY_EXISTS}" == "true" && ! -f "${BACKEND_DIR}/.env.install.bak" ]]; then
  cp "${ENV_FILE}" "${BACKEND_DIR}/.env.install.bak"
  # SECURITY: the backup copy inherits the source umask (typically 0644 on
  # distros), so tighten it explicitly. It contains JWT_SECRET, the mail
  # encryption key, and the credential vault master — never readable by
  # other users on the host.
  chmod 600 "${BACKEND_DIR}/.env.install.bak" 2>/dev/null || true
fi

ensure_env_file "${ENV_FILE}" "${BACKEND_DIR}/.env.example"
# Belt-and-braces: ensure_env_file writes via `cp` or `: >`, neither of
# which tighten the umask; the file contains secrets, so force 0600.
chmod 600 "${ENV_FILE}" 2>/dev/null || true

info "Ensuring LUXIPANEL_CONFIG_DIR exists at ${LUXIPANEL_CONFIG_DIR_VALUE}"
mkdir -p "${LUXIPANEL_CONFIG_DIR_VALUE}"
chmod 750 "${LUXIPANEL_CONFIG_DIR_VALUE}" || true

JWT_SECRET="$(get_env_value "${ENV_FILE}" JWT_SECRET || true)"
MAIL_ENCRYPTION_KEY="$(get_env_value "${ENV_FILE}" MAIL_ENCRYPTION_KEY || true)"
CREDENTIAL_VAULT_KEY="$(get_env_value "${ENV_FILE}" CREDENTIAL_VAULT_KEY || true)"

if [[ -z "${JWT_SECRET}" || "${JWT_SECRET}" == "CHANGE_ME_TO_A_RANDOM_64_CHAR_STRING" ]]; then
  JWT_SECRET="$(random_hex 32)"
fi

if [[ -z "${MAIL_ENCRYPTION_KEY}" || "${MAIL_ENCRYPTION_KEY}" == "CHANGE_ME_32_BYTES_HEX" ]]; then
  MAIL_ENCRYPTION_KEY="$(random_hex 32)"
fi

# Master key for the LOCAL encrypted target vault (modules/servers). Required in
# production (64 hex / 32 bytes); generated once and then preserved across
# re-installs so the existing vault keeps decrypting.
if [[ -z "${CREDENTIAL_VAULT_KEY}" || "${CREDENTIAL_VAULT_KEY}" == "CHANGE_ME_64_HEX_CHARS" ]]; then
  CREDENTIAL_VAULT_KEY="$(random_hex 32)"
fi

COOKIE_SECURE="false"
if [[ "${APP_SCHEME}" == "https" ]]; then
  COOKIE_SECURE="true"
fi

set_env_value "${ENV_FILE}" "NODE_ENV" "production"
set_env_value "${ENV_FILE}" "PORT" "${BACKEND_PORT}"
set_env_value "${ENV_FILE}" "HOST" "${BACKEND_HOST}"
set_env_value "${ENV_FILE}" "LOG_LEVEL" "info"
set_env_value "${ENV_FILE}" "REDIS_URL" "redis://${REDIS_HOST}:${REDIS_PORT}/0"
set_env_value "${ENV_FILE}" "CORS_ORIGIN" "${APP_SCHEME}://${APP_DOMAIN}"
set_env_value "${ENV_FILE}" "JWT_SECRET" "${JWT_SECRET}"
set_env_value "${ENV_FILE}" "COOKIE_SECURE" "${COOKIE_SECURE}"
set_env_value "${ENV_FILE}" "WEBAUTHN_RP_NAME" "LUXIPANEL"
set_env_value "${ENV_FILE}" "WEBAUTHN_RP_ID" "${APP_DOMAIN}"
set_env_value "${ENV_FILE}" "WEBAUTHN_ORIGIN" "${APP_SCHEME}://${APP_DOMAIN}"
set_env_value "${ENV_FILE}" "MAIL_ENCRYPTION_KEY" "${MAIL_ENCRYPTION_KEY}"
set_env_value "${ENV_FILE}" "TERMINAL_ENABLED" "true"
set_env_value "${ENV_FILE}" "DEFAULT_LOCALE" "es"
set_env_value "${ENV_FILE}" "SUPPORTED_LOCALES" "es,en"
set_env_value "${ENV_FILE}" "LUXIPANEL_CONFIG_DIR" "${LUXIPANEL_CONFIG_DIR_VALUE}"

# Optional during install: protected LP features remain locked until the
# per-panel key is supplied. Preserve an existing key on reinstall.
if [[ -n "${LP_PANEL_CREDENTIAL:-}" ]]; then
  if [[ ! "${LP_PANEL_CREDENTIAL}" =~ ^lxp_live_[0-9a-f]{64}$ ]]; then
    fail "LP_PANEL_CREDENTIAL must be the lxp_live_ key from Seguridad → API KEY"
  fi
  set_env_value "${ENV_FILE}" "LP_PANEL_CREDENTIAL" "${LP_PANEL_CREDENTIAL}"
fi

# Local encrypted target vault (modules/servers) master key. See generation above.
set_env_value "${ENV_FILE}" "CREDENTIAL_VAULT_KEY" "${CREDENTIAL_VAULT_KEY}"

# LUXIPANEL is self-hosted (standalone multi-node SSH); there is no managed
# LP-LICENSE-SERVER mode. Turn off the dead LP usage-reporting features.
set_env_value "${ENV_FILE}" "WORKLOG_ENABLED" "false"

# Host-only cookie (no domain attribute). The example default
# `COOKIE_DOMAIN=.luxipanel.com` is a multi-tenant artifact; on a self-hosted
# domain (e.g. panel.tudominio.com) that wildcard never matches, so the browser
# DROPS the CSRF/session cookies and login fails with "CSRF token mismatch".
# Empty = the cookie is scoped to this exact host.
set_env_value "${ENV_FILE}" "COOKIE_DOMAIN" ""

info "Installing backend dependencies"
cd "${BACKEND_DIR}"
pnpm install

info "Building backend"
pnpm run build

info "Starting backend with PM2"
start_pm2_app "${ROOT_DIR}" "${PM2_BACKEND}" "${BACKEND_PORT}" "Backend" \
  "Backend is listening on 127.0.0.1:${BACKEND_PORT}"

info "Backend installation completed (no database — JSON sidecars in ${LUXIPANEL_CONFIG_DIR_VALUE})"
