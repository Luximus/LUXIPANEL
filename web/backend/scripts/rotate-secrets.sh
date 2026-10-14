#!/usr/bin/env bash
# ============================================================
# LUXIPANEL — Secret Rotation Script
# Rotates JWT_SECRET and/or MAIL_CRYPTO_KEY.
#
# WARNING: Rotating JWT_SECRET invalidates all active sessions.
# WARNING: Rotating MAIL_CRYPTO_KEY requires re-encrypting all
#          stored mail passwords — the script handles this via
#          the migration API endpoint.
# ============================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/colors.sh"
source "${SCRIPT_DIR}/lib/checks.sh"
source "${SCRIPT_DIR}/lib/prompts.sh"

require_root

LUXIPANEL_ENV="${LUXIPANEL_DIR:-/opt/luxipanel}/backend/.env"
ROTATE_JWT=false
ROTATE_MAIL_KEY=false
NON_INTERACTIVE=false

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --jwt)             ROTATE_JWT=true ;;
      --mail-key)        ROTATE_MAIL_KEY=true ;;
      --all)             ROTATE_JWT=true; ROTATE_MAIL_KEY=true ;;
      --env)             LUXIPANEL_ENV="$2"; shift ;;
      --non-interactive) NON_INTERACTIVE=true ;;
    esac
    shift
  done

  if [[ "${ROTATE_JWT}" == "false" && "${ROTATE_MAIL_KEY}" == "false" ]]; then
    fatal "Specify at least one: --jwt, --mail-key, or --all"
  fi
}

backup_env() {
  local backup="${LUXIPANEL_ENV}.backup.$(date +%Y%m%d_%H%M%S)"
  cp "${LUXIPANEL_ENV}" "${backup}"
  chmod 600 "${backup}"
  info "Backed up .env to ${backup}"
}

rotate_jwt_secret() {
  step "Rotating JWT_SECRET"

  warn "This will invalidate ALL active user sessions immediately."

  # When CREDENTIAL_VAULT_KEY is empty, the standalone credential vault derives
  # its key from JWT_SECRET (see config/env.ts §Standalone). Rotating JWT_SECRET
  # in that state makes ${LUXIPANEL_CONFIG_DIR}/servers/targets.json undecryptable
  # → every registered SSH target is lost. Refuse unless a dedicated vault key
  # is set (or the operator forces it non-interactively).
  local vault_key
  vault_key=$(grep -E "^CREDENTIAL_VAULT_KEY=" "${LUXIPANEL_ENV}" | head -1 | cut -d= -f2- | tr -d '"'"'"' ' )
  if [[ -z "${vault_key}" ]]; then
    warn "CREDENTIAL_VAULT_KEY is empty: the credential vault key is derived from"
    warn "JWT_SECRET, so rotating it will make targets.json UNDECRYPTABLE (all"
    warn "registered SSH targets are lost). Set a dedicated CREDENTIAL_VAULT_KEY"
    warn "(64 hex chars) before rotating JWT_SECRET."
    if [[ "${NON_INTERACTIVE}" == "true" ]]; then
      fatal "Refusing to rotate JWT_SECRET with an empty CREDENTIAL_VAULT_KEY."
    fi
    confirm "Rotate JWT_SECRET anyway and LOSE all stored SSH credentials?" || return
  fi

  if [[ "${NON_INTERACTIVE}" == "false" ]]; then
    confirm "Continue with JWT_SECRET rotation?" || return
  fi

  local new_secret
  new_secret=$(generate_secret 64)

  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${new_secret}|" "${LUXIPANEL_ENV}"

  success "JWT_SECRET rotated"
  # Never echo the secret to stdout — it would land in the terminal scrollback,
  # CI logs and the systemd journal. It is already written to .env (0600).
  info "New secret written to ${LUXIPANEL_ENV} (not printed)."
  info "All users will need to log in again."
}

rotate_mail_crypto_key() {
  step "Rotating MAIL_CRYPTO_KEY"

  warn "This will re-encrypt all stored mail passwords."
  warn "The panel must be running for this operation."
  if [[ "${NON_INTERACTIVE}" == "false" ]]; then
    confirm "Continue with MAIL_CRYPTO_KEY rotation?" || return
  fi

  local new_key
  new_key=$(generate_secret 32)
  local old_key
  old_key=$(grep "^MAIL_ENCRYPTION_KEY=" "${LUXIPANEL_ENV}" | cut -d= -f2)

  # Update .env with new key
  sed -i "s|^MAIL_ENCRYPTION_KEY=.*|MAIL_ENCRYPTION_KEY=${new_key}|" "${LUXIPANEL_ENV}"

  success "MAIL_CRYPTO_KEY updated in .env"
  # Never echo the key to stdout (scrollback / CI / journal). It is in .env.
  info "New key written to ${LUXIPANEL_ENV} (not printed)."
  warn "Restart luxipanel and then trigger a Dovecot sync to re-encrypt passwords."
  warn "  systemctl restart luxipanel"
  warn "  curl -X POST http://localhost:8080/api/admin/sync/all  (with auth token)"
}

restart_panel() {
  step "Restarting LUXIPANEL to apply new secrets"
  # Current deployments run under pm2 (luxipanel-backend), not the legacy
  # systemd `luxipanel` unit. `.env` is inlined by ecosystem.config.cjs at
  # eval time, so the restart must RE-EVALUATE the ecosystem (a plain
  # `pm2 restart --update-env` uses the cached config and would NOT pick up
  # the new secret). Fall back to systemd only if pm2 isn't present.
  local eco="${LUXIPANEL_DIR:-/opt/luxipanel}/ecosystem.config.cjs"
  if command -v pm2 >/dev/null 2>&1 && [[ -f "${eco}" ]]; then
    pm2 restart "${eco}" --only luxipanel-backend --update-env \
      && success "luxipanel-backend restarted (pm2, ecosystem re-evaluated)" \
      || fatal "pm2 restart failed"
  elif command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files luxipanel.service >/dev/null 2>&1; then
    systemctl restart luxipanel
    sleep 3
    systemctl is-active --quiet luxipanel \
      && success "luxipanel restarted successfully" \
      || fatal "luxipanel failed to restart"
  else
    warn "Neither pm2 (${eco}) nor a systemd luxipanel unit found."
    warn "Restart the panel manually so the rotated secret takes effect."
  fi
}

main() {
  parse_args "$@"

  [[ -f "${LUXIPANEL_ENV}" ]] || fatal ".env not found at ${LUXIPANEL_ENV}"

  section "LUXIPANEL Secret Rotation"

  backup_env

  if [[ "${ROTATE_JWT}" == "true" ]];      then rotate_jwt_secret;     fi
  if [[ "${ROTATE_MAIL_KEY}" == "true" ]]; then rotate_mail_crypto_key; fi

  restart_panel
  success "Secret rotation complete"
}

main "$@"
