# Contributing

Create contribution branches in your personal fork. The official repository has three permanent branches; each contains the complete monorepo.

| Target | Contributions |
| --- | --- |
| `developer` | Web, backend, desktop, mobile, shared tooling and workflows |
| `modules` | One community module per PR, confined to `web/modules/<id>/` |
| `main` | Reviewed, stable combined releases |

Folders, `area:*` labels and CODEOWNERS identify each area. Conventional PR titles (`fix:`, `feat:`, `docs:`, etc.) receive `type:*` labels. Additional maintainers can be assigned to their paths in CODEOWNERS as the team grows. Individual fix and feature branches belong in personal forks. Register marketplace modules through Dev before review so ownership stays attributable to the original creator; split mixed module/core contributions.

Luximus manually merges contributions after checks. Work branches use zero formal approvals because GitHub forbids self-approval by the sole maintainer. Main retains one CODEOWNERS approval, including for administrators; official release PRs are authored by the bot so the owner can approve them. Developer accepts trusted bot promotions; full CI gates release preparation. Module approval in LP and publication are separate steps. Builds test all clients sequentially without deploying production or publishing to stores. Test an independent installation manually before approving a release.

## Frozen releases

The pipeline freezes a successful developer commit and the exact LP-approved module version IDs into `release/<version>`, with its test run and source recorded in `release.provenance.json`. Developer can advance while the candidate remains frozen. Publication verifies the recorded test artifact, unchanged source, still-approved exact module versions, full release checks and owner review. Approval of a newer module version does not invalidate an older frozen version. Revoking its approval blocks publication. All clients share one SemVer version; existing tags are immutable.

Only the latest stable release is supported. There is one active release candidate. Normal candidates derive from developer; urgent fixes derive from the last official stable tag so unfinished features cannot leak into a hotfix.

## Urgent hotfixes

Run **Prepare combined release** on `main` with mode `hotfix` and exactly one of:

- `pull_request`: the number of a reviewed, merged developer PR whose isolated patch applies cleanly to stable.
- `module_version_ids`: comma-separated approved LP version UUIDs for modules already present in stable.

The bot first prepares and validates the isolated patch. Conflicts stop preparation before replacing an active normal candidate. A valid urgent fix closes and records the old candidate's SHA/PR, preserving its source in developer, then tests `hotfix/<version>`. Successful checks freeze its metadata and open a reviewed main PR. After publication, main is integrated into developer, and a new normal candidate includes pending development. Original contribution PRs and module authorship remain recorded. Published candidate branches are removed only when their head still matches the reviewed SHA.

`automation/modules-baseline` is an ephemeral bot PR that updates the module branch's released core baseline while preserving its exact `web/modules` subtree. Internal baseline PRs are excluded from user contribution attribution and never bypass approval for actual module changes.

## Maintainer setup and migration

`python3 web/scripts/configure-branches.py` previews repository-specific protection, labels and allowed branches; `--apply` applies it using `GH_TOKEN` from the authenticated GitHub CLI. Main requires `release-checks`, a current branch and one owner approval. Force pushes and deletion remain prohibited on all permanent branches.

The legacy `web`, `desktop`, `mobile` and `lxp/release-next` refs exist only during migration. Once this pipeline is reviewed and verified on main, run `configure-branches.py --apply --retire-legacy`. It refuses deletion unless main contains the three-branch policy, all commits are preserved in main/developer and no open PR uses the branch. `lxp/release-next` is only the initial bootstrap PR, never a permanent release channel.

## LOG and architecture

LOG's optional `auto`, `web`, `desktop`, `mobile` and `developer` values select the affected area and validation. Every core/client repair opens a PR against developer; module repairs target modules. AI repairs use isolated worktrees, replay against the current target and run affected-client checks before pushing to the user's fork. Failed replay, verification or secret scans publish nothing. Accepting a module PR prepares its version and does not publish it to installations.

Follow the affected application's architecture: models → repositories → services → controllers → routes → index.ts. Services do not use Express, effects go through Executor, and target/user state stays scoped. Community modules use the SDK and declare effects/capabilities; consult `web/MODULE-SDK-SPEC.md`.

Use a real GitHub account. AI-assisted fixes retain contributor authorship and declare assistance. Do not include private logs, credentials, configuration, signing files or generated builds. Preserve the contribution license and DCO requirements in [web/CONTRIBUTING.md](web/CONTRIBUTING.md).

Build/typecheck packages serially on shared hosts with `NODE_OPTIONS=--max-old-space-size=2560`. Run focused tests for the change. Installations receive release notices and update manually with local-change protection.
