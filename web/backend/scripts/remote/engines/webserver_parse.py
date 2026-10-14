#!/usr/bin/env python3
"""
webserver_parse.py — nginx config locations + directive regexes shared by the
system-collectors that read vhosts (collector-nginx, collector-hosting).

Both collectors compiled their own byte-identical `server_name` / `root`
patterns and their own copies of the sites-available/sites-enabled paths; if
one of them ever drifted, the two views of the same box would disagree about
which domains exist. They live here once.

They are only the SHARED primitives: each collector still applies its own
filtering on top (collector-nginx keeps every token except `_`; the hosting
collector additionally requires a real domain shape), because those rules
mirror two different panel-side services.

Stdlib only — no pip. Runs on the CLIENT server.
"""

from __future__ import annotations

import re

SITES_AVAILABLE = "/etc/nginx/sites-available"
SITES_ENABLED = "/etc/nginx/sites-enabled"

RE_SERVER_NAME = re.compile(r"^\s*server_name\s+([^;]+);", re.IGNORECASE | re.MULTILINE)
RE_ROOT = re.compile(r"^\s*root\s+([^;]+);", re.IGNORECASE | re.MULTILINE)


def server_name_tokens(content):
    """Every whitespace-separated token of every `server_name` directive, in
    file order and un-filtered (callers decide what counts as a domain)."""
    for m in RE_SERVER_NAME.finditer(content or ""):
        for tok in (m.group(1) or "").split():
            yield tok
