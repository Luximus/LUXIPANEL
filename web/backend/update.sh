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
require_command sudo

ensure_pm2_global

require_command pm2

GIT_PULL=true
GIT_BRANCH="${GIT_BRANCH:-main}"

ENV_FILE="${BACKEND_DIR}/.env"
FRONTEND_ENV_FILE="${ROOT_DIR}/frontend/.env"

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
      --skip-migrate)
        # Deprecated: LUXIPANEL no longer uses a database.
        shift
        ;;
      --backend-port)
        BACKEND_PORT="$2"
        shift 2
        ;;
      --help|-h)
        cat <<'EOF'
Usage: sudo bash backend/update.sh [options]

Options:
  --skip-git-pull       Rebuild from the current checkout without pulling
  --branch <name>       Branch to pull when git update is enabled
  --skip-migrate        Deprecated (no-op — database has been removed)
  --backend-port <port> Preferred backend port
EOF
        exit 0
        ;;
      *)
        fail "Unknown option: $1"
        ;;
    esac
  done
}

update_frontend_backend_reference_if_local() {
  [[ -f "${FRONTEND_ENV_FILE}" ]] || return 0

  local current_backend_url
  current_backend_url="$(get_env_value "${FRONTEND_ENV_FILE}" BACKEND_URL || true)"

  set_env_value "${FRONTEND_ENV_FILE}" "BACKEND_PORT" "${BACKEND_PORT}"

  if [[ -z "${current_backend_url}" || "${current_backend_url}" =~ ^http://(127\.0\.0\.1|localhost):[0-9]+$ ]]; then
    set_env_value "${FRONTEND_ENV_FILE}" "BACKEND_URL" "http://127.0.0.1:${BACKEND_PORT}"
    warn "Updated frontend/.env with the new local backend port ${BACKEND_PORT}. Restart the frontend if it is already running."
  fi
}

main() {
  parse_args "$@"

  ensure_env_file "${ENV_FILE}" "${BACKEND_DIR}/.env.example"

  if [[ "${GIT_PULL}" == "true" ]]; then
    info "Updating git checkout from branch ${GIT_BRANCH}"
    git_update_branch "${ROOT_DIR}" "${GIT_BRANCH}"
  fi

  local preferred_backend_port
  preferred_backend_port="${BACKEND_PORT:-$(get_env_value "${ENV_FILE}" PORT || printf '%s' "${DEFAULT_BACKEND_PORT}")}"

  pm2 delete panel-backend luxipanel-backend >/dev/null 2>&1 || true

  BACKEND_PORT="$(resolve_free_port "Backend" "${preferred_backend_port}")"

  if [[ -z "$(get_env_value "${ENV_FILE}" NODE_ENV || true)" ]]; then
    set_env_value "${ENV_FILE}" "NODE_ENV" "production"
  fi
  if [[ -z "$(get_env_value "${ENV_FILE}" HOST || true)" ]]; then
    set_env_value "${ENV_FILE}" "HOST" "127.0.0.1"
  fi
  set_env_value "${ENV_FILE}" "PORT" "${BACKEND_PORT}"

  update_frontend_backend_reference_if_local

  info "Installing backend dependencies"
  cd "${BACKEND_DIR}"
  npm install

  info "Building backend"
  npm run build

  info "Starting backend with PM2"
  start_pm2_app "${ROOT_DIR}" "${PM2_BACKEND}" "${BACKEND_PORT}" "Backend" \
    "Backend updated on 127.0.0.1:${BACKEND_PORT}"
}

main "$@"
