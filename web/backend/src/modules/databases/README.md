# Databases module

A general, phpMyAdmin-style database manager for the **connected server**.
Auto-detects the engines installed on the target and lets you browse schemas
and run SQL — for **MySQL / MariaDB** and **PostgreSQL**.

## Design

- **No persisted state, no stored credentials.** The module does not register
  "connection instances". It auto-detects the engines running on the connected
  server and talks to them through their local CLI over the `Executor`:
  - `sudo -n mysql --batch …` — root via `unix_socket` auth.
  - `sudo -n -u postgres psql --csv …` — peer auth as the `postgres` role.
- All work runs on the **client server** via its context executor (local/SSH target isolation
  invariant). Nothing touches the panel host.
- The sudo credential is the operator's own SSH passphrase, injected into the
  shell body with `injectSudoIntoShellScript` (same pattern as the nginx
  services). No password is ever stored or passed via argv.

## Structure

```
databases/
├── models/index.ts                 # types + Zod request schemas
├── services/sql-util.ts            # pure: identifier quoting, output parsing, statement classification, tenant create-db detection
├── services/sql-builder.ts         # pure: browse/CRUD statement builders (SELECT rows / INSERT / UPDATE / DELETE)
├── services/engine-adapter.ts      # per-engine adapters (SQL/CLI/parse) behind one interface
├── services/databases.service.ts   # executor-backed orchestration (executor + adapter + builders)
├── controllers/databases.controller.ts
├── routes/databases.routes.ts
├── agent-capability.ts             # AI assistant tools (databases.*)
└── index.ts                        # registerDatabasesModule(app)
```

### Anatomy: no `repositories/`

Like the `firewall` and `nginx` modules, `databases` has **no `repositories/`
layer and no persisted sidecar of its own.** It is a *pass-through* manager: it
reads and mutates the database engines **of the connected server** through their
CLI over the `Executor`, and stores nothing on the panel host. The
model/repository/service/controller ladder collapses to
**models (types + Zod) → pure helpers (`sql-util` + `sql-builder`) → per-engine
adapters → service (orchestration) → controller → routes.** Statement text is
built exclusively by the pure helpers so it is auditable and unit-tested in one
place; the service is the single layer that touches the box.

### SQL construction is injection-safe (identifiers quoted, values escaped)

Every browse/CRUD statement is assembled by the pure `sql-builder`/`engine-adapter`
functions under a fixed contract:

- **Identifiers** (database / table / column) are emitted **only** through the
  adapter's `quoteIdent` (backtick / double-quote with delimiter doubling); PG
  tables are additionally schema-qualified. Column names are also validated
  against `identifierSchema` up-front (defence in depth).
- **Values** are emitted **only** through the adapter's `stringLiteral`
  (engine escaping) or a real `NULL` — never concatenated raw. Bind parameters
  are not available because the engines are driven through their CLI
  (`mysql -e` / `psql -c`, which has no parameter channel); an engine-escaped
  literal is the correct and only mechanism, and is covered by injection tests
  (`sql-builder.test.ts`). Catalogue lookups (`information_schema` / `pg_*`)
  likewise pass the db/table as escaped string literals or as shell-quoted CLI
  args (`quoteArg`).

## Endpoints

All under `requireAuth` + `requireModule("databases")`.

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/databases/engines` | Detect installed/running engines + versions |
| GET  | `/api/databases/list?engine=` | List databases for an engine |
| POST | `/api/databases/databases` | Create one validated database (CSRF-guarded) |
| GET  | `/api/databases/tables?engine=&database=` | List tables (rows + size) |
| GET  | `/api/databases/columns?engine=&database=&table=` | Table structure |
| GET  | `/api/databases/rows?engine=&database=&table=&limit=&offset=` | Browse rows (paginated) |
| POST | `/api/databases/query` | Run a statement (SQL console; CSRF-guarded) |
| POST   | `/api/databases/records` | Insert one record (CSRF-guarded) |
| PATCH  | `/api/databases/records` | Update one record by primary key (CSRF-guarded) |
| DELETE | `/api/databases/records` | Delete one record by primary key (CSRF-guarded) |
| POST   | `/api/databases/export`  | Dump a database to a `.sql` attachment (CSRF-guarded) |
| POST   | `/api/databases/install` | Install a database engine on the target (CSRF-guarded) |

### Write safety

`POST /api/databases/query` classifies the statement. Read statements
(`SELECT/SHOW/EXPLAIN/…`) run freely; mutating/DDL statements are refused
unless `allowWrite: true` is sent — the UI only sets that from its explicit
"Allow write" affordance, so a stray `UPDATE`/`DROP` can't slip through the
browse paths. Identifiers used to build browse queries are validated
(`identifierSchema`) **and** engine-quoted.

### Record CRUD (`/records`)

Insert/update/delete a single row. Column names are validated
(`identifierSchema`) and engine-quoted; values travel as strings (or `null` for
a real SQL `NULL`) and are bound as engine-escaped string literals (the engine
casts to the column type). **`update`/`delete` are primary-key scoped:** the
`where` map must be *exactly* the table's full primary key
(`assertWhereIsPrimaryKey`) so a single edit can never fan out across rows.
Tables without a primary key can't be edited/deleted row-by-row — the UI hides
those actions and the service refuses them.

### Export (`/export`)

Runs the engine's native dump tool over the Executor (`sudo -n mysqldump …` /
`sudo -n -u postgres pg_dump …`), optionally restricted to a subset of tables
and `--no-data`/`--schema-only` when `includeData: false`. The dump text is
streamed back as a `Content-Disposition: attachment` `.sql` download.

### Install (`/install`)

Installs a database engine on the connected server via the shared
`packageInstaller` (`mariadb` → `mariadb-server`, `postgresql` → `postgresql`).
Sudo is resolved through the standard flow — live session passphrase first,
then a `SUDO_PASSWORD_REQUIRED` prompt routed through the frontend
`<InstallModal>` / `withSudo` helper. The response carries `code`/`output`
inside `data` so the shared install modal can drive the prompt and live log.

### Hosting tenant scope

Hosting sessions see only databases with their account prefix. The target's
hosting account registry resolves nested names (`foo_` versus `foo_bar_`).
Usernames containing a hyphen receive a stable `lxp_<hash>_` SQL-safe prefix.
The create endpoint checks this prefix and the live account's `maxDatabases`
across both running engines under a per-account creation lock before issuing
a single quoted `CREATE DATABASE`. Record browsing, edits and export check the
same scope. The SQL console, engine installation and AI `run_query` tool are
unavailable to hosting sessions. Database CLI commands run through a trusted
service executor only after the scope check; they do not inherit the tenant's
unprivileged shell. Creating a database does not create an application SQL user
or grant privileges to one.

### Engine visibility (UI)

The engine bar shows **only running engines** as selectable — never disabled
buttons. Engines that aren't running are surfaced instead as "Install …"
actions in the install section.

## Agent capability

Tools (all prefixed `databases.`): `list_engines`, `list_databases`,
`list_tables` (read), and `run_query` (action, `dangerous`, `allowWrite`
gated).

## Licensing

Registered in LP-LICENSE-SERVER (`seeds/modules.ts`) as `code: "databases"`,
`tag: "premium"`, `selfInstall: true` (no global setup script — the engines
and their CLIs are detected on the target). The panel catalog entry lives in
`admin/services/module-registry.service.ts`.
