#!/usr/bin/env bash
# ============================================================
# install-engines.sh — lay down the cache-engine bundle on the
# CLIENT server and schedule the single coalesced dispatcher.
#
# Idempotent & non-interactive. Run by LP over the pooled SSH
# connection AFTER luxipanel-redis-cache.sh and AFTER LP has
# written ${LUXIPANEL_CONFIG_DIR}/cache-engine/cache-policy.json
# (the single source of truth, exported from cacheable-modules.ts).
#
# Output: a single JSON line on stdout: {"ok":true,"scheduler":"systemd|cron"}
# ============================================================
set -u

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFG="${LUXIPANEL_CONFIG_DIR:-/etc/luxipanel}"
ENGINE_DIR="${CFG}/cache-engine"
DEST="${ENGINE_DIR}/engines"
POLICY="${ENGINE_DIR}/cache-policy.json"
SCHEDULE="${ENGINE_DIR}/schedule.json"

have() { command -v "$1" >/dev/null 2>&1; }
emit_fail() { echo "{\"ok\":false,\"error\":\"$1\"}"; exit 0; }

# ---- ensure python3 (engines are stdlib python3)
if ! have python3; then
  if have apt-get; then
    DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1 || true
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 >/dev/null 2>&1 || true
  elif have dnf; then dnf install -y -q python3 >/dev/null 2>&1 || true
  elif have yum; then yum install -y -q python3 >/dev/null 2>&1 || true
  elif have zypper; then zypper -q install -y python3 >/dev/null 2>&1 || true
  elif have apk; then apk add --no-cache python3 >/dev/null 2>&1 || true
  fi
fi
have python3 || emit_fail "python3 not installable"

# ---- lay down the bundle (0700 dir, scripts 0700)
umask 077
mkdir -p "${DEST}" "${ENGINE_DIR}/state" 2>/dev/null || emit_fail "mkdir failed"
cp -f "${SELF_DIR}/engines/"*.py "${SELF_DIR}/engines/dispatcher.sh" "${DEST}/" \
  2>/dev/null || emit_fail "cannot copy engine bundle"
chmod 700 "${DEST}/dispatcher.sh" "${DEST}/"*.py 2>/dev/null || true
chmod 700 "${ENGINE_DIR}" "${ENGINE_DIR}/state" 2>/dev/null || true
# Ship the current allowlist on upgrades as well as fresh installs. The
# operator's schedule/intervals remain untouched; retired collectors stop running.
if [ -r "${SELF_DIR}/cache-policy.json" ]; then
  cp -f "${SELF_DIR}/cache-policy.json" "${POLICY}" || emit_fail "cannot update cache policy"
  chmod 600 "${POLICY}" 2>/dev/null || true
fi

# The systemd units below run the dispatcher/worker as ${TARGET_USER} (the
# non-root SSH user), so the 0700 bundle must be owned by that user or the
# worker cannot even read its own scripts (and worker.py's askpass trust check
# accepts the euid owner). Done AFTER the chmods so the mode stays 0700.
# NOTE: TARGET_USER/TARGET_GROUP are resolved a few lines below; resolve them
# here too (cheap, idempotent) so the chown can happen right after the copy.
_ENGINE_OWNER="${SUDO_USER:-root}"
_ENGINE_GROUP="$(id -gn "${_ENGINE_OWNER}" 2>/dev/null || echo "${_ENGINE_OWNER}")"
if [ "$(id -u)" = 0 ] && [ "${_ENGINE_OWNER}" != "root" ]; then
  chown -R "${_ENGINE_OWNER}:${_ENGINE_GROUP}" "${ENGINE_DIR}" 2>/dev/null || true
fi

# ---- default schedule.json from policy (only if absent; never clobber the
#      operator's Ajustes → Módulos choices)
if [ ! -f "${SCHEDULE}" ] && [ -r "${POLICY}" ]; then
  python3 - "${POLICY}" "${SCHEDULE}" "${SELF_DIR}/engines" <<'PY' || true
import json, sys
# common.py ships in ${SELF_DIR}/engines; add it to sys.path (stdin scripts get
# "" as sys.path[0]) so the fallback interval AND the atomic 0600 sidecar write
# come from the SSOT, not from a literal / a fourth copy of the tmp+chmod+
# os.replace dance.
sys.path.insert(0, sys.argv[3])
import common
pol = json.load(open(sys.argv[1], encoding="utf-8"))
out = {}
for c in pol.get("collections", []):
    out[f'{c["module"]}/{c["collection"]}'] = {
        "enabled": True,
        "intervalSeconds": int(c.get("defaultIntervalSeconds") or common.DEFAULT_INTERVAL_SECONDS),
    }
common.atomic_write_json(sys.argv[2], out)
PY
fi
[ -f "${SCHEDULE}" ] && chmod 600 "${SCHEDULE}" 2>/dev/null || true

# Run the timer as the SSH user (the same identity that owns the sidecars
# under LUXIPANEL_CONFIG_DIR). When sudo invokes this script `$SUDO_USER`
# carries the calling user; falls back to root for unattended setups.
TARGET_USER="${SUDO_USER:-root}"
TARGET_GROUP="$(id -gn "${TARGET_USER}" 2>/dev/null || echo "${TARGET_USER}")"

# ---- write-behind HMAC key (A1). The panel signs every queued job with this
#      key (shared/remote-cache/submit-mutation.ts reads it back over SSH) and
#      the worker (LPWQ_REQUIRE_HMAC=true) rejects anything unsigned — so a local
#      process that can write the loopback Redis can't inject root-bearing jobs.
#      Owned by the worker/SSH user, mode 0640. Generated ONCE and never
#      clobbered: rotating it would reject in-flight jobs and needs a coordinated
#      worker+panel restart. Path MUST match worker.py HMAC_KEY_PATH.
HMAC_KEY_FILE="${ENGINE_DIR}/lpwq.hmac.key"
provision_hmac_key() {
  [ -s "${HMAC_KEY_FILE}" ] && return 0   # already provisioned — keep it stable
  local src
  src="$(mktemp)" || return 1
  ( umask 077
    { openssl rand -hex 32 2>/dev/null \
        || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; } > "${src}" )
  if [ ! -s "${src}" ]; then rm -f "${src}"; return 1; fi
  # 0600 owner-only: both the worker (owner) and the panel (reads over SSH as
  # the SAME user) access as owner, so group-read is unnecessary and would let
  # any member of the SSH user's group read the signing key and forge jobs.
  if [ "$(id -u)" = 0 ]; then
    install -m 0600 -o "${TARGET_USER}" -g "${TARGET_GROUP}" "${src}" "${HMAC_KEY_FILE}" 2>/dev/null \
      || { install -m 0600 "${src}" "${HMAC_KEY_FILE}" 2>/dev/null; \
           chown "${TARGET_USER}:${TARGET_GROUP}" "${HMAC_KEY_FILE}" 2>/dev/null || true; }
  else
    install -m 0600 "${src}" "${HMAC_KEY_FILE}" 2>/dev/null \
      || { cp -f "${src}" "${HMAC_KEY_FILE}" && chmod 0600 "${HMAC_KEY_FILE}"; }
  fi
  rm -f "${src}"
}
provision_hmac_key || echo "[install-engines] WARN: could not provision HMAC key at ${HMAC_KEY_FILE}" >&2

# ---- sudoers drop-in: NOPASSWD allowlist for the exact commands the
#      collectors run as `sudo -n <cmd>`. The timer runs as ${TARGET_USER}
#      (a non-root SSH user), so without this each collector hits
#      "a password is required" and the sidecar stays count:0.
#
#      Strict allowlist (NOT a blanket NOPASSWD ALL): each binary is pinned
#      and arguments are constrained by the absolute paths the collectors
#      pass on the command line. Validated with `visudo -cf` before install
#      so a malformed file never blocks login.
write_sudoers() {
  local f="/etc/sudoers.d/luxipanel-cache-engine"
  local tmp="${f}.tmp.$$"
  # Constrained allowlist — no blanket NOPASSWD: /bin/cat, /bin/find, etc.
  # Each command is pinned to specific paths the collectors actually read.
  cat > "${tmp}" <<EOF
# LUXIPANEL cache-engine — managed by install-engines.sh. Do not edit.
# Allows the cache-engine timer user (${TARGET_USER}) to run, without a
# password prompt, only the read-only inspection commands invoked by the
# collectors under ${DEST}.
Cmnd_Alias LUXIPANEL_CACHE = \\
  /usr/bin/cat /etc/luxipanel/* /etc/nginx/sites-available/* /etc/nginx/sites-enabled/* /etc/postfix/* /etc/dovecot/* /var/log/luxipanel/* /var/log/nginx/* /var/log/mail.log /var/log/syslog /var/log/auth.log /var/vmail/*, \\
  /bin/cat /etc/luxipanel/* /etc/nginx/sites-available/* /etc/nginx/sites-enabled/* /etc/postfix/* /etc/dovecot/* /var/log/luxipanel/* /var/log/nginx/* /var/log/mail.log /var/log/syslog /var/log/auth.log /var/vmail/*, \\
  /usr/bin/ls /etc/luxipanel/* /etc/nginx/sites-available/* /etc/nginx/sites-enabled/* /etc/postfix/* /etc/dovecot/* /var/spool/cron/* /var/vmail/*, \\
  /bin/ls /etc/luxipanel/* /etc/nginx/sites-available/* /etc/nginx/sites-enabled/* /etc/postfix/* /etc/dovecot/* /var/spool/cron/* /var/vmail/*, \\
  /usr/bin/find /var/spool/cron/* /var/vmail/* /etc/nginx/sites-available/* /etc/nginx/sites-enabled/* /etc/postfix/* /etc/dovecot/* -type f -print, \\
  /bin/find /var/spool/cron/* /var/vmail/* /etc/nginx/sites-available/* /etc/nginx/sites-enabled/* /etc/postfix/* /etc/dovecot/* -type f -print, \\
  /usr/bin/crontab -l, \\
  /usr/sbin/ufw status verbose, /usr/bin/ufw status verbose, \\
  /usr/bin/doveadm -f tab quota get -A
Defaults!LUXIPANEL_CACHE !requiretty
${TARGET_USER} ALL=(root) NOPASSWD: LUXIPANEL_CACHE
EOF
  chmod 440 "${tmp}" 2>/dev/null || true
  if visudo -cf "${tmp}" >/dev/null 2>&1; then
    mv -f "${tmp}" "${f}" 2>/dev/null || rm -f "${tmp}"
  else
    rm -f "${tmp}"
  fi
}
if [ "$(id -u)" = 0 ] && have visudo && [ "${TARGET_USER}" != "root" ]; then
  write_sudoers || true
fi

# ---- schedule the dispatcher: one 60s tick (systemd timer, cron fallback)
SCHEDULER="none"
DISP="${DEST}/dispatcher.sh"
WORKER="${DEST}/worker.py"
# Dedicated cache-Redis systemd service (SSOT = SVC in luxipanel-redis-cache.sh,
# provisioned just before this script). The worker unit orders After= it.
CACHE_SVC="luxipanel-cache"
# Unit names (SSOT) — the *_UNIT file paths and the systemctl calls below both
# derive from these so a name is written once.
DISP_SVC_NAME="luxipanel-cache-engine.service"
TMR_NAME="luxipanel-cache-engine.timer"
WRK_NAME="luxipanel-cache-worker.service"
SVC_UNIT="/etc/systemd/system/${DISP_SVC_NAME}"
TMR_UNIT="/etc/systemd/system/${TMR_NAME}"
WRK_UNIT="/etc/systemd/system/${WRK_NAME}"

# Repeated per-unit environment line (LUXIPANEL_CONFIG_DIR=${CFG}).
env_line() { printf 'Environment=LUXIPANEL_CONFIG_DIR=%s\n' "${CFG}"; }

write_units() {
  cat > "${SVC_UNIT}" <<EOF
[Unit]
Description=LUXIPANEL cache-engine dispatcher (one tick)
[Service]
Type=oneshot
User=${TARGET_USER}
Group=${TARGET_GROUP}
$(env_line)
ExecStart=/usr/bin/env bash ${DISP}
Nice=19
IOSchedulingClass=idle
EOF
  cat > "${TMR_UNIT}" <<EOF
[Unit]
Description=LUXIPANEL cache-engine tick every 60s
[Timer]
OnBootSec=30
OnUnitActiveSec=60
AccuracySec=10
Persistent=true
[Install]
WantedBy=timers.target
EOF
}

# Long-lived write-behind worker (drains lpwq:* and applies job recipes).
# Runs as the unprivileged SSH user; privileged steps go through `sudo -n`
# against the cache-engine sudoers allowlist (write commands are appended to
# that allowlist per module as each module is migrated to the queue).
write_worker_unit() {
  cat > "${WRK_UNIT}" <<EOF
[Unit]
Description=LUXIPANEL write-behind queue worker
After=${CACHE_SVC}.service network.target
[Service]
Type=simple
User=${TARGET_USER}
Group=${TARGET_GROUP}
$(env_line)
Environment=LPWQ_REQUIRE_HMAC=true
ExecStart=/usr/bin/env python3 ${WORKER}
Restart=on-failure
RestartSec=3
Nice=19
IOSchedulingClass=idle
[Install]
WantedBy=multi-user.target
EOF
}
if have systemctl && [ -d /run/systemd/system ] && [ "$(id -u)" = 0 ] \
   && write_units 2>/dev/null; then
  write_worker_unit 2>/dev/null || true
  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl enable --now "${TMR_NAME}" >/dev/null 2>&1 || true
  # Enable AND restart the worker so a re-provisioned worker.py actually takes
  # effect (enable --now does NOT restart an already-running unit).
  systemctl enable "${WRK_NAME}" >/dev/null 2>&1 || true
  systemctl restart "${WRK_NAME}" >/dev/null 2>&1 || true
  SCHEDULER="systemd"
else
  CRON_LINE="* * * * * LUXIPANEL_CONFIG_DIR=${CFG} flock -n ${ENGINE_DIR}/.cron.lock /usr/bin/env bash ${DISP} >/dev/null 2>&1"
  # Worker fallback: drain the queue once a minute (flock-serialized) when
  # systemd isn't available to keep it long-lived.
  WORKER_CRON="* * * * * LUXIPANEL_CONFIG_DIR=${CFG} flock -n ${ENGINE_DIR}/.worker.lock /usr/bin/env python3 ${WORKER} --drain >/dev/null 2>&1"
  ( crontab -l 2>/dev/null | grep -vF "${DISP}" | grep -vF "${WORKER}"; \
    echo "${CRON_LINE}"; echo "${WORKER_CRON}" ) \
    | crontab - 2>/dev/null && SCHEDULER="cron" || SCHEDULER="none"
fi

# Live data is opt-in; retain the administrator's flags on upgrades.
LIVE_CONFIG="${ENGINE_DIR}/live-data.json"
if [ "${LXP_ENABLE_LIVE_DATA:-0}" = 1 ] && [ ! -f "${LIVE_CONFIG}" ]; then
  printf '%s\n' '{"versionedReads":true,"events":true,"watcher":true}' > "${LIVE_CONFIG}"
  chmod 600 "${LIVE_CONFIG}"
  if [ "$(id -u)" = 0 ]; then chown "${TARGET_USER}:${TARGET_GROUP}" "${LIVE_CONFIG}"; fi
fi
if [ "${SCHEDULER}" = systemd ]; then
  cat > /etc/systemd/system/luxipanel-cache-watch.service <<EOF
[Unit]
Description=LUXIPANEL configuration change watcher
After=${CACHE_SVC}.service
[Service]
Type=simple
User=${TARGET_USER}
Group=${TARGET_GROUP}
$(env_line)
ExecStart=/usr/bin/env python3 ${DEST}/live_watch.py
Restart=on-failure
RestartSec=3
Nice=10
IOSchedulingClass=idle
[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload >/dev/null 2>&1 || true
  # The process stays dormant while watcher=false; flags can be enabled per target later.
  systemctl enable --now luxipanel-cache-watch.service >/dev/null 2>&1 || true
fi

# ---- cold-start: populate Redis once now so the first DataTable is fast
nice -n 19 timeout 180 /usr/bin/env bash "${DISP}" --once >/dev/null 2>&1 &

echo "{\"ok\":true,\"scheduler\":\"${SCHEDULER}\"}"
exit 0
