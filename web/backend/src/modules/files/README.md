# Files Module

Sandboxed server-side file manager — browse, read, write, upload, download, and archive files within allowed base paths.

## Archive extraction — containment model & known limits (W1 · B2)

`extractWithExecutor` audits the archive's member list **on the target** before
extracting and fails closed: it rejects members with NUL / absolute paths / `..`
and symlink|hardlink members whose resolved target escapes the destination. The
member-name parser is aligned to **GNU tar** verbose output (and Info-ZIP
`unzip -Z`); a target with busybox/BSD tar may fail the listing and thus refuse
a *legitimate* archive (fail-closed, never a bypass). Accepted residual risks,
documented deliberately:

- **ZIP with symlink members is rejected wholesale** — `zipinfo` does not expose
  the link target, so it cannot be audited (legit npm/macOS zips will fail).
- **TOCTOU** between the audit and the extract (two separate processes re-read
  the user-controlled archive); mitigated by GNU tar/Info-ZIP stripping `..`
  themselves on extract.
- **Pre-planted symlink already in `dest`** is out of scope of the member audit.

## Endpoints

### Browser

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/files/list` | Admin | List directory contents (`?path=/var/vmail`) |
| GET | `/api/files/stat` | Admin | Stat a single path (size, mode, mtime, type) |
| GET | `/api/files/search` | `files.read` | Recursive search **by file name** — tree form `?base=&q=&limit=`, legacy form `?path=&q=` (see Name search below) |
| GET | `/api/files/grep` | `files.read` | Recursive search **inside files** — see Content search below |
| GET | `/api/files/compare` | `files.read` | Diff two directory trees by content hash (#6): added/removed/modified + same count |
| GET | `/api/files/history` | `files.read` | Per-file timeline (#8): git `log --follow` commits merged with snapshots |
| GET | `/api/files/history/git-show` | `files.read` | Content of the file at a git revision (for diff/restore) |

### Git (native, phase 1 — `git.service.ts`, #14)

Local work-tree operations only (no network/credentials yet): `git -C <repo> …`
via the executor. Commits use the session user as author (`-c user.name/email`).
Branch names are validated; discard is confirmed in the UI (git/reflog is the
safety net, so no snapshot).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/files/git/status` | `files.read` | `status --porcelain -b` + branches + HEAD |
| POST | `/api/files/git/commit` | `files.write` + CSRF | `add -A` (optional) + commit |
| POST | `/api/files/git/discard` | `files.write` + CSRF | `checkout -- .`/paths (+ optional `clean -fd`) |
| POST | `/api/files/git/checkout` | `files.write` + CSRF | switch to an existing branch |
| POST | `/api/files/git/branch` | `files.write` + CSRF | create + switch to a new branch |
| POST | `/api/files/git/pull` | `files.write` + CSRF | `pull --ff-only` (uses a matching credential) |
| POST | `/api/files/git/push` | `files.write` + CSRF | `push` current branch (uses a matching credential) |
| POST | `/api/files/git/clone` | `files.write` + CSRF | clone a repo into `dest` (creds by host; url/dest validated, `dest` sandboxed in-service like upload) |
| POST | `/api/files/git/deploy` | `files.write` + CSRF | deploy from a branch: `checkout <branch>` + `pull --ff-only` |
| GET | `/api/files/git/credentials` | `files.read` | List stored credentials (never the secret) |
| POST | `/api/files/git/credentials` | `files.write` + CSRF | Add a PAT (https) or SSH key, encrypted at rest |
| DELETE | `/api/files/git/credentials/:id` | `files.write` + CSRF | Remove a credential |

**Credentials (phase 2):** PAT (https) or private key (ssh), AES-256-GCM
encrypted with `GIT_ENCRYPTION_KEY` (panel host only — the per-server sidecar
`files/git-credentials.json` holds ciphertext). On pull/push the secret is
decrypted on the panel host and staged in an ephemeral `0600` helper file on the
target (askpass token file for https / key file for ssh) fed via
`GIT_ASKPASS` / `GIT_SSH_COMMAND` — **never in argv** — and removed afterwards.
Credential ↔ remote is matched by host. Empty `GIT_ENCRYPTION_KEY` disables
credential features (local git still works).
| GET | `/api/files/project-info` | `files.read` | Detect stack + logical map (#4) — see Project map below |
| GET | `/api/files/exposure/scan` | `files.read` | Sensitive files inside nginx public roots (#3/#16) |
| GET | `/api/files/exposure/probe` | `files.read` | Fetch a file's public URL (SSRF-safe; client domains only) |
| POST | `/api/files/exposure/block` | `files.write` + CSRF | Append a `.htaccess` deny rule for a file (snapshots first) |
| GET | `/api/files/privacy` | `files.security` | Directory Privacy status for a folder: protected?, realm, users, **live nginx enforcement** |
| POST | `/api/files/privacy/protect` | `files.security` + CSRF | Password-protect a folder (upsert user) — see Directory Privacy below |
| POST | `/api/files/privacy/user/remove` | `files.security` + CSRF | Remove one Basic-auth user (last one ⇒ unprotect) |
| POST | `/api/files/privacy/unprotect` | `files.security` + CSRF | Remove protection (strips nginx block + any publish block first, then deletes files) |
| GET | `/api/files/privacy/sites` | `files.security` | List of enabled nginx **domains** (`server_name`s) the folder can be **published** under; one entry per distinct FQDN: `{ site, domain, ssl, kind }` |
| POST | `/api/files/privacy/publish` | `files.security` + CSRF | Expose a protected folder under a chosen nginx **domain** via an `alias` location → yields a public URL on that domain (best-effort Certbot TLS if the site has none) |
| POST | `/api/files/privacy/unpublish` | `files.security` + CSRF | Remove the published `alias` exposure (keeps the folder's credentials) |
| POST | `/api/files/replace/preview` | `files.read` + CSRF | Mass replace **preview** (per-line before/after, no writes) |
| POST | `/api/files/replace/apply` | `files.write` + CSRF | Mass replace **apply** (snapshots each file first) |
| GET | `/api/files/allowed-bases` | Admin | List sandbox root directories |
| GET | `/api/files/meta` | `files.read` | Tags + comment for a path (#23/#24) |
| GET | `/api/files/meta/all` | `files.read` | Annotated files inside the caller's readable paths |
| PUT | `/api/files/meta` | `files.write` + CSRF | Upsert tags + comment (deletes when empty) |
| GET | `/api/files/share/roots` | `files.read` | Public nginx roots a share can be published under (#17) |
| GET | `/api/files/share` | `files.share` | Own shares inside readable paths; admins see all |
| POST | `/api/files/share` | `files.write` + CSRF | Create a temporary share link |
| POST | `/api/files/share/:token/revoke` | `files.write` + CSRF | Revoke a share (removes the staged blob) |
| GET | `/api/files/mode` | `files.view` | Client/dev UI mode for the current user (#25) |
| PUT | `/api/files/mode` | `files.view` + CSRF | Set the UI mode (UX guardrail — NOT access control; roles remain authoritative) |
| GET/PATCH | `/api/files/preferences` | `files.view` (+ CSRF for PATCH) | Current user's mode, hidden files, favorite roots, tree expansion mode (`multiple`/`single`), shortcuts; per connected server |
| GET | `/api/files/config/effective` | `files.view` | Effective file-operation limits for the connected server |
| GET/PATCH | `/api/files/config` | admin + `files.config` (+ CSRF for PATCH) | Per-server operational policy, bounded by environment ceilings |
| GET/POST | `/api/files/config/prune-preview`, `/api/files/config/prune` | admin + `files.config` (CSRF for POST) | Preview and explicitly apply snapshot retention |

### Directory Privacy (`directory-privacy.service.ts`)

cPanel-style folder password protection (HTTP Basic auth), surfaced as a section
of the Permissions modal (directories only). Three artifacts on the connected
server:

- **`.htpasswd`** in the folder — `user:hash` lines. The hash is Apache `apr1`
  (MD5) computed **in Node** (`apr1()`), so the cleartext password never reaches
  the remote shell/argv; only the hash is written. `apr1` is compatible with both
  Apache and nginx `auth_basic_user_file`. Verified against `openssl passwd -apr1`
  in tests.
- **`.htaccess`** in the folder — `AuthType Basic` block (Apache). **Inert on
  nginx** (nginx ignores `.htaccess`); kept for Apache targets.
- **nginx `auth_basic`** — the part that actually enforces on nginx. Delegated to
  `nginxBasicAuthService` (nginx module): finds the enabled site whose document
  root contains the folder, injects a marked `location ^~ /folder/ { auth_basic … }`
  block (nesting the site's `\.php$` handler for PHP sites), validates with
  `nginx -t`, rolls back on error, and reloads. `getStatus` reports
  `enforcement: { enforced, site, url, reason }` so the UI shows whether it is
  truly live (and why not — e.g. `no-site` when the folder is outside every
  web root).

All reads/writes use **sudo staging** (`sudo cat`, tmp `0600` + `sudo cp` +
`sudo chmod`, `sudo rm`) because these files commonly live under root-owned web
roots. The `.htpasswd` ends up **`0640` + group-owned by the detected webserver
group** (www-data/nginx/apache/http) so only the worker can read it; when no
webserver group exists it falls back to the legacy `0644` with a warning.

> ⚠️ **`apr1` hashes are weak** (1000-round MD5, cheaply crackable offline with
> GPUs). It stays because it's the only format both Apache and nginx accept out
> of the box. Recommend to operators: never reuse a real account password here
> and **rotate these passwords periodically**. A hash-format migration (bcrypt)
> is a planned follow-up; do not change the format in place — existing
> `.htpasswd` files must keep validating.

> ⚠️ **`.htaccess` ≠ enforcement on nginx.** On an nginx-only server the password
> prompt comes solely from the injected `auth_basic` block; the `.htaccess` does
> nothing. On Apache it is the reverse.

### Mass replace (`replace.service.ts`, #10)

Find/replace across a directory tree, built on the content-search engine
(candidate-file discovery) and the snapshot engine (a backup is captured before
every file is rewritten — `apply` is reversible from the change history).
Matching is **line-scoped with a JS RegExp so preview === apply**; grep only
prunes which files to read. `text` mode escapes regex metachars; `regex` mode
keeps native `$1`/`$&` backrefs. Caps: 100 files (max 500), 200 lines/file.

### Project map (`project-type.service.ts`, Fase 0.3 / #4)

`GET /api/files/project-info?path=` classifies the stack from the top-level
listing (one `readdir`) + `package.json`/`composer.json` contents, and returns a
logical map: `{ type, label, confidence, publicRoot, markers, sections[] }`.
Detects Laravel, WordPress, Next.js, Nuxt, Vue, React, Node, Django, Python,
classic PHP and static sites. Each `section` carries `{ key, label, path,
exists, sensitive?, isFile? }` (existence approximated from the listing's first
path segment — no extra round-trips). Feeds the smart map (#4) and the
per-stack cleanup classifier (#11).

### Name search — folder tree (`name-search.service.ts`)

`GET /api/files/search?base=<abs>&q=<term>&limit=<n>` searches recursively **by
file/folder name** from `base` on the connected server, so the sidebar tree can
find entries inside folders the user never expanded (its client-side filter only
sees loaded nodes).

- `base` (required, absolute) — validated with the same `safePath` sandbox as
  `list`/`read`, plus `pathSandbox` + `enforceFilePathPermission("read")`
  (`base` is in both middlewares' path-key whitelists).
- `q` (required) — case-insensitive **substring** of the name, minimum 2 chars;
  shorter/absent → `400 VALIDATION_ERROR`. fnmatch metacharacters (`* ? [ ]`)
  are escaped, so the term always matches literally.
- `limit` — default 100, capped at 500.

Response (bare object, not the `{ok,data}` envelope — fixed API contract):

```json
{ "items": [{ "path": "/abs/ruta", "name": "archivo.ext", "type": "file" }],
  "truncated": false, "base": "/abs" }
```

Command (one executor round-trip, 15s timeout), pruning `node_modules`/`.git`:

```sh
if find /dev/null -maxdepth 0 -printf '' >/dev/null 2>&1; then
  find '<base>' -mindepth 1 '(' -name 'node_modules' -o -name '.git' ')' -prune \
    -o -iname '*<q>*' -printf '%y\t%p\n' 2>/dev/null | head -n <limit+1>
else   # busybox/BSD find without -printf
  find '<base>' -mindepth 1 '(' -name 'node_modules' -o -name '.git' ')' -prune \
    -o -iname '*<q>*' '(' -type d -exec printf 'd\t%s\n' '{}' ';' \
    -o -exec printf 'f\t%s\n' '{}' ';' ')' 2>/dev/null | head -n <limit+1>
fi
```

`base` and `q` are quoted with `quoteArg`; the `-printf` probe picks the variant
on the target itself so the fallback costs no extra round-trip. `head -n limit+1`
both bounds the output and makes `truncated` detectable. Symlinks (`%y` = `l`)
are reported as `file`.

> The route is shared with the **legacy** `?path=&q=` search (used by the
> search & replace panel, envelope `{ok,path,query,data}` with full `DirEntry`s
> via `filesystemService.searchRecursive*`): `nameSearchController.search` calls
> `next()` when `base` is absent, so `browserController.search` still serves it.

### Content search (Fase 0.2 — `content-search.service.ts`)

`GET /api/files/grep?path=&q=&mode=&caseSensitive=&maxResults=` runs
`grep -rnI … | head` through the request executor and returns matches grouped
by file. The `| head` bounds the result set and masks grep's exit-1-on-no-match
(the pipeline exits 0), so an empty result is not treated as a failed command.

`mode` selects the pattern:
- `text` (default) — literal substring (`grep -F`), case-insensitive unless `caseSensitive=true`.
- `regex` — POSIX ERE (`grep -E`), honours `caseSensitive`.
- Canned scanners (`-E`, forced case-insensitive where noted), `q` ignored:
  `email`, `url`, `apikey`, `import`, `function`, `endpoint`, `variable`.

Excludes `.git node_modules vendor .cache dist build .next` by default; caps at
500 matches (override up to 5000) and 100 matches/file; 25s timeout. Feeds the
content-search UI (#9), mass replace (#10), and the exposed-secrets / malware
scans (#3, #12).

### Editor

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/files/read` | Admin | Read a text file (`?path=...`) |
| POST | `/api/files/validate` | `files.read` + CSRF | Validate content before saving (#7): JSON/.env/nginx in-process, PHP `php -l` & YAML via executor |
| GET | `/api/files/cleanup/scan` | `files.read` | Smart cleanup scan (#11): regenerable dirs + big files, classified safe/review/keep |
| GET | `/api/files/images/capabilities` | `files.read` | Which image tools exist (magick/cwebp/jpegoptim/optipng) (#22) |
| GET | `/api/files/images/scan` | `files.read` | List large images under a dir |
| POST | `/api/files/images/process` | `files.write` + CSRF | op=webp/compress(snapshot)/resize/responsive |
| GET | `/api/files/malware/scan` | `files.read` | Explainable heuristic malware scan (#12) — eval/base64/webshell/PHP-in-uploads |
| GET | `/api/files/malware/quarantine` | `files.read` | List quarantined files (#13) |
| POST | `/api/files/malware/quarantine` | `files.delete` + CSRF | Quarantine a file (snapshot + move + chmod 000) |
| POST | `/api/files/malware/quarantine/:id/restore` | `files.write` + CSRF | Restore a quarantined file to its origin |
| DELETE | `/api/files/malware/quarantine/:id` | `files.delete` + CSRF | Permanently delete a quarantined file |
| PUT | `/api/files/write` | Admin + CSRF | Write/overwrite a text file |

### Transfer

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/files/download` | `files.download` | Stream file download (`?path=...`) |
| POST | `/api/files/upload` | `files.upload` + CSRF | Upload binary file (`application/octet-stream`); per-server limit up to `FILES_UPLOAD_MAX_BYTES` (512 MiB by default) |

### Operations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/files/mkdir` | Admin + CSRF | Create directory |
| DELETE | `/api/files` | Admin + CSRF | Delete file or directory |
| PUT | `/api/files/rename` | Admin + CSRF | Rename/move a path |
| POST | `/api/files/copy` | Admin + CSRF | Copy file or directory |
| GET | `/api/files/permissions/recommend` | `files.read` | Current mode + risk analysis + recommended mode (#5) |
| PUT | `/api/files/chmod` | Admin + CSRF | Change file permissions (octal string) |
| PUT | `/api/files/chmod-recursive` | `files.chmod` + CSRF | Apply file/dir modes across a tree (snapshots first) (#5) |
| PUT | `/api/files/chown` | Admin + CSRF | Change owner:group |

**Escalación privilegiada gateada por grupo Linux.** Upload (fallback
`writePrivilegedFile` en EACCES) y delete/rename/chmod
(`privilegedRemove`/`privilegedRename`/`privilegedChmod`) escalan a `sudo` sólo
si el usuario del panel logueado pertenece a `sudo`/`wheel` **en el servidor
conectado**, resuelto en vivo (`id -nG`, cache corto por sesión) por
`shared/system/privilege-escalation.ts` (`canEscalatePrivileges` /
`assertCanEscalate`). Un usuario Linux sin ese grupo recibe **403
`FORBIDDEN`** sin intento de sudo (respeta los permisos Linux; sin escalada de
privilegios vía el panel). Cada escalada efectiva queda auditada con el
**username real** (`auditPrivilegedFileOp` → log estructurado
`privileged file op`). Fail-closed: sin usuario de contexto o si `id -nG`
falla, NO escala.

### Archive

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/files/compress` | Admin + CSRF | Create a `.tar.gz` or `.zip` archive |
| POST | `/api/files/extract` | Admin + CSRF | Extract an archive to a destination directory |
| GET | `/api/files/archive-contents` | Admin | List contents of an archive without extracting |

### Snapshots — "Modo cambios seguros" (Fase 0.1, keystone)

Every panel-driven mutation (`write`, `delete`, `rename`/move, `copy`, `chmod`,
`upload`/replace) first captures a **mini-backup** of the pre-change state via
`snapshotService.capture()`. Capture is best-effort: a failure logs a warning
and the operation continues (it never blocks the user's edit/delete/move).

Storage on the connected client server:
- Blobs (raw bytes for files, `tar.gz` for directories): `${LUXIPANEL_CONFIG_DIR}/files-snapshots/<uuid>`
- Metadata map (kv-store): `${LUXIPANEL_CONFIG_DIR}/files/snapshots.json`

`kind` values: `file` (bytes captured), `dir` (tar.gz captured), `absent`
(path didn't exist → restore deletes it), `skipped` (over `FILES_SNAPSHOT_MAX_BYTES`,
metadata only). Restore captures the current state first (op `restore`) so it
is itself reversible. Retention prunes oldest beyond per-path / global caps.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/files/snapshots` | `files.read` | List snapshots, newest first (`?path=` to filter) |
| GET | `/api/files/snapshots/:id/diff` | `files.read` | `{ before, after }` for a file snapshot (feeds Monaco diff) |
| GET | `/api/files/snapshots/:id/download` | `files.read` | Download the backup blob (`.tar.gz` for dir snapshots) |
| POST | `/api/files/snapshots/:id/restore` | `files.write` + CSRF | Restore captured state onto the original path |
| DELETE | `/api/files/snapshots/:id` | `files.delete` + CSRF | Drop a snapshot (blob + metadata) |

## Path Sandbox

Two layers of path protection:

**1. `pathSandbox` middleware** (fast early-exit guard):
Blocks requests before they hit services if the path contains:
- `../` or `..\` (directory traversal)
- Null bytes (`\0`)
- `/proc/`, `/sys/`, `/dev/` prefixes

**2. `filesystem.service.ts` → `safePath()`** (authoritative check):
Resolves `path.resolve()` and verifies it starts with one of the configured `FILE_MANAGER_BASES`. Any path outside these roots throws `ForbiddenError`.

**3. `enforceFilePathPermission` middleware** (role/tenant path policy):
Collects path values from an **explicit whitelist of payload keys**
(`PATH_KEYS` in `role-file-permissions.middleware.ts`: `path`, `target`,
`source`, `src`, `dst`, `from`, `to`, `directory`, `archive`, `sources`,
`dest`, `destDir`, `root`) and checks each against `canAccessPath`. Any new route
payload field that names a path MUST be added to that list. The middleware also
resolves existing symlinks on the connected server (`realpath -m`) and checks
the effective path against both the server sandbox and the caller's path policy.
Upload validates the final `dest/filename` path separately. Git operations
recheck the resolved repository root against the caller's path policy.

Git note: `gitService` re-validates the resolved `git rev-parse
--show-toplevel` root against `safePath` — a repo whose toplevel lives outside
the sandbox is treated as not-a-repo (otherwise `-C <root>` ops would escape).

## Config

| Env var | Default | Description |
|---------|---------|-------------|
| `FILE_MANAGER_BASES` | `/host` in Docker, otherwise `/` | Comma-separated hard sandbox roots |
| `FILES_UPLOAD_MAX_BYTES` | `536870912` | Hard ceiling for a single upload; the drawer can set a lower per-server cap |
| `FILES_SNAPSHOTS_ENABLED` | `true` | Master switch for pre-mutation mini-backups |
| `FILES_SNAPSHOT_MAX_BYTES` | `5242880` | Max blob size to capture (5MB); larger → `skipped` |
| `FILES_SNAPSHOT_MAX_PER_PATH` | `20` | Retention: snapshots kept per distinct path |
| `FILES_SNAPSHOT_MAX_TOTAL` | `500` | Retention: global snapshot cap per server |

The drawer's **Operation** tab is administrator-only. Its per-server sidecar
controls the effective upload cap, snapshot capture/retention, and creation of
temporary links (enabled, maximum lifetime, password requirement). Existing
links retain their own expiry and password. Lowering snapshot retention does
not immediately remove copies; the separate preview/cleanup action requires
confirmation. Personal settings live in `files/prefs.json`, keyed by user ID on
each connected server; browser-only favorites and hidden-file state migrate on
first use. Legacy admin shortcuts migrate into that admin's preferences.

## Services

| Service | Purpose |
|---------|---------|
| `filesystem.service.ts` | All FS operations: list, stat, read, write, mkdir, delete, rename, copy |
| `permissions.service.ts` | `chmod`/`chown`; `analyzeMode` (recommender #5: 644/755 advice, 777 danger); `chmodRecursiveWithExecutor` (find -exec) |
| `archive.service.ts` | `tar -czf` for compress, `tar -xzf`/`unzip` for extract, list contents. Extraction (local AND executor) runs a **zip-slip + symlink containment audit** first: members with `..`, absolute paths or NUL are rejected; tar symlink/hardlink members with targets outside the destination are rejected (verbose-listing audit — tar/unzip have no `--no-follow-symlinks`); zips containing symlink members are rejected outright; listing failures fail closed (RAR keeps a best-effort name-only guard) |
| `snapshot.service.ts` | Pre-mutation mini-backups: capture / restore / readText (diff) / download / prune |
| `content-search.service.ts` | Recursive `grep -rnI` content search (text/regex + canned scanners), grouped by file |
| `replace.service.ts` | Mass find/replace: line-scoped preview + apply (snapshots each file), text/regex with `$1` backrefs |
| `project-type.service.ts` | Stack detection (Laravel/WP/Next/Nuxt/Vue/React/Node/Django/Python/PHP) + logical section map |
| `exposure.service.ts` | Web exposure: nginx public roots × sensitive-file scan, risk classify, SSRF-safe probe, `.htaccess` block |
| `validation.service.ts` | Pre-save validation: JSON/.env/brace checks in-process; `php -l` + YAML (python) via executor; skips if tool absent |
| `dir-compare.service.ts` | Compare two trees via `find \| xargs sha256sum`: added/removed/modified + same count (diff/copy reuse read/copy) |
| `file-history.service.ts` | Per-file timeline: `git log --follow` + snapshots merged; `git show rev:path` for a revision's content |
| `git.service.ts` | Native Git: status/commit/discard/branch (local) + pull/push/clone/deploy (creds via ephemeral askpass/key, never argv) |
| `git-credentials.service.ts` | PAT/SSH credentials, AES-256-GCM at rest (GIT_ENCRYPTION_KEY, panel-host only); matched to a remote by host |
| `malware.service.ts` | Explainable heuristic scan (grep eval/base64/webshell + PHP-in-uploads) + quarantine (snapshot+move+chmod000) under `${LUXIPANEL_CONFIG_DIR}/files-quarantine` |
| `cleanup.service.ts` | Smart cleanup scan: regenerable dirs (du) + big files, classified safe/review/keep (deletion reuses DELETE /api/files) |
| `image-optim.service.ts` | Image WebP/compress(snapshot)/resize/responsive via magick/cwebp/jpegoptim/optipng (detects tool, actionable if missing) |
| `file-meta.service.ts` | Per-path tags (#23) + internal comment (#24) in a sidecar (no FS mutation); empty entries are pruned |
| `files-prefs.service.ts` | Per-user/per-server browser preferences: mode, hidden files, favorite roots, tree expansion mode and shortcuts |
| `files-config.service.ts` | Per-server operational policy with environment hard ceilings |
| `share.service.ts` | Temporary share links (#17) served by the CLIENT's nginx/PHP gatekeeper (`<root>/_lxpshare.php`); blob+meta staged outside docroot; bcrypt passwords (legacy SHA-256 verification), expiry and download count under an exclusive lock. Revocation succeeds only if staged data was removed. Metadata is `0660` with the webserver group. |

## Architecture

```
files module
├── middlewares/
│   └── path-sandbox.middleware.ts  ← fast path validation (blocks traversal)
├── controllers/
│   ├── browser.controller.ts       ← list, stat, allowed-bases
│   ├── editor.controller.ts        ← read, write
│   ├── upload.controller.ts        ← upload (raw binary), download (stream)
│   ├── operations.controller.ts    ← mkdir, delete, rename, copy, chmod, chown, compress, extract
│   └── snapshot.controller.ts      ← list, diff, restore, download, delete snapshots
├── models/
│   └── snapshot.model.ts           ← SnapshotRecord / kind / op types
└── services/
    ├── filesystem.service.ts       ← safePath() + all FS ops
    ├── permissions.service.ts      ← chmod, chown
    ├── archive.service.ts          ← tar, zip, list
    └── snapshot.service.ts         ← capture (pre-mutation) / restore / diff / download / prune
```
