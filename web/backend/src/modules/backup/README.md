# Backups

The module creates `.tar.gz` archives on the connected server. A manual job
returns `202 { jobId }`; the UI polls its status. The scheduler runs enabled
cron plans on the panel host and, when
`BACKUP_SCHEDULER_REMOTE_TARGETS=true`, on enabled remote vault targets.
Each target uses its own executor, policy, jobs, schedules, and storage targets.

## Sources and destinations

Manual and scheduled backups can include selected MySQL/MariaDB or PostgreSQL
databases, mail data, panel configuration, chosen absolute paths, or the curated
full-server selection. The target engine builds the archive in the server's
configured local folder (default `/var/backups/luxipanel`). Cloud destinations
use the target's `aws` CLI to upload to S3 or R2. A successful upload removes
the temporary local archive. A failed upload leaves the archive locally and
marks the job failed with the actual upload error.

S3/R2 credentials are managed in Settings → Credentials and resolved when a
target is used. Scheduled jobs resolve their storage target at run time, so
credential rotation applies without editing every schedule.

## API

All routes require an authenticated user with the Backups module; mutations
also require CSRF protection.

| Method | Route | Result |
| --- | --- | --- |
| GET, POST | `/api/backups` | Merged job/archive history; start manual backup |
| GET | `/api/backups/:id` | Manual job or local archive detail |
| GET | `/api/backups/:id/download` | Stream a local archive |
| DELETE | `/api/backups/:id` | Delete a local archive, or remove a cloud/failed record from history |
| GET, PUT | `/api/backups/config` | Read policy; update `defaultRetainCount` |
| POST | `/api/backups/config/directory/preview` | Count managed archives in old and new folders |
| POST | `/api/backups/config/directory` | Confirmed folder change with local archive deletion |
| GET, POST, PUT, DELETE | `/api/backups/schedules[/:id]` | Manage schedules |
| GET, POST, PUT, DELETE | `/api/backups/storages[/:id]` | Manage S3/R2 destinations |

The policy lives in the per-server `backup-config.json` sidecar under the
configured LUXIPANEL config directory. `localDir` is an absolute, canonical
data path; `defaultRetainCount` is an integer from 1 to 365. The old generic
`backup_dir` and `backup_retention_days` settings are not runtime policy:
they were panel-level UI values and cannot safely be mapped to a server.

Changing folders requires the current path, the previewed archive count, and
`confirmDelete: true`. The server rejects overlapping folders, a nonempty
new backup folder, or a backup in progress. It deletes only archives matching
LuxiPanel's generated filename pattern directly in the previous folder,
removes local history, and leaves S3/R2 objects and records untouched. If a
deletion fails, the previous folder remains configured and the error includes
the completed/total count. Other files in the folder are never deleted.

## Retention and history

Retention is a **number of local copies**, not days. Successful manual backups
use `defaultRetainCount`; each schedule keeps its own `retainCount`. The
default also initializes new schedules when the request omits a count.
After a successful local backup, the module records its origin in the
per-server `backup-archive-index.json` sidecar and removes older tracked
archives from the same manual/schedule group. Legacy archives without a
verified origin remain visible and require manual deletion or the confirmed
folder change. Cloud object lifecycle is configured with the provider.

The list combines manual history, scheduled jobs, and archives found on disk.
Completed local job records whose archive is gone are omitted. Cloud records
remain visible; deleting such a row removes the record only, not the remote
object. Download is available only for local archives.

## Verification

Run `pnpm typecheck` and the backup service tests in `backend/`. The frontend
is built with `pnpm build` in `frontend/`. Check the drawer, schedule CRUD,
history actions, target switching, folder preview/confirmation, and partial
deletion errors in the browser.
