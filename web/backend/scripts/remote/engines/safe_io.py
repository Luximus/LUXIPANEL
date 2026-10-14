#!/usr/bin/env python3
"""
safe_io.py — read/list paths that may require `sudo` on the customer box.

Shared between the system-collectors (nginx, hosting, mail) so the
"read first unprivileged, fall back to `cat`, then `sudo -n cat`" sequence
and the equivalent `ls` / `find` fallbacks live in exactly one place.

Stdlib only — no pip. Runs on the CLIENT server.
"""

from __future__ import annotations

import os

import common


def read_maybe_sudo(path: str, *, require_text: bool = False,
                    sudo_non_interactive: bool = True, timeout=None) -> str:
    """Read `path` as text. Tries in order:
      1. direct open() (works when running as a privileged user)
      2. `cat <path>` via subprocess (works in shells)
      3. `sudo -n cat <path>` (for non-interactive sudoers NOPASSWD)

    Returns "" on every failure (callers treat empty as "no data").

    The keyword flags exist so collector-mail.py can use this ladder without
    changing its (deliberately different) semantics — they are NOT knobs to
    turn casually:
      * `require_text`          — a blank/whitespace-only result from steps 1-2
                                  is treated as "no data" and escalation
                                  continues (mirrors readServerFile in
                                  accounts.helpers.ts).
      * `sudo_non_interactive`  — False drops the `-n`, i.e. plain `sudo cat`.
      * `timeout`               — per-subprocess timeout in seconds (None = no
                                  timeout, the historical default here).
    """
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            s = fh.read()
        if not require_text or (s and s.strip()):
            return s
    except Exception:
        pass
    r = common.run_cmd(["cat", path], timeout=timeout)
    if r and r.returncode == 0 and r.stdout and (not require_text or r.stdout.strip()):
        return r.stdout
    sudo_argv = ["sudo", "-n", "cat", path] if sudo_non_interactive else ["sudo", "cat", path]
    r = common.run_cmd(sudo_argv, timeout=timeout)
    if r and r.returncode == 0 and r.stdout:
        return r.stdout
    return ""


def list_dir_maybe_sudo(path: str) -> list:
    """List directory entries (basenames). Tries `ls -1 -- <path>` first via
    `sudo -n`, then again unprivileged. Returns [] on every failure."""
    # argv only — `path` may be untrusted; never build a shell string from it.
    r = common.run_cmd(["sudo", "-n", "ls", "-1", "--", path])
    if not r or r.returncode != 0:
        r = common.run_cmd(["ls", "-1", "--", path])
    if not r or r.returncode != 0:
        return []
    return [s.strip() for s in r.stdout.split("\n") if s.strip()]


def list_files_in(path: str, depth: int = 2, cap: int = 200) -> list:
    """Recursive listing of regular files under `path`, capped by `depth`.
    Falls back to `sudo -n find` if direct os.walk() fails (permission denied
    on a directory the engine user can't enter). Never raises — returns [].
    """
    if not path:
        return []
    if not os.path.exists(path):
        return []
    if os.path.isfile(path):
        return [path]
    files = []
    try:
        for root, dirs, names in os.walk(path):
            rel_depth = len(os.path.relpath(root, path).split(os.sep))
            if rel_depth > depth and root != path:
                dirs.clear()
                continue
            for n in names:
                files.append(os.path.join(root, n))
            if len(files) > cap:
                break
    except OSError:
        r = common.run_cmd(["sudo", "-n", "find", path, "-maxdepth", str(depth),
                            "-type", "f"])
        if r and r.stdout:
            files = [ln.strip() for ln in r.stdout.split("\n") if ln.strip()][:cap]
    return files