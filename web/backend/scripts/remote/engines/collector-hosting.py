#!/usr/bin/env python3
"""
collector-hosting.py — system-collector for hosting/accounts.

Mirrors `hostingController.list`:
  rows = serverDomainsService.list(executor) enriched per row with
        `du -sm <documentRoot>` → diskUsedMb.

Server discovery is identical to the panel's TS service: parse nginx
sites under /etc/nginx/sites-available/* and extract `server_name` +
`root`. (Apache/Caddy fallback not implemented here — the controller's
live loader covers those cold-miss cases.)
"""

import hashlib
import os
import re
import sys
import time

import common
import safe_io
from webserver_parse import RE_ROOT, server_name_tokens

# Vendor-aware config paths — mirrors `COMMON_SERVER_CONFIGS` in the TS
# `serverDomainsService`. Subset of the most-common deployments; engine is
# fail-open so missing paths are silently skipped.
NGINX_PATHS = [
    "/etc/nginx/nginx.conf",
    "/etc/nginx/sites-enabled",
    "/etc/nginx/sites-available",
    "/etc/nginx/conf.d",
    "/etc/nginx/vhosts.d",
    "/usr/local/nginx/conf/conf.d",
    "/etc/openresty/conf.d",
]
APACHE_PATHS = [
    "/etc/apache2/sites-enabled",
    "/etc/apache2/sites-available",
    "/etc/apache2/conf-enabled",
    "/etc/httpd/conf.d",
    "/etc/httpd/sites-enabled",
    "/etc/httpd/sites-available",
    "/usr/local/apache2/conf/vhosts",
]
CADDY_PATHS = [
    "/etc/caddy/Caddyfile",
    "/etc/caddy/conf.d",
    "/etc/caddy/sites-enabled",
    "/usr/local/etc/caddy/Caddyfile",
]

# RE_SERVER_NAME / RE_ROOT come from webserver_parse (shared with
# collector-nginx.py). Apache/Caddy patterns are only used here.
RE_APACHE_NAME = re.compile(r"^\s*Server(?:Name|Alias)\s+(.+)$", re.IGNORECASE | re.MULTILINE)
RE_APACHE_DOCROOT = re.compile(r"^\s*DocumentRoot\s+(.+)$", re.IGNORECASE | re.MULTILINE)
RE_CADDY_DOMAIN = re.compile(r"^([a-z0-9.-]+\.[a-z]{2,})(?:\s|$)", re.IGNORECASE | re.MULTILINE)
RE_CADDY_ROOT = re.compile(r"^\s*root\s+\*?\s+(.+)$", re.IGNORECASE | re.MULTILINE)
RE_DOMAIN_CHARS = re.compile(r"^[a-z0-9.-]+\.[a-z]{2,}$", re.IGNORECASE)


# `fnv1a_id` lives in common.py (shared with collector-mail.py); the privileged
# read/list ladders live in safe_io.py. Both used to be copied in here.


# Cache each domain's `du -sm` result for an hour: a full disk walk per vhost
# on every 60s tick would blow past the collector's 120s global timeout and
# never write its stamp (→ perpetual re-run). The view still reflects the last
# measured size; freshness is bounded by DU_CACHE_TTL.
DU_CACHE_TTL = 3600


def _du_cache_path(dir_path):
    digest = hashlib.sha256(dir_path.encode("utf-8")).hexdigest()[:32]
    return os.path.join(common.STATE_DIR, f"du__{digest}.json")


def _du_cache_get(dir_path):
    cached = common.load_json(_du_cache_path(dir_path))
    if not isinstance(cached, dict) or cached.get("path") != dir_path:
        return None
    ts = cached.get("ts")
    mb = cached.get("mb")
    if isinstance(ts, (int, float)) and isinstance(mb, int) \
            and (time.time() - ts) < DU_CACHE_TTL:
        return mb
    return None


def _du_cache_put(dir_path, mb):
    common.atomic_write_json(
        _du_cache_path(dir_path),
        {"path": dir_path, "mb": mb, "ts": int(time.time())},
        dir_mode=0o700,
        ensure_ascii=False,
    )


def disk_usage_mb(dir_path):
    if not dir_path:
        return None
    cached = _du_cache_get(dir_path)
    if cached is not None:
        return cached
    # argv only — `dir_path` is untrusted (documentRoot from web-server
    # config). `--` stops option injection; stderr is captured, not shell-merged.
    r = common.run_cmd(["du", "-sm", "--", dir_path], timeout=60)
    if not r or r.returncode != 0:
        return None
    out = (r.stdout or "").strip()
    if not out:
        return None
    try:
        mb = int(out.split()[0])
    except (ValueError, IndexError):
        return None
    _du_cache_put(dir_path, mb)
    return mb


def normalize_candidate(value):
    v = (value or "").strip().lower().rstrip(";")
    if not v or "*" in v:
        return None
    return v if RE_DOMAIN_CHARS.match(v) else None


def extract_nginx(content):
    domains = []
    for tok in server_name_tokens(content):
        d = normalize_candidate(tok)
        if d and d not in domains:
            domains.append(d)
    rm = RE_ROOT.search(content or "")
    document_root = rm.group(1).strip().strip('"').strip("'") if rm else None
    return domains, document_root


def extract_apache(content):
    domains = []
    for m in RE_APACHE_NAME.finditer(content or ""):
        for tok in (m.group(1) or "").split():
            d = normalize_candidate(tok)
            if d and d not in domains:
                domains.append(d)
    rm = RE_APACHE_DOCROOT.search(content or "")
    document_root = rm.group(1).strip().strip('"').strip("'") if rm else None
    return domains, document_root


def extract_caddy(content):
    domains = []
    for m in RE_CADDY_DOMAIN.finditer(content or ""):
        d = normalize_candidate(m.group(1))
        if d and d not in domains:
            domains.append(d)
    rm = RE_CADDY_ROOT.search(content or "")
    document_root = rm.group(1).strip().strip('"').strip("'") if rm else None
    return domains, document_root


def discover_sites():
    """Reproduce serverDomainsService.list across nginx/apache/caddy.
    Returns one entry per distinct server_name/ServerName/Caddy site host."""
    out = {}
    for paths, extract in [
        (NGINX_PATHS, extract_nginx),
        (APACHE_PATHS, extract_apache),
        (CADDY_PATHS, extract_caddy),
    ]:
        for base in paths:
            for file_path in safe_io.list_files_in(base):
                content = safe_io.read_maybe_sudo(file_path)
                if not content:
                    continue
                domains, document_root = extract(content)
                for d in domains:
                    entry = out.setdefault(d, {
                        "name": d,
                        "sources": [],
                        "documentRoot": document_root,
                        "configPaths": [],
                    })
                    if file_path not in entry["sources"]:
                        entry["sources"].append(file_path)
                    if file_path not in entry["configPaths"]:
                        entry["configPaths"].append(file_path)
                    if not entry["documentRoot"]:
                        entry["documentRoot"] = document_root
    return sorted(out.values(), key=lambda x: x["name"])


def gather():
    sites = discover_sites()
    rows = []
    for d in sites:
        used_mb = disk_usage_mb(d.get("documentRoot"))
        rows.append({
            "id": common.fnv1a_id(d["name"]),
            "username": d["name"],
            "displayName": d["name"],
            "domain": d["name"],
            "documentRoot": d.get("documentRoot"),
            "diskUsedMb": used_mb,
            "status": "active",
            "plan": "custom",
            "sources": d.get("sources", []),
            "configPaths": d.get("configPaths", []),
        })
    return rows


def main(argv):
    return common.run_collector_main(argv, gather_fn=gather)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
