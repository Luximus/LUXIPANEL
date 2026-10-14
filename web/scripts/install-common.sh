#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

# ─────────────────────────────────────────────────────────────────────────
# Shared deploy defaults (SSOT for the canonical pm2 flow).
#
# These are the single source of truth for the literals previously hardcoded
# in install.sh / update.sh. Keep the `${VAR:-$DEFAULT_*}` override semantics
# at the call sites — these only provide the fallback value.
# ─────────────────────────────────────────────────────────────────────────
DEFAULT_BACKEND_PORT="8080"
DEFAULT_FRONTEND_PORT="4321"
DEFAULT_REDIS_PORT="6379"
DEFAULT_DB_PORT="5432"
DEFAULT_APP_DOMAIN="panel.luxisoft.com"
DEFAULT_GIT_BRANCH="main"
# Node.js major the panel targets (NodeSource setup_<major>.x + version checks).
DEFAULT_NODE_MAJOR="22"

# nginx vhost paths for the panel site (sites-available source + sites-enabled
# symlink). Backend-side mirror of these lives in nginx-sites.service.ts (M6).
PANEL_NGINX_SITE_AVAILABLE="/etc/nginx/sites-available/panel"
PANEL_NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/panel"

info() {
  printf '[INFO] %s\n' "$*"
}

warn() {
  printf '[WARN] %s\n' "$*" >&2
}

fail() {
  printf '[ERROR] %s\n' "$*" >&2
  exit 1
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || fail "Run this installer as root."
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

ensure_git_repo() {
  local repo_dir="$1"
  [[ -d "${repo_dir}/.git" ]] || fail "Not a git repository: ${repo_dir}"
}

default_domain() {
  hostname -f 2>/dev/null || hostname
}

# Print `bytes` random bytes as lowercase hex (2*bytes chars). SSOT for every
# secret the installers generate.
#
# openssl first, then /dev/urandom + `od`. The `od` fallback is deliberate: it
# is the ONLY fallback that yields the SAME alphabet and the SAME length as
# `openssl rand -hex` (the `tr -dc 'A-Za-z0-9' | head -c N` variant that used
# to live in backend/scripts/lib/prompts.sh produced a different alphabet and
# HALF the characters). Hex is also `sed`-safe (no `&`/`\`), so callers that
# splice the value into a `sed` replacement stay correct.
random_hex() {
  local bytes="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "${bytes}" && return 0
  fi
  head -c "${bytes}" /dev/urandom | od -An -tx1 | tr -d ' \n'
  printf '\n'
}

# Validate a PREPARED sudoers file with `visudo -cf` and, only if it parses,
# install it atomically at ${dest} as 0440 root:root.
#
# Returns non-zero (without touching ${dest}) when validation fails; the caller
# owns the messaging, the temp file and the cleanup, so each call site keeps its
# own wording/exit code. `quiet=true` swallows visudo's diagnostics.
install_sudoers_dropin() {
  local tmp="$1"
  local dest="$2"
  local quiet="${3:-false}"

  chmod 0440 "${tmp}" 2>/dev/null || true
  if [[ "${quiet}" == "true" ]]; then
    visudo -cf "${tmp}" >/dev/null 2>&1 || return 1
  else
    visudo -cf "${tmp}" >/dev/null || return 1
  fi
  install -m 0440 -o root -g root "${tmp}" "${dest}"
}

validate_identifier() {
  local value="$1"
  local label="$2"
  [[ "${value}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "${label} must match [A-Za-z_][A-Za-z0-9_]*"
}

sql_escape_literal() {
  printf "%s" "$1" | sed "s/'/''/g"
}

port_in_use() {
  local port="$1"
  ss -ltnH "( sport = :${port} )" 2>/dev/null | grep -q .
}

find_free_port() {
  local candidate="$1"
  while port_in_use "${candidate}"; do
    candidate=$((candidate + 1))
  done
  printf '%s\n' "${candidate}"
}

# find_free_port + the "port X is busy, using Y" warning the four per-project
# install/update scripts all emit. Prints the chosen port on stdout (the warning
# goes to stderr via warn(), so command substitution stays clean).
resolve_free_port() {
  local label="$1"
  local preferred="$2"
  local chosen

  chosen="$(find_free_port "${preferred}")"
  if [[ "${chosen}" != "${preferred}" ]]; then
    warn "${label} port ${preferred} is busy. Using ${chosen} instead."
  fi
  printf '%s\n' "${chosen}"
}

# ── Toolchain bootstrap ────────────────────────────────────────────────────
# pnpm is the project's package manager (there is a pnpm-lock.yaml) and comes
# from corepack, which ships with Node 22. No-op when pnpm is already on PATH
# or corepack is missing; best-effort, never fatal (callers decide whether a
# missing pnpm is an error via `require_command pnpm` / `fail`).
corepack_activate_pnpm() {
  command -v pnpm >/dev/null 2>&1 && return 0
  command -v corepack >/dev/null 2>&1 || return 0

  info "Enabling pnpm via corepack"
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@latest --activate >/dev/null 2>&1 || true
}

# Install PM2 globally when it is missing. Used by the per-project
# install/update scripts, which then `require_command pm2`.
ensure_pm2_global() {
  command -v pm2 >/dev/null 2>&1 && return 0
  info "PM2 not found. Installing it globally."
  npm install -g pm2
}

get_env_value() {
  local file="$1"
  local key="$2"
  [[ -f "${file}" ]] || return 1
  # The exit status of a `grep | head | cut` pipeline is `cut`'s (always 0), so
  # a missing/empty key would still "succeed" and callers' `|| default`
  # fallbacks would be dead code (e.g. an empty PORT → `server 127.0.0.1:;` in
  # the vhost → `nginx -t` fails mid-update). Capture and fail on empty.
  local value
  value="$(grep -E "^${key}=" "${file}" | head -n 1 | cut -d= -f2-)"
  [[ -n "${value}" ]] || return 1
  printf '%s\n' "${value}"
}

ensure_env_file() {
  local file="$1"
  local template="${2:-}"

  mkdir -p "$(dirname "${file}")"
  if [[ -f "${file}" ]]; then
    return 0
  fi

  if [[ -n "${template}" && -f "${template}" ]]; then
    cp "${template}" "${file}"
  else
    : > "${file}"
  fi
}

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp

  ensure_env_file "${file}"
  tmp="$(mktemp)"

  awk -v key="${key}" -v value="${value}" '
    BEGIN { updated = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) {
        print key "=" value
      }
    }
  ' "${file}" > "${tmp}"

  mv "${tmp}" "${file}"
}

wait_for_port() {
  local host="$1"
  local port="$2"
  local retries="${3:-30}"
  local i

  for ((i = 0; i < retries; i += 1)); do
    if command -v nc >/dev/null 2>&1; then
      if nc -z "${host}" "${port}" >/dev/null 2>&1; then
        return 0
      fi
    elif (echo >"/dev/tcp/${host}/${port}") >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

# Start a panel app from the repo ecosystem file and wait for its port. This is
# the tail every per-project install/update script shares:
#   cd repo → pm2 start --only <app> --update-env → pm2 save → wait_for_port 30
#
#   start_pm2_app <root_dir> <app> <port> <label> <ready_msg> [clean_env]
#
# `label` is the noun used in the timeout warning ("Backend"/"Frontend").
# `clean_env=true` drops PORT/HOST from the environment pm2 inherits — the
# frontend installers do this so the shell's own PORT/HOST cannot leak into the
# Astro server and override what ecosystem.config.cjs injects.
start_pm2_app() {
  local root_dir="$1"
  local app="$2"
  local port="$3"
  local label="$4"
  local ready_msg="$5"
  local clean_env="${6:-false}"

  cd "${root_dir}"
  if [[ "${clean_env}" == "true" ]]; then
    env -u PORT -u HOST pm2 start "${root_dir}/ecosystem.config.cjs" --only "${app}" --update-env
  else
    pm2 start "${root_dir}/ecosystem.config.cjs" --only "${app}" --update-env
  fi
  pm2 save >/dev/null

  if wait_for_port "127.0.0.1" "${port}" 30; then
    info "${ready_msg}"
  else
    warn "${label} did not open port ${port} within 30 seconds. Check pm2 logs."
  fi
}

# ── Panel nginx vhost (SSOT) ───────────────────────────────────────────────
# The panel vhost template lived verbatim in BOTH install.sh (write_nginx_config)
# and update.sh (write_base_nginx_config), and its /i18n/ half a THIRD time
# inside update.sh's python patcher. It lives here once now.

# The disk-served i18n bundle locations + the named fallback they try_files
# into. Emitted with the two-space indent used inside `server { }` and consumed
# both by the full template below and by update.sh's idempotent injector (which
# receives this text on argv), so the three copies can no longer drift.
#
# `$uri`, `$host`, … are NGINX variables: this heredoc is intentionally quoted
# so the shell leaves them alone.
panel_nginx_i18n_block() {
  local root_dir="$1"

  cat <<EOF
  # i18n bundles served straight from disk, bypassing the Node frontend.
  # The build emits content-hashed folders (/i18n/<hash>/<locale>/<ns>.json)
  # that are immutable, so they get a 1-year immutable TTL; only manifest.json
  # rotates per deploy and gets a short TTL. This offloads every translation
  # fetch from the frontend process. If the file isn't on disk (e.g. a path
  # mismatch or a not-yet-built deploy) we fall back to proxying the frontend
  # so i18n never hard-breaks.
  location = /i18n/manifest.json {
    root ${root_dir}/frontend/dist/client;
    add_header Cache-Control "public, max-age=60, stale-while-revalidate=300" always;
    access_log off;
    try_files \$uri @node_frontend;
  }

  location /i18n/ {
    root ${root_dir}/frontend/dist/client;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    access_log off;
    try_files \$uri @node_frontend;
  }

  location @node_frontend {
    proxy_pass http://panel_frontend;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
EOF
}

panel_nginx_extracted_block() {
  local root_dir="$1"
  cat <<EOF
  # Short-lived public cache for static module scripts. HTML and API remain
  # uncached; a new versioned URL takes effect immediately after deployment.
  location ^~ /scripts/extracted/ {
    root ${root_dir}/frontend/dist/client;
    add_header Cache-Control "public, max-age=60" always;
    access_log off;
    try_files \$uri @node_frontend;
  }
EOF
}

# Write ${PANEL_NGINX_SITE_AVAILABLE}, enable it, drop the distro default vhost,
# validate and reload. Exactly what install.sh and update.sh each used to do.
#
#   write_panel_nginx_vhost <backend_port> <frontend_port> <domain> <root_dir>
write_panel_nginx_vhost() {
  local backend_port="$1"
  local frontend_port="$2"
  local domain="$3"
  local root_dir="$4"
  local nginx_file="${PANEL_NGINX_SITE_AVAILABLE}"

  [[ -n "${domain}" ]] || domain="${DEFAULT_APP_DOMAIN}"

  cat > "${nginx_file}" <<EOF
upstream panel_api {
  server 127.0.0.1:${backend_port};
  keepalive 32;
}

upstream panel_frontend {
  server 127.0.0.1:${frontend_port};
  keepalive 32;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${domain};

  client_max_body_size 100M;

  location /api/terminal {
    proxy_pass http://panel_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 3600s;
  }

  location /api/preferences/ws {
    proxy_pass http://panel_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 3600s;
  }

  location /api {
    proxy_pass http://panel_api;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 60s;
  }

$(panel_nginx_i18n_block "${root_dir}")
$(panel_nginx_extracted_block "${root_dir}")

  location / {
    proxy_pass http://panel_frontend;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

  ln -sfn "${nginx_file}" "${PANEL_NGINX_SITE_ENABLED}"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
}

git_prepare_safe_directory() {
  local repo_dir="$1"
  git config --global --add safe.directory "${repo_dir}" >/dev/null 2>&1 || true
}

git_require_clean_tracked_tree() {
  local repo_dir="$1"
  if ! git -C "${repo_dir}" diff --quiet --ignore-submodules -- || \
     ! git -C "${repo_dir}" diff --cached --quiet --ignore-submodules --; then
    fail "Tracked git changes detected in ${repo_dir}. Commit or stash them before running update."
  fi
}

git_update_branch() {
  local repo_dir="$1"
  local branch="$2"

  ensure_git_repo "${repo_dir}"
  require_command git
  git_prepare_safe_directory "${repo_dir}"
  git_require_clean_tracked_tree "${repo_dir}"

  git -C "${repo_dir}" fetch origin "${branch}" --prune

  if git -C "${repo_dir}" show-ref --verify --quiet "refs/heads/${branch}"; then
    git -C "${repo_dir}" checkout "${branch}"
  else
    git -C "${repo_dir}" checkout -B "${branch}" "origin/${branch}"
  fi

  git -C "${repo_dir}" pull --ff-only origin "${branch}"
}

# ── Disk hygiene ───────────────────────────────────────────────────────────
# A panel down because the disk filled up is the most common avoidable outage.
# Two real sources measured on a production box: (1) kernel core dumps written
# into the process cwd — an Astro build killed by OOM leaves a 2-3GB core.*
# INSIDE the panel repo per crash (12GB found); (2) pm2 logs with no rotation.
# Both guards are idempotent and safe to run on every install/update.

# Disable core dumps ONLY when the current pattern is the kernel default (a
# relative name like "core"/"core.%p" → dumps land in the crashing process'
# cwd, i.e. inside the panel repo). If the host already routes cores through a
# managed pipe (systemd-coredump, apport — both quota their storage) or an
# absolute path the admin chose, respect it and do nothing.
setup_coredump_guard() {
  local pattern
  pattern="$(cat /proc/sys/kernel/core_pattern 2>/dev/null || true)"
  case "${pattern}" in
    "|"*|/*)
      info "Core dumps already managed (${pattern%% *}) — leaving as is"
      ;;
    *)
      info "Disabling cwd core dumps (kernel.core_pattern was '${pattern:-core}')"
      printf 'kernel.core_pattern=|/bin/false\n' > /etc/sysctl.d/50-luxipanel-coredumps.conf
      sysctl -p /etc/sysctl.d/50-luxipanel-coredumps.conf >/dev/null 2>&1 || \
        warn "Could not apply sysctl core_pattern (will apply on next boot)"
      ;;
  esac
}

# pm2-logrotate: without it ~/.pm2/logs grows unbounded (pm2 never rotates on
# its own). Needs network the first time (npm download) — degrade to a warning
# offline; the next update retries.
ensure_pm2_logrotate() {
  command -v pm2 >/dev/null 2>&1 || return 0
  if ! pm2 describe pm2-logrotate >/dev/null 2>&1; then
    info "Installing pm2-logrotate (log rotation for panel processes)"
    pm2 install pm2-logrotate >/dev/null 2>&1 || {
      warn "pm2-logrotate could not be installed (offline?). Logs will NOT rotate until it is."
      return 0
    }
  fi
  pm2 set pm2-logrotate:max_size 10M >/dev/null 2>&1 || true
  pm2 set pm2-logrotate:retain 14 >/dev/null 2>&1 || true
  pm2 set pm2-logrotate:compress true >/dev/null 2>&1 || true
}

# ── SSH hardening (D4) ─────────────────────────────────────────────────────
# A public VPS sees thousands of SSH brute-force attempts/day. Two idempotent,
# reversible guards: (1) fail2ban jailing sshd after 3 fails; (2) an sshd
# drop-in tightening auth. PasswordAuthentication is disabled by default (arg
# "true" keeps it, from `install.sh --allow-password`). The drop-in is validated
# with `sshd -t` and rolled back if it doesn't parse, so sshd never breaks.
setup_ssh_hardening() {
  local allow_password="${1:-false}"
  info "Hardening SSH (fail2ban + sshd_config drop-in)"

  # (1) fail2ban — best effort; a box without apt or offline just skips it.
  if ! command -v fail2ban-server >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban >/dev/null 2>&1 || \
      warn "  could not install fail2ban (offline?) — skipping jail"
  fi
  if [[ -d /etc/fail2ban ]]; then
    mkdir -p /etc/fail2ban/jail.d
    cat > /etc/fail2ban/jail.d/luxipanel.conf <<'EOF'
# LUXIPANEL SSH brute-force protection — managed by install.sh. Do not edit.
[sshd]
enabled  = true
maxretry = 3
findtime = 600
bantime  = 86400
EOF
    systemctl enable --now fail2ban >/dev/null 2>&1 || true
    systemctl reload fail2ban >/dev/null 2>&1 || systemctl restart fail2ban >/dev/null 2>&1 || true
    info "  fail2ban sshd jail active (maxretry=3, bantime=24h)"
  fi

  # (2) sshd drop-in — needs Include support (Debian/Ubuntu default has it).
  if [[ -d /etc/ssh ]]; then
    mkdir -p /etc/ssh/sshd_config.d
    local pwauth="no"
    [[ "${allow_password}" == "true" ]] && pwauth="yes"
    # Lockout guard: never disable password auth unless a usable authorized_keys
    # exists for root or the invoking (sudo) user. `sshd -t` only checks syntax,
    # not that a working key is present — disabling blind can lock the operator
    # out on next reconnect. If no key is found, keep passwords + warn.
    if [[ "${pwauth}" == "no" ]]; then
      local key_found="false" u_home
      for u_home in /root "/home/${SUDO_USER:-}"; do
        if [[ -n "${u_home}" && -s "${u_home}/.ssh/authorized_keys" ]]; then key_found="true"; break; fi
      done
      if [[ "${key_found}" != "true" ]]; then
        pwauth="yes"
        warn "  no authorized_keys found for root/${SUDO_USER:-<user>} — keeping PasswordAuthentication ON to avoid lockout. Add an SSH key and re-run to disable passwords."
      fi
    fi
    local dropin="/etc/ssh/sshd_config.d/luxipanel.conf"
    cat > "${dropin}" <<EOF
# LUXIPANEL SSH hardening — managed by install.sh. Do not edit.
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
PasswordAuthentication ${pwauth}
EOF
    if ! grep -rqs '^[[:space:]]*Include[[:space:]].*sshd_config\.d' /etc/ssh/sshd_config; then
      warn "  /etc/ssh/sshd_config has no 'Include sshd_config.d/*.conf' — drop-in may be ignored; apply the settings manually."
    fi
    local sshd_bin
    sshd_bin="$(command -v sshd || echo /usr/sbin/sshd)"
    if "${sshd_bin}" -t >/dev/null 2>&1; then
      systemctl reload sshd >/dev/null 2>&1 || systemctl reload ssh >/dev/null 2>&1 || \
        warn "  could not reload sshd — apply with 'systemctl reload sshd'"
      info "  sshd drop-in applied (MaxAuthTries 3, ClientAliveInterval 300, PasswordAuthentication ${pwauth})"
      if [[ "${pwauth}" == "no" ]]; then
        warn "  PasswordAuthentication is now DISABLED — confirm your SSH key works before logging out. Re-run with --allow-password to keep password logins."
      fi
    else
      rm -f "${dropin}"
      warn "  'sshd -t' rejected the drop-in — removed it to avoid breaking sshd. SSH left unchanged."
    fi
  fi
}

# Remove stray artifacts a broken build leaves behind inside the panel tree
# (core dumps from pre-guard crashes) and drop pnpm store packages no longer
# referenced by any project. Only touches the panel's own footprint.
cleanup_build_artifacts() {
  local repo_dir="$1"
  local removed
  removed="$(find "${repo_dir}" -maxdepth 3 -type f -name 'core.[0-9]*' -size +10M -print -delete 2>/dev/null | wc -l)"
  [[ "${removed}" -gt 0 ]] && info "Removed ${removed} stale core dump(s) from ${repo_dir}"
  if command -v pnpm >/dev/null 2>&1; then
    pnpm store prune >/dev/null 2>&1 || true
  fi
}
