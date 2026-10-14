# Admin Module

Server administration panel — settings, system info, logs, sync, and maintenance tools.

## Endpoints

### Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings` | Admin | List all settings (key → value pairs) |
| GET | `/api/settings/:category` | Admin | List settings by category |
| PUT | `/api/settings` | Admin + CSRF | Set a single setting |
| PUT | `/api/settings/bulk` | Admin + CSRF | Set multiple settings at once |
| DELETE | `/api/settings/:key` | Admin + CSRF | Delete a setting |
| GET/PUT | `/api/admin/installation-api-key` | Admin (CSRF for PUT), local installation | Show only key status; validate online and save the per-installation key with mode 0600 |

### Tools

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/tools/rebuild-maps` | Admin + CSRF | Rebuild Postfix virtual maps (`postmap`) |
| POST | `/api/admin/tools/restart-service` | Admin + CSRF | Restart a named systemd service |
| GET | `/api/admin/tools/audit-log` | Admin | Query audit log entries |
| GET | `/api/admin/tools/dns-check/:domain` | Admin | Live DNS check for a domain |

### Logs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/logs` | Admin | List loggable systemd services |
| GET | `/api/admin/logs/kernel` | Admin | Recent kernel log (`journalctl -k`) |
| GET | `/api/admin/logs/:service` | Admin | Journal entries for a service |

### System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/system/info` | Admin | OS version, hostname, uptime, CPU/RAM info |
| GET | `/api/ui/releases` | Authenticated, local target | Published GitHub Releases, installed commit and operation status |
| POST | `/api/admin/system/releases/install` | Admin, CSRF, local target | Stage and activate a published tag; accepts `{ "tag": "vX.Y.Z" }` |
| GET | `/api/admin/system/health` | Admin | Health status of key services |
| GET | `/api/admin/system/env` | Admin | Active env config (sensitive values redacted) |

### Sync

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/sync/dovecot` | Admin + CSRF | Regenerate Dovecot users file + reload |
| POST | `/api/admin/sync/postfix` | Admin + CSRF | Regenerate Postfix maps + reload |
| POST | `/api/admin/sync/sieve` | Admin + CSRF | Recompile Sieve scripts for all accounts |
| POST | `/api/admin/sync/all` | Admin + CSRF | Run all three syncs in sequence |

### GitHub catalogue

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/repository-store/search`, `/repos/:owner/:name`, `/readme`, `/config`, `/state` | GitHub view | Public repository search, detail, README, token status, saved/cloned state |
| PATCH | `/api/repository-store/preferences` | GitHub view + CSRF | User preferences on the connected server |
| POST | `/api/repository-store/saved` | GitHub view + CSRF | Add/remove user bookmarks |
| POST | `/api/repository-store/clones`, `/api/repository-store/clones/link` | GitHub view + Files Git + CSRF | Clone or register a verified existing copy |
| POST | `/api/repository-store/clones/:id/check`, `/api/repository-store/clones/:id/update` | GitHub view + Files Git + path write + CSRF | Fetch active branch status; fast-forward only when safe |
| DELETE | `/api/repository-store/clones/:id` | GitHub view + Files Git + CSRF | Unlink a copy without deleting files |
| GET/PUT/DELETE | `/api/admin/repository-store/config` | Admin (CSRF for writes) | Token presence, encrypted token update/removal |

Bookmarks/preferences live per user in the connected server's `repository-store/users` sidecar. Clone records live in `repository-store/clones` and are filtered by canonical file permissions on reads. A legacy browser "installed" mark migrates to a bookmark only. Catalogue reads exclude private repositories even when the stored token can access them.

## Auth Guard

The `/api/admin/*` and `/api/settings*` endpoints require:
1. Valid `luxipanel_session` JWT cookie
2. `modules` array in JWT containing `"admin"` (i.e. `kind === "admin"`)

## Services

| Service | Purpose |
|---------|---------|
| `system-info.service.ts` | OS/hardware info via `/proc`, `os` module, `uname` |
| `log-viewer.service.ts` | Shells out to `journalctl` with line/unit filters |
| `process.service.ts` | `systemctl restart <name>`, status checks |

## Settings Storage

Settings use a per-server sidecar with `(key, value, category)` entries. The `category` groups settings (e.g. `"panel"`, `"mail"`, `"security"`). The GitHub token is encrypted at rest, hidden from generic settings responses, and edited through its dedicated Admin endpoint.

## Audit Log

All mutating admin actions (settings changes, syncs, restarts) are written to the `audit_log` table with:
- `userId` — who triggered it
- `action` — what was done (e.g. `"settings.set"`, `"sync.dovecot"`)
- `meta` — JSON payload (key/values changed, service name, etc.)
- `ip` — originating IP address
- `ts` — UTC timestamp

## Module catalog (SSOT)

`services/module-registry.service.ts` is the **single source of truth** for the
panel's preinstalled-module catalog. Two canonical structures live there and
nowhere else:

- `CATALOG` — the static per-module presentation/behavior catalog (name, icon,
  category, features, config fields, `dependencies`/`implies`, sidebar/FAB
  capabilities). `getAll()`/`getById()` read from it (⊕ community modules).
- `DEFAULT_ENABLED_MODULES` — the ids that start enabled on a fresh install
  (before any `module.<id>.enabled` settings row exists).

**Invariant (guarded):** `DEFAULT_ENABLED_MODULES ⊆ CATALOG`. Enforced at module
load by `assertDefaultsAreCatalogued()` (fail-fast throw) and covered by
`module-registry.service.test.ts` so a rename/removal can never leave a phantom
module defaulting to enabled. The frozen list is exported as
`defaultEnabledModuleIds` for tests / seed paths that need the same source.

**Downstream consumers derive from this catalog — they do NOT re-list it:**

- `auth/services/role-permissions.service.ts` builds the assignable-permission
  catalog dynamically via `moduleRegistryService.getAll()`; its
  `MODULE_SURFACES` / `SIMPLE_SIDEBAR_MODULES` maps are per-module *permission
  surfaces* (a distinct concern), not a second catalog. It also exports
  `assignableModuleSlugs()` = the canonical list of every group-assignable
  module id (the same set `deriveModulesFromPermissions` iterates).
- `users/services/roles.service.ts` (`validModuleSlugs()`) and `hosting` derive
  the `admin` group's `modules[]` + the allowed-module validation set from
  `assignableModuleSlugs()` — they no longer keep a hand-maintained literal that
  went stale (a real entitlement gap: obsidian/databases/cloudflare/expo/
  hosting/terminal existed but the old literal omitted them).
- `community/community-loader.service.ts`, `mcp/services/extension-registry.service.ts`
  and `shared/community-catalog.ts` consume the `ModuleDefinition` model type.

> `shared/auth/roles.ts` (`ModuleSlugs` — the JWT/token slug namespace, e.g.
> `ai-assistant`/`nginx`/`backup`) is intentionally a *different string domain*
> (token slugs, not catalog ids). Do not "consolidate" it into the catalog.

## Architecture

```
Admin module layers:
  models/
    module.model.ts             ← ModuleDefinition / ConfigField / CatalogEntry
  routes/admin.routes.ts
    → controllers/ (settings, tools, logs, system, sync, modules, branding,
                    cache-modules, repository-store)
    → services/
        module-registry.service.ts  ← catalog SSOT (CATALOG + defaults)
        cache-modules.service.ts     ← per-target cache-engine schedule (Executor)
        system-info.service.ts       ← /proc, os, uname
        log-viewer.service.ts        ← journalctl (per-server via Executor)
        security-settings / server-settings.service.ts
    → repositories/
        settings.repository.ts       ← settings sidecar CRUD
    account-policy.ts                ← Dovecot/Postfix map builders (used by tools)
```

> Server commands run against the **connected server via the per-request
> `Executor`**; the `local` target keeps an in-process `execFileSync` path
> (`tools.controller` `restartService` / `dnsCheck`) because it is the panel's
> own box. Mutating tools throw typed `AppError`s — never raw `res.status(500)`.
