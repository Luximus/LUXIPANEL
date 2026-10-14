# Contributing

Create fix/feature branches in your personal fork and open a PR against the appropriate official branch. Each official branch contains the complete monorepo.

| Target | Contributions |
| --- | --- |
| `web` | Server, backend and web frontend fixes/features |
| `desktop` | Electron client fixes/features |
| `mobile` | Native client fixes/features |
| `modules` | One community module per PR, confined to `web/modules/<id>/` |
| `developer` | Shared tooling, root/workflow files or changes spanning clients |
| `main` | Reviewed official releases only |

Register marketplace modules through Dev before review so ownership stays attributable to the original creator. Split mixed module/core contributions. Release scripts under `web/scripts/` are shared tooling and target `developer`. Individual fix/feature branches belong in personal forks.

Luximus manually merges client/shared PRs after checks. Work branches require checks and a PR, with zero formal approvals because GitHub forbids self-approval by the sole maintainer. Main retains one CODEOWNERS approval, including for administrators; release PRs are authored by the bot so the owner can approve them. Client contributions that pass post-merge CI and LP-approved module snapshots are automatically promoted to `developer`. Developer CI tests all clients sequentially, without publishing to stores or deploying production. Test an independent installation manually before approving the release.

The pipeline freezes the exact successful developer SHA and its approved module list into the sole temporary branch `lxp/release-next`. Stale/failed developer checks, changed module approval or different module source block preparation/publication. Full release checks and owner review precede a single SemVer release of all clients. Existing official tags are immutable. Internal baseline PRs are excluded from user contribution attribution.

After developer checks, the pipeline can sync a client baseline only while its head is an ancestor of that tested developer snapshot. Pending client commits are preserved; conflicts require maintainer resolution. Module baseline sync uses the temporary branch only while idle, updates released core files and preserves the exact `web/modules` tree. Internal baseline PRs bypass module contribution registration, never LP approval for actual modules.

Maintainer setup: `python3 web/scripts/configure-branches.py` previews branch protection and creation policy; `--apply` applies it using `GH_TOKEN` from your authenticated GitHub CLI. This changes only this repository. Review pipeline code before integration; retain main protection.

LOG supports optional repair targets `auto`, `web`, `desktop`, `mobile` or `developer`. Legacy empty/`main` values mean automatic routing. Core repairs start from the full developer monorepo, replay on the current target and run affected-client checks before pushing the verified commit to the user's fork. Module repairs always target `modules`. Failed replay/checks publish nothing. Merged contributions stay release-pending until included in an official Release; installations receive notices and update manually with local-change protection.

Follow the architecture of the application you change. Server modules use models → repositories → services → controllers → routes → index.ts; services do not use Express, effects go through Executor, and target/user state must stay scoped. Community modules use the SDK and declare their effects/capabilities. Consult `web/MODULE-SDK-SPEC.md`.

Use a real GitHub account for contributions. AI-assisted fixes retain the contributor's GitHub authorship and declare the assistance. Never include raw private logs, credentials, configuration, signing files or generated builds. Sanitize public reports and describe relevant verification. A CI failure or missing secret scan blocks automated publication.

Build/typecheck packages serially on shared hosts, with `NODE_OPTIONS=--max-old-space-size=2560`. Run focused tests for the change. Maintainers review PRs and the combined release PR; accepting a module PR prepares a version and does not itself publish it to installations.
