#!/usr/bin/env python3
"""
collector-clamav-quarantine.py — system-collector for clamav/quarantine.

Mirrors `clamavService.getQuarantine` 1:1: reads the quarantine path from
`${LUXIPANEL_CONFIG_DIR}/clamav-settings.json` (falling back to the same
default the TS service uses) and runs:
  `find <dir> -maxdepth 1 -type f -printf '%f|%s|%TY-...'`
Output row: { name, path, size, mtime }, sorted by mtime desc.
"""

import json
import os
import sys

import common

DEFAULT_QUARANTINE_DIR = "/var/lib/luxipanel/clamav/quarantine"
SETTINGS_PATH = os.path.join(common.CFG_DIR, "clamav-settings.json")


def resolve_quarantine_dir():
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        d = data.get("quarantineDir") if isinstance(data, dict) else None
        if isinstance(d, str) and d:
            return d
    except Exception:
        pass
    return DEFAULT_QUARANTINE_DIR


def gather():
    raw_qdir = resolve_quarantine_dir()
    # Defence-in-depth: a poisoned sidecar can set quarantineDir to anything.
    # Reject control chars + shell metacharacters outright (single quote is
    # the documented injection vector for `sh -lc`), then realpath and verify
    # the directory lies under the canonical quarantine root.
    if isinstance(raw_qdir, str) and any(ord(c) < 0x20 or c in "'\"`$\\;&|<>" for c in raw_qdir):
        raw_qdir = DEFAULT_QUARANTINE_DIR
    try:
        qdir = os.path.realpath(raw_qdir)
    except (OSError, ValueError):
        return []
    allowed = os.path.realpath(DEFAULT_QUARANTINE_DIR)
    if qdir != allowed and not qdir.startswith(allowed + os.sep):
        # Reject unknown roots entirely — never silently fall back, so a
        # malicious settings file does not get a free pass via the default.
        return []
    if not os.path.isdir(qdir):
        return []
    # Argv-style execution so the path can never be re-interpreted by a shell.
    r = common.run_cmd([
        "sudo", "-n", "find", qdir,
        "-maxdepth", "1", "-type", "f",
        "-printf", "%f|%s|%TY-%Tm-%TdT%TH:%TM:%TS\n",
    ], timeout=30)
    if not r or not r.stdout:
        return []
    rows = []
    for line in r.stdout.split("\n"):
        if not line.strip():
            continue
        parts = line.split("|")
        if len(parts) < 3:
            continue
        name, size_raw, mtime = parts[0], parts[1], parts[2]
        # Reject any name containing separators or `..` so the rendered
        # `path` column cannot escape qdir. Stripped-down to `[A-Za-z0-9._-]+`
        # which is what clamav actually emits.
        if not name or not all(c.isalnum() or c in "._-" for c in name) or ".." in name:
            continue
        try:
            size = int(size_raw)
        except ValueError:
            size = 0
        rows.append({
            "name": name,
            "path": f"{qdir.rstrip('/')}/{name}",
            "size": size,
            "mtime": mtime.strip(),
        })
    rows.sort(key=lambda r: r["mtime"], reverse=True)
    return rows


def main(argv):
    return common.run_collector_main(argv, gather_fn=gather)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
