#!/usr/bin/env python3
"""
common.py — shared helpers for the LUXIPANEL client-side cache engines.

Runs ON THE CLIENT SERVER (the customer's machine), not on the panel host.
Stdlib only (no pip): json, gzip, base64, hashlib, subprocess, time, os.

Responsibilities:
  * locate conn.json (dedicated Redis on 127.0.0.1) and cache-policy.json
  * project + deterministically sort + pre-paginate a collection into the
    exact view the DataTable needs
  * content-hash the payload and only rewrite Redis when it actually changed
    (always refresh `collectedAt` so the reader's stale-while-revalidate
    logic sees the engine is alive)
  * store everything gzip+base64 so values are quoting-safe over redis-cli
    and, later, over /api/agents/exec

Redis key namespace is instance-local: each client server has its OWN
dedicated Redis, so the instance itself is the per-server boundary. The
panel-side reader additionally namespaces meta by target.id.

  lprc:v1:<module>:<collection>:meta            -> b64(gzip(json meta))
  lprc:v1:<module>:<collection>:full            -> b64(gzip(json rows[]))
  lprc:v1:<module>:<collection>:p:<size>:<idx>  -> b64(gzip(json rows[] page))
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import os
import re
import subprocess
import time

# ── wire contract (SSOT: TS shared/remote-cache/keys.ts → cache-policy.json) ──
# The read-cache prefix (`lprc:v1`), write-queue prefix (`lpwq:v1`) and policy
# schema version are shipped in the sibling cache-policy.json (emitted from the
# TypeScript SSOT by build-policy.ts). Load them ONCE here so the Python side
# never re-embeds the literals. Historical literals stay as HARDCODED FALLBACKS
# so a box where the JSON isn't shipped yet keeps working byte-identically.
def _load_policy():
    try:
        with open(os.path.join(os.path.dirname(__file__), "..", "cache-policy.json")) as f:
            return json.load(f)
    except Exception:
        return {}


_POLICY = _load_policy()
KEY_PREFIX = _POLICY.get("keyPrefix", "lprc:v1")
# Write-queue namespace (`lpwq:v1`); the WQ_* key builders below derive from it.
WQ_PREFIX = _POLICY.get("writeQueuePrefix", "lpwq:v1")

# Redis commands are fed to `redis-cli` one-per-line on stdin, so a key
# containing a space or newline would inject an extra command. `module` and
# `collection` are safe identifiers from the policy, but `scope` is derived
# from a sidecar row field (engine-mirror.py) and could be attacker-influenced.
# Reject anything with whitespace/control chars before it reaches a key.
SAFE_KEY_RE = re.compile(r"^[A-Za-z0-9_.:@+-]+$")
PAGE_SIZES = [10, 20, 50, 100]  # mirrors DataTable.tsx pageSizeOptions

CFG_DIR = os.environ.get("LUXIPANEL_CONFIG_DIR", "/etc/luxipanel")
CONN_PATH = os.path.join(CFG_DIR, "cache", "conn.json")
POLICY_PATH = os.path.join(CFG_DIR, "cache-engine", "cache-policy.json")
SCHEDULE_PATH = os.path.join(CFG_DIR, "cache-engine", "schedule.json")
STATE_DIR = os.path.join(CFG_DIR, "cache-engine", "state")

# From the shipped policy (SSOT), falling back to the historical literal.
POLICY_SCHEMA_VERSION = _POLICY.get("schemaVersion", 1)

# Fallback dispatch interval when neither schedule.json nor the policy entry
# pins one. SSOT for the magic 600 previously inlined in dispatcher.sh /
# install-engines.sh.
DEFAULT_INTERVAL_SECONDS = 600


# --------------------------------------------------------------------------
# config loading (fail-open: missing/broken config => engine is a no-op)
# --------------------------------------------------------------------------
def load_json(path: str):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return None
    except (OSError, ValueError):
        return None


# --------------------------------------------------------------------------
# subprocess helper shared by all collectors (S-02)
#
# `subprocess.run` with capture, timeout, check=False and a safe-soft return
# value (None on any exception). This is the single source of truth for
# "shell out, never raise". The worker has its own variant that returns a
# sentinel object on TimeoutExpired so it can distinguish the failure mode
# in error reporting; collectors don't need that detail.
# --------------------------------------------------------------------------
def run_cmd(argv, *, timeout=None):
    try:
        return subprocess.run(
            list(argv),
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except Exception:
        return None


# --------------------------------------------------------------------------
# Collector main() control flow (S-01)
#
# Every system-collector follows the same recipe:
#   1. parse argv (argv[1]=module, argv[2]=collection)
#   2. load the dedicated Redis conn + ping it (fail-open no-op if down)
#   3. load the cache policy + find the entry that names this collector
#   4. time the gather, write the projected view + the per-entry stat
#
# The differences live entirely in `gather()` (which computes the rows from
# the customer's box) and `source` (always "system-collector" today, but
# kept parameterisable so a future sidecar-style engine can reuse this).
# --------------------------------------------------------------------------
def run_collector_main(argv, *, gather_fn, source="system-collector"):
    """Standard CLI entrypoint for the system-collector scripts.

    argv[1]  = module
    argv[2]  = collection
    gather_fn() -> list[dict]: returns the rows to project into Redis
    source    = the `source` tag written into the meta blob (and used by
                the dispatcher to pick the engine; collectors always use
                "system-collector")

    Exit codes:
      0  normal (including the fail-open no-op paths)
      2  usage error (wrong argv)
    """
    import sys

    if len(argv) != 3:
        sys.stderr.write(
            "usage: {} <module> <collection>\n".format(
                argv[0] if argv else "<collector>",
            )
        )
        return 2
    module, collection = argv[1], argv[2]
    conn = load_conn()
    if not conn:
        return 1 if os.environ.get("LXP_REFRESH_STRICT") == "1" else 0
    redis = Redis(*conn)
    if not redis.ping():
        return 1 if os.environ.get("LXP_REFRESH_STRICT") == "1" else 0
    policy = load_policy() or []
    entry = next(
        (c for c in policy
         if c.get("module") == module and c.get("collection") == collection),
        None,
    )
    if not entry or entry.get("source") != source:
        return 0
    started = time.time()
    rows = gather_fn()
    stat = write_view(redis, module, collection, rows,
                      source, entry.get("projection"))
    stat["wallMs"] = int((time.time() - started) * 1000)
    write_stat(module, collection, stat)
    return 0


def load_conn():
    """Returns (host, port, password) or None if Redis isn't provisioned."""
    conn = load_json(CONN_PATH)
    if not isinstance(conn, dict):
        return None
    host = conn.get("host") or "127.0.0.1"
    port = conn.get("port")
    password = conn.get("password")
    if not port or not password:
        return None
    return (str(host), int(port), str(password))


def load_policy():
    pol = load_json(POLICY_PATH)
    if not isinstance(pol, dict):
        return None
    if pol.get("schemaVersion") != POLICY_SCHEMA_VERSION:
        return None
    cols = pol.get("collections")
    return cols if isinstance(cols, list) else None


# --------------------------------------------------------------------------
# redis-cli wrapper (commands fed on stdin, one per line; b64 tokens only so
# there are no quoting hazards)
# --------------------------------------------------------------------------
class Redis:
    def __init__(self, host, port, password):
        # NOTE: never pass the password on argv (`-a <pw>`) — it's visible in
        # `ps`/`/proc/<pid>/cmdline` to any local user and exposes a
        # write-behind job injection primitive. Use REDISCLI_AUTH env (read
        # by redis-cli itself, only this process can see it) and pass
        # `--no-auth-warning` to keep logs clean.
        env = os.environ.copy()
        env["REDISCLI_AUTH"] = password
        self._env = env
        self._base = [
            "redis-cli",
            "-h", host,
            "-p", str(port),
            "--no-auth-warning",
        ]

    def _run(self, args, stdin=None, timeout=20):
        return subprocess.run(
            self._base + args,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            env=self._env,
        )

    def ping(self) -> bool:
        try:
            r = self._run(["PING"], timeout=5)
            return r.returncode == 0 and r.stdout.strip() == "PONG"
        except Exception:
            return False

    def get(self, key: str):
        r = self._run(["--no-raw", "GET", key])
        if r.returncode != 0:
            return None
        out = r.stdout.strip()
        if out == "" or out == "(nil)":
            return None
        # --no-raw wraps bulk strings in quotes
        if len(out) >= 2 and out[0] == '"' and out[-1] == '"':
            out = out[1:-1]
        return out or None

    def pipeline(self, commands) -> bool:
        """commands: list of (CMD, key, value-or-None). One redis-cli process."""
        lines = []
        for cmd in commands:
            if len(cmd) == 3 and cmd[2] is not None:
                lines.append(f"{cmd[0]} {cmd[1]} {cmd[2]}")
            else:
                lines.append(f"{cmd[0]} {cmd[1]}")
        try:
            r = self._run([], stdin="\n".join(lines) + "\n", timeout=30)
            return r.returncode == 0
        except Exception:
            return False

    def scan_keys(self, pattern: str):
        try:
            r = self._run(["--scan", "--pattern", pattern], timeout=15)
            if r.returncode != 0:
                return []
            return [ln for ln in r.stdout.splitlines() if ln.strip()]
        except Exception:
            return []

    # ---- write-queue ops (lpwq:*) -------------------------------------
    # Queue/processing elements are plain jobIds (uuids, never secrets); the
    # job payload lives under its own key fed via stdin by the panel, so no
    # secret ever lands in argv (`ps`/audit safe on the customer's box).
    def brpoplpush(self, src: str, dst: str, block_timeout: int = 5):
        """Reliable take: atomically move one element src->dst, blocking up to
        `block_timeout`s. Returns the element (jobId) or None on timeout."""
        try:
            r = self._run(["BRPOPLPUSH", src, dst, str(block_timeout)],
                          timeout=block_timeout + 5)
        except Exception:
            return None
        if r.returncode != 0:
            return None
        out = (r.stdout or "").strip()
        if not out or out == "(nil)":
            return None
        return out

    def lrem(self, key: str, count: int, value: str) -> bool:
        try:
            r = self._run(["LREM", key, str(count), value], timeout=10)
            return r.returncode == 0
        except Exception:
            return False

    def lrange(self, key: str, start: int = 0, stop: int = -1):
        try:
            r = self._run(["LRANGE", key, str(start), str(stop)], timeout=10)
            if r.returncode != 0:
                return []
            return [ln for ln in r.stdout.splitlines() if ln.strip()]
        except Exception:
            return []

    def set_ex(self, key: str, value: str, ttl_seconds: int) -> bool:
        """SET with TTL. `value` is a b64 token (no spaces) so argv is safe,
        but we still feed it on stdin to keep one uniform path."""
        try:
            r = self._run([], stdin=f"SET {key} {value} EX {ttl_seconds}\n",
                          timeout=15)
            return r.returncode == 0
        except Exception:
            return False

    def delete(self, *keys: str) -> bool:
        if not keys:
            return True
        return self.pipeline([("DEL", k) for k in keys])


# --------------------------------------------------------------------------
# payload shaping
# --------------------------------------------------------------------------
def fnv1a_id(s) -> int:
    """32-bit FNV-1a masked to 31 bits — the SSOT for synthetic DataTable row
    ids in the collectors (hosting, mail).

    MUST stay byte-compatible with the panel-side implementation: the id is what
    the DataTable keys rows by, so a divergence silently reshuffles selections
    and per-row actions. Kept here (and nowhere else) precisely for that reason.
    """
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h & 0x7FFFFFFF


def atomic_write_json(path: str, obj, *, dir_mode=None, mode=0o600,
                      ensure_ascii=True) -> bool:
    """Write `obj` as compact JSON to `path` atomically: mkdir -p, write a
    sibling `.tmp`, chmod it, then `os.replace`.

    A reader therefore never sees a half-written sidecar, and the file is never
    world-readable even for an instant (the chmod happens on the tmp, before the
    rename). `dir_mode` additionally tightens the containing directory (0o700
    for the engine state dir).

    Best-effort by design — every caller is on a fail-open path: returns False
    on OSError instead of raising.
    """
    try:
        directory = os.path.dirname(path)
        os.makedirs(directory, exist_ok=True)
        if dir_mode is not None:
            os.chmod(directory, dir_mode)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(obj, fh, separators=(",", ":"), ensure_ascii=ensure_ascii)
        os.chmod(tmp, mode)
        os.replace(tmp, path)
        return True
    except OSError:
        return False


def _b64gz(text: str) -> str:
    return base64.b64encode(gzip.compress(text.encode("utf-8"), 6)).decode("ascii")


def _project(row: dict, projection):
    if not projection:
        return row
    return {k: row.get(k) for k in projection}


def _sort_key(row: dict):
    # Deterministic: newest-first when createdAt exists, else by id (str).
    ca = row.get("createdAt")
    if ca is not None:
        return (0, "", str(ca))
    return (1, str(row.get("id", "")), "")


def _deterministic(rows):
    has_ca = rows and all(r.get("createdAt") is not None for r in rows)
    if has_ca:
        return sorted(rows, key=lambda r: str(r.get("createdAt")), reverse=True)
    return sorted(rows, key=lambda r: str(r.get("id", "")))


def docs_from_sidecar(obj):
    """kv-store collection file = object map {docId: {..}}. -> list of docs."""
    if not isinstance(obj, dict):
        return []
    out = []
    for doc_id, doc in obj.items():
        if isinstance(doc, dict):
            d = dict(doc)
            d.setdefault("id", doc_id)
            out.append(d)
    return out


def write_view(redis: Redis, module: str, collection: str, rows, source: str,
                projection=None, scope=None) -> dict:
    """
    Build the precomputed DataTable view and push to Redis only if the
    content changed. Returns a stats dict for the cost panel (Hito 6).

    When `scope` is provided, the keys are namespaced under
    `:scope:<scope>:` so a single collection can have one unscoped blob and
    N per-scope blobs side-by-side.
    """
    # Key-injection guard: never build a Redis key from an unvalidated token.
    if not SAFE_KEY_RE.match(str(module)) or not SAFE_KEY_RE.match(str(collection)):
        return {"module": module, "collection": collection, "version": "",
                "count": 0, "changed": False, "bytes": 0, "durationMs": 0,
                "skipped": "invalid-key"}
    if scope is not None and scope != "" and not SAFE_KEY_RE.match(str(scope)):
        return {"module": module, "collection": collection, "version": "",
                "count": 0, "changed": False, "bytes": 0, "durationMs": 0,
                "skipped": "invalid-scope"}
    started = time.time()
    projected = [_project(r, projection) for r in _deterministic(list(rows))]
    full_json = json.dumps(projected, separators=(",", ":"), sort_keys=True,
                            ensure_ascii=False)
    version = hashlib.sha256(full_json.encode("utf-8")).hexdigest()[:16]
    scope_part = f":scope:{scope}" if scope is not None and scope != "" else ""
    base = f"{KEY_PREFIX}:{module}:{collection}{scope_part}"

    prev = None
    raw_meta = redis.get(f"{base}:meta")
    if raw_meta:
        try:
            prev = json.loads(gzip.decompress(base64.b64decode(raw_meta)))
        except Exception:
            prev = None

    collected_at = int(time.time())
    count = len(projected)
    page_index = {}
    for size in PAGE_SIZES:
        pages = max(1, (count + size - 1) // size) if count else 0
        page_index[str(size)] = pages

    changed = not prev or prev.get("version") != version
    meta = {
        "schemaVersion": POLICY_SCHEMA_VERSION,
        "version": version,
        "count": count,
        "collectedAt": collected_at,
        "source": source,
        "pageSizes": PAGE_SIZES,
        "pages": page_index,
    }
    meta_val = _b64gz(json.dumps(meta, separators=(",", ":")))
    from live_view import publish
    publish(redis, CFG_DIR, module, collection, meta, _b64gz(full_json), scope)


    if not changed:
        # Data identical — only refresh freshness so the reader's SWR/fallback
        # knows the engine is alive. Single cheap SET.
        redis.pipeline([("SET", f"{base}:meta", meta_val)])
        return {
            "module": module, "collection": collection, "version": version,
            "count": count, "changed": False, "bytes": len(full_json),
            "durationMs": int((time.time() - started) * 1000),
        }

    # Content changed: drop stale keys for this collection, then rewrite.
    cmds = []
    for k in redis.scan_keys(f"{base}:*"):
        cmds.append(("DEL", k))
    cmds.append(("SET", f"{base}:full", _b64gz(full_json)))
    for size in PAGE_SIZES:
        for idx in range(page_index[str(size)]):
            chunk = projected[idx * size:(idx + 1) * size]
            cmds.append((
                "SET",
                f"{base}:p:{size}:{idx}",
                _b64gz(json.dumps(chunk, separators=(",", ":"),
                                  ensure_ascii=False)),
            ))
    cmds.append(("SET", f"{base}:meta", meta_val))
    ok = redis.pipeline(cmds)
    return {
        "module": module, "collection": collection, "version": version,
        "count": count, "changed": True, "ok": ok, "bytes": len(full_json),
        "durationMs": int((time.time() - started) * 1000),
    }


def write_stat(module: str, collection: str, stat: dict) -> None:
    """Persist per-entry metrics for Ajustes → Módulos (Hito 6)."""
    key = f"{module}__{collection}"
    atomic_write_json(os.path.join(STATE_DIR, f"{key}.stat"), stat,
                      dir_mode=0o700)


def sidecar_path(module: str, collection: str) -> str:
    return os.path.join(CFG_DIR, module, f"{collection}.json")


# --------------------------------------------------------------------------
# write-queue (lpwq) — shared key namespace + payload codec
#
# Mirror image of the read engine: instead of collecting system state INTO
# Redis, a worker drains job "recipes" FROM Redis and applies them on-box.
# Namespaced `lpwq:v1` so it never collides with the read cache `lprc:v1`.
# WQ_PREFIX is loaded from the shipped policy (SSOT) at the top of this module.
# --------------------------------------------------------------------------
WQ_QUEUE = f"{WQ_PREFIX}:queue"
WQ_PROCESSING = f"{WQ_PREFIX}:processing"
WQ_HEALTH = f"{WQ_PREFIX}:health"
# Sudo credential the panel registers so the worker can run privileged steps
# the same way the panel does (`sudo -S` with the SSH user's own passphrase).
# Single key: this Redis IS the per-server boundary. Loopback + requirepass +
# no disk persistence; the passphrase is the SSH user's own (no escalation for
# that user). The panel refreshes it (with TTL) on every submit that needs sudo.
WQ_CRED = f"{WQ_PREFIX}:cred"


def wq_job_key(job_id: str) -> str:
    return f"{WQ_PREFIX}:job:{job_id}"


def wq_status_key(job_id: str) -> str:
    return f"{WQ_PREFIX}:status:{job_id}"


def wq_done_key(job_id: str) -> str:
    """Short-lived list the worker pushes on terminal state so a panel doing
    a semi-sync BLPOP wakes the instant the job finishes (no polling)."""
    return f"{WQ_PREFIX}:done:{job_id}"


def load_sudo_cred(redis):
    """Returns {'user':..,'passphrase':..} or None. Fail-soft."""
    obj = load_obj_b64(redis.get(WQ_CRED))
    if isinstance(obj, dict) and obj.get("passphrase"):
        return obj
    return None


def b64gz(text: str) -> str:
    """Public alias of the payload codec (panel and worker agree on it)."""
    return _b64gz(text)


def ungz_b64(token):
    """Inverse of b64gz: returns the decoded text, or None on any failure."""
    if not token:
        return None
    try:
        return gzip.decompress(base64.b64decode(token)).decode("utf-8")
    except Exception:
        return None


def load_obj_b64(token):
    """ungz_b64 + json.loads, fail-soft to None."""
    txt = ungz_b64(token)
    if txt is None:
        return None
    try:
        return json.loads(txt)
    except ValueError:
        return None


# --------------------------------------------------------------------------
# notifications sidecar append (client-side failure reporting)
#
# Notifications is a `sidecar-mirror` collection: an object map keyed by uuid
# at ${CFG_DIR}/notifications/notifications.json. The worker runs ON the
# client, so when something fails it appends a row here directly and lets the
# panel see it after the next `notifications/notifications` refresh — no panel
# round-trip needed. This only APPENDS a record; it duplicates no business
# logic. Row shape mirrors notification.model.ts exactly.
# --------------------------------------------------------------------------
NOTIF_MAX_ROWS = 5000


def emit_notification(severity: str, module: str, title: str, message: str,
                       metadata=None, link=None) -> bool:
    """Append one notification row to the client-side sidecar (atomic, 0600).
    Returns True on success. Best-effort: never raises (callers are in error
    paths already)."""
    import uuid as _uuid

    path = sidecar_path("notifications", "notifications")
    try:
        existing = load_json(path)
        rows = existing if isinstance(existing, dict) else {}
    except Exception:
        rows = {}

    now = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + \
        f".{int((time.time() % 1) * 1000):03d}Z"
    nid = str(_uuid.uuid4())
    rows[nid] = {
        "id": nid,
        "source": "system",
        "module": module,
        "severity": severity if severity in ("info", "success", "warning", "error") else "error",
        "title": title,
        "message": message,
        "link": link,
        "userId": None,
        "read": False,
        "readAt": None,
        "createdAt": now,
        "metadata": metadata if isinstance(metadata, dict) else None,
    }

    # Trim oldest by createdAt so the sidecar never grows unbounded (mirrors
    # notificationsRepository.trim, MAX_ROWS=5000).
    if len(rows) > NOTIF_MAX_ROWS:
        ordered = sorted(rows.items(),
                         key=lambda kv: str(kv[1].get("createdAt", "")))
        for k, _v in ordered[: len(rows) - NOTIF_MAX_ROWS]:
            rows.pop(k, None)

    return atomic_write_json(path, rows, ensure_ascii=False)
