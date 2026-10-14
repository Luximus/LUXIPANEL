#!/usr/bin/env python3
"""
collector-firewall.py — system-collector for firewall/rules.

Mirrors `ufwService.getStatusWithExecutor` _parseRules 1:1.

Command: `sudo ufw status numbered`.
Output rule shape: { number, action, direction, to, from, protocol, comment }.

Returns an empty list when ufw isn't installed / not active / sudo is
denied — same defensive behaviour as the TS service.
"""

import re
import sys

import common

RULE_RE = re.compile(r"^\[\s*(\d+)\]\s+(.+?)\s{2,}(.+?)\s{2,}(.+?)(?:\s+#\s*(.+))?$")


def gather():
    r = common.run_cmd(["sudo", "-n", "ufw", "status", "numbered"], timeout=10)
    if not r or r.returncode != 0 or not r.stdout:
        return []
    rules = []
    for line in r.stdout.split("\n"):
        m = RULE_RE.match(line)
        if not m:
            continue
        num, to_port, action, from_, comment = m.group(1, 2, 3, 4, 5)
        rules.append({
            "number": int(num),
            "action": (action or "").strip(),
            "direction": "OUT" if "OUT" in (action or "") else "IN",
            "to": (to_port or "").strip(),
            "from": (from_ or "").strip(),
            "protocol": "tcp" if "/tcp" in (to_port or "") else "udp" if "/udp" in (to_port or "") else None,
            "comment": (comment or "").strip() or None,
        })
    return rules


def main(argv):
    return common.run_collector_main(argv, gather_fn=gather)


if __name__ == "__main__":
    sys.exit(main(sys.argv))