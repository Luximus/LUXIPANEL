#!/usr/bin/env python3
"""
collector-cron.py — system-collector for cron/jobs.

Mirrors `cronParserService.listWithExecutor`:
  * Run `sudo crontab -l` (for root) — falls back to no-output on error.
  * Parse: skip blank lines; lines starting with `#` set the pending
    comment; other lines split into 5-field schedule + command, with
    optional inline `# comment`.
  * Emit `{ id (8-hex), schedule, command, comment, user, raw }`.

The hash function matches lineId() in the TS service so DELETE by id
works against the cached blob without translation.
"""

import sys

import common


def line_id(line: str) -> str:
    """Same Java-style 32-bit string hash as lineId() in the TS service."""
    h = 0
    for ch in line:
        h = ((h << 5) - h + ord(ch)) & 0xFFFFFFFF
    return f"{h:08x}"


def list_for_user(user: str):
    cmd = (["sudo", "-n", "crontab", "-l"] if user == "root"
           else ["crontab", "-l"])
    r = common.run_cmd(cmd)
    if not r or r.returncode != 0:
        return []
    return parse(r.stdout, user)


def parse(raw: str, user: str):
    jobs = []
    pending_comment = None
    for line in raw.split("\n"):
        trimmed = line.strip()
        if not trimmed:
            pending_comment = None
            continue
        if trimmed.startswith("#"):
            pending_comment = trimmed[1:].strip()
            continue
        parts = trimmed.split()
        if len(parts) < 6:
            pending_comment = None
            continue
        schedule = " ".join(parts[:5])
        rest = " ".join(parts[5:])
        idx = rest.find(" # ")
        if idx >= 0:
            command = rest[:idx].strip()
            inline_comment = rest[idx + 3:].strip()
        else:
            command = rest
            inline_comment = None
        jobs.append({
            "id": line_id(line),
            "schedule": schedule,
            "command": command,
            "comment": inline_comment if inline_comment is not None else pending_comment,
            "user": user,
            "raw": line,
        })
        pending_comment = None
    return jobs


def gather():
    return list_for_user("root")


def main(argv):
    return common.run_collector_main(argv, gather_fn=gather)


if __name__ == "__main__":
    sys.exit(main(sys.argv))