# LUXIPANEL contributor instructions
The public monorepo contains web/, desktop/ and mobile/. Each client configures its own dependencies. Read the relevant ARCHITECTURE.md before editing; preserve direct server login and target/session isolation. Use the codebase graph when available, otherwise search source. Run builds serially on shared servers. Source, tests and example configuration may be committed; credentials, stores/signing material, local data and generated output must stay ignored. Release delivery is reviewed and manual installation preserves local changes and module status.

Direct commits to an installable branch that introduce user-visible behavior must include public `LUXIPANEL-NOTES` metadata. For an already-published historical commit, add a reviewed exact-SHA entry to `web/backend/src/shared/github/legacy-change-notes.ts`; never derive public notes from internal commit subjects.

On shared servers, run memory-intensive validation serially across repositories: Astro check, TypeScript typecheck, Vitest, Playwright, and builds. Do not start these checks in parallel, including through Promise.allSettled or background shells. Stop temporary databases and browser processes after tests. If the assistant resource group reports pressure, inspect its cgroup before starting another heavy check.

Assistant builds and deployments on a target share `/run/lock/luxipanel-assistant-build.lock`. The `admin.bash` and `servers.exec` tools reserve it for recognized commands; when using a direct shell, hold the same `flock` for the full build or deployment.
