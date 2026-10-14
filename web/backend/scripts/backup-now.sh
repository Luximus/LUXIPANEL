#!/usr/bin/env bash
# ============================================================
# LUXIPANEL — Manual Immediate Backup
# Triggers a backup via the LUXIPANEL API.
# Requires a valid API key (set LUXIPANEL_API_KEY env var or --key flag).
# ============================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/colors.sh"

PANEL_URL="${PANEL_URL:-http://localhost:8080}"
API_KEY="${LUXIPANEL_API_KEY:-}"
BACKUP_TYPE="${BACKUP_TYPE:-full}"
NON_INTERACTIVE=false

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --url)             PANEL_URL="$2"; shift ;;
      --key)             API_KEY="$2"; shift ;;
      --type)            BACKUP_TYPE="$2"; shift ;;
      --non-interactive) NON_INTERACTIVE=true ;;
    esac
    shift
  done

  if [[ -z "${API_KEY}" ]]; then
    # Try to read from .env
    local env_file="${LUXIPANEL_DIR:-/opt/luxipanel}/backend/.env"
    if [[ -f "${env_file}" ]]; then
      API_KEY=$(grep "^BACKUP_API_KEY=" "${env_file}" | cut -d= -f2 || true)
    fi
  fi

  if [[ -z "${API_KEY}" ]]; then
    if [[ "${NON_INTERACTIVE}" == "true" ]]; then
      warn "No BACKUP_API_KEY configured — skipping backup-now (run manually once an API key is set)"
      exit 0
    fi
    echo -ne "API Key: "
    read -rs API_KEY; echo
  fi
}

trigger_backup() {
  step "Triggering ${BACKUP_TYPE} backup via API"

  local response
  response=$(curl -sf \
    -X POST \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"${BACKUP_TYPE}\"}" \
    "${PANEL_URL}/api/backups" 2>&1) || {
      fatal "Failed to contact panel at ${PANEL_URL}. Is it running?"
    }

  local job_id
  job_id=$(echo "${response}" | grep -oP '"id":\s*\K\d+' | head -1)

  if [[ -z "${job_id}" ]]; then
    error "Unexpected response: ${response}"
    fatal "Failed to trigger backup"
  fi

  success "Backup job #${job_id} triggered"
  # Do NOT echo the API key (scrollback / CI logs / journal). Reference it via
  # the env var instead so the printed command stays copy-pasteable but secretless.
  info "Check status: curl -H \"Authorization: Bearer \${LUXIPANEL_API_KEY}\" ${PANEL_URL}/api/backups/${job_id}"
}

main() {
  parse_args "$@"
  trigger_backup
}

main "$@"
