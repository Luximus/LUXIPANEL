# Cron Module

Manages two kinds of scheduled work on the connected target:

1. **Classic script jobs** — entries in the selected Linux user's crontab. Each panel-created
   job is wrapped by `lxp-cron-run` so every execution writes a per-run `.log`
   (start / output / end). External (non-panel) crontab lines are shown
   read and managed alongside panel-created jobs.
2. **Scheduled AI-agent jobs** — run an AI Assistant agent on a cron schedule
   via an in-process scheduler (mirrors the backup scheduler). The agent's
   tools are gated by the AI Assistant's per-target module-access sidecar.

## Endpoints

### Daemon (firewall-style install/service)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cron/status` | `{ installed, service:{unit,active}, wrapper }` |
| POST | `/api/cron/install` | Admin only: install cron package + service + log wrapper (sudo-aware) |
| POST | `/api/cron/service/enable` | Admin only: start + enable the cron service |
| POST | `/api/cron/service/disable` | Admin only: stop + disable the cron service |

### Classic jobs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cron/users` | Admin only: list Linux accounts eligible for the selector |
| GET | `/api/cron/jobs[?user=…]` | List jobs of the session's Linux account; admin may select any account |
| POST | `/api/cron/jobs` | Create a wrapped, logged job |
| PUT | `/api/cron/jobs/:id` | Edit a job (preserves paused state) |
| POST | `/api/cron/jobs/:id/toggle` | Pause / resume |
| DELETE | `/api/cron/jobs/:id` | Remove a job + its logs |
| POST | `/api/cron/validate` | Validate + describe a cron expression |
| GET | `/api/cron/jobs/:id/logs[?user=…]` | List per-execution logs after checking job ownership |
| GET | `/api/cron/jobs/:id/logs/:file[?user=…]` | Read one execution log after checking job ownership |

Non-admins cannot override `user`. Admins default to `root`; ordinary users
default to their own login, and hosting sessions to their tenant's Linux owner.
Each mutation resolves the Linux account with `getent passwd` before reading or
writing its crontab. The same restriction applies to `cron.*` Assistant tools.

### Scheduled AI-agent jobs
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/cron/ai-jobs` | List / create agent jobs |
| PUT/DELETE | `/api/cron/ai-jobs/:id` | Edit / remove |
| POST | `/api/cron/ai-jobs/:id/toggle` | Enable / disable |
| POST | `/api/cron/ai-jobs/:id/run` | Run now (async) |
| GET | `/api/cron/ai-jobs/:id/logs[/:file]` | Execution logs |

## How jobs are stored

A panel-managed crontab line looks like:

```
<schedule> <cronWrapperPath> <jobId> <base64(command)> # <comment>
```

`jobId` is a stable UUID generated at creation (not a hash), so edit/pause keep
the same id. A paused job is the same line prefixed with `#LXP-OFF `. The
parser decodes the wrapper so the UI shows the original command.

Root's per-execution logs live under `${LUXIPANEL_CONFIG_DIR}/cron/logs/<jobId>/`.
Other accounts use a private wrapper in `~/.local/libexec/luxipanel/` and
private logs in `~/.local/state/luxipanel/cron/logs/<jobId>/`. Logs
are rotated to the most recent 50 per job.

### Where crontab writes run (hard rule: never a local shell-out)

`cron-parser.service.ts` reads/writes the crontab **only through the request
`Executor`** — SSH for remote targets, the sudo-wrapped `localExecutor` for the
panel's own box. There is no `execSync`/`child_process` path any more (CLAUDE.md
hard rule: no module runs commands on the panel host directly). The write is
always **staged over SFTP** (`executor.writeFile` to a `/tmp/.lxp-cron-*` file)
then installed with `crontab <file>`, so the multi-line body is written
byte-for-byte and a command with quotes/`$`/`;`/`#`/newlines can never break out
of a token or inject an extra crontab line (the old `echo '…' | crontab -`
escaping did not survive every payload).

`jobs.controller` picks the delivery per target, mirroring the firewall module:
- **local target** → run synchronously via `*WithExecutor` (writeFile + `crontab
  <tmp>`), never the write-behind queue;
- **direct SSH or hosting privilege-drop executor already running as the owner**
  → execute synchronously as that account;
- **remote target** → enqueue the identical steps on the write-behind queue
  (`submitMutation`, collection `cron/jobs` is `writable`) and return
  `job:{id,mode}` so the UI polls `/api/jobs/:id` before reloading the table.

## AI-agent jobs

Stored in `${LUXIPANEL_CONFIG_DIR}/cron/ai-agents.json`. Provider/model mirror
the AI Assistant; `projectId` reuses an Assistant project (cwd + instructions),
while `projectPaths` (what the UI sets; `projectPath` mirrors the first entry
for back-compat/display) points at git projects detected by the Files module
(`GET /api/files/projects`). Each path becomes the agent's working directory
(`cwd` option of `agentService.run`; a resolved `projectId` path takes
precedence). With MORE than one path, each run executes the task once PER
project, independently and in parallel — own cwd and own log file
(`<ts>-pN.log`); job status aggregates (any error ⇒ error) and the chain
fires once after all project runs finish. `category`/`tags` are free-form
metadata for the UI filters. Reusable presets (categories, tags, named rule
snippets) live in `cron/agent-presets.json` (`agent-presets.repository.ts`,
one document per panel/hosting user; legacy `default` is migrated on admin read) and are served via
`GET/PUT /api/cron/agent-presets`; the UI offers them as selectors in the
agent dialog (settings UI = ViewSettingsModal in the panel navbar's
title-actions slot). Each tag preset belongs to a category
(`{name, category}`; legacy plain strings are normalized on read) and the
tag selectors (dialog, filters, bulk bar) narrow to the selected category.
Jobs reference rule presets by id (`ruleIds`): the scheduler resolves them to
their CURRENT text at run time and prepends them to the job's ad-hoc `rules`,
so editing a preset updates every agent that selected it.

**Email reports** (`notifyEmails`): after each run the scheduler emits
`Events.SYSTEM_MAIL_SEND` (event bus — no cross-module import); the mail
module sends it with its panel-outbound identity (Mail → Configuración →
"Envío del panel": default mailbox account or external SMTP).

**Human approvals** (`requireApproval`): finishing a run creates a pending
approval (`approval.repository.ts`, sidecar `cron/approvals.json`, panel-host
store) with a single-use capability token. The report email links to the
PUBLIC page `GET/POST /api/cron-approvals/:token` (token-gated, no session;
the `/api/cron-approvals` prefix is outside the `/api/cron` auth gate):
APPROVE fires the deferred `nextJobId` chain, CHANGES re-runs the job with
the reviewer's feedback appended (and requests approval again), DENY stops
the flow. Links are TEMPORARY (24h expiry, see `APPROVAL_TTL_MS` in
`approval.repository.ts`) and their base is the panel's
CURRENT public origin (per-panel subdomain) learned from authenticated
requests via `shared/panel-url` (x-forwarded-host/proto; the frontend proxy
backfills them) — NOT a .env constant, since LUXIPANEL is multi-user/
multi-server; `PANEL_PUBLIC_URL` remains only as an explicit override. `POST /api/cron/ai-jobs/bulk` applies a partial patch
(`category`/`tags`/`agentMode`/`enabled`) to many jobs at once (multi-select
quick actions). `nextJobId` chains another agent job: when a run finishes
(any status), the scheduler triggers the chained job, skipping cycles and
already-running targets; chained jobs run even when paused (pausing only stops
the cron schedule, like "run now"). An empty `schedule` is allowed: the job
never fires on its own (the scheduler skips it) and exists only to be run
manually or as a chain target. `agentMode` ("single" default | "multi")
appends an execution directive to the prompt: "multi" tells the agent to fan
out parallel subagents (native in Claude CLI via its Task tool; best-effort
on other providers), "single" forbids them.
The scheduler (`ai-cron-scheduler.service.ts`) polls every 60s, runs due jobs
against `localExecutor` through `agentService.run`, and the allowed tools come
from `assistantModulesService.allowedTools` — so the agent's powers over a
module are granted/revoked from **AI Assistant → Modules**, not here.

## Services

| Service | Purpose |
|---------|---------|
| `cron-parser.service.ts` | Parse/build/validate/describe crontab; wrapper format; read/write via `Executor` (SFTP-staged `crontab <file>`) |
| `cron-daemon.service.ts` | Install package + service + wrapper (packageInstaller) |
| `cron-log.service.ts` | List/read/rotate per-execution `.log` files via executor |
| `ai-cron-scheduler.service.ts` | In-process scheduler for AI-agent jobs |

## Agent capability

`agent-capability.ts` exposes the FULL module to the AI Assistant, gated by
the Assistant's module-access sidecar: classic crontab CRUD (`cron.list` read;
`cron.add/update/toggle/remove` actions), scheduled AI-agent jobs CRUD +
oversight (`cron.ai_list/ai_logs/ai_read_log` read; `cron.ai_add/ai_update/
ai_remove/ai_run/ai_toggle` actions) and the module presets (`cron.presets_get`
read; `cron.presets_set` replace-document action). The cron page has an AI
quick-ask bar (like the Files module) that seeds the floating assistant with
module context so users can drive all of this in natural language.
