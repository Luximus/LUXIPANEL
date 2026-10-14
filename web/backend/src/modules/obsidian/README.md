# Obsidian module

Manager for **Obsidian vaults on the connected client server**: register or
create vaults, browse/edit markdown notes, search content, walk the wikilink
graph — and let the AI assistant read and capture knowledge straight into the
vault.

## Design

- **Vaults are plain directories on the CLIENT server.** The panel only
  persists vault *registrations* (name + absolute path) in the per-server
  sidecar `${LUXIPANEL_CONFIG_DIR}/obsidian/vaults.json` via
  `dataStore(executor, "obsidian", "vaults")` (uuid ids). Deleting a vault in
  the panel only deregisters it — **note files are never removed**.
- **Personal workspace preferences** (`editorMode`, `fontSize`, `lastVaultId`)
  live in the per-server Obsidian KV collection keyed by authenticated user.
  Vault registrations remain shared on the connected server.
- **Everything runs over the Executor** (selected-target isolation invariant):
  SFTP primitives for note I/O, `find`/`grep`/`date` for tree/search/daily
  notes. **No sudo** — vault files belong to the SSH user. Every shell
  argument goes through `quoteArg`.
- **Path security (double gate):**
  1. `resolveRel(vaultPath, rel)` (`services/path-util.ts`, unit-tested)
     rejects empty paths, NUL bytes, absolute paths and ANY `..` segment, then
     normalizes and verifies the vault prefix. Note operations only accept
     `.md` / `.canvas` / `.txt` extensions.
  2. Controllers and agent tools re-check the session user's per-group PATH
     policy (`canAccessPath`) against the vault and each requested note path
     (read for GETs, write for mutations). Tree, search and backlinks filter
     paths the user cannot read. Non-admins only see vaults their policy lets
     them read.
     Direct note operations resolve symlink components on the connected server
     and reject targets outside the vault before I/O.
  3. Manual vault registration/removal, context preparation and container
     synchronization require an admin session. Automatic project/chat context
     provisioning remains a system action.

## Endpoints

All under `requireAuth` + `requireModule("obsidian")`; mutations are
CSRF-guarded.

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/obsidian/vaults` | Vaults + live `exists` / `noteCount` |
| GET/PATCH | `/api/obsidian/preferences` | Current user's workspace view on the connected server |
| POST   | `/api/obsidian/vaults` | `{name, path, mode:"create"\|"register"}` |
| DELETE | `/api/obsidian/vaults/:id` | Deregister (never deletes files) |
| GET    | `/api/obsidian/vaults/:id/tree` | Folders + notes (`*.md`/`*.canvas`, one `find`) |
| GET    | `/api/obsidian/vaults/:id/note?path=rel` | Read note (≤2MB) |
| GET    | `/api/obsidian/vaults/:id/daily/today` | Server-local date and existing note content, or a blank draft |
| PUT    | `/api/obsidian/vaults/:id/note` | `{path, content}` create/update |
| POST   | `/api/obsidian/vaults/:id/note/rename` | `{from, to}` |
| DELETE | `/api/obsidian/vaults/:id/note?path=rel` | Delete note |
| POST   | `/api/obsidian/vaults/:id/folders` | `{path}` mkdir -p |
| POST   | `/api/obsidian/vaults/:id/daily` | Append a quick entry to today's note |
| GET    | `/api/obsidian/vaults/:id/search?q=` | Literal grep, ≤200 hits |
| GET    | `/api/obsidian/vaults/:id/links?path=rel` | Outgoing wikilinks + backlinks |
| POST   | `/api/obsidian/vaults/:id/assistant-context` | Seed `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` (`{overwrite?}`, idempotent) |
| GET    | `/api/obsidian/containers` | Registered context containers (repo / project / chat) |
| POST   | `/api/obsidian/containers/sync` | Back-fill a container per repo / project / loose chat (idempotent) |

## Context containers (auto-provisioned)

When the **Assistant** module is enabled it `implies` Obsidian (see
`admin/module-registry.service.ts`), and Obsidian then mints one **context
container** per source the assistant works with — a GitHub repo on the server,
an assistant project, or a loose chat. A container is a real vault under a
central, per-SSH-user root that keeps the repos themselves clean:

```
~/luxipanel-context/
  projects/<repo>/      assistant/<project>/      chats/<chat>/
```

Each is seeded with `Contexto.md`, `Decisiones.md`, `Comandos.md`,
`Errores.md`, `Reglas.md` (plus the per-provider context files), so the
assistant — and the `claude`/`codex`/`gemini` CLIs — store and reference
summarized context, decisions, commands, known errors and rules there. For
repos, a `<!-- luxipanel-context -->` pointer block is also appended to the
repo's own `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` so a CLI launched inside the
repo finds the vault.

- `services/context-container.service.ts` owns creation; the per-source
  `refKey` (`repo:<path>` / `project:<id>` / `chat:<id>`) in
  `containers.json` (`repositories/containers.repository.ts`) makes it
  idempotent across renames.
- **Triggers (all):** sync on module-enable (repos + projects, background SSH
  scan), the `obsidian.sync_containers` agent tool / panel "Sincronizar
  contenedores" button (includes loose chats), and lifecycle **events**
  (`AI_PROJECT_CREATED` / `AI_CONVERSATION_CREATED`) — ai-assistant emits, the
  obsidian `listeners.ts` reacts, so the dependency stays one-way.
- Agent tools `obsidian.list_containers` (find the vault for a source) and
  `obsidian.sync_containers` (back-fill) join the `obsidian.*` set.

## AI assistant integration

`agent-capability.ts` registers `obsidian.*` tools: `list_vaults`,
`list_notes`, `read_note`, `search_notes`, `backlinks` (read) and
`write_note` (dangerous), `append_note`, `daily_note` (appends to
`Daily/YYYY-MM-DD.md`, date = client server's `date +%F`), `delete_note`
(dangerous). Vaults are addressable by name or id. Data panel
`obsidian.vaults_summary` (TTL 300s) summarizes the registered vaults.

`POST …/assistant-context` writes the same vault-conventions context file for
every CLI provider (CLAUDE.md, AGENTS.md, GEMINI.md) at the vault root, so CLI
agent sessions started inside the vault know the wikilink/frontmatter/daily
note conventions.
