#!/usr/bin/env bash
# ============================================================
# luxipanel-redis-cache.sh — provision the dedicated cache Redis
# on the CLIENT server (the customer's machine).
#
# Idempotent. Installs a DEDICATED redis instance `luxipanel-cache`
# bound to 127.0.0.1 on its own port — it never touches the
# customer's system Redis (default :6379). Persists connection
# info to ${LUXIPANEL_CONFIG_DIR}/cache/conn.json (chmod 600).
#
# Re-running NEVER rotates the password (a rotation would 401 every
# reader until the next provision — same trap as the LUXIPANEL key).
#
# Output: a single JSON line on stdout: {"ok":true,"version":"..","port":N}
# The password is NEVER printed to stdout.
# ============================================================
set -u

CFG="${LUXIPANEL_CONFIG_DIR:-/etc/luxipanel}"
HOST="127.0.0.1"
PORT="${LUXIPANEL_CACHE_PORT:-7379}"
CACHE_DIR="${CFG}/cache"
CONN="${CACHE_DIR}/conn.json"
LEGACY_CONF="${CACHE_DIR}/redis-cache.conf"
MAXMEM="${LUXIPANEL_CACHE_MAXMEMORY:-128mb}"
SVC="luxipanel-cache"
SVC_USER="luxipanel-cache"
SVC_GROUP="luxipanel-cache"

# Keep the panel-readable connection file separate from Redis' private config
# and state.  The latter contain the same credential but must not be writable
# (or unnecessarily readable) by the SSH/panel account.
if [ "$(id -u)" = 0 ] && command -v systemctl >/dev/null 2>&1 \
   && [ -d /run/systemd/system ]; then
  CONF_DIR="/etc/${SVC}"
  CONF="${CONF_DIR}/redis-cache.conf"
  DATA_DIR="/var/lib/${SVC}"
  RUN_DIR="/run/${SVC}"
else
  CONF_DIR="${CACHE_DIR}"
  CONF="${CACHE_DIR}/redis-cache.conf"
  DATA_DIR="${CACHE_DIR}/data"
  RUN_DIR="${CACHE_DIR}"
fi

emit_fail() { echo "{\"ok\":false,\"error\":\"$1\"}"; exit 0; }

have() { command -v "$1" >/dev/null 2>&1; }

# ---- ensure redis-server present (dedicated instance, system one untouched)
if ! have redis-server; then
  if have apt-get; then
    DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1 || true
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq redis-server >/dev/null 2>&1 || true
  elif have dnf; then dnf install -y -q redis >/dev/null 2>&1 || true
  elif have yum; then yum install -y -q redis >/dev/null 2>&1 || true
  elif have zypper; then zypper -q install -y redis >/dev/null 2>&1 || true
  elif have apk; then apk add --no-cache redis >/dev/null 2>&1 || true
  fi
fi
have redis-server || emit_fail "redis-server not installable"

mkdir -p "${CACHE_DIR}" "${CONF_DIR}" "${DATA_DIR}" 2>/dev/null \
  || emit_fail "cannot create cache directories"

# Preserve the existing connection-file owner so a root re-provision does not
# silently lock the panel account out.  Fall back to the cache directory owner.
if [ -n "${LUXIPANEL_TARGET_USER:-${SUDO_USER:-}}" ] \
   && id "${LUXIPANEL_TARGET_USER:-${SUDO_USER:-}}" >/dev/null 2>&1; then
  CONN_UID="$(id -u "${LUXIPANEL_TARGET_USER:-${SUDO_USER:-}}")"
  CONN_GID="$(id -g "${LUXIPANEL_TARGET_USER:-${SUDO_USER:-}}")"
else
  CONN_UID="$(stat -c %u "${CONN}" 2>/dev/null || stat -c %u "${CFG}" 2>/dev/null || echo 0)"
  CONN_GID="$(stat -c %g "${CONN}" 2>/dev/null || stat -c %g "${CFG}" 2>/dev/null || echo 0)"
fi
chown "${CONN_UID}:${CONN_GID}" "${CACHE_DIR}" 2>/dev/null || true
chmod 700 "${CACHE_DIR}" 2>/dev/null || true

if [ "$(id -u)" = 0 ] && have systemctl && [ -d /run/systemd/system ]; then
  if ! getent group "${SVC_GROUP}" >/dev/null 2>&1; then
    groupadd --system "${SVC_GROUP}" >/dev/null 2>&1 \
      || emit_fail "cannot create cache service group"
  fi
  if ! id "${SVC_USER}" >/dev/null 2>&1; then
    useradd --system --gid "${SVC_GROUP}" --home-dir "${DATA_DIR}" \
      --no-create-home --shell /usr/sbin/nologin "${SVC_USER}" >/dev/null 2>&1 \
      || emit_fail "cannot create cache service user"
  fi
  chown root:"${SVC_GROUP}" "${CONF_DIR}" 2>/dev/null \
    || emit_fail "cannot secure cache config directory"
  chmod 750 "${CONF_DIR}" 2>/dev/null \
    || emit_fail "cannot secure cache config directory"
  chown "${SVC_USER}":"${SVC_GROUP}" "${DATA_DIR}" 2>/dev/null \
    || emit_fail "cannot secure cache data directory"
  chmod 700 "${DATA_DIR}" 2>/dev/null \
    || emit_fail "cannot secure cache data directory"
else
  chmod 700 "${DATA_DIR}" 2>/dev/null || true
fi

# ---- password: reuse existing (idempotent), else generate once
PASS=""
if [ -r "${CONN}" ]; then
  PASS="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("password",""))' "${CONN}" 2>/dev/null || true)"
fi
if [ -z "${PASS}" ]; then
  if have openssl; then PASS="$(openssl rand -hex 24)"
  else PASS="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"; fi
fi
[ -n "${PASS}" ] || emit_fail "cannot derive password"

# ---- write dedicated config (cache-only: no persistence, LRU eviction)
umask 077
CONF_TMP="${CONF}.tmp.$$"
CONF_BACKUP=""
if [ -e "${CONF}" ]; then
  CONF_BACKUP="${CONF}.rollback.$$"
  cp -p -- "${CONF}" "${CONF_BACKUP}" 2>/dev/null \
    || emit_fail "cannot stage cache config rollback"
fi
cat > "${CONF_TMP}" <<EOF
# Managed by LUXIPANEL — dedicated cache instance. Do not edit by hand.
port ${PORT}
bind 127.0.0.1 -::1
protected-mode yes
requirepass ${PASS}
dir ${DATA_DIR}
appendonly no
save ""
maxmemory ${MAXMEM}
maxmemory-policy allkeys-lru
daemonize no
pidfile ${RUN_DIR}/redis-cache.pid
loglevel notice
# Neutralize the CONFIG SET dir/dbfilename + SAVE arbitrary-file-write
# primitive: anyone with the requirepass could otherwise rewrite the data dir
# and dump an RDB to e.g. /root/.ssh/authorized_keys or /etc/cron.d. This
# cache never needs runtime CONFIG (provisioning reads INFO, not CONFIG), so
# disable it outright. Applies to BOTH the systemd and nohup start paths.
rename-command CONFIG ""
EOF
chmod 600 "${CONF_TMP}" 2>/dev/null || emit_fail "cannot secure staged cache config"
if [ "$(id -u)" = 0 ] && [ "${CONF_DIR}" = "/etc/${SVC}" ]; then
  chown root:"${SVC_GROUP}" "${CONF_TMP}" 2>/dev/null \
    || emit_fail "cannot secure cache config"
  chmod 640 "${CONF_TMP}" 2>/dev/null || emit_fail "cannot secure cache config"
fi
mv -f -- "${CONF_TMP}" "${CONF}" 2>/dev/null \
  || emit_fail "cannot install cache config"

# ---- run it (systemd preferred, nohup fallback)
start_nohup() {
  pkill -f "redis-server ${CONF}" >/dev/null 2>&1 || true
  sleep 1
  nohup redis-server "${CONF}" >/dev/null 2>&1 &
}
UNIT="/etc/systemd/system/${SVC}.service"
UNIT_BACKUP=""
rollback_systemd() {
  local ok=true
  if [ -n "${CONF_BACKUP}" ] && [ -e "${CONF_BACKUP}" ]; then
    mv -f -- "${CONF_BACKUP}" "${CONF}" 2>/dev/null || ok=false
  elif [ -z "${CONF_BACKUP}" ]; then
    rm -f -- "${CONF}" 2>/dev/null || ok=false
  fi
  if [ -n "${UNIT_BACKUP}" ] && [ -e "${UNIT_BACKUP}" ]; then
    mv -f -- "${UNIT_BACKUP}" "${UNIT}" 2>/dev/null || ok=false
  elif [ -z "${UNIT_BACKUP}" ]; then
    rm -f -- "${UNIT}" 2>/dev/null || ok=false
  fi
  systemctl daemon-reload >/dev/null 2>&1 || ok=false
  if [ -n "${UNIT_BACKUP}" ]; then
    systemctl restart "${SVC}" >/dev/null 2>&1 || ok=false
  else
    systemctl stop "${SVC}" >/dev/null 2>&1 || true
  fi
  "${ok}"
}
write_unit() {
  local unit_tmp="${UNIT}.tmp.$$"
  if [ -e "${UNIT}" ]; then
    UNIT_BACKUP="${UNIT}.rollback.$$"
    cp -p -- "${UNIT}" "${UNIT_BACKUP}" 2>/dev/null || return 1
  fi
  cat > "${unit_tmp}" <<EOF
[Unit]
Description=LUXIPANEL dedicated cache Redis
After=network.target

[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
ExecStart=$(command -v redis-server) ${CONF}
Restart=on-failure
RestartSec=3
Nice=10
UMask=0077
RuntimeDirectory=${SVC}
RuntimeDirectoryMode=0700
StateDirectory=${SVC}
StateDirectoryMode=0700
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictNamespaces=true
LockPersonality=true
SystemCallArchitectures=native
CapabilityBoundingSet=
AmbientCapabilities=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX

[Install]
WantedBy=multi-user.target
EOF
  chown root:root "${unit_tmp}" 2>/dev/null || return 1
  chmod 644 "${unit_tmp}" 2>/dev/null || return 1
  mv -f -- "${unit_tmp}" "${UNIT}" 2>/dev/null || return 1
}
if have systemctl && [ -d /run/systemd/system ] && [ "$(id -u)" = 0 ]; then
  if ! write_unit 2>/dev/null; then
    [ -z "${UNIT_BACKUP}" ] || mv -f -- "${UNIT_BACKUP}" "${UNIT}" 2>/dev/null || true
    [ -z "${CONF_BACKUP}" ] || mv -f -- "${CONF_BACKUP}" "${CONF}" 2>/dev/null || true
    emit_fail "cannot install cache systemd unit"
  fi
  if ! systemctl daemon-reload >/dev/null 2>&1; then
    [ -z "${UNIT_BACKUP}" ] || mv -f -- "${UNIT_BACKUP}" "${UNIT}" 2>/dev/null || true
    [ -z "${CONF_BACKUP}" ] || mv -f -- "${CONF_BACKUP}" "${CONF}" 2>/dev/null || true
    systemctl daemon-reload >/dev/null 2>&1 || true
    emit_fail "cannot reload cache systemd unit"
  fi
  systemctl enable "${SVC}" >/dev/null 2>&1 || true
  if ! systemctl restart "${SVC}" >/dev/null 2>&1; then
    if rollback_systemd; then
      emit_fail "cache systemd service failed; previous service restored"
    fi
    emit_fail "cache systemd service failed and rollback was incomplete"
  fi
else
  # Never create a root-owned detached Redis. Non-systemd root deployments
  # must provide an explicit supervisor/identity instead of degrading silently.
  if [ "$(id -u)" = 0 ]; then
    emit_fail "refusing root cache process without systemd"
  fi
  # Unprivileged non-systemd installation: run under the invoking identity.
  start_nohup
fi

# ---- verify
# SECURITY: feed the cache-Redis password via REDISCLI_AUTH env (read by
# redis-cli itself) instead of `-a` argv, so it never appears in `ps` /
# /proc/<pid>/cmdline during this brief provisioning window.
VERSION=""
export REDISCLI_AUTH="${PASS}"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if redis-cli -h "${HOST}" -p "${PORT}" --no-auth-warning ping 2>/dev/null | grep -q PONG; then
    VERSION="$(redis-cli -h "${HOST}" -p "${PORT}" --no-auth-warning \
      INFO server 2>/dev/null | sed -n 's/^redis_version:\(.*\)/\1/p' | tr -d '\r' | head -1)"
    break
  fi
  sleep 1
done
unset REDISCLI_AUTH
if [ -z "${VERSION}" ]; then
  if [ "$(id -u)" = 0 ] && have systemctl && [ -d /run/systemd/system ] \
     && rollback_systemd; then
    emit_fail "cache health check failed; previous service restored"
  fi
  emit_fail "cache health check failed and rollback was incomplete"
fi

if [ "$(id -u)" = 0 ] && have systemctl && [ -d /run/systemd/system ]; then
  CACHE_PID="$(systemctl show -p MainPID --value "${SVC}" 2>/dev/null || echo 0)"
  CACHE_USER="$(ps -o user= -p "${CACHE_PID}" 2>/dev/null | tr -d '[:space:]')"
  if [ "${CACHE_PID}" = "0" ] || [ "${CACHE_USER}" != "${SVC_USER}" ]; then
    if rollback_systemd; then
      emit_fail "cache identity check failed; previous service restored"
    fi
    emit_fail "cache identity check failed and rollback was incomplete"
  fi
fi

# ---- persist connection info for the panel-side reader (chmod 600)
TMP="${CONN}.tmp.$$"
cat > "${TMP}" <<EOF
{"host":"${HOST}","port":${PORT},"password":"${PASS}","instance":"${SVC}"}
EOF
chmod 600 "${TMP}" 2>/dev/null || true
mv -f "${TMP}" "${CONN}" 2>/dev/null || emit_fail "cannot write conn.json"
if [ "$(id -u)" = 0 ]; then
  chown "${CONN_UID}:${CONN_GID}" "${CONN}" 2>/dev/null \
    || emit_fail "cannot restore conn.json ownership"
fi
chmod 600 "${CONN}" 2>/dev/null || emit_fail "cannot secure conn.json"

[ -z "${CONF_BACKUP}" ] || rm -f -- "${CONF_BACKUP}"
[ -z "${UNIT_BACKUP}" ] || rm -f -- "${UNIT_BACKUP}"
if [ "${LEGACY_CONF}" != "${CONF}" ] && [ -e "${LEGACY_CONF}" ]; then
  rm -f -- "${LEGACY_CONF}" 2>/dev/null \
    || emit_fail "cannot remove legacy cache config"
fi

echo "{\"ok\":true,\"version\":\"${VERSION}\",\"port\":${PORT}}"
exit 0
