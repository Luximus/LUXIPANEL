# Firewall Module

UFW rule management and Fail2ban jail control via API.

## Endpoints

### UFW Status

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/firewall/status` | Admin | UFW status, default policy, active rules |
| POST | `/api/firewall/enable` | Admin + CSRF | Enable UFW (equivalent to `ufw enable`) |
| POST | `/api/firewall/disable` | Admin + CSRF | Disable UFW (equivalent to `ufw disable`) |

### UFW Rules

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/firewall/rules` | Admin | List all numbered UFW rules |
| POST | `/api/firewall/rules` | Admin + CSRF | Add a UFW rule |
| DELETE | `/api/firewall/rules/:number` | Admin + CSRF | Delete rule by number (`ufw delete <N>`) |
| POST | `/api/firewall/cloudflare-allow` | Admin + CSRF | Preset: allow Cloudflare's published IP ranges on TCP 80,443 |

### Cloudflare allow preset

`POST /api/firewall/cloudflare-allow` fetches Cloudflare's **public** range
lists (`https://www.cloudflare.com/ips-v4` and `/ips-v6` — no API token, no
dependency on the cloudflare module), validates every line against a strict
CIDR regex (invalid lines are discarded; fewer than 10 valid IPv4 ranges ⇒
`502 CLOUDFLARE_IPS_SUSPECT`) and applies one rule per range:

```
ufw allow proto tcp from <cidr> to any port 80,443 comment "cloudflare"
```

On remote targets all rules go in **one** write-behind job (same path as
`POST /api/firewall/rules`); on the local target they run synchronously via
`ufwService`. Response: `{ ok, data: { applied: <n>, job?: { id, mode } } }`
— the job is nested **inside** `data` (the frontend api-client maps
`data: json.data ?? json`, so a top-level `job` sibling would be dropped and
`awaitJob()` would no-op).

**Idempotency:** the endpoint does NOT dedupe against existing rules — UFW
itself is idempotent here and re-adding an existing rule just prints
`Skipping adding existing rule` with exit code 0, so re-running the preset
(e.g. after Cloudflare publishes new ranges) is safe and only adds what's
missing.

### Fail2ban

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/firewall/fail2ban/jails` | Admin | List jails and banned IPs (`fail2ban-client status`) |
| POST | `/api/firewall/fail2ban/unban` | Admin + CSRF | Unban an IP from a jail |
| POST | `/api/firewall/fail2ban/ban` | Admin + CSRF | Manually ban an IP in a jail |

## Rule Request Body

```json
{
  "action": "allow",
  "proto": "tcp",
  "port": 25,
  "from": "any",
  "comment": "SMTP"
}
```

Fields:
- `action`: `"allow"` | `"deny"` | `"reject"`
- `proto`: `"tcp"` | `"udp"` | `"any"`
- `port`: port number or range (e.g. `"8080:8090"`)
- `from`: source IP/CIDR or `"any"` (default)
- `comment`: optional description stored in UFW rule

## Fail2ban Operations

```json
// POST /api/firewall/fail2ban/unban
{ "jail": "sshd", "ip": "192.168.1.100" }

// POST /api/firewall/fail2ban/ban
{ "jail": "postfix-sasl", "ip": "10.0.0.5", "bantime": 86400 }
```

## Services

| Service | Purpose |
|---------|---------|
| `ufw.service.ts` | Wraps `ufw` CLI via the `Executor`: status, enable/disable, allow/deny, delete, numbered list. Pure `_*Argv` builders are the single source of truth for each command shape (reused by the write-behind step recipes). |
| `fail2ban.service.ts` | Wraps `fail2ban-client` via the `Executor`: status, ban, unban, list jails + banned IPs |
| `cloudflare-ips.service.ts` | Fetches + strictly validates Cloudflare's public IPv4/IPv6 CIDR lists (10s timeout, AppError 502 on suspect responses) |

All UFW/Fail2ban commands run through the per-request `Executor` (`quoteCmd`/
`quoteArg`, argv form, no shell interpolation) — **never** a local
`child_process`. The same code path serves the panel's own box (the
sudo-wrapped `localExecutor`) and remote SSH targets, satisfying the hard rule
in `CLAUDE.md`.

## Events

Emitted on the internal event bus (consumed by `notifications`/worklog — this
module never imports other modules):

- `FIREWALL_RULE_ADDED` — after a rule is added: `{ action, port, from, target }`.
  The Cloudflare preset emits **one single** event for the whole batch:
  `{ action: "allow", from: "cloudflare", port: "80,443", target }`.
- `FIREWALL_RULE_DELETED` — after a rule is deleted: `{ ruleNumber, target }`.

## Security Notes

- All UFW/Fail2ban operations run on the **connected server** via the per-request
  `Executor` (SSH for remote targets, the sudo-wrapped `localExecutor` for the
  panel's own box). No command ever runs as a `child_process` on the panel host.
  The SSH user must hold sudo for `ufw` / `fail2ban-client`.
- Every argument is passed as quoted argv (`quoteCmd`/`quoteArg`) — jail names,
  IPs, ports and comments cannot break out of their token even if the input
  contains `;`, `$( )`, backticks or spaces. Sanitizer allowlists remain in
  place for defense in depth.
- The `status` endpoint parses `ufw status numbered` output into a structured
  JSON response (`_parseRules`, a pure function covered by characterization tests).
- Ban/unban actions are logged to the audit log with the triggering user ID.

## Architecture

```
firewall module
├── models/
│   ├── ufw.model.ts            ← UfwRule, UfwStatus
│   ├── fail2ban.model.ts       ← JailStatus
│   └── cloudflare.model.ts     ← CloudflareIpRanges
├── controllers/
│   ├── status.controller.ts    ← overview, enable, disable, jails, ban, unban
│   └── rules.controller.ts     ← list, add, remove, cloudflareAllow
└── services/
    ├── ufw.service.ts          ← executor.exec(quoteCmd("sudo", ["ufw", …]))
    ├── fail2ban.service.ts     ← executor.exec(quoteCmd("sudo", ["fail2ban-client", …]))
    └── cloudflare-ips.service.ts
```

> **No `repositories/`:** the firewall has no per-server sidecar. Reads come from
> the read-cache collector (`collector-firewall`, `firewall/rules`) with a live
> `ufwService` fallback; writes go through the write-behind queue
> (`submitMutation`, `firewall/rules` is `writable`). There is nothing to persist
> via `dataStore`.
