#!/usr/bin/env python3
"""
collector-nginx.py — system-collector for nginx/sites.

Replicates `nginxSitesService.listSites` from the TS controller 1:1.

Source:
  * `ls /etc/nginx/sites-available` (with sudo fallback)
  * `ls /etc/nginx/sites-enabled`   (with sudo fallback)
  * Per file: read content via `cat` (sudo fallback), regex extract
    `server_name`, `root`, `proxy_pass`, ssl-listen detection.

Output row shape (NginxSiteSummary): { name, file, enabled, domains,
root, proxyPass, ssl, kind }.
"""

import re
import sys

import common
import safe_io
# Site paths + the server_name/root patterns are shared with collector-hosting.
from webserver_parse import RE_ROOT, SITES_AVAILABLE, SITES_ENABLED, server_name_tokens

RE_PROXY = re.compile(r"proxy_pass\s+([^;]+);", re.IGNORECASE)
RE_SSL = re.compile(r"listen\s+(\[::\]:)?443\b|ssl_certificate\s+", re.IGNORECASE)
RE_REDIRECT = re.compile(r"^\s*return\s+30[12]\s", re.IGNORECASE | re.MULTILINE)
RE_FASTCGI = re.compile(r"fastcgi_pass\s+", re.IGNORECASE)


def site_names_from_content(content):
    out = []
    for tok in server_name_tokens(content):
        v = tok.lower()
        if v and v != "_" and v not in out:
            out.append(v)
    return out


def detect_kind(content):
    if RE_REDIRECT.search(content or ""):
        return "redirect"
    if RE_PROXY.search(content or ""):
        return "proxy"
    if RE_FASTCGI.search(content or ""):
        return "php"
    if re.search(r"^\s*root\s+", content or "", re.IGNORECASE | re.MULTILINE):
        return "static"
    return "unknown"


def gather():
    names = safe_io.list_dir_maybe_sudo(SITES_AVAILABLE)
    enabled_set = set(safe_io.list_dir_maybe_sudo(SITES_ENABLED))
    sites = []
    for name in names:
        file = f"{SITES_AVAILABLE}/{name}"
        content = safe_io.read_maybe_sudo(file)
        root_match = RE_ROOT.search(content) if content else None
        proxy_match = RE_PROXY.search(content) if content else None
        sites.append({
            "name": name,
            "file": file,
            "enabled": name in enabled_set,
            "domains": site_names_from_content(content),
            "root": root_match.group(1).strip() if root_match else None,
            "proxyPass": proxy_match.group(1).strip() if proxy_match else None,
            "ssl": bool(RE_SSL.search(content)) if content else False,
            "kind": detect_kind(content),
        })
    sites.sort(key=lambda x: x["name"])
    return sites


def main(argv):
    return common.run_collector_main(argv, gather_fn=gather)


if __name__ == "__main__":
    sys.exit(main(sys.argv))