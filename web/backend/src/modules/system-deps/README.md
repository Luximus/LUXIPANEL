# System-Deps Module

Generic per-module system-dependency check + unattended install. Generalizes
the firewall install pattern (`packageInstaller` + `sudoShell`) for every
module that needs server-side binaries (postfix, dovecot, nginx, certbot,
mariadb, cron, zip, …). The dependency registry lives in
`src/shared/system/module-deps.ts` (`MODULE_DEPENDENCIES` / `MODULE_DEPS_META`).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/system-deps/:module` | Auth + module access | Install state of each declared dependency |
| POST | `/api/system-deps/:module/install` | Auth + module access + CSRF | Install missing/selected dependencies |

`:module` must exist in the registry (`firewall`, `mail`, `nginx`,
`databases`, `backup`, `cron`, `files`); otherwise → `404 { ok: false, error: "UNKNOWN_MODULE" }`.
Authorization then delegates to `requireModule(<param>)` (registry enabled +
entitlement + license + user module access).

## GET response

```json
{
  "ok": true,
  "data": {
    "module": "mail",
    "dependencies": [
      {
        "key": "dovecot",
        "label": "Dovecot (IMAP/LMTP)",
        "description": "Servidor IMAP y entrega local LMTP.",
        "optional": false,
        "installed": false,
        "commands": ["dovecot", "doveadm"],
        "packages": ["dovecot-core", "dovecot-imapd", "dovecot-lmtpd"],
        "units": ["dovecot"]
      }
    ],
    "allRequiredInstalled": false,
    "anyInstalled": true
  }
}
```

- `installed` = ALL `commands` resolve on the target (`isCommandAvailable`).
- `allRequiredInstalled` ignores `optional` deps; with
  `MODULE_DEPS_META[module].requiresOneOf` (e.g. `databases`) it is true when
  AT LEAST ONE dependency is installed.

## POST body / response

```json
{ "keys": ["dovecot"], "sudoPassword": "..." }
```

- `keys` omitted ⇒ all required-and-missing deps (with `requiresOneOf` ⇒ the
  first registry entry when none is installed).
- Installs SEQUENTIALLY (avoids the apt lock) via `packageInstaller.install`,
  then `enableUnit` per declared unit (`unitsAreAlternatives` ⇒ first unit
  that enables wins, like cron/crond).

```json
{
  "ok": false,
  "code": "SUDO_PASSWORD_REQUIRED",
  "data": {
    "results": [
      { "key": "dovecot", "ok": false, "manager": "apt", "packages": ["dovecot-core", "dovecot-imapd", "dovecot-lmtpd"], "exitCode": 1, "code": "SUDO_PASSWORD_REQUIRED" }
    ],
    "output": "=== Dovecot (IMAP/LMTP) ===\n…",
    "code": "SUDO_PASSWORD_REQUIRED"
  }
}
```

Always HTTP 200 (like firewall's install): `data.code` / `data.output` feed
the shared install-modal `withSudo` helper. A `SUDO_PASSWORD_REQUIRED` /
`SUDO_PASSWORD_INVALID` aborts the remaining installs and is propagated.

## Adding a dependency

Edit `MODULE_DEPENDENCIES` in `src/shared/system/module-deps.ts` — declare
`commands` (probe), `packages` (per manager), optional `units` and
`optional`. No controller/route changes needed.
