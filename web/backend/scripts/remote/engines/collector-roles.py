#!/usr/bin/env python3
"""
collector-roles.py — system-collector for users/roles.

Replicates `readLinuxGroupsFromServer` from the TS controller 1:1.

Source: `getent group`.
Output row shape:
  { id, name, description: null, modules: [], permissions: null,
    members: [string] }
"""

import sys

import common


def gather():
    r = common.run_cmd(["getent", "group"], timeout=10)
    if not r or r.returncode != 0:
        return []
    rows = []
    for raw in r.stdout.split("\n"):
        line = raw.strip()
        if not line:
            continue
        cols = line.split(":")
        if len(cols) < 4:
            continue
        name, _x, gid_raw, members_raw = cols[0], cols[1], cols[2], cols[3]
        if not name or not gid_raw:
            continue
        try:
            gid = int(gid_raw)
        except ValueError:
            continue
        members = [m.strip() for m in (members_raw or "").split(",") if m.strip()]
        rows.append({
            "id": gid,
            "name": name,
            "description": None,
            "modules": [],
            "permissions": None,
            "members": members,
        })
    return rows


def main(argv):
    return common.run_collector_main(argv, gather_fn=gather)


if __name__ == "__main__":
    sys.exit(main(sys.argv))