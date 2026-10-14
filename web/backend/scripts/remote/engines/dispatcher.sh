#!/usr/bin/env bash
# ============================================================
# dispatcher.sh — single coalesced cache-engine runner (CLIENT side)
#
# One process (driven by a 60s systemd timer / cron) instead of N timers.
# Reads cache-policy.json + schedule.json, runs only the engines that are
# due, each isolated with flock/nice/ionice/timeout so a slow or failing
# module can never starve the others or harm the customer's machine.
#
#   dispatcher.sh            run every due entry (normal tick)
#   dispatcher.sh --once     run every ENABLED entry now (cold-start)
#   dispatcher.sh --entry M C run just M/C now (targeted refresh, Hito 5)
#
# Periodic runs fail open; explicit strict refreshes return collector failure.
# ============================================================
set -u

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFG="${LUXIPANEL_CONFIG_DIR:-/etc/luxipanel}"
ENGINE_DIR="${CFG}/cache-engine"
STATE_DIR="${ENGINE_DIR}/state"
POLICY="${ENGINE_DIR}/cache-policy.json"
SCHEDULE="${ENGINE_DIR}/schedule.json"
LOCK="${ENGINE_DIR}/.dispatcher.lock"
PER_ENTRY_TIMEOUT=120

MODE="due"
ONLY_M=""; ONLY_C=""; ONLY_SCOPE=""
case "${1:-}" in
  --once)  MODE="once" ;;
  --entry)
    MODE="entry"; ONLY_M="${2:-}"; ONLY_C="${3:-}"
    # Optional `--scope <value>` after the entry pair.
    if [ "${4:-}" = "--scope" ]; then ONLY_SCOPE="${5:-}"; fi
    ;;
esac

log() { echo "[$(date -u +%FT%TZ)] dispatcher: $*" >&2; }

[ -r "${POLICY}" ]   || { log "no cache-policy.json — noop"; exit "${LXP_REFRESH_STRICT:-0}"; }
command -v python3 >/dev/null 2>&1 || { log "python3 missing — noop"; exit "${LXP_REFRESH_STRICT:-0}"; }
mkdir -p "${STATE_DIR}" 2>/dev/null || true
chmod 700 "${STATE_DIR}" 2>/dev/null || true

# Serialize. The periodic ("due"/"once") tick takes a single global lock so
# two ticks never overlap. A targeted refresh (`--entry`, fired by the panel
# after a create/edit/delete) must NOT share that lock — otherwise it is
# dropped with "previous tick still running" whenever a periodic tick happens
# to be mid-run, and the client Redis is never refreshed for that write. So
# `--entry` takes a per-(module/collection) lock and waits briefly for an
# in-flight refresh of the SAME entry instead of skipping.
# (Keep stderr live so log() reaches systemd/cron — only the lock open is
# best-effort.)
# SECURITY: ONLY_M / ONLY_C are interpolated into a filesystem path (lock
# file) and later into a `python3 engine M C` argv. Reject anything that
# isn't a safe identifier — blocks path traversal in the lock file name and
# argv injection when values come from a privileged caller (worker.py →
# trigger_refresh) that may have decoded a manipulated job payload.
SAFE_ID_RE='^[a-zA-Z0-9_-]+$'
if [ "${MODE}" = "entry" ]; then
  if ! [[ "${ONLY_M}" =~ ${SAFE_ID_RE} ]] || ! [[ "${ONLY_C}" =~ ${SAFE_ID_RE} ]]; then
    log "invalid --entry arguments: ONLY_M=${ONLY_M:-<empty>} ONLY_C=${ONLY_C:-<empty>} — refuse"
    exit "${LXP_REFRESH_STRICT:-0}"
  fi
  ENTRY_LOCK="${ENGINE_DIR}/.entry-${ONLY_M}-${ONLY_C}.lock"
  exec 9>"${ENTRY_LOCK}" || exit "${LXP_REFRESH_STRICT:-0}"
  flock -w 30 9 || { log "entry ${ONLY_M}/${ONLY_C} refresh still running — skip"; exit "${LXP_REFRESH_STRICT:-0}"; }
else
  exec 9>"${LOCK}" || exit 0
  flock -n 9 || { log "previous tick still running — skip"; exit 0; }
fi

# Emit "<module> <collection> <source> <collector|-> <interval>" (always 5
# tokens; "-" means no collector). schedule.json overrides enabled/interval.
emit_entries() {
python3 - "$MODE" "$ONLY_M" "$ONLY_C" "$SELF_DIR" <<'PY'
import sys
# common.py ships alongside dispatcher.sh in ${DEST}; when this script is fed
# on stdin sys.path[0] is "" (CWD), so add the bundle dir explicitly so the
# shared constants/loaders below resolve (SSOT: common.py, not re-derived here).
sys.path.insert(0, sys.argv[4])
import common
mode, only_m, only_c = sys.argv[1], sys.argv[2], sys.argv[3]
pol = common.load_json(common.POLICY_PATH) or {}
cols = pol.get("collections", []) if isinstance(pol, dict) else []
sched = common.load_json(common.SCHEDULE_PATH) or {}
for c in cols:
    m, col = c.get("module"), c.get("collection")
    if not m or not col: continue
    if mode == "entry" and (m != only_m or col != only_c): continue
    s = sched.get(f"{m}/{col}", {}) if isinstance(sched, dict) else {}
    enabled = s.get("enabled", True)
    if not enabled: continue
    interval = int(s.get("intervalSeconds") or c.get("defaultIntervalSeconds") or common.DEFAULT_INTERVAL_SECONDS)
    src = c.get("source") or "sidecar-mirror"
    collector = c.get("collector") or "-"
    print(f"{m} {col} {src} {collector} {interval}")
PY
}

result=0
entries=0
now=$(date +%s)
while read -r m col src collector interval; do
  [ -n "${m:-}" ] || continue
  entries=$((entries + 1))
  [ "${collector}" = "-" ] && collector=""
  stamp="${STATE_DIR}/${m}__${col}.last"

  if [ "${MODE}" = "due" ]; then
    last=0
    [ -r "${stamp}" ] && last="$(cat "${stamp}" 2>/dev/null || echo 0)"
    case "${last}" in ''|*[!0-9]*) last=0 ;; esac
    if [ "$(( now - last ))" -lt "${interval}" ]; then
      continue
    fi
  fi

  if [ "${src}" = "system-collector" ] && [ -n "${collector}" ] \
     && [ -f "${SELF_DIR}/${collector}.py" ]; then
    engine="${SELF_DIR}/${collector}.py"
  else
    engine="${SELF_DIR}/engine-mirror.py"
  fi

  # Pass an optional scope as the 3rd arg ONLY for --entry mode. Engines
  # that don't support scope ignore extra args; engine-mirror.py uses it to
  # emit just that scope's blob (granular refresh-on-write path).
  scope_arg=""
  if [ "${MODE}" = "entry" ] && [ -n "${ONLY_SCOPE}" ]; then
    scope_arg="${ONLY_SCOPE}"
  fi
  log "run ${m}/${col}${scope_arg:+ scope=$scope_arg} via $(basename "${engine}")"
  if nice -n 19 ionice -c3 timeout "${PER_ENTRY_TIMEOUT}" \
       python3 "${SELF_DIR}/run_entry.py" "${m}" "${col}" python3 "${engine}" "${m}" "${col}" ${scope_arg:+"${scope_arg}"} \
       >/dev/null 2>>"${ENGINE_DIR}/dispatcher.err"; then
    date +%s > "${stamp}" 2>/dev/null || true
    chmod 600 "${stamp}" 2>/dev/null || true
  else
    result=1
    log "entry ${m}/${col}${scope_arg:+ scope=$scope_arg} failed (isolated, continuing)"
  fi
done < <(emit_entries)

if [ "${LXP_REFRESH_STRICT:-0}" = "1" ]; then
  [ "$entries" -gt 0 ] || exit 1
  exit "$result"
fi
exit 0
