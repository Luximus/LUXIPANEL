# Dev → LOG

LUXIPANEL logs describe this panel installation. Module logs are stored through the selected Executor under a verified user and server, with module id/version and execution/tests/report origin. Unknown ownership is never inferred from a shared installation account key. Public reports are imported only for verified owned project links; module execution is scoped to the actual caller.

Manual repair and public report actions require the local installation administrator. Configure an API-mode agent and a personal GitHub credential. Automatic repair is disabled initially, starts only for new selected-severity events, ignores historical reports, deduplicates incidents per version, and has a daily safety limit in addition to token/time budgets. Anonymous browser telemetry cannot launch an agent. Administrator authority is rechecked before execution/publication.

The agent can read sanitized evidence in pages and edit only its repair worktree. A module job writes only its own module. Verification runs in Bubblewrap without host credentials/services and without network during checks; dependency installation disables hooks. Source containing recognized credentials, invalid/private paths or changed verification results is not published.

GitHub publication verifies the contributor account, creates/reuses their fork, pushes an attributed commit and opens a PR to the original repository. Jobs distinguish PR review, accepted/pending Release, available and installed. Reports/announcements/comments use public GitHub data, and read cursors are separate for local, SSH and tenant principals.
