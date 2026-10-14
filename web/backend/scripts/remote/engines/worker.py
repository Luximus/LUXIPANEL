#!/usr/bin/env python3
"""
worker.py — generic write-behind queue worker (CLIENT side).

Mirror image of engine-mirror.py. Instead of collecting system state INTO
Redis, this drains job "recipes" FROM the per-server Redis (lpwq:v1:queue)
and applies them ON the customer's box, where there is no SSH latency between
steps. It carries NO business logic: the panel (TypeScript) builds the step
recipe and enqueues it in one fast op; this worker only executes the steps and
then triggers the read collector refresh so the DataTable reflects the change.

Reliable queue: BRPOPLPUSH queue->processing, ack via LREM on completion, so a
crash/restart requeues an in-flight job (idempotent steps) instead of losing
it. A poison job is capped by MAX_ATTEMPTS and reported as failed.

Always fail-soft. Every failure (apply error, missing payload, Redis down) is
surfaced to the panel as a notification via common.emit_notification, written
straight to the notifications sidecar on this box.

  worker.py            run forever (systemd: luxipanel-cache-worker.service)
  worker.py --drain    drain the queue once and exit (cron fallback)

Stdlib only (json, subprocess, time, os, uuid) — no pip, like the collectors.
"""

import json
import os
import re
import signal
import subprocess
import sys
import time
import uuid
import hashlib
import hmac
import pwd
from stat import S_IMODE

import common

# Set by a SIGTERM/SIGINT handler so the main loop can exit cleanly between
# jobs (systemd sends SIGTERM on stop/restart) instead of being killed mid-job.
_STOP = False


def _handle_stop(_signum, _frame):
    global _STOP
    _STOP = True

STATUS_TTL = int(os.environ.get("WRITE_QUEUE_JOB_TTL_SECONDS", "3600"))  # job + status key TTL; mirrors WRITE_QUEUE_JOB_TTL_SECONDS (default 1h)
HEALTH_TTL = 180           # short, so a dead worker => missing health => stuck alert
BLOCK_SECONDS = 5          # BRPOPLPUSH block window
MAX_ATTEMPTS = 1           # no silent auto-retry; an orphan past this => failed
NO_CONN_SLEEP = 10         # Redis not provisioned yet — back off, fail-open
PING_FAIL_SLEEP = 5

# HMAC integrity check on job payloads — the trust boundary for write-behind
# jobs. Without it, any local process that can write the loopback per-server
# Redis (:7379) could inject a job carrying sudo-bearing steps (root-equivalent).
#
# Key file: ${LUXIPANEL_CONFIG_DIR}/cache-engine/lpwq.hmac.key, provisioned by
# install-engines.sh (mode 0640, owned by the SSH/worker user or root). The
# panel (shared/remote-cache/submit-mutation.ts) reads the SAME key and signs
# every enqueued payload; the worker rejects any job whose `hmac` does not match.
#
# FAIL-CLOSED in production. LPWQ_REQUIRE_HMAC defaults to true (the systemd
# unit sets it explicitly). When required:
#   • boot: if the key file is missing/unreadable the worker ABORTS (no silent
#     fail-open drain) — see main().
#   • per job: a job with a missing/invalid signature is rejected as corrupt.
# A developer running the worker by hand without a key must opt out explicitly
# with LPWQ_REQUIRE_HMAC=false (dev only).
HMAC_KEY_PATH = os.path.join(
    os.environ.get("LUXIPANEL_CONFIG_DIR", "/etc/luxipanel"),
    "cache-engine", "lpwq.hmac.key",
)
# Key file may be 0600 (root-owned legacy) or 0640 (owned by the worker/SSH
# user, as install-engines.sh provisions it). Group/other write bits are never
# tolerated.
_HMAC_KEY_MODES = frozenset({0o600, 0o640})
_HMAC_KEY: bytes | None = None
_HMAC_REQUIRED = os.environ.get("LPWQ_REQUIRE_HMAC", "true").lower() not in ("false", "0", "no")


def _load_hmac_key():
    """Read the HMAC key from disk. Cached after the first successful read so a
    privileged key rotation takes effect on restart. Returns None when the key
    file is absent, has unsafe permissions/ownership, or is empty.

    NO fail-open side effect: an operator who requested HMAC but has no readable
    key gets None here, and the caller treats that as a HARD failure (boot abort
    / per-job reject) rather than silently disabling the check."""
    global _HMAC_KEY
    if _HMAC_KEY is not None:
        return _HMAC_KEY
    try:
        st = os.stat(HMAC_KEY_PATH)
        if S_IMODE(st.st_mode) not in _HMAC_KEY_MODES:
            return None
        # Reject any group/other write bit regardless of the mode allowlist.
        if S_IMODE(st.st_mode) & 0o022:
            return None
        # Owner must be root (uid 0) or the identity the worker itself runs as
        # (install-engines.sh chowns the 0640 key to the SSH/worker user). A
        # non-root third party who can write the file still can't forge jobs.
        if st.st_uid not in (0, os.geteuid()):
            return None
        with open(HMAC_KEY_PATH, "rb") as fh:
            data = fh.read().strip()
        if not data:
            return None
        _HMAC_KEY = data
        return data
    except OSError:
        return None


def _verify_job_hmac(payload: dict) -> bool:
    """Return True iff the payload's HMAC matches the shared key, or if HMAC is
    disabled (LPWQ_REQUIRE_HMAC=false, dev only). Fail-CLOSED: when required and
    the key is unavailable OR the signature is absent/wrong, return False so the
    job is rejected without running any privileged step. HMAC is computed over
    the JSON payload WITHOUT the `hmac` field (canonical: sorted keys, compact,
    no ASCII-escaping — must byte-match submit-mutation.ts canonicalJson())."""
    if not _HMAC_REQUIRED:
        return True
    key = _load_hmac_key()
    if key is None:
        # Required but no usable key → reject (fail-closed). In practice the
        # boot guard in main() already aborted; this is defence in depth.
        return False
    if not isinstance(payload, dict):
        return False
    sig = payload.get("hmac")
    if not isinstance(sig, str):
        return False
    body = {k: v for k, v in payload.items() if k != "hmac"}
    try:
        body_bytes = json.dumps(
            body, separators=(",", ":"), sort_keys=True, ensure_ascii=False
        ).encode("utf-8")
    except (UnicodeEncodeError, ValueError, TypeError):
        # A lone surrogate / un-encodable value in user data (e.g. a truncated
        # emoji in a displayName) would raise here. Reject fail-closed instead
        # of letting the exception crash the worker (DoS via legit user data).
        return False
    expected = hmac.new(key, body_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)

# Path containment: the worker is the trust boundary. A writeFile step MUST
# resolve to one of these roots; anything else is rejected before any disk
# action. Mirrors cache-policy.json `writable: true` collections.
WRITE_ROOTS = (
    os.environ.get("LUXIPANEL_CONFIG_DIR", "/etc/luxipanel").rstrip("/") or "/etc/luxipanel",
    "/var/lib/luxipanel",
)

# Private staging dir for the root-writeFile path (A1'): under the engine config
# dir, 0700, so a local attacker can neither pre-create the temp file (O_EXCL)
# nor win a symlink race (O_NOFOLLOW). Replaces the world-writable /tmp path.
TMP_DIR = os.path.join(
    os.environ.get("LUXIPANEL_CONFIG_DIR", "/etc/luxipanel").rstrip("/") or "/etc/luxipanel",
    "cache-engine", "tmp",
)

# Modes allowed for writeFile steps. setuid/setgid/sticky bits are always
# rejected — combined with the path allowlist this prevents dropping a
# setuid-root binary or chmod-ing /etc/shadow world-readable. World-WRITABLE
# modes (0o666/0o777) are also rejected: no panel-built recipe legitimately
# needs a world-writable file, and accepting them would let a bug or an
# HMAC-injected job drop e.g. a world-writable /etc/sudoers.d fragment.
ALLOWED_MODES = frozenset({
    0o600, 0o640, 0o644, 0o660, 0o664,
    0o700, 0o750, 0o755, 0o760, 0o764, 0o770, 0o775,
})

_OWNER_RE = re.compile(r"^[a-z_][a-z0-9_-]{0,31}(:[a-z_][a-z0-9_-]{0,31})?$")


def _resolve_under_roots(path):
    """Resolve `path` (string) and verify it ends up under one of WRITE_ROOTS.
    Returns the absolute resolved path or None if containment fails."""
    if not isinstance(path, str) or not path:
        return None
    # Reject nulls + control chars; realpath is strict but cheap defence.
    if any(ord(c) < 0x20 for c in path):
        return None
    real = os.path.realpath(path)
    for root in WRITE_ROOTS:
        if real == root or real.startswith(root + os.sep):
            return real
    return None

SELF_DIR = os.path.dirname(os.path.abspath(__file__))
DISPATCHER = os.path.join(SELF_DIR, "dispatcher.sh")

_counters = {"processed": 0, "failed": 0, "lastError": None}


# --------------------------------------------------------------------------
# status / health
# --------------------------------------------------------------------------
def write_status(redis, job_id, state, **extra):
    st = {"jobId": job_id, "state": state, "ts": int(time.time())}
    st.update(extra)
    redis.set_ex(common.wq_status_key(job_id),
                 common.b64gz(json.dumps(st, separators=(",", ":"))),
                 STATUS_TTL)


def read_status(redis, job_id):
    return common.load_obj_b64(redis.get(common.wq_status_key(job_id))) or {}


def finish(redis, job_id, state, **extra):
    """Terminal status write + wake any panel blocked on the done-notify."""
    write_status(redis, job_id, state, **extra)
    redis.pipeline([
        ("RPUSH", common.wq_done_key(job_id), state),
        ("EXPIRE", common.wq_done_key(job_id), "30"),
    ])


def write_health(redis, state):
    h = {
        "state": state,                       # "idle" | "busy"
        "lastTickAt": int(time.time()),
        "processed": _counters["processed"],
        "failed": _counters["failed"],
        "lastError": _counters["lastError"],
    }
    redis.set_ex(common.WQ_HEALTH,
                 common.b64gz(json.dumps(h, separators=(",", ":"))),
                 HEALTH_TTL)


# --------------------------------------------------------------------------
# step execution (the only thing the worker "does")
# --------------------------------------------------------------------------
def _apply_write_file(step, passphrase):
    path = step.get("path")
    if not path:
        return False, "writeFile: missing path"
    # Containment: the panel-built recipe must NOT be able to point at
    # /etc/passwd, /etc/shadow, /etc/sudoers or other arbitrary paths. We
    # realpath() and check against the configured roots; reject otherwise.
    resolved = _resolve_under_roots(path)
    if resolved is None:
        return False, f"writeFile refused: path not under allowed roots: {path}"
    path = resolved
    content = common.ungz_b64(step.get("b64gz", "")) or ""
    try:
        mode = int(str(step.get("mode", "0600")), 8)
    except ValueError:
        mode = 0o600
    # Mode allowlist: forbid setuid/setgid/sticky bits and exotic perm bits.
    # Anything weird (0o777 is technically allowed, but setuid bits 0o4000+
    # are NOT — they make the file a privilege primitive).
    if mode not in ALLOWED_MODES:
        print(
            f"[worker] writeFile REJECTED (mode {oct(mode)} not in allowlist) path={path}",
            file=sys.stderr, flush=True,
        )
        return False, f"writeFile refused: mode {oct(mode)} not in allowlist"
    root = bool(step.get("root"))
    owner = step.get("owner")  # e.g. "root:root" — only used in root path
    if owner and not _OWNER_RE.match(owner):
        return False, f"writeFile refused: owner {owner!r} malformed or numeric uid/gid not allowed"

    if not root:
        try:
            parent = os.path.dirname(path)
            if parent:
                os.makedirs(parent, exist_ok=True)
                # Ensure the parent tree runs under an allowed root too
                # (makedirs can create new dirs in unexpected places).
                if _resolve_under_roots(parent) is None:
                    return False, f"writeFile refused: parent dir outside allowed roots: {parent}"
            # O_NOFOLLOW closes a TOCTOU window: between _resolve_under_roots()
            # and this open() a local attacker could swap the final component
            # for a symlink pointing outside the roots. If the target is itself
            # a symlink the open fails (ELOOP) — panel-written sidecars are
            # regular files, never symlinks, so this is safe.
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, mode)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as fh:
                    fh.write(content)
            except Exception:
                # Best-effort chmod on failure so we never leave a stray fd.
                try:
                    os.chmod(path, mode)
                except OSError:
                    pass
                raise
            # Belt-and-braces: fchmod enforces the mode bit-for-bit regardless
            # of the umask active at create() time.
            os.chmod(path, mode)
            return True, None
        except OSError as e:
            return False, f"writeFile {path}: {e}"

    # root-owned destination: write to a PRIVATE tmp, then `sudo cp` + chmod
    # (+chown), using the SSH user's passphrase exactly like the panel.
    #
    # A1' — atomic, race-free staging: the tmp lives under TMP_DIR (0700 dir,
    # not world-writable /tmp) and is opened O_CREAT|O_EXCL|O_NOFOLLOW with mode
    # 0600 so there is NO window in which the staged content (mail-account
    # passwords, {SHA512-CRYPT} hashes) is world-readable, and a local attacker
    # can neither pre-create the file nor point it at /etc/shadow via a symlink.
    try:
        os.makedirs(TMP_DIR, mode=0o700, exist_ok=True)
        os.chmod(TMP_DIR, 0o700)
    except OSError as e:
        return False, f"writeFile(root): cannot prepare staging dir {TMP_DIR}: {e}"
    tmp = os.path.join(TMP_DIR, f".lpwq-{uuid.uuid4().hex}")
    try:
        fd = os.open(
            tmp,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
            0o600,
        )
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(content)
        for argv in (["cp", tmp, path],
                     ["chmod", oct(mode)[2:], path],
                     (["chown", owner, path] if owner else None)):
            if argv is None:
                continue
            r = run_priv(argv, passphrase, timeout=20)
            if r.returncode != 0:
                return False, _sudo_error(argv, r)
        return True, None
    except OSError as e:
        return False, f"writeFile(root) {path}: {e}"
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


# Binaries that are SAFE to run as root via sudo. Anything else (shells,
# interpreters, env, sudo itself, etc.) is rejected to prevent recipes from
# turning sudo into a root shell primitive. This is the trust boundary for
# the write-behind queue.
#
# `tee`, `sed`, `awk`, `grep` are intentionally NOT here: each is an
# arbitrary-write / arbitrary-exec primitive under sudo (e.g. `sudo tee
# /etc/sudoers.d/zz`, `sudo sed -i … /etc/shadow`, `sudo awk
# 'BEGIN{system(…)}' file`, `sudo grep -E … | xargs …`). All real callers
# (system-accounts, cron, firewall, nginx, dovecot, postfix) work with the
# narrowed set below.
_SUDO_BIN_ALLOWLIST = frozenset({
    "/bin/cp", "/usr/bin/cp",
    "/bin/mv", "/usr/bin/mv",
    "/bin/rm", "/usr/bin/rm",
    "/bin/mkdir", "/usr/bin/mkdir",
    "/bin/chmod", "/usr/bin/chmod",
    "/bin/chown", "/usr/bin/chown",
    "/usr/sbin/useradd", "/usr/sbin/userdel", "/usr/sbin/usermod",
    "/usr/sbin/groupadd", "/usr/sbin/groupdel", "/usr/sbin/groupmod",
    "/usr/bin/chpasswd", "/usr/sbin/chpasswd",
    "/bin/passwd", "/usr/bin/passwd",
    "/usr/bin/gpasswd",
    "/usr/bin/crontab",
    "/usr/sbin/postfix", "/usr/sbin/dovecot",
    "/usr/sbin/postmap", "/usr/bin/postmap",
    "/usr/sbin/ufw", "/usr/bin/ufw",
    "/bin/systemctl", "/usr/bin/systemctl",
    "/usr/sbin/nginx", "/usr/bin/nginx",
})

_SUDO_BIN_BASENAMES = frozenset(os.path.basename(p) for p in _SUDO_BIN_ALLOWLIST)

# Per-binary FIRST-LEVEL flag allowlist (A2'). Blanket "reject every flag" broke
# legitimate recipes (useradd -m, usermod -aG, chown -R, systemctl --now, …);
# blanket "accept every flag" re-opens `cp --reference=`, `sudo -s`, etc. So we
# pin, per binary: the short letters allowed in a short cluster (`-rf` → r,f),
# the exact long options allowed (`--force`), and whether the bare `--`
# end-of-options sentinel is allowed. A binary absent here allows NO flags.
_FLAG_POLICY = {
    "useradd":   {"short": set("cdefgGkmMrsu"),  "long": frozenset(),          "dd": False},
    "usermod":   {"short": set("acdefgGlLmpsuU"), "long": frozenset(),          "dd": False},
    "userdel":   {"short": set("fr"),             "long": frozenset(),          "dd": False},
    "groupadd":  {"short": set("fgKor"),          "long": frozenset(),          "dd": False},
    "groupmod":  {"short": set("gno"),            "long": frozenset(),          "dd": False},
    "groupdel":  {"short": set(),                 "long": frozenset(),          "dd": False},
    "gpasswd":   {"short": set("aAdMr"),          "long": frozenset(),          "dd": False},
    "chpasswd":  {"short": set("cems"),           "long": frozenset(),          "dd": False},
    "passwd":    {"short": set("delnuSx"),        "long": frozenset(),          "dd": False},
    "chown":     {"short": set("cfhRv"),          "long": frozenset(),          "dd": False},
    "chmod":     {"short": set("cfhRv"),          "long": frozenset(),          "dd": False},
    "cp":        {"short": set("adfLpPRrv"),      "long": frozenset(),          "dd": False},
    "mv":        {"short": set("fnv"),            "long": frozenset(),          "dd": False},
    "rm":        {"short": set("dfrRv"),          "long": frozenset(),          "dd": False},
    "mkdir":     {"short": set("mpv"),            "long": frozenset(),          "dd": False},
    "crontab":   {"short": set("lru"),            "long": frozenset(),          "dd": False},
    "systemctl": {"short": set(),                 "long": frozenset({"--now"}), "dd": True},
    "nginx":     {"short": set("st"),             "long": frozenset(),          "dd": False},
    "ufw":       {"short": set(),                 "long": frozenset({"--force"}), "dd": False},
    "postmap":   {"short": set(),                 "long": frozenset(),          "dd": False},
    "postfix":   {"short": set(),                 "long": frozenset(),          "dd": False},
    "dovecot":   {"short": set(),                 "long": frozenset(),          "dd": False},
}
_EMPTY_POLICY = {"short": set(), "long": frozenset(), "dd": False}


def _flag_token_allowed(token, policy):
    """Is a single argv token that starts with '-' permitted for this binary?"""
    if token == "--":
        return policy["dd"]
    if token.startswith("--"):
        # Long option (possibly `--opt=value`): must be listed verbatim, and we
        # match on the `--opt` part so `--force=x` can't smuggle a value.
        name = token.split("=", 1)[0]
        return name in policy["long"]
    cluster = token[1:]  # short cluster like "rf"
    if not cluster:
        return False     # bare "-" (stdin sentinel) — not allowed as a flag
    return all(ch in policy["short"] for ch in cluster)


def _sudo_argv_allowed(argv):
    """Return True iff argv[0]'s basename is in the sudo binary allowlist AND
    every subsequent token is either a non-flag OR a flag explicitly permitted
    for that binary by _FLAG_POLICY. Non-string tokens are rejected outright.
    Blocks `sudo -s`/`-i`, `sudo bash -c`, `cp --reference=…`, `sed -i`, etc."""
    if not argv:
        return False
    a0 = str(argv[0])
    base = os.path.basename(a0)
    # If argv[0] is given as a PATH (contains a slash), it must be an absolute
    # path whose realpath is in the allowlist — a basename-only check would let
    # `/home/attacker/cp` masquerade as the allowlisted `cp`. Bare names (no
    # slash, how the panel actually sends them) are resolved by sudo's
    # secure_path to a system binary, so the basename allowlist governs those.
    if "/" in a0:
        if not a0.startswith("/") or os.path.realpath(a0) not in _SUDO_BIN_ALLOWLIST:
            print(f"[worker] sudo step REJECTED (path not allowlisted): {a0}",
                  file=sys.stderr, flush=True)
            return False
    elif base not in _SUDO_BIN_BASENAMES:
        print(f"[worker] sudo step REJECTED (binary not allowlisted): {base}",
              file=sys.stderr, flush=True)
        return False
    policy = _FLAG_POLICY.get(base, _EMPTY_POLICY)
    for a in argv[1:]:
        if not isinstance(a, str):
            return False
        if a.startswith("-") and not _flag_token_allowed(a, policy):
            print(f"[worker] sudo step REJECTED (flag {a!r} not allowed for {base})",
                  file=sys.stderr, flush=True)
            return False
    return True


def _apply_sh(step, passphrase):
    argv = step.get("argv")
    cmd = step.get("cmd")
    sudo = bool(step.get("sudo"))
    timeout = max(1, int(step.get("timeoutMs", 30000)) // 1000)
    stdin = step.get("input")

    if sudo:
        # Privileged steps MUST be argv against a real binary — never
        # `sudo bash -c ...` (that would be a root shell). With askpass the
        # command's own stdin stays free for `crontab -`, `chpasswd`, etc.
        if not isinstance(argv, list) or not argv:
            return False, "sudo step requires argv (no shell allowed)"
        if not _sudo_argv_allowed(argv):
            return (False,
                    "sudo step rejected: binary not in allowlist or "
                    "argv contains flag/option (no sudo bash -c, sudo -s, "
                    "sudo -i, --reference, etc.)")
        r = run_priv(argv, passphrase, timeout=timeout, stdin=stdin)
        if r.returncode != 0:
            return False, _sudo_error(argv, r)
        return True, None

    if isinstance(argv, list) and argv:
        full = [str(a) for a in argv]
    elif isinstance(cmd, str) and cmd:
        full = ["bash", "-c", cmd]   # unprivileged shell only
    else:
        return False, "sh step requires argv or cmd"

    r = _run(full, stdin=stdin, timeout=timeout)
    if r.returncode != 0:
        return False, (r.stderr or r.stdout or "").strip()[:300] or \
            f"exit {r.returncode}"
    return True, None


# --------------------------------------------------------------------------
# privileged execution — mirrors the panel's `sudo -S` model, but via askpass
# so the passphrase never reaches argv (ps-safe) and the command keeps its
# own stdin. The passphrase is the SSH user's own, read from lpwq:v1:cred.
# --------------------------------------------------------------------------
_ASKPASS_PATH = None
_SUDO_PW_RE = ("a password is required", "no tty present",
               "a terminal is required", "incorrect password",
               "sorry, try again")


def _assert_self_dir_trusted():
    """Verify SELF_DIR (the engine bundle directory) is 0700 and owned by a
    trusted principal — either root OR the identity the worker runs as
    (install-engines.sh chowns the bundle to the non-root SSH/worker user so
    the unit can read it). The SUDO_ASKPASS helper lives here; 0700 means only
    that owner (and root) can replace .askpass.sh, and the worker running as
    that owner already holds the same passphrase, so there is no escalation.
    A group/other-accessible dir, or one owned by a third party, is rejected
    (fail-closed: sudo stays disabled for this worker's lifetime)."""
    try:
        st = os.stat(SELF_DIR)
        if S_IMODE(st.st_mode) != 0o700:
            return False
        if st.st_uid not in (0, os.geteuid()):
            return False
        # Sanity: the owning uid must map to a real account (catches a uid with
        # no passwd entry — extremely rare, but cheap defence).
        try:
            pwd.getpwuid(st.st_uid)
        except KeyError:
            return False
        return True
    except OSError:
        return False


def ensure_askpass():
    """Create a static, secretless SUDO_ASKPASS helper once. It echoes the
    passphrase handed to it via the LPWQ_SUDO_PASS env var (scoped to the sudo
    child only)."""
    global _ASKPASS_PATH
    if _ASKPASS_PATH and os.path.exists(_ASKPASS_PATH):
        # Re-validate on every use: a local attacker could swap the helper
        # file (or change SELF_DIR ownership/mode) after our first check.
        st = os.stat(_ASKPASS_PATH)
        if S_IMODE(st.st_mode) != 0o700 or st.st_uid not in (0, os.geteuid()):
            _ASKPASS_PATH = None
            return None
        if not _assert_self_dir_trusted():
            _ASKPASS_PATH = None
            return None
        return _ASKPASS_PATH
    if not _assert_self_dir_trusted():
        return None
    path = os.path.join(SELF_DIR, ".askpass.sh")
    try:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write('#!/bin/sh\nprintf \'%s\\n\' "$LPWQ_SUDO_PASS"\n')
        os.chmod(path, 0o700)
        # Enforce trusted ownership (root or the worker's own euid) so a third
        # party who gets write access to SELF_DIR after the first run can't take
        # over the helper. _assert_self_dir_trusted() already required SELF_DIR
        # to be 0700 and owned by one of these, so the helper we just wrote is
        # owned by the worker's euid; anything else means tampering.
        try:
            if os.stat(path).st_uid not in (0, os.geteuid()):
                # Untrusted helper file — drop it so we refuse sudo rather than
                # authenticate to an attacker-controlled binary.
                os.unlink(path)
                _ASKPASS_PATH = None
                return None
        except OSError:
            _ASKPASS_PATH = None
            return None
        _ASKPASS_PATH = path
    except OSError:
        _ASKPASS_PATH = None
    return _ASKPASS_PATH


def run_priv(argv, passphrase, timeout=20, stdin=None):
    """Run argv as root. With a passphrase: `sudo -A` + askpass. Without one:
    fall back to `sudo -n` so any NOPASSWD-allowlisted command still works."""
    argv = [str(a) for a in argv]
    if passphrase and ensure_askpass():
        env = dict(os.environ)
        env["SUDO_ASKPASS"] = _ASKPASS_PATH
        env["LPWQ_SUDO_PASS"] = passphrase
        return _run(["sudo", "-A"] + argv, stdin=stdin, timeout=timeout, env=env)
    return _run(["sudo", "-n"] + argv, stdin=stdin, timeout=timeout)


def _sudo_error(argv, r):
    out = ((r.stderr or "") + " " + (r.stdout or "")).lower()
    detail = (r.stderr or r.stdout or "").strip()[:300]
    if any(p in out for p in _SUDO_PW_RE):
        return (f"sudo {argv[0]}: passphrase ausente o inválida — el panel debe "
                f"re-registrar la credencial y reintentar. ({detail})")
    return f"sudo {' '.join(argv)}: {detail or f'exit {r.returncode}'}"


def _run(full, stdin=None, timeout=30, env=None):
    try:
        return subprocess.run(full, input=stdin, capture_output=True,
                              text=True, timeout=timeout, check=False, env=env)
    except subprocess.TimeoutExpired:
        class _T:
            returncode = 124
            stdout = ""
            stderr = "timeout"
        return _T()
    except Exception as e:  # noqa: BLE001 — fail-soft
        class _E:
            returncode = 1
            stdout = ""
            stderr = str(e)
        return _E()


STEP_APPLIERS = {"writeFile": _apply_write_file, "sh": _apply_sh}


REFRESH_TIMEOUT = 90  # bound the synchronous collector run per refresh entry


def trigger_refresh(refresh):
    """Re-run the read collector(s) SYNCHRONOUSLY so that by the time the job is
    marked `done`, the client read cache already reflects the mutation. This is
    what makes read-after-write consistent for a panel that waits on / polls the
    job: the collector (e.g. collector-mail) can take several seconds, so we
    bound each run and fail-open (the 60s periodic tick is the backstop)."""
    ready = True
    for entry in refresh or []:
        try:
            m, c = entry[0], entry[1]
            scope = entry[2] if len(entry) > 2 else None
        except (IndexError, TypeError):
            continue
        if not m or not c:
            continue
        cmd = ["bash", DISPATCHER, "--entry", str(m), str(c)]
        if scope:
            cmd += ["--scope", str(scope)]
        try:
            result = subprocess.run(cmd, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
                           env=dict(os.environ, LXP_REFRESH_STRICT="1", LXP_COLLECT_LIGHT="1", LXP_INVALIDATE="1"),
                           timeout=REFRESH_TIMEOUT, check=False)
            ready = ready and result.returncode == 0
        except Exception:
            ready = False
    return ready


# --------------------------------------------------------------------------
# one job
# --------------------------------------------------------------------------
def process_job(redis, job_id):
    job = common.load_obj_b64(redis.get(common.wq_job_key(job_id)))
    if not isinstance(job, dict):
        finish(redis, job_id, "failed", error="job payload missing/corrupt")
        _counters["failed"] += 1
        _counters["lastError"] = "payload missing/corrupt"
        common.emit_notification(
            "error", "cola-escritura", "Trabajo de cola corrupto",
            f"El job {job_id} no tiene receta legible y se descartó.",
            metadata={"jobId": job_id})
        return

    # HMAC integrity check — the trust boundary for privileged steps. A job
    # without a valid HMAC is rejected as if it were corrupt (closed-form
    # failure, no privileged work runs).
    if not _verify_job_hmac(job):
        finish(redis, job_id, "failed", error="job payload HMAC missing or invalid")
        _counters["failed"] += 1
        _counters["lastError"] = "hmac missing or invalid"
        common.emit_notification(
            "error", "cola-escritura", "Trabajo de cola rechazado por HMAC",
            f"El job {job_id} no pasó la verificación HMAC (clave no configurada, "
            "firma ausente o manipulada) y se descartó sin aplicar ningún paso.",
            metadata={"jobId": job_id})
        return

    prev = read_status(redis, job_id)
    attempts = int(prev.get("attempts", 0)) + 1
    op = job.get("op", "?")
    module = job.get("module", "?")
    collection = job.get("collection", "?")
    label = f"{module}/{collection} {op}"

    if attempts > MAX_ATTEMPTS:
        finish(redis, job_id, "failed", attempts=attempts,
               error="excedió reintentos (posible job venenoso)")
        _counters["failed"] += 1
        _counters["lastError"] = f"poison {label}"
        common.emit_notification(
            "error", "cola-escritura", f"Operación abandonada: {label}",
            f"El trabajo {op} en {module}/{collection} falló de forma repetida "
            f"y se abandonó tras {attempts - 1} intento(s).",
            metadata={"jobId": job_id, "op": op, "module": module,
                      "collection": collection})
        return

    write_status(redis, job_id, "running", attempts=attempts,
                 startedAt=int(time.time()))

    # Resolve the sudo passphrase once per job (the panel registered it in
    # lpwq:v1:cred just before enqueuing). May be None if the job has no
    # privileged steps or the cred expired — privileged steps then surface an
    # actionable error via _sudo_error.
    cred = common.load_sudo_cred(redis)
    passphrase = cred.get("passphrase") if cred else None

    steps = job.get("steps") or []
    for idx, step in enumerate(steps):
        applier = STEP_APPLIERS.get(step.get("type"))
        if applier is None:
            ok, err = False, f"paso desconocido: {step.get('type')!r}"
        else:
            ok, err = applier(step, passphrase)
        if not ok:
            finish(redis, job_id, "failed", attempts=attempts,
                   failedStep=idx, error=err,
                   finishedAt=int(time.time()))
            _counters["failed"] += 1
            _counters["lastError"] = f"{label}: {err}"
            common.emit_notification(
                "error", "cola-escritura", f"Falló: {label}",
                f"El paso {idx + 1}/{len(steps)} de la operación {op} en "
                f"{module}/{collection} falló: {err}",
                metadata={"jobId": job_id, "op": op, "module": module,
                          "collection": collection, "failedStep": idx})
            return

    view_ready = trigger_refresh(job.get("refresh"))
    # The write was applied. A failed collector must neither claim a current
    # view nor invite the caller to repeat an already-applied mutation.
    finish(redis, job_id, "done", attempts=attempts, applied=True,
           viewReady=view_ready, resource=f"{module}/{collection}", refreshState="ready" if view_ready else "failed",
           finishedAt=int(time.time()))
    _counters["processed"] += 1


# --------------------------------------------------------------------------
# startup orphan recovery
# --------------------------------------------------------------------------
def requeue_orphans(redis):
    """Anything left in `processing` from a previous crash: move back to the
    queue once so it gets one more attempt (the MAX_ATTEMPTS guard caps loops)."""
    for job_id in redis.lrange(common.WQ_PROCESSING, 0, -1):
        redis.lrem(common.WQ_PROCESSING, 1, job_id)
        redis.pipeline([("RPUSH", common.WQ_QUEUE, job_id)])


# --------------------------------------------------------------------------
# main loop
# --------------------------------------------------------------------------
def main(argv):
    drain_once = "--drain" in argv
    signal.signal(signal.SIGTERM, _handle_stop)
    signal.signal(signal.SIGINT, _handle_stop)

    # A1 — fail-closed at boot. When HMAC is required (prod default) but no
    # usable key is present, ABORT rather than draining fail-open: a missing key
    # means the panel can't be signing either, so every job would be rejected
    # anyway, and silently running unsigned jobs is exactly the hole we close.
    if _HMAC_REQUIRED and _load_hmac_key() is None:
        print(
            f"[worker] FATAL: LPWQ_REQUIRE_HMAC is on but no usable HMAC key at "
            f"{HMAC_KEY_PATH} (missing, wrong mode/owner, or empty). Refusing to "
            f"start. Re-run install-engines.sh to provision the key, or set "
            f"LPWQ_REQUIRE_HMAC=false for local development.",
            file=sys.stderr, flush=True,
        )
        return 1

    recovered = False

    while True:
        if _STOP:
            return 0
        conn = common.load_conn()
        if not conn:
            if drain_once:
                return 0
            time.sleep(NO_CONN_SLEEP)
            continue
        redis = common.Redis(*conn)
        if not redis.ping():
            if drain_once:
                return 0
            time.sleep(PING_FAIL_SLEEP)
            continue

        if not recovered:
            requeue_orphans(redis)
            recovered = True

        job_id = redis.brpoplpush(common.WQ_QUEUE, common.WQ_PROCESSING,
                                  BLOCK_SECONDS)
        if job_id is None:
            write_health(redis, "idle")
            if drain_once:
                return 0
            continue

        write_health(redis, "busy")
        try:
            process_job(redis, job_id)
        except Exception as e:  # noqa: BLE001 — a malformed recipe (non-dict
            # step, non-numeric timeoutMs, …) must not kill the worker and leave
            # the job stuck in `running`. Mark it failed + notify, then continue.
            try:
                finish(redis, job_id, "failed",
                       error=f"worker exception: {e}")
                common.emit_notification(
                    "error", "cola-escritura", "Trabajo de cola con error interno",
                    f"El job {job_id} lanzó una excepción no controlada y se "
                    f"marcó como fallido: {e}",
                    metadata={"jobId": job_id})
            except Exception:
                pass
            _counters["failed"] += 1
            _counters["lastError"] = f"exception: {e}"
        finally:
            redis.lrem(common.WQ_PROCESSING, 1, job_id)   # ack
            redis.delete(common.wq_job_key(job_id))
        write_health(redis, "idle")


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except KeyboardInterrupt:
        sys.exit(0)
