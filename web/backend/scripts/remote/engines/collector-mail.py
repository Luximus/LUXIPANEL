#!/usr/bin/env python3
"""
collector-mail.py — system-collector for mail/accounts.

Replicates the TS controller's accounts list logic 1:1 (no shortcuts) so
the cached blob is interchangeable with what `accounts.controller.list()`
would produce on a live read. Sources, parsers and edge cases mirror:
  - accounts.helpers.ts → readAccountsFromServer (postfix vmailbox +
    dovecot users with quota parsing)
  - accounts.controller.ts → readForwardsFromServer (per-account sidecar
    JSON + legacy postfix virtual_alias_maps)
  - accounts.controller.ts → getAllMailboxUsageMap (doveadm quota → find
    byte-sweep fallback)
  - accounts.controller.ts → getMaildirQuotaLimitsMap (Dovecot maildirsize)
  - accounts.controller.ts → getDiskTotalMb (df -kP)

Output is the row shape `accounts.controller.list` returns *before* the
optional includeUsage enrichment. The cache always carries the projected
list ready to serve.
"""

import base64
import json
import os
import re
import sys

import common
import safe_io

POSTFIX_VMAILBOX = os.environ.get("POSTFIX_VMAILBOX", "/etc/postfix/vmailbox")
DOVECOT_USERS_FILE = os.environ.get("DOVECOT_USERS_FILE", "/etc/dovecot/users")
VMAIL_BASE = os.environ.get("VMAIL_BASE", "/var/vmail")

RE_NONE_QUOTA = re.compile(r"(?:storage|bytes|quota(?:_rule\d*)?)=(?:0\b|none|unlimited)", re.IGNORECASE)
RE_BYTES = re.compile(r"bytes=(\d+)", re.IGNORECASE)
RE_STORAGE = re.compile(r"storage=(\d+)\s*([kmgt])?", re.IGNORECASE)
RE_MAILDIRSIZE_LIMIT = re.compile(r"^(\d+)S")


# Default timeout for this collector's shell-outs (was `_run`'s default; the
# subprocess wrapper itself is common.run_cmd now).
CMD_TIMEOUT = 20


def normalize_address(raw):
    v = (raw or "").strip().lower()
    if not v or "@" not in v:
        return None
    local, _, domain = v.partition("@")
    if not local or not domain:
        return None
    return f"{local}@{domain}"


# `fnv1a_id` is common.fnv1a_id (shared with collector-hosting.py) — the row id
# must be identical on both sides or the DataTable rekeys its rows.
fnv1a_id = common.fnv1a_id


def is_sudo_privilege_error(text):
    if not text:
        return False
    return bool(re.search(
        r"a password is required|a terminal is required|not allowed to execute|"
        r"incorrect password|sudo:.*command not found",
        text, re.IGNORECASE,
    ))


def read_server_file(file_path):
    """Mirror readServerFile: direct read, then `cat`, then `sudo cat`.

    Same escalation ladder as every other collector (safe_io.read_maybe_sudo);
    the flags keep this call site's two historical quirks: a blank read counts
    as "no data" and keeps escalating, and the last step is a plain `sudo`
    (no `-n`), as the TS helper it mirrors does.
    """
    return safe_io.read_maybe_sudo(
        file_path,
        require_text=True,
        sudo_non_interactive=False,
        timeout=CMD_TIMEOUT,
    )


def parse_quota_mb_from_dovecot_line(line):
    if RE_NONE_QUOTA.search(line):
        return 0
    m = RE_BYTES.search(line)
    if m:
        try:
            b = int(m.group(1))
            if b > 0:
                return max(1, round(b / (1024 * 1024)))
        except ValueError:
            pass
    m = RE_STORAGE.search(line)
    if m:
        try:
            n = int(m.group(1))
            if n > 0:
                unit = (m.group(2) or "").lower()
                if unit == "t": return n * 1024 * 1024
                if unit == "g": return n * 1024
                if unit == "m": return n
                if unit == "k": return max(1, round(n / 1024))
                return max(1, round(n / 1024))  # unitless = KiB
        except ValueError:
            pass
    return 0


def parse_dovecot_users(content):
    out = {}
    for raw in (content or "").split("\n"):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        first = line.find(":")
        if first < 1:
            continue
        address = normalize_address(line[:first])
        if not address:
            continue
        rest = line[first + 1:]
        second = rest.find(":")
        password_hash = (rest[:second] if second >= 0 else rest).strip() or "!"
        quota_mb = parse_quota_mb_from_dovecot_line(line)
        # passwd-file: user:password:uid:gid:gecos:home:shell:extra — capture
        # the home (the per-user maildir) so we can DERIVE the real vmail base
        # instead of trusting the VMAIL_BASE env default (the scheduled engine
        # only gets LUXIPANEL_CONFIG_DIR in its unit, so a non-default mail
        # path would otherwise be invisible → empty forwards/quota).
        parts = line.split(":")
        home = parts[5].strip() if len(parts) >= 6 else ""
        out[address] = {"passwordHash": password_hash, "quotaMb": quota_mb, "home": home}
    return out


def parse_postfix_vmailbox(content):
    seen = set()
    out = []
    for raw in (content or "").split("\n"):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        candidate = line.split(None, 1)[0] if line else ""
        address = normalize_address(candidate)
        if address and address not in seen:
            seen.add(address)
            out.append(address)
    return out


def normalize_incoming_mode(value):
    return "suspend" if value == "suspend" else "allow"


def normalize_outgoing_mode(value):
    return value if value in ("allow", "suspend", "hold") else "allow"


def normalize_login_mode(value):
    return "suspend" if value == "suspend" else "allow"


def _scan_vmail_sidecars(base, name, payload_cmd, *, maxdepth=3, min_rel=2,
                         timeout=30):
    """One privileged sweep of the per-account files under the vmail base.

    Runs a single `sudo find … -exec sh -c '<payload_cmd>'` that prints one
    `<path>|<payload>` line per match, then yields `(address, payload)` for the
    lines that decompose into `<base>/<domain>/<local>/…`. Everything outside
    the base, or without both path components, is dropped — that filter is the
    security-relevant part and must not be duplicated per caller.

    The three vmail readers (account settings, forwards, maildirsize limits)
    differ only in the file name, the depth, how many path components they
    require, and how they decode the payload; that is exactly the parameter
    list. Yields nothing when the find fails (fail-open, like every collector).
    """
    base = (base or VMAIL_BASE).rstrip("/")
    base_prefix = base + "/"
    r = common.run_cmd([
        "sudo", "find", base, "-mindepth", "3", "-maxdepth", str(maxdepth),
        "-name", name,
        "-exec", "sh", "-c", payload_cmd, "_", "{}", ";",
    ], timeout=timeout)
    if not r or r.returncode != 0 or not r.stdout:
        return
    for raw in r.stdout.split("\n"):
        line = raw.strip()
        sep = line.find("|")
        if sep <= 0:
            continue
        file_path = line[:sep]
        payload = line[sep + 1:].strip()
        if not payload or not file_path.startswith(base_prefix):
            continue
        rel = [p for p in file_path[len(base_prefix):].split("/") if p]
        if len(rel) < min_rel:
            continue
        address = normalize_address(f"{rel[1]}@{rel[0]}")
        if not address:
            continue
        yield address, payload


# `find -exec` payload printers: the sidecar JSON is base64'd (binary-safe on
# one line) and maildirsize only needs its first line.
SIDECAR_B64_CMD = 'echo "$1|$(base64 -w0 "$1" 2>/dev/null)"'
MAILDIRSIZE_HEAD_CMD = 'echo "$1|$(head -n1 "$1" 2>/dev/null)"'


def read_account_settings_from_sidecars(base):
    out = {}
    for address, b64 in _scan_vmail_sidecars(base, "luxipanel-mail.json",
                                             SIDECAR_B64_CMD):
        try:
            parsed = json.loads(base64.b64decode(b64).decode("utf-8"))
        except Exception:
            continue
        settings = parsed.get("settings")
        if not isinstance(settings, dict):
            continue
        out[address] = {
            "incomingMode": normalize_incoming_mode(settings.get("incomingMode")),
            "outgoingMode": normalize_outgoing_mode(settings.get("outgoingMode")),
            "loginMode": normalize_login_mode(settings.get("loginMode")),
            "plusAddressingAutoFolder": settings.get("plusAddressingAutoFolder") is not False,
        }
    return out


def derive_vmail_base(accounts):
    """Infer the real vmail base from the per-user homes in /etc/dovecot/users.

    The panel writes each home as `<base>/<domain>/<local>`, so the base is
    the grandparent of the home. We pick the most common grandparent across
    accounts (robust to a stray malformed entry). Returns None when nothing
    usable is found, so the caller can fall back to the VMAIL_BASE env. This
    is what makes the collector path-correct even though the systemd/cron unit
    only exports LUXIPANEL_CONFIG_DIR — without it a non-default mail path
    leaves forwards (sidecar) and quota (maildirsize) silently empty.
    """
    counts = {}
    for a in accounts:
        home = (a.get("home") or "").rstrip("/")
        if not home.startswith("/"):
            continue
        base = os.path.dirname(os.path.dirname(home))  # <base>/<domain>/<local> → <base>
        if base and base != "/" and base.startswith("/"):
            counts[base] = counts.get(base, 0) + 1
    if not counts:
        return None
    return max(counts.items(), key=lambda kv: kv[1])[0]


def read_accounts_from_server():
    vmailbox = read_server_file(POSTFIX_VMAILBOX)
    vmailbox_addresses = parse_postfix_vmailbox(vmailbox)
    users_content = read_server_file(DOVECOT_USERS_FILE)
    users_by_address = parse_dovecot_users(users_content)

    # Registry = UNION of both files. A DISABLED account is removed from the
    # Postfix vmailbox (so incoming mail is rejected) but kept in the Dovecot
    # users file with a "!" hash. Sourcing from the vmailbox alone made disabled
    # accounts vanish from the list instead of showing as disabled.
    addresses = list(dict.fromkeys(list(vmailbox_addresses) + list(users_by_address.keys())))
    if not addresses:
        return []

    out = []
    for address in addresses:
        domain = address.split("@", 1)[1] if "@" in address else None
        if not domain:
            continue
        info = users_by_address.get(address)
        password_hash = info["passwordHash"] if info else "!"
        quota_mb = info["quotaMb"] if info else 0
        home = info.get("home", "") if info else ""
        # A DISABLED account keeps its real hash behind a leading "!" marker (so
        # it can be re-enabled without a password reset); a bare "!" means no
        # password. Either way the leading "!" => disabled.
        ph = (password_hash or "!").strip()
        enabled = (len(ph) > 0 and not ph.startswith("!")) if info else True
        out.append({
            "address": address,
            "domain": domain,
            "passwordHash": password_hash,
            "quotaMb": quota_mb,
            "home": home,
            "enabled": enabled,
        })
    return out


ALIAS_MAP_FILE_PREFIXES = (
    "hash:", "btree:", "lmdb:", "cdb:", "dbm:", "sdbm:",
    "texthash:", "cidr:", "pcre:", "regexp:",
)


def resolve_postfix_alias_files():
    """Mirror resolvePostfixAliasFiles: the file(s) backing
    `virtual_alias_maps` per `postconf`, plus the well-known defaults so a
    postconf miss can't hide manually-edited aliases. Non-file map types
    (mysql/ldap/…) are skipped. read_server_file() returns "" for missing
    paths, so extra candidates are harmless."""
    files = {
        "/etc/postfix/virtual",
        "/etc/postfix/virtual_aliases",
        os.path.join(os.path.dirname(POSTFIX_VMAILBOX), "virtual_aliases"),
    }
    r = common.run_cmd(["sh", "-c",
                        "{ command -v postconf >/dev/null 2>&1 && postconf -h virtual_alias_maps; } "
                        "|| /usr/sbin/postconf -h virtual_alias_maps 2>/dev/null "
                        "|| postconf virtual_alias_maps 2>/dev/null"], timeout=15)
    if r and r.returncode == 0 and r.stdout:
        rhs = r.stdout.split("=", 1)[1] if "=" in r.stdout else r.stdout
        for token in re.split(r"[\s,]+", rhs.strip()):
            token = token.strip()
            if not token:
                continue
            prefix = next((p for p in ALIAS_MAP_FILE_PREFIXES if token.startswith(p)), None)
            if prefix:
                p = token[len(prefix):]
                if p.startswith("/"):
                    files.add(p)
            elif token.startswith("/"):
                files.add(token)
    return list(files)


def read_forwards_from_server(base=None):
    """Mirror readForwardsFromServer: per-account sidecar JSON (find+base64,
    panel-authoritative) MERGED with every file-backed map resolved from
    `postconf virtual_alias_maps` (legacy/external/manual aliases). The alias
    files only fill addresses NOT already covered by a sidecar."""
    out = {}

    # --- Primary source: per-account sidecar JSON (one privileged find). ---
    for address, b64 in _scan_vmail_sidecars(base, "luxipanel-mail.json",
                                             SIDECAR_B64_CMD):
        try:
            parsed = json.loads(base64.b64decode(b64).decode("utf-8"))
        except Exception:
            continue
        items = out.get(address, [])
        for f in parsed.get("forwards", []) if isinstance(parsed.get("forwards"), list) else []:
            if not isinstance(f, dict):
                continue
            if f.get("enabled") is False:
                continue
            dest = f.get("destination")
            if not isinstance(dest, str):
                continue
            dest = dest.strip()
            if not dest:
                continue
            items.append({
                "id": fnv1a_id(f"{address}->{dest}"),
                "destination": dest,
                "keepCopy": f.get("keepCopy") is not False,
            })
        if items:
            out[address] = items

    # --- Legacy/external/manual source: postconf-resolved alias map files.
    # Best-effort, path-independent (absolute files), fills only addresses
    # the sidecar didn't already cover. ---
    for alias_path in resolve_postfix_alias_files():
        content = read_server_file(alias_path)
        if not content.strip():
            continue
        for raw in content.replace("\r\n", "\n").split("\n"):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            cols = re.split(r"\s+", line, maxsplit=1)
            if len(cols) < 2:
                continue
            source = normalize_address(cols[0])
            if not source or source in out:
                continue
            destinations = [d.strip() for d in cols[1].split(",") if d.strip()]
            keep_copy = source in destinations
            items = []
            for dest in destinations:
                if dest == source:
                    continue
                items.append({
                    "id": fnv1a_id(f"{source}->{dest}"),
                    "destination": dest,
                    "keepCopy": keep_copy,
                })
            if items:
                out[source] = items
    return out


def get_disk_total_mb():
    r = common.run_cmd(["sh", "-c", f"df -kP '{VMAIL_BASE}' 2>/dev/null | tail -1"], timeout=10)
    if not r or r.returncode != 0:
        return None
    cols = r.stdout.strip().split()
    if len(cols) < 2:
        return None
    try:
        b = int(cols[1])
    except ValueError:
        return None
    if b <= 0:
        return None
    return round(b / 1024)


def get_maildir_quota_limits(base=None):
    """Mirror getMaildirQuotaLimitsMap."""
    out = {}
    # maildirsize sits one level deeper than the sidecar (inside the Maildir),
    # hence maxdepth 4 / three path components.
    for address, first_line in _scan_vmail_sidecars(base, "maildirsize",
                                                    MAILDIRSIZE_HEAD_CMD,
                                                    maxdepth=4, min_rel=3):
        m = RE_MAILDIRSIZE_LIMIT.match(first_line)
        if not m:
            continue
        try:
            limit_bytes = int(m.group(1))
        except ValueError:
            continue
        if limit_bytes <= 0:
            continue
        out[address] = max(1, round(limit_bytes / (1024 * 1024)))
    return out


def get_all_mailbox_usage_map(addresses, base=None):
    """Mirror getAllMailboxUsageMap. Returns dict {available: bool, map: {addr: bytes}}."""
    addr_set = {a.lower() for a in addresses}
    usage = {a: 0 for a in addr_set}
    if not addresses:
        return {"available": True, "map": usage}

    # Primary: doveadm quota. argv only (matches the pinned sudoers command
    # `/usr/bin/doveadm -f tab quota get -A`); privilege errors are detected on
    # both stdout and stderr below, so the old `2>&1` merge is unnecessary.
    r = common.run_cmd(["sudo", "-n", "doveadm", "-f", "tab", "quota", "get", "-A"],
                       timeout=CMD_TIMEOUT)
    if r and r.stdout and not is_sudo_privilege_error(r.stdout) and not is_sudo_privilege_error(r.stderr):
        matched = 0
        for line in r.stdout.split("\n"):
            cols = line.split("\t")
            if len(cols) < 5:
                continue
            user = (cols[0] or "").strip().lower()
            typ = (cols[2] or "").strip().upper()
            if not user or "@" not in user or typ != "STORAGE":
                continue
            try:
                kib = int((cols[3] or "").strip())
            except ValueError:
                continue
            if kib < 0:
                continue
            if user in usage:
                usage[user] = kib * 1024
                matched += 1
        if matched > 0:
            return {"available": True, "map": usage}

    # Fallback: find byte sweep. argv only — `vmail_base` is derived from the
    # per-user homes in /etc/dovecot/users and must never be interpolated into
    # a shell string (a home with a `'` would break the quoting / inject).
    # The former `| awk -F'[|/]'` aggregation is reproduced in Python below.
    vmail_base = (base or VMAIL_BASE).rstrip("/")
    vmail_depth = len([p for p in vmail_base.lstrip("/").split("/") if p])
    domain_field = vmail_depth + 3
    local_field = domain_field + 1
    probe = common.run_cmd(["sudo", "-n", "find", vmail_base, "-maxdepth", "6",
                            "-type", "f"], timeout=15)
    if probe and (is_sudo_privilege_error(probe.stdout) or is_sudo_privilege_error(probe.stderr)):
        return {"available": False, "reason": "sudo_password_required", "map": usage}
    r = common.run_cmd(["sudo", "-n", "find", vmail_base, "-mindepth", "4", "-type", "f",
                        "-printf", r"%s|%p\n"], timeout=60)
    if not r or r.returncode != 0:
        return {"available": False, "map": usage}
    if is_sudo_privilege_error(r.stdout) or is_sudo_privilege_error(r.stderr):
        return {"available": False, "reason": "sudo_password_required", "map": usage}
    # awk -F'[|/]' '{sums[$local_field"@"$domain_field] += $1}': with the field
    # separator being `|` or `/`, awk field N == split-index N-1. $1 is the byte
    # size (before the `|`); path components start after the empty field that
    # sits between the `|` and the leading `/` of the absolute path.
    sums = {}
    for line in r.stdout.split("\n"):
        if not line:
            continue
        parts = re.split(r"[|/]", line)
        if len(parts) < local_field:
            continue
        try:
            size = int(parts[0])
        except ValueError:
            continue
        domain = parts[domain_field - 1]
        local = parts[local_field - 1]
        if not domain or not local:
            continue
        key = f"{local}@{domain}".lower()
        sums[key] = sums.get(key, 0) + size
    for addr, byts in sums.items():
        if "@" in addr and byts >= 0 and addr in usage:
            usage[addr] = byts
    return {"available": True, "map": usage}


def round_to_two(n):
    return round(n * 100) / 100


def build_rows():
    """Emit the FULL response item shape so the controller can swap its
    inline build for `serveCachedDataTable` without reshaping anything."""
    server_accounts = read_accounts_from_server()
    if not server_accounts:
        return []
    # Derive the real vmail base from the dovecot homes; the scheduled engine
    # only gets LUXIPANEL_CONFIG_DIR in its unit, so VMAIL_BASE would otherwise
    # be the wrong default and the path-dependent reads (forwards sidecar,
    # maildirsize quota) would come back empty.
    vmail_base = derive_vmail_base(server_accounts) or VMAIL_BASE
    settings_by_address = read_account_settings_from_sidecars(vmail_base)
    forwards_by_address = read_forwards_from_server(vmail_base)
    addresses = [a["address"] for a in server_accounts]
    light = os.environ.get("LXP_COLLECT_LIGHT") == "1"
    usage = {"available": False, "map": {}} if light else get_all_mailbox_usage_map(addresses, vmail_base)
    quota_limits = {} if light else get_maildir_quota_limits(vmail_base)
    usage_known = usage["available"]

    rows = []
    for a in server_accounts:
        addr = a["address"]
        account_forwards = forwards_by_address.get(addr, [])
        used_mb = (round_to_two((usage["map"].get(addr.lower(), 0)) / (1024 * 1024))
                   if usage_known else None)
        quota_mb = quota_limits.get(addr.lower(), a["quotaMb"])
        used_percent = (
            round_to_two((used_mb / quota_mb) * 100)
            if usage_known and quota_mb > 0 and used_mb is not None
            else None
        )
        enabled = a["enabled"]
        settings = settings_by_address.get(addr, {})
        rows.append({
            "usedMb": used_mb,
            "usedPercent": used_percent,
            "id": fnv1a_id(addr),
            "address": addr,
            "domain": a["domain"],
            "displayName": None,
            "quotaMb": quota_mb,
            "enabled": enabled,
            "incomingMode": settings.get("incomingMode", "allow" if enabled else "suspend"),
            "outgoingMode": settings.get("outgoingMode", "allow"),
            "loginMode": settings.get("loginMode", "allow" if enabled else "suspend"),
            "plusAddressingAutoFolder": settings.get("plusAddressingAutoFolder", True),
            "forwards": account_forwards,
            "forwardCount": len(account_forwards),
            "createdAt": None,
            # NOTE: never set passwordHash here. It's filtered by the
            # projection in cacheable-modules.ts as defence in depth, but we
            # don't even put it on the wire to be safe.
        })
    return rows


def main(argv):
    return common.run_collector_main(argv, gather_fn=build_rows)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
