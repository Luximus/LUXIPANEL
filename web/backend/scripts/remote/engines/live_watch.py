"""Allowlisted config watcher; no public listener, recursive data scans or writes.

inotify watches directories as well as files, so atomic rename is covered.
Overflow/restart reconciles enabled collections; the periodic dispatcher remains
the recovery path on filesystems without reliable notifications.
"""
import json
import concurrent.futures
import ctypes
import os
import select
import signal
import struct
import subprocess
import time
import common
from live_view import features

MASK = 0x00000008 | 0x00000004 | 0x00000040 | 0x00000080 | 0x00000100 | 0x00000200 | 0x00000400 | 0x00000800
OVERFLOW = 0x00004000
BASE = os.path.dirname(os.path.realpath(__file__))
CFG = common.CFG_DIR

def sources():
    result = {
        "users/system": ["/etc/passwd", "/etc/shadow", "/etc/group"],
        "users/roles": ["/etc/group", "/etc/gshadow"],
        "nginx/sites": ["/etc/nginx/sites-available", "/etc/nginx/sites-enabled"],
        "mail/accounts": ["/etc/postfix", "/etc/dovecot"],
        "cron/jobs": ["/etc/crontab", "/etc/cron.d", "/var/spool/cron/crontabs", "/var/spool/cron"],
        "firewall/rules": ["/etc/ufw", "/etc/nftables.conf"],
    }
    for entry in common.load_policy() or []:
        key = entry.get("module", "") + "/" + entry.get("collection", "")
        if entry.get("source") == "sidecar-mirror":
            # Sidecars live below <config>/data/<module>; known directories
            # only, never watch the hosted apps/maildirs or arbitrary files.
            result.setdefault(key, []).extend([os.path.join(CFG, "data", entry["module"]),
                                              os.path.join(CFG, entry["module"])])
    result["users/system"].extend([os.path.join(CFG, "auth"), os.path.join(CFG, "users")])
    result["users/roles"].append(os.path.join(CFG, "users"))
    return result

def enabled_keys():
    schedule = common.load_json(common.SCHEDULE_PATH) or {}
    return {str(c.get("module")) + "/" + str(c.get("collection"))
            for c in common.load_policy() or []
            if schedule.get(str(c.get("module")) + "/" + str(c.get("collection")), {}).get("enabled", True)}

def collect(key):
    module, collection = key.split("/")
    env = dict(os.environ, LXP_COLLECT_LIGHT="1", LXP_INVALIDATE="1", LXP_REFRESH_STRICT="1")
    return subprocess.run(["bash", os.path.join(BASE, "dispatcher.sh"), "--entry", module, collection],
                          env=env, timeout=150, stdout=subprocess.DEVNULL, check=False).returncode

class Watcher:
    def __init__(self):
        self.libc = ctypes.CDLL(None, use_errno=True)
        self.fd = self.libc.inotify_init1(os.O_NONBLOCK | os.O_CLOEXEC)
        if self.fd < 0:
            raise OSError(ctypes.get_errno(), "inotify unavailable")
        self.watches = {}
        self.paths = {}

    def rebuild(self):
        for wd in self.watches:
            self.libc.inotify_rm_watch(self.fd, wd)
        self.watches = {}
        self.paths = sources()
        for key, paths in self.paths.items():
            for path in paths:
                # Watch the containing directory even before a file exists.
                candidates = {os.path.dirname(path)}
                if os.path.isdir(path):
                    candidates.add(path)
                    # Sidecar subdirectories are bounded; never follow links.
                    if path.startswith(CFG + os.sep):
                        for root, dirs, _ in os.walk(path, followlinks=False):
                            dirs[:] = [d for d in dirs if not os.path.islink(os.path.join(root, d))]
                            candidates.add(root)
                            if len(candidates) >= 4096: break
                for directory in candidates:
                    wd = self.libc.inotify_add_watch(self.fd, os.fsencode(directory), MASK)
                    if wd >= 0:
                        self.watches.setdefault(wd, []).append((key, path, directory))

    def read(self):
        changed, rebuild = set(), False
        try: raw = os.read(self.fd, 256 * 1024)
        except BlockingIOError: return changed, rebuild
        offset = 0
        while offset + 16 <= len(raw):
            wd, mask, _, size = struct.unpack_from("iIII", raw, offset)
            name = os.fsdecode(raw[offset + 16:offset + 16 + size].split(b"\0", 1)[0])
            offset += 16 + size
            if mask & OVERFLOW:
                changed.update(enabled_keys()); rebuild = True; continue
            matched = False
            for key, path, directory in self.watches.get(wd, []):
                full = os.path.join(directory, name) if name else directory
                if full == path or full.startswith(path.rstrip("/") + "/"):
                    matched = True
                    changed.add(key)
                    # Linux memberships affect both list representations.
                    if key.startswith("users/"): changed.update(["users/system", "users/roles"])
            if matched and mask & (0x00000100 | 0x00000040 | 0x00000080 | 0x00000400 | 0x00000800): rebuild = True
        return changed, rebuild

def main():
    running = True
    def stop(*_):
        nonlocal running
        running = False
    signal.signal(signal.SIGTERM, stop); signal.signal(signal.SIGINT, stop)
    watcher = Watcher(); watcher.rebuild()
    dirty = {key: time.monotonic() for key in enabled_keys()}
    futures = {}
    previous_enabled = set()
    last_rebuild = time.monotonic()
    last_status = 0
    failures = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        while running:
            select.select([watcher.fd], [], [], .25)
            keys, rebuild = watcher.read()
            now = time.monotonic()
            for key in keys: dirty[key] = now + .25
            if rebuild or now - last_rebuild > 60:
                watcher.rebuild(); last_rebuild = now
            if now - last_status > 5:
                last_status = now
                try:
                    directory = os.path.join(CFG, "cache-engine")
                    temporary = os.path.join(directory, ".watch-status.tmp")
                    with open(temporary, "w") as file:
                        json.dump({"checkedAt": int(time.time()), "watches": len(watcher.watches), "running": len(futures), "pending": len(dirty), "failures": failures}, file)
                    os.chmod(temporary, 0o600)
                    os.replace(temporary, os.path.join(directory, "watch-status.json"))
                except OSError: pass
            for key, future in list(futures.items()):
                if future.done():
                    del futures[key]
                    try:
                        if future.result() != 0: dirty[key] = now + 30; failures += 1
                    except Exception: dirty[key] = now + 30; failures += 1
            if features(CFG).get("watcher") is not True:
                previous_enabled = set()
                continue
            enabled = enabled_keys()
            for key in enabled - previous_enabled: dirty[key] = now
            previous_enabled = enabled
            for key in list(dirty):
                if key not in enabled: del dirty[key]; continue
                if dirty[key] <= now and key not in futures and len(futures) < 2:
                    del dirty[key]; futures[key] = pool.submit(collect, key)
    os.close(watcher.fd)

if __name__ == "__main__":
    main()
