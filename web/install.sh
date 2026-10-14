#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 LUXISOFT

set -euo pipefail
IFS=$'\n\t'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${ROOT_DIR}/scripts/install-common.sh"

# NOTE: root is required in main() AFTER parse_args, so `--help` works without sudo.

APP_DOMAIN="${APP_DOMAIN:-$DEFAULT_APP_DOMAIN}"

# LUXIPANEL is self-hosted (standalone multi-node SSH). There is no managed
# LP-LICENSE-SERVER mode and no OPERATION_MODE anymore — the panel manages the
# local box plus any remote servers registered in the Servers module.

# Public origin scheme. Default "http"; --https/--tls/--cloudflare set it to
# "https" so every public origin the app emits (CORS_ORIGIN, WEBAUTHN_ORIGIN,
# SITE_URL, LUXIPANEL_URL) and COOKIE_SECURE match a TLS-terminating proxy
# (nginx+certbot, or Cloudflare in front). Resolved in main().
APP_SCHEME_OVERRIDE="${APP_SCHEME_OVERRIDE:-}"
# Set by --cloudflare: only changes the post-install reminders (DNS-only while
# certbot runs, SSL → Full (strict)). The env it produces is the same as --https.
BEHIND_CLOUDFLARE="false"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-$DEFAULT_DB_PORT}"
DB_NAME="${DB_NAME:-luxipanel}"
DB_USER="${DB_USER:-luxipanel}"
DB_PASSWORD="${DB_PASSWORD:-luxipanel}"

REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-$DEFAULT_REDIS_PORT}"

BACKEND_PORT="${BACKEND_PORT:-$DEFAULT_BACKEND_PORT}"
FRONTEND_PORT="${FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}"

# Phase toggles for the scenario wrappers in scripts/standalone/*.sh. Defaults
# reproduce the original "do everything" behaviour, so plain `install.sh` is
# unchanged.
SKIP_SYSTEM_DEPS="false"   # --skip-system-deps: assume redis/postgres/nginx/etc are already installed
SKIP_NGINX="false"         # --skip-nginx: do NOT write the panel vhost (nginx already serves the domain)
RUN_CERTBOT="false"        # --run-certbot: obtain a Let's Encrypt cert (direct TLS) after writing nginx
STRICT_PORTS="false"       # --strict-ports: never auto-remap a busy port (fail instead — for --skip-nginx)
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"  # --email <addr>: registration email for certbot
ALLOW_PASSWORD_AUTH="false"  # --allow-password: keep SSH PasswordAuthentication (default hardens to key-only)

usage() {
  cat <<'EOF'
Usage: sudo bash install.sh [options]

Options:
  --domain <hostname>        Public hostname for nginx and app URLs
  --standalone               DEPRECATED / no-op. LUXIPANEL is always self-hosted
                             (standalone multi-node SSH) now; kept only so old
                             wrapper scripts keep working.
  --https, --tls             Public origin is HTTPS (TLS terminated by nginx or
                             a proxy). Sets COOKIE_SECURE=true and the https://
                             origins (CORS/WebAuthn/SITE_URL/LUXIPANEL_URL).
  --http                     Force the http:// origin (COOKIE_SECURE=false).
                             Override for scenarios that default to https.
  --cloudflare               Same as --https, plus Cloudflare-specific reminders
                             after install (DNS-only while certbot runs, then
                             SSL → Full (strict)).
  --skip-system-deps         Assume redis/postgresql/nginx/build tools are already
                             installed and running; skip apt + service enable.
                             (Node/pnpm/pm2 are still ensured.)
  --skip-nginx               Do NOT write the panel nginx vhost — your nginx
                             already serves the domain. (Use --strict-ports so the
                             chosen ports match your existing config.)
  --run-certbot              Obtain a Let's Encrypt certificate for the domain
                             (direct TLS via certbot --nginx) after install.
  --email <addr>             Registration email for certbot (optional).
  --allow-password           Keep SSH PasswordAuthentication enabled. By default
                             install.sh hardens sshd to key-only (fail2ban +
                             MaxAuthTries 3). Use this ONLY if you rely on SSH
                             passwords and understand the risk.
  --strict-ports             Fail if a requested port is busy instead of picking
                             another (so ports stay aligned with existing nginx).
  --backend-port <port>      Preferred backend port (default: 8080)
  --frontend-port <port>     Preferred frontend port (default: 4321)
  --db-name <name>           PostgreSQL database name (default: luxipanel)
  --db-user <user>           PostgreSQL role name (default: luxipanel)
  --db-password <password>   PostgreSQL role password (default: luxipanel)
  --help                     Show this help
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain)
        APP_DOMAIN="$2"
        shift 2
        ;;
      --standalone)
        # Deprecated no-op: standalone is the only mode now. Accepted so the
        # scripts/standalone/*.sh wrappers keep working.
        shift 1
        ;;
      --https|--tls)
        APP_SCHEME_OVERRIDE="https"
        shift 1
        ;;
      --http)
        APP_SCHEME_OVERRIDE="http"
        BEHIND_CLOUDFLARE="false"
        shift 1
        ;;
      --cloudflare)
        APP_SCHEME_OVERRIDE="https"
        BEHIND_CLOUDFLARE="true"
        shift 1
        ;;
      --skip-system-deps)
        SKIP_SYSTEM_DEPS="true"
        shift 1
        ;;
      --skip-nginx)
        SKIP_NGINX="true"
        shift 1
        ;;
      --run-certbot)
        RUN_CERTBOT="true"
        shift 1
        ;;
      --email)
        LETSENCRYPT_EMAIL="$2"
        shift 2
        ;;
      --allow-password)
        ALLOW_PASSWORD_AUTH="true"
        shift 1
        ;;
      --strict-ports)
        STRICT_PORTS="true"
        shift 1
        ;;
      --backend-port)
        BACKEND_PORT="$2"
        shift 2
        ;;
      --frontend-port)
        FRONTEND_PORT="$2"
        shift 2
        ;;
      --db-name)
        DB_NAME="$2"
        shift 2
        ;;
      --db-user)
        DB_USER="$2"
        shift 2
        ;;
      --db-password)
        DB_PASSWORD="$2"
        shift 2
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        fail "Unknown option: $1"
        ;;
    esac
  done
}

install_system_dependencies() {
  command -v apt-get >/dev/null 2>&1 || fail "This installer currently supports Debian and Ubuntu hosts with apt-get."

  info "Installing system dependencies"
  apt-get update
  apt-get install -y \
    build-essential \
    ca-certificates \
    curl \
    git \
    gnupg \
    make \
    netcat-openbsd \
    nginx \
    openssl \
    python3 \
    redis-server
}
# NOTE: PostgreSQL is intentionally NOT installed. LUXIPANEL has no database
# (persistence is JSON sidecars via kv-store/data-store + Redis — see env.ts,
# where DATABASE_URL is explicitly removed). The DB_* vars below are inert
# leftovers; backend/install.sh ignores them. Installing + enabling postgres
# left an unused root service running with a default credential.

ensure_nodejs() {
  if command -v node >/dev/null 2>&1; then
    local node_major
    node_major="$(node -p "process.versions.node.split('.')[0]")"
    if [[ "${node_major}" == "${DEFAULT_NODE_MAJOR}" ]]; then
      info "Node.js ${DEFAULT_NODE_MAJOR} already installed"
      return
    fi
  fi

  info "Installing Node.js ${DEFAULT_NODE_MAJOR}"
  # Do NOT pipe the remote installer straight into a root shell. Download it to
  # a file first so it can be inspected / checksum-verified before executing.
  #
  # NodeSource does not publish a stable checksum for setup_22.x (it is
  # regenerated regularly), so a hard-coded hash would break installs. Instead:
  #   • download to a private temp file (fail the install if the download fails),
  #   • sanity-check it is a non-empty shell script (not an HTML error/redirect),
  #   • optionally verify against NODESOURCE_SETUP_SHA256 if the operator pins one.
  local setup_script
  setup_script="$(mktemp)"
  if ! curl -fsSL --proto '=https' --tlsv1.2 "https://deb.nodesource.com/setup_${DEFAULT_NODE_MAJOR}.x" -o "${setup_script}"; then
    rm -f "${setup_script}"
    fail "Failed to download the NodeSource setup script."
  fi
  if [[ ! -s "${setup_script}" ]] || ! head -n1 "${setup_script}" | grep -qE '^#!\s*/'; then
    rm -f "${setup_script}"
    fail "Downloaded NodeSource setup script is empty or not a shell script (possible CDN error/MITM)."
  fi
  if [[ -n "${NODESOURCE_SETUP_SHA256:-}" ]]; then
    echo "${NODESOURCE_SETUP_SHA256}  ${setup_script}" | sha256sum -c - \
      || { rm -f "${setup_script}"; fail "NodeSource setup script checksum mismatch."; }
  fi
  bash "${setup_script}"
  rm -f "${setup_script}"
  apt-get install -y nodejs
}

# PM2 install is the shared ensure_pm2_global from install-common.sh (SSOT).

# Make pnpm (the project's package manager — there is a pnpm-lock.yaml) available
# via corepack, which ships with Node 22. REQUIRED: the per-project installers
# now run `pnpm install` / `pnpm run build`.
ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    info "pnpm already installed ($(pnpm -v 2>/dev/null || echo '?'))"
    return
  fi

  # Shared with backend/install.sh + frontend/install.sh (install-common.sh).
  corepack_activate_pnpm

  if ! command -v pnpm >/dev/null 2>&1; then
    npm install -g pnpm >/dev/null 2>&1 || true
  fi

  command -v pnpm >/dev/null 2>&1 || fail "pnpm is required but could not be installed. Enable it manually: 'sudo corepack enable && corepack prepare pnpm@latest --activate' (or 'sudo npm install -g pnpm'), then re-run."
}

prepare_services() {
  info "Enabling core services"
  # PostgreSQL intentionally omitted — LUXIPANEL has no database.
  systemctl enable --now redis-server
  systemctl enable --now nginx
}

# ─────────────────────────────────────────────────────────────────────────
# Preview sandbox (PIPS) substrate — ADVISORY probes only.
#
# The out-of-process module-preview runtime (RUNTIME-DESIGN.md) needs a
# confining substrate: `unshare` + `pivot_root`/`--root` (util-linux ≥2.38),
# `setpriv`, and unprivileged user namespaces. None of this is a HARD install
# requirement — the panel boots and runs with previews INERT (fail-closed) if
# the substrate is missing. We only record the host's capability for operator
# visibility, and best-effort enable the systemd user manager so the optional
# Tier-2 cgroup reinforcement is reachable without a login session.
probe_preview_sandbox() {
  info "Probing preview-sandbox substrate (advisory; previews stay inert if absent)"

  local ok=1

  if command -v unshare >/dev/null 2>&1; then
    info "  unshare: present ($(unshare --version 2>/dev/null | head -n1 || echo '?'))"
    # util-linux ≥2.38 ships `unshare --root` (integrated chroot); probe the flag.
    if unshare --help 2>&1 | grep -q -- "--root"; then
      info "  unshare --root (util-linux ≥2.38): supported"
    else
      warn "  unshare --root NOT supported (util-linux <2.38) — Tier 1 FS scrub unavailable"
      ok=0
    fi
  else
    warn "  unshare: MISSING (install util-linux) — preview sandbox will be inert"
    ok=0
  fi

  if command -v setpriv >/dev/null 2>&1; then
    info "  setpriv: present"
  else
    warn "  setpriv: MISSING (install util-linux) — preview sandbox will be inert"
    ok=0
  fi

  if command -v pivot_root >/dev/null 2>&1; then
    info "  pivot_root: present"
  else
    info "  pivot_root binary not on PATH (the runtime uses 'unshare --root'; not required)"
  fi

  local max_userns="0"
  if [[ -r /proc/sys/user/max_user_namespaces ]]; then
    max_userns="$(cat /proc/sys/user/max_user_namespaces 2>/dev/null || echo 0)"
  fi
  if [[ "${max_userns}" -gt 0 ]]; then
    info "  max_user_namespaces: ${max_userns} (unprivileged userns available)"
  else
    warn "  max_user_namespaces=${max_userns} — unprivileged user namespaces DISABLED; preview sandbox will be inert"
    ok=0
  fi

  if [[ -r /proc/sys/kernel/unprivileged_userns_clone ]]; then
    local unpriv
    unpriv="$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo 1)"
    if [[ "${unpriv}" == "0" ]]; then
      warn "  unprivileged_userns_clone=0 — unprivileged userns blocked; preview sandbox will be inert"
      ok=0
    else
      info "  unprivileged_userns_clone: ${unpriv}"
    fi
  else
    info "  unprivileged_userns_clone: sysctl absent (modern Debian default = allowed)"
  fi

  # Best-effort: enable the systemd USER manager so `/run/user/<uid>` + the user
  # bus exist at boot without a login session, which unlocks the optional Tier-2
  # cgroup reinforcement (`systemd-run --user`). NON-FATAL: if linger can't be
  # enabled the host simply runs the confining Tier 1.
  local panel_user="${SUDO_USER:-root}"
  if command -v loginctl >/dev/null 2>&1; then
    if loginctl enable-linger "${panel_user}" >/dev/null 2>&1; then
      info "  loginctl enable-linger ${panel_user}: enabled (Tier-2 reachable)"
    else
      warn "  loginctl enable-linger ${panel_user} failed (non-fatal) — host will run Tier 1"
    fi
  else
    info "  loginctl absent — skipping linger; host will run Tier 1"
  fi

  if [[ "${ok}" == "1" ]]; then
    info "Preview-sandbox substrate looks usable (subject to the runtime's boot self-test)"
  else
    warn "Preview-sandbox substrate incomplete — module previews will stay INERT (fail-closed). This is OK."
  fi
}

# The vhost template itself is the SSOT in scripts/install-common.sh
# (`write_panel_nginx_vhost`) — update.sh renders the very same file.
write_nginx_config() {
  info "Writing nginx configuration"
  write_panel_nginx_vhost "${BACKEND_PORT}" "${FRONTEND_PORT}" "${APP_DOMAIN}" "${ROOT_DIR}"
}

ensure_certbot() {
  if command -v certbot >/dev/null 2>&1; then
    info "certbot already installed"
    return
  fi
  info "Installing certbot"
  apt-get install -y certbot python3-certbot-nginx
}

# Obtain a Let's Encrypt certificate for ${APP_DOMAIN} and let certbot wire the
# 443 server block into the existing nginx vhost. Best-effort: a failure (DNS not
# pointing here yet, port 80 blocked, behind a non-DNS-only Cloudflare proxy)
# warns but does NOT abort — the panel still works over http and certbot can be
# re-run later.
run_certbot() {
  ensure_certbot

  if [[ "${BEHIND_CLOUDFLARE}" == "true" ]]; then
    warn "Cloudflare: the HTTP-01 challenge must reach THIS origin directly (not the orange-cloud proxy)."
    if [[ -t 0 ]]; then
      warn ">>> In the Cloudflare dashboard set the DNS record for ${APP_DOMAIN} to 'DNS only' (grey cloud) NOW."
      read -r -p "Press Enter once it is 'DNS only' to continue (Ctrl-C to skip certbot)... " _ || true
    else
      warn "Non-interactive run — skipping automatic certbot. After setting DNS-only run:"
      warn "  sudo certbot --nginx -d ${APP_DOMAIN} --agree-tos --redirect --register-unsafely-without-email"
      warn "Then re-enable the Cloudflare proxy and set SSL/TLS mode to 'Full (strict)'."
      return 0
    fi
  fi

  local email_args=("--register-unsafely-without-email")
  if [[ -n "${LETSENCRYPT_EMAIL}" ]]; then
    email_args=("-m" "${LETSENCRYPT_EMAIL}" "--no-eff-email")
  fi

  info "Requesting a Let's Encrypt certificate for ${APP_DOMAIN}"
  if certbot --nginx -d "${APP_DOMAIN}" --agree-tos --non-interactive --redirect "${email_args[@]}"; then
    info "TLS certificate issued and nginx updated for ${APP_DOMAIN}"
    if [[ "${BEHIND_CLOUDFLARE}" == "true" ]]; then
      warn "Re-enable the Cloudflare proxy (orange cloud) and set SSL/TLS mode to 'Full (strict)' now."
    fi
  else
    warn "certbot did not complete (DNS not pointing here yet? :80 blocked?). The panel still serves over http; run 'sudo certbot --nginx -d ${APP_DOMAIN}' once DNS is ready."
  fi
}

# Resolve a usable port for a service. With --strict-ports a busy port is fatal
# (so it stays aligned with an existing nginx vhost); otherwise the next free
# port is chosen (handles a host where 8080/4321 are already taken).
resolve_port() {
  local label="$1" preferred="$2" chosen
  chosen="$(find_free_port "${preferred}")"
  if [[ "${chosen}" != "${preferred}" ]]; then
    if [[ "${STRICT_PORTS}" == "true" ]]; then
      fail "${label} port ${preferred} is in use and --strict-ports is set. Free it (or update your nginx + drop --strict-ports)."
    fi
    warn "${label} port ${preferred} is busy; using ${chosen} instead."
    if [[ "${SKIP_NGINX}" == "true" ]]; then
      warn "  → point your existing nginx vhost at ${label} port ${chosen}."
    fi
  fi
  printf '%s\n' "${chosen}"
}

# Install /etc/sudoers.d/luxipanel-modules from the repo template, substituting
# the __LUXIPANEL_PM2_USER__ placeholder with the pm2 service user. Validated
# with `visudo -cf` and REFUSED if the placeholder was left unresolved (a
# hardcoded developer account would otherwise grant NOPASSWD root everywhere).
# Idempotent: re-running just re-writes the same file.
setup_modules_sudoers() {
  local src="${ROOT_DIR}/scripts/luxipanel-modules.sudoers"
  local dest="/etc/sudoers.d/luxipanel-modules"
  local pm2_user="${SUDO_USER:-root}"
  [[ -r "${src}" ]] || { warn "modules sudoers template missing (${src}); skipping"; return 0; }
  command -v visudo >/dev/null 2>&1 || { warn "visudo not found; skipping modules sudoers install"; return 0; }

  local tmp
  tmp="$(mktemp)"
  sed "s/__LUXIPANEL_PM2_USER__/${pm2_user}/g" "${src}" > "${tmp}"
  if grep -q '__LUXIPANEL_PM2_USER__' "${tmp}"; then
    rm -f "${tmp}"
    warn "modules sudoers: placeholder user unresolved (SUDO_USER empty?); NOT installing ${dest}"
    return 0
  fi
  # chmod 0440 + `visudo -cf` + atomic install: install_sudoers_dropin
  # (install-common.sh), shared with scripts/install-sudoers.sh.
  if install_sudoers_dropin "${tmp}" "${dest}" true; then
    info "Installed ${dest} (LUXIPANEL_USERS=${pm2_user})"
  else
    warn "modules sudoers failed 'visudo -cf'; NOT installing ${dest}"
  fi
  rm -f "${tmp}"
}

main() {
  parse_args "$@"
  require_root
  validate_identifier "${DB_NAME}" "DB_NAME"
  validate_identifier "${DB_USER}" "DB_USER"

  # http by default; --https/--tls/--cloudflare flip it to https so the app's
  # public origins + COOKIE_SECURE match the TLS edge (avoids the behind-proxy
  # "CSRF token mismatch" at login).
  APP_SCHEME="${APP_SCHEME_OVERRIDE:-http}"

  if [[ "${SKIP_SYSTEM_DEPS}" == "true" ]]; then
    info "Skipping system dependency install (--skip-system-deps): assuming redis/postgresql/nginx and build tools are already present."
    command -v nginx >/dev/null 2>&1 || warn "nginx not found on PATH — the panel needs it as reverse proxy."
  else
    install_system_dependencies
  fi

  ensure_nodejs
  ensure_pm2_global
  ensure_pnpm

  if [[ "${SKIP_SYSTEM_DEPS}" == "true" ]]; then
    info "Skipping service enable (--skip-system-deps): assuming postgresql/redis/nginx are already running."
  else
    prepare_services
  fi

  probe_preview_sandbox

  # Stop any previous panel processes FIRST so their ports free up and get reused
  # (rather than skipped as "busy") on this fresh install.
  if command -v pm2 >/dev/null 2>&1; then
    pm2 delete panel-backend panel-frontend luxipanel-backend luxipanel-frontend >/dev/null 2>&1 || true
  fi

  BACKEND_PORT="$(resolve_port "backend" "${BACKEND_PORT}")"
  FRONTEND_PORT="$(resolve_port "frontend" "${FRONTEND_PORT}")"
  if [[ "${FRONTEND_PORT}" == "${BACKEND_PORT}" ]]; then
    FRONTEND_PORT="$(resolve_port "frontend" "$((BACKEND_PORT + 1))")"
  fi

  info "Selected backend port: ${BACKEND_PORT}"
  info "Selected frontend port: ${FRONTEND_PORT}"

  APP_DOMAIN="${APP_DOMAIN}" \
  APP_SCHEME="${APP_SCHEME}" \
  BACKEND_PORT="${BACKEND_PORT}" \
  DB_HOST="${DB_HOST}" \
  DB_PORT="${DB_PORT}" \
  DB_NAME="${DB_NAME}" \
  DB_USER="${DB_USER}" \
  DB_PASSWORD="${DB_PASSWORD}" \
  REDIS_HOST="${REDIS_HOST}" \
  REDIS_PORT="${REDIS_PORT}" \
  bash "${ROOT_DIR}/backend/install.sh"

  BACKEND_PORT="$(get_env_value "${ROOT_DIR}/backend/.env" PORT || printf '%s' "${BACKEND_PORT}")"

  APP_DOMAIN="${APP_DOMAIN}" \
  APP_SCHEME="${APP_SCHEME}" \
  FRONTEND_PORT="${FRONTEND_PORT}" \
  BACKEND_HOST="127.0.0.1" \
  BACKEND_PORT="${BACKEND_PORT}" \
  BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}" \
  bash "${ROOT_DIR}/frontend/install.sh"

  FRONTEND_PORT="$(get_env_value "${ROOT_DIR}/frontend/.env" PORT || printf '%s' "${FRONTEND_PORT}")"

  if [[ "${SKIP_NGINX}" == "true" ]]; then
    info "Skipping nginx config (--skip-nginx): using your existing nginx setup for ${APP_DOMAIN}."
    warn "Make sure your nginx vhost proxies:  /  → 127.0.0.1:${FRONTEND_PORT}  and  /api → 127.0.0.1:${BACKEND_PORT}"
    warn "  (plus WebSocket upgrade for /api/terminal and /api/preferences/ws). See write_nginx_config in install.sh for a reference vhost."
  else
    write_nginx_config
  fi

  # Panel-host module sudoers (parametrized User_Alias) + SSH hardening. Both
  # idempotent; run before pm2 startup so a fresh box is hardened from first boot.
  setup_modules_sudoers
  setup_ssh_hardening "${ALLOW_PASSWORD_AUTH}"

  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || warn "pm2 startup could not be configured automatically. Run 'pm2 startup systemd -u root --hp /root' manually."
  pm2 save >/dev/null || true

  # Disk hygiene: stop cwd core dumps (an OOM-killed build dumps 2-3GB into the
  # repo) and rotate pm2 logs. Idempotent — see install-common.sh.
  setup_coredump_guard
  ensure_pm2_logrotate

  if [[ "${RUN_CERTBOT}" == "true" ]]; then
    if [[ "${SKIP_NGINX}" == "true" ]]; then
      warn "--run-certbot ignored with --skip-nginx (certbot needs to edit a panel vhost it manages). Run certbot yourself against your existing vhost."
    else
      run_certbot
    fi
  fi

  info "Installation completed"
  info "Public URL: ${APP_SCHEME}://${APP_DOMAIN}"
  info "Backend: 127.0.0.1:${BACKEND_PORT}"
  info "Frontend: 127.0.0.1:${FRONTEND_PORT}"

  info "Open ${APP_SCHEME}://${APP_DOMAIN}/login and sign in with an existing Linux account that is a member of the sudo (or wheel) group — the first account to log in becomes the panel admin."
  info "Add remote servers from the panel's server selector; their credentials are encrypted at rest with CREDENTIAL_VAULT_KEY in ${LUXIPANEL_CONFIG_DIR:-/etc/luxipanel}/servers/targets.json. For servers on your own LAN, set SERVERS_ALLOW_PRIVATE=true in backend/.env."

  if [[ "${APP_SCHEME}" == "https" ]]; then
    info "HTTPS origin set: CORS_ORIGIN/WEBAUTHN_ORIGIN=https://${APP_DOMAIN}, COOKIE_SECURE=true, COOKIE_DOMAIN empty (host-only). Reach the panel over https only."
    if [[ "${RUN_CERTBOT}" != "true" && "${SKIP_NGINX}" != "true" ]]; then
      info "Issue the TLS certificate on this origin: sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d ${APP_DOMAIN}"
    fi
  fi

  if [[ "${BEHIND_CLOUDFLARE}" == "true" ]]; then
    if [[ "${RUN_CERTBOT}" != "true" ]]; then
      warn "Cloudflare: BEFORE running certbot, set this record to 'DNS only' (grey cloud) so the HTTP-01 challenge reaches the origin. Re-enable the proxy (orange cloud) afterwards."
    fi
    warn "Cloudflare: set SSL/TLS encryption mode to 'Full (strict)' once the origin has a valid cert. Login won't return 'CSRF token mismatch' (COOKIE_SECURE=true + host-only cookie + https origins)."
  fi
}

main "$@"
