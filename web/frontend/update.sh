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

ensure_pm2_global

require_command pm2

GIT_PULL=true
GIT_BRANCH="${GIT_BRANCH:-main}"

ENV_FILE="${FRONTEND_DIR}/.env"
BACKEND_ENV_FILE="${ROOT_DIR}/backend/.env"

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --skip-git-pull)
        GIT_PULL=false
        shift
        ;;
      --branch)
        GIT_BRANCH="$2"
        shift 2
        ;;
      --frontend-port)
        FRONTEND_PORT="$2"
        shift 2
        ;;
      --backend-url)
        BACKEND_URL="$2"
        shift 2
        ;;
      --backend-port)
        BACKEND_PORT="$2"
        shift 2
        ;;
      --help|-h)
        cat <<'EOF'
Usage: sudo bash frontend/update.sh [options]

Options:
  --skip-git-pull        Rebuild from the current checkout without pulling
  --branch <name>        Branch to pull when git update is enabled
  --frontend-port <port> Preferred frontend port
  --backend-url <url>    Override BACKEND_URL in frontend/.env
  --backend-port <port>  Override BACKEND_PORT in frontend/.env
EOF
        exit 0
        ;;
      *)
        fail "Unknown option: $1"
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  ensure_env_file "${ENV_FILE}" "${FRONTEND_DIR}/.env.example"

  if [[ "${GIT_PULL}" == "true" ]]; then
    info "Updating git checkout from branch ${GIT_BRANCH}"
    git_update_branch "${ROOT_DIR}" "${GIT_BRANCH}"
  fi

  local preferred_frontend_port
  local frontend_host
  local backend_port_from_backend_env

  preferred_frontend_port="${FRONTEND_PORT:-$(get_env_value "${ENV_FILE}" PORT || get_env_value "${ENV_FILE}" PORT_FRONTEND || printf '%s' "${DEFAULT_FRONTEND_PORT}")}"
  frontend_host="$(get_env_value "${ENV_FILE}" HOST || printf '127.0.0.1')"
  backend_port_from_backend_env="$(get_env_value "${BACKEND_ENV_FILE}" PORT || printf '%s' "${DEFAULT_BACKEND_PORT}")"

  BACKEND_PORT="${BACKEND_PORT:-$(get_env_value "${ENV_FILE}" BACKEND_PORT || printf '%s' "${backend_port_from_backend_env}")}"
  BACKEND_URL="${BACKEND_URL:-$(get_env_value "${ENV_FILE}" BACKEND_URL || printf 'http://127.0.0.1:%s' "${BACKEND_PORT}")}"

  pm2 delete panel-frontend luxipanel-frontend >/dev/null 2>&1 || true

  FRONTEND_PORT="$(resolve_free_port "Frontend" "${preferred_frontend_port}")"

  if [[ -z "$(get_env_value "${ENV_FILE}" SITE_URL || true)" ]]; then
    set_env_value "${ENV_FILE}" "SITE_URL" "http://${DEFAULT_APP_DOMAIN}"
  fi
  if [[ -z "$(get_env_value "${ENV_FILE}" LUXIPANEL_URL || true)" ]]; then
    set_env_value "${ENV_FILE}" "LUXIPANEL_URL" "$(get_env_value "${ENV_FILE}" SITE_URL || printf 'http://%s' "${DEFAULT_APP_DOMAIN}")"
  fi

  set_env_value "${ENV_FILE}" "HOST" "${frontend_host}"
  set_env_value "${ENV_FILE}" "PORT" "${FRONTEND_PORT}"
  set_env_value "${ENV_FILE}" "PORT_FRONTEND" "${FRONTEND_PORT}"
  set_env_value "${ENV_FILE}" "BACKEND_PORT" "${BACKEND_PORT}"
  set_env_value "${ENV_FILE}" "BACKEND_URL" "${BACKEND_URL}"

  info "Installing frontend dependencies"
  cd "${FRONTEND_DIR}"
  npm install

  info "Building frontend"
  set -a
  source "${ENV_FILE}"
  set +a
  npm run build

  info "Starting frontend with PM2"
  start_pm2_app "${ROOT_DIR}" "${PM2_FRONTEND}" "${FRONTEND_PORT}" "Frontend" \
    "Frontend updated on 127.0.0.1:${FRONTEND_PORT}" true
}

main "$@"
