# Mail Module

Manages virtual mailboxes, Dovecot/Postfix configuration, IMAP access, and SMTP sending.

## Independent mail server

Mail settings can select another enabled SSH target with an approved fingerprint
from the user's accessible saved servers. The selection lives in sessionStorage,
per tab and active panel target. It affects mailboxes, credentials, sidecars,
SMTP/IMAP, mail jobs and mail sudo operations; it does not switch the panel's
session or the outbound identity for system notifications. The remote server
must expose compatible Postfix/Dovecot mailboxes and reachable mail ports.

`GET /api/mail/server-settings` lists safe target metadata; authenticated
`POST /api/mail/server-settings/validate` (CSRF protected) checks the selected
SSH connection without provisioning mail. Mail requests carry `X-Mail-Target-Id`.
The mail router resolves this header after authentication/module checks and
validates target visibility, enablement, host fingerprint and host policy on
every request. Both explicit executors and ambient SMTP/IMAP/sidecar lookups
use that target. Hosting sessions retain their original tenant executor.

An unavailable or unauthorized selection fails closed. Existing inbox/compose
frames retain their original request target and reject operations if the shared
tab selection changes. Applying a selection reloads Mail and its settings frame
when settings are detached in the workspace, and closes the settings overlay.
Direct-page settings reload that page.
Account mutation status is read at `/api/mail/jobs/:id`; sudo credentials are
submitted at `/api/mail/sudo/credential` with the existing admin and CSRF gates.

## Endpoints

### Accounts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts` | mail module | List all mail accounts |
| POST | `/api/accounts` | mail + CSRF | Create a mail account |
| PUT | `/api/accounts/:id` | mail + CSRF | Update account (password, quota, enabled) |
| DELETE | `/api/accounts/:id` | mail + CSRF | Delete account + maildir |

### Forwards

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts/:accountId/forwards` | mail | List forwards for an account |
| PUT | `/api/accounts/:accountId/forwards` | mail + CSRF | Replace all forwards (triggers sieve rebuild) |
| DELETE | `/api/accounts/:accountId/forwards/:id` | mail + CSRF | Delete a specific forward |

### Filters

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts/:accountId/filters` | mail | List filters for an account |
| POST | `/api/accounts/:accountId/filters` | mail + CSRF | Create a new filter |
| PUT | `/api/accounts/:accountId/filters/:filterId` | mail + CSRF | Update a filter |
| DELETE | `/api/accounts/:accountId/filters/:filterId` | mail + CSRF | Delete a filter |

### Autoresponder

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts/autoresponder/charsets` | mail | List available charset values |
| GET | `/api/accounts/:accountId/autoresponder` | mail | Get autoresponder config for account |
| PUT | `/api/accounts/:accountId/autoresponder` | mail + CSRF | Create/update autoresponder |
| DELETE | `/api/accounts/:accountId/autoresponder` | mail + CSRF | Remove autoresponder |

### IMAP Mailbox

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/mail/:accountId/folders` | mail | List IMAP folders |
| GET | `/api/mail/:accountId/messages` | mail | List messages (paginated) |
| GET | `/api/mail/:accountId/messages/:uid` | mail | Fetch full message |
| GET | `/api/mail/:accountId/disk-usage` | mail | Folder-level disk usage summary |
| POST | `/api/mail/:accountId/disk-usage/delete-by-date` | mail + CSRF | Delete messages in folder by date range |
| POST | `/api/mail/:accountId/disk-usage/copy-by-date` | mail + CSRF | Copy messages by date range to another account |
| POST | `/api/mail/:accountId/clone` | mail + CSRF | Clone the WHOLE mailbox (all folders + messages) to another existing account; Message-ID dedup makes it idempotent |
| POST | `/api/mail/:accountId/messages/:uid/move` | mail + CSRF | Move to folder |
| POST | `/api/mail/:accountId/messages/:uid/flag` | mail + CSRF | Set/clear IMAP flags |
| DELETE | `/api/mail/:accountId/messages/:uid` | mail + CSRF | Delete message |
| POST | `/api/mail/:accountId/send` | mail + CSRF | Send multipart email via SMTP, then append the same MIME message to Sent; `draft=true` saves to Drafts instead |
| PUT | `/api/mail/:accountId/drafts/:uid` | mail + CSRF | Replace an IMAP draft without losing attachments |
| GET | `/api/mail/:accountId/messages/:uid/attachments/:index` | mail | Download one parsed attachment |
| POST | `/api/mail/:accountId/messages/:uid/decrypt` | mail + CSRF | Unlock a PGP/MIME message with the mailbox private key and a passphrase |

### Configuración operativa

- **PGP:** `/api/mail/encryption` stores verified OpenPGP public keys and encrypted private keys per target. Generated private keys and revocation certificates are returned once for a local backup. Legacy `mail_encryption_settings_v1` entries are shown as invalid and never used for encryption.
- **Archivo:** `/api/mail/archive` applies domain rules to Postfix `sender_bcc_maps` and `recipient_bcc_maps`. A dedicated pipe transport writes copies to `/var/lib/luxipanel/mail-archive/<domain>/<incoming|outgoing>/Maildir`, separate from user mailboxes. Retention runs daily through `/etc/cron.daily/luxipanel-mail-archive` when a finite retention is configured. The drawer can list, download and restore copies to `Archive Restored` via IMAP. Rules affect only new mail. The previous v1 preference record is inactive until saved again.
- **Antispam:** `/api/mail/spam-filters` applies scores, threshold and address lists to SpamAssassin, then rebuilds account Sieve scripts for Junk and high-score discard. Enabling requires an existing SpamAssassin or Amavis Postfix filter; the API reports why a target is unavailable. The previous v1 preference record is inactive until saved again.
- **Permisos:** global filters, antispam, outbound identity, master access and archive defaults require administrator. Domain rules and archived messages are limited to the domains visible to the current tenant. PGP and archive settings use separate keys per target.

#### Master access (Dovecot master user) — passwords changed outside the panel

Dovecot only stores a one-way hash, so the per-account credential the panel
captures at create / password-change (`mailbox-credential.service`,
`mail/credentials.json`) goes stale the moment a user changes their password
with a mail client or `doveadm pw`. Instead of dying with
`MAIL_CREDENTIAL_INVALID`, the panel owns a **Dovecot master user**
(`services/mail-master.service.ts`) per mail server, provisioned lazily on the
first administrator inbox open (or explicitly via the API). Other users can use
an existing master login, but their reads never provision privileged access:

| Artifact on the target | Content |
|---|---|
| `/etc/dovecot/master-users` (0640 root:dovecot) | `luxipanel-master:{SHA512-CRYPT}…` |
| `/etc/dovecot/conf.d/95-luxipanel-master.conf` | `auth_master_user_separator = *` + `passdb … master = yes` (2.3 `args=` / 2.4 `passwd_file_path=` syntax, detected from `doveconf -n`) |
| `${LUXIPANEL_CONFIG_DIR}/mail/master-access.json` (0600) | master password, AES-256-GCM with the panel's `MAIL_ENCRYPTION_KEY` |

Provisioning validates with `sudo doveconf -n` **before** `systemctl reload
dovecot` and rolls the drop-in back on a syntax error. `withImap` and
`smtpService.send` try `<address>*luxipanel-master` first and fall back to the
per-account credential; a server the panel cannot provision keeps the previous
behaviour (failure cached 5 min, reason exposed as `lastError`). Postfix
authenticates SASL through Dovecot, so the master login also submits mail.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/mail/master-access` | `{enabled, username, createdAt, rotatedAt, verifiedAt, dovecotVersion, lastError}` (never the password) |
| POST | `/api/mail/master-access` | provision now; `{rotate:true}` mints a new master password |
| DELETE | `/api/mail/master-access` | remove the files + credential, reload Dovecot |

#### Per-server isolation of IMAP/SMTP sockets

IMAP/SMTP connections are opened from the panel's Node process, but the mailbox
lives on **the server the session is bridged to** — not the panel host. To keep
tenants isolated, `services/mail-target.ts` (`resolveMailTargetHost()`) maps the
per-request **context executor** to the connected target's host:

- **LOCAL session** (`executor.target.id === "local"`): unchanged — the host
  candidates still include the trailing `localhost` fallback.
- **REMOTE session**: the candidate list **leads with the target's SSH host**
  (plus `mail.<domain>` / `imap.<domain>` / `smtp.<domain>`) and **never**
  includes `localhost` — **fail-closed**, so a remote tenant's mail can't be
  read/sent by dialing the panel host. The host is read from the local SSH
  vault (`targetsRepository`) by `target.id`, under `runOnPanelHost`.
- **Fail-closed errors** (typed, `shared/errors`): `MAIL_NO_SERVER_EXECUTOR`
  (428) when there is no context executor, `MAIL_REMOTE_HOST_UNRESOLVED` (502)
  when the vault has no host for the target.

The pure candidate builders are unit-tested: `buildHostCandidates`
(imap-connection) and `buildSubmissionCandidates` (smtp.service) — a present
`targetHost` drops `localhost`; absent keeps today's behaviour.

> **v2 (pending):** for a remote target whose 143/993/587 ports are firewalled
> shut, tunnel the socket through the executor (SSH local-forward) instead of
> dialing the host directly. Until then a locked-down remote box surfaces a
> typed `MAIL_IMAP_UNREACHABLE` / SMTP error rather than a wrong-tenant success.

The same isolation applies to **SpamAssassin score types**
(`GET /api/mail/spam-filters/score-types`): rule names are read from the
**connected server's** `*.cf` files via the context executor (one
`find … -exec cat` round-trip), and the in-memory cache is keyed by
`executor.target.id` (10-min TTL) so server A's rule set is never served for
server B. No context executor → generic bundled fallback list (no server data).

### Contacts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/mail/:accountId/contacts` | mail | Search contacts |

## AI Assistant — depuración de buzón

`agent-capability.ts` expone herramientas al **Asistente IA** para depurar una
carpeta (spam / phishing / malware) y dejar solo el correo importante. Diseño
**cuarentena primero**: lo sospechoso se *mueve* (reversible), no se borra.

| Tool | kind | Por defecto | Qué hace |
|------|------|-------------|----------|
| `mail.list_messages` | read | activa | Lista paginada de una carpeta (metadata compacta: uid, from, subject, date, flags, hasAttachments). Triaje por lotes. |
| `mail.fetch_message` | read | activa | Mensaje completo + **verdictos de autenticación** (`auth`: spf/dkim/dmarc + Return-Path) para detectar suplantación. Body truncado a 4 KB. |
| `mail.move_messages` | action (no dangerous) | activa | Mueve un lote de UIDs a una carpeta (crea `Revisar-IA` si no existe). **Acción por defecto de la depuración.** |
| `mail.flag_messages` | action (no dangerous) | activa | Marca un lote (`\Flagged`/`\Seen`) sin mover nada. |
| `mail.delete_messages` | action **dangerous** | activa + `requireConfirm` | Borrado permanente (\Deleted + expunge). Solo tras revisar la cuarentena. |

Señales de clasificación combinadas: (1) autenticación de cabeceras de
`fetch_message`, (2) heurística del modelo sobre remitente/asunto/tipo de
adjunto. Los toggles `enabled` /
`requireConfirm` por-tool viven en el sidecar de acceso del asistente
(pestaña Módulos); `mail.delete_messages` pide confirmación por ser `dangerous`.

## Password Encryption

Mail account passwords are stored encrypted with AES-256-GCM:
- Format stored in DB: `iv:authTag:ciphertext` (all hex)
- Key: `MAIL_ENCRYPTION_KEY` env var (32-byte hex = 64 hex chars)
- When Dovecot needs the password, it is decrypted and hashed with `{BLF-CRYPT}`

## Dovecot Sync

After any account create/update/delete, the module calls:
```
dovecotService.regenerateUsersFileWithExecutor()  → rewrites /etc/dovecot/users
dovecotService.reloadWithExecutor()               → systemctl reload dovecot
```

Use `POST /api/admin/sync/dovecot` to force-sync manually.

## Security model (wave 2026-07 — contract change)

**Everything runs on the CONNECTED server via the `Executor` — the module no
longer executes anything on the panel host.** The legacy `execSync` twins were
removed from the public service contracts:

- Removed: `dovecotService.hashPassword/ensureMaildir/regenerateUsersFile/reload`,
  `postfixService.regenerateMailboxMap/regenerateDomainMap/regenerateCatchallMap/
  regenerateRoutingMaps/reload`, `sieveService.writeSieveForward/
  writeAccountFiltersAndForwards/rebuildAll` (sync, child_process on the panel
  host, string-interpolated). Only the `*WithExecutor` twins remain; on the
  "local" target they run through `localExecutor` (same behavior, no
  child_process). The write-behind queue path for `mail/accounts` is unchanged.
- Every command is built with `quoteCmd`/`quoteArg` (no string interpolation
  into shells). `iconv -l` (autoresponder charsets) also runs on the connected
  server, cached per target.
- **0600 atomic staging (audit Top #9):** files staged before a `sudo cp`
  (Postfix maps, `/etc/dovecot/users`, Sieve scripts, doveadm stdin secrets)
  are written via `services/staging.helpers.ts` → SFTP `writeFile` with
  `mode: 0o600` (atomic, no write-then-chmod window) under
  `${LUXIPANEL_CONFIG_DIR}/cache/<purpose>-staging/` (0700); `/tmp` is only a
  fallback and still 0600. Destination perms: `/etc/dovecot/users` `0640
  root:<dovecot group>`; Postfix maps stay `0644` ON PURPOSE (the postmap'd
  `.db` inherits the perms and is read by the unprivileged postfix daemons —
  0640 root:root would break delivery; they contain no secrets). The
  destination mode is applied **atomically on the direct-write fast path too**
  (`writeRootOwnedFile`/`writePostfixFile` pass `{ mode }` to `executor.writeFile`),
  so when the panel SSH user can write the file directly the `{SHA512-CRYPT}`
  users file still lands `0640` instead of the SFTP umask default — never
  world-readable — and the sudo-cp fallback keeps its `chmod`.
- **XSS:** message HTML from mailparser is sanitized server-side
  (`services/mail-html-sanitizer.ts`, `sanitize-html`) before leaving
  `GET /api/mail/:accountId/messages/:uid` — conservative allowlist
  (formatting/tables/img), `script`/`iframe`/`object`/`embed`/`form`, `on*`
  handlers and `javascript:` URLs dropped, `img src` limited to `https:`/`cid:`,
  inline `style` bounded to a fixed property set. The frontend's sandboxed
  iframe remains as defense-in-depth.

## Sieve Forwards

When forwards change, a Sieve script is auto-generated:
```sieve
require ["fileinto","copy","reject"];
redirect :copy "dest@example.com";
```

Sieve files are compiled with `sievec` and stored in the maildir.

## Key Services

| Service | Purpose |
|---------|---------|
| `imap.service.ts` | FACADE — re-exports the `imapService` object + named funcs. Implementation split under `services/imap/`: `imap.types.ts` (shapes), `imap-parse.ts` (address/message/auth parsing + uid/date helpers), `imap-connection.ts` (`withImap`/`verifyLogin`/host candidates), `imap-folders.ts` (list/create/rename/delete/usage), `imap-fetch.ts` (list/fetch messages + move/delete/flag), `imap-bulk.ts` (date-range copy/delete + `cloneMailbox`) |
| `mail-master.service.ts` | Dovecot master user owned by the panel (provision / rotate / disable / auth-candidate resolution). See *Master access* |
| `mail-target.ts` | `resolveMailTargetHost()` — maps the per-request context executor to the connected target's mail host (see *Per-server isolation of IMAP/SMTP sockets*). Fail-closed; localhost only for the local session |
| `smtp.service.ts` | Nodemailer SMTP client, send with attachment support |
| `dovecot.service.ts` | Hash password, write users file, reload (all via executor) |
| `postfix.service.ts` | Write vmailbox/virtual maps, `postmap`, reload (via executor) |
| `sieve.service.ts` | Generate Sieve scripts for forwards, compile with sievec (via executor) |
| `mail-crypto.service.ts` | AES-256-GCM encrypt/decrypt for stored passwords |
| `mail-html-sanitizer.ts` | Server-side XSS sanitizer for HTML mail bodies |
| `staging.helpers.ts` | 0600-atomic staging under `cache/<purpose>-staging` for sudo copies |

## Controllers — accounts split

`controllers/accounts.controller.ts` is a FACADE re-exporting `accountsController`
(referenced by `routes/mail.routes.ts`) and the `MailAccountListItem` type. The
implementation lives under `controllers/accounts/`:

| File | Contents |
|------|----------|
| `accounts.util.ts` | Mode/regex constants, `ForwardEntry`, `normalize`/`normalizeAddress`/`roundToTwo` |
| `accounts-schemas.ts` | Zod create/update/list schemas + `resolveAddressFromCreateBody` |
| `accounts-usage.helpers.ts` | Privileged disk usage / disk total / maildir quota reads |
| `accounts-forwards.reader.ts` | Sidecar + Postfix `virtual_alias_maps` forwards reader |
| `accounts-state.ts` | Dovecot/Postfix entry rendering + `applyAccountState` (queue/live) + maildir rename + sidecar settings |
| `accounts-list.ts` | `MailAccountListItem` + `buildAccountItemsLive` cold-miss builder |
| `accounts-crud.controller.ts` | The `accountsController` HTTP handlers (list/domains/create/update/delete) |

## Config

| Env var | Default | Description |
|---------|---------|-------------|
| `MAIL_ENCRYPTION_KEY` | `""` | 64 hex char AES-256-GCM key |
| `DOVECOT_USERS_FILE` | `/etc/dovecot/users` | Path to Dovecot passwd-file |
| `POSTFIX_VMAILBOX` | `/etc/postfix/vmailbox` | Path to virtual mailbox map |
| `VMAIL_BASE` | `/var/vmail` | Base directory for mail storage |
| `VMAIL_UID` / `VMAIL_GID` | `5000` | vmail system user UID/GID |
