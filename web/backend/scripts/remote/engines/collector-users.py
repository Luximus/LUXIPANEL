#!/usr/bin/env python3
"""
collector-users.py — system-collector for users/system.

Replicates `readLinuxUsersFromServer` from the panel TS controller 1:1 so
the cached blob is byte-compatible with what the controller would produce
on a live read. The controller's `list()` can swap to `serveCachedDataTable`
and get identical output.

Source: `getent passwd` + `sudo -n passwd -Sa` (lock flag) + `sudo -n getent
shadow` (last-password-change) + `stat` on home dirs (birth/ctime/mtime), all
best-effort.
Output row shape (LinuxUserRow):
  { id, username, email: null, displayName, roleId: null, role: null,
    modules: [], enabled, phoneE164: null, authProvider: "system",
    systemUid, systemGid, homeDir, shell, managedBySystem: true,
    syncedAt: null, createdAt, updatedAt }
"""

import sys

import common


def _iso_from_epoch(seconds):
    """Epoch seconds -> ISO-8601 UTC, or None for 0/negative (unknown)."""
    try:
        secs = int(seconds)
    except (TypeError, ValueError):
        return None
    if secs <= 0:
        return None
    from datetime import datetime, timezone
    return datetime.fromtimestamp(secs, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def gather():
    # Pull /etc/passwd, the `passwd -Sa` lock-status and `getent shadow`
    # (last-password-change day, field 3) in a single shell so the engine
    # mirrors the controller's one-round-trip behaviour. MIRRORS
    # readLinuxUsersFromServer 1:1 (cache and live read must be identical).
    r = common.run_cmd(
        ["sh", "-lc",
         "getent passwd; printf '\\n---\\n'; sudo -n passwd -Sa 2>/dev/null || true; "
         "printf '\\n---\\n'; sudo -n getent shadow 2>/dev/null || true"],
        timeout=20,
    )
    if r is None or r.returncode != 0:
        return []
    parts = r.stdout.split("\n---\n")
    passwd_out = parts[0] if len(parts) > 0 else ""
    lock_out = parts[1] if len(parts) > 1 else ""
    shadow_out = parts[2] if len(parts) > 2 else ""

    locked_by_name = {}
    for raw in lock_out.split("\n"):
        line = raw.strip()
        if not line:
            continue
        fields = line.split()
        name = fields[0] if fields else None
        flag = fields[1] if len(fields) > 1 else ""
        if name:
            locked_by_name[name] = flag.startswith("L")

    # username -> last-password-change day (shadow field 3, days since epoch).
    last_change_by_name = {}
    for raw in shadow_out.split("\n"):
        line = raw.strip()
        if not line:
            continue
        cols = line.split(":")
        name = cols[0] if cols else None
        try:
            days = int(cols[2]) if len(cols) > 2 and cols[2] else 0
        except ValueError:
            days = 0
        if name and days > 0:
            last_change_by_name[name] = days

    # Parse passwd first so we can batch-stat every home dir.
    parsed = []
    for raw in passwd_out.split("\n"):
        line = raw.strip()
        if not line:
            continue
        cols = line.split(":")
        if len(cols) < 7:
            continue
        name, _x, uid_raw, gid_raw, gecos, home_dir, shell = cols[:7]
        if not name or not uid_raw or not gid_raw or not home_dir or not shell:
            continue
        try:
            uid = int(uid_raw)
            gid = int(gid_raw)
        except ValueError:
            continue
        display_name = (gecos or "").split(",")[0].strip() or None
        parsed.append((name, uid, gid, display_name, home_dir, shell))

    # Batch-stat homes: `%n|%W|%Z|%Y` = path|birth|ctime|mtime. Missing homes
    # go to stderr (ignored) -> those rows fall back to null dates.
    home_stat = {}
    homes = sorted({p[4] for p in parsed})
    if homes:
        sr = common.run_cmd(["stat", "-c", "%n|%W|%Z|%Y"] + homes, timeout=20)
        if sr is not None and sr.stdout:
            for raw in sr.stdout.split("\n"):
                line = raw.strip()
                if not line:
                    continue
                segs = line.split("|")
                if len(segs) < 4:
                    continue
                try:
                    home_stat[segs[0]] = (int(segs[1] or 0), int(segs[2] or 0), int(segs[3] or 0))
                except ValueError:
                    continue

    rows = []
    for name, uid, gid, display_name, home_dir, shell in parsed:
        locked = locked_by_name.get(name, False)
        st = home_stat.get(home_dir)
        if st:
            created_secs = st[0] if st[0] > 0 else st[1]
        else:
            created_secs = 0
        change_day = last_change_by_name.get(name)
        if change_day:
            updated_secs = change_day * 86400
        elif st:
            updated_secs = st[2]
        else:
            updated_secs = 0
        rows.append({
            "id": uid,
            "username": name,
            "email": None,
            "displayName": display_name,
            "roleId": None,
            "role": None,
            "modules": [],
            "enabled": not locked,
            "phoneE164": None,
            "authProvider": "system",
            "systemUid": uid,
            "systemGid": gid,
            "homeDir": home_dir,
            "shell": shell,
            "managedBySystem": True,
            "syncedAt": None,
            "createdAt": _iso_from_epoch(created_secs),
            "updatedAt": _iso_from_epoch(updated_secs),
        })
    return rows


def main(argv):
    return common.run_collector_main(argv, gather_fn=gather)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
