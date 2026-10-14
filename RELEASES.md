# Releases and repository migration

`v2.0.1` is the first source release of this public monorepo, succeeding existing 2.0.0 web installations. `release.manifest.json` and `modules.lock.json` bind official module versions, source commits and built file hashes to one delivery. All client package versions are aligned in a release.

## Maintainer setup

After the reviewed pipeline code is on main, authenticate GitHub CLI as a repository administrator and run:

```sh
cd web
python3 scripts/github-release-setup.py --apply
```

This creates the modules branch/labels when missing and prepares review protection. Existing stronger protection is retained. The official workflows authenticate to LP with short-lived GitHub OIDC tokens: LP verifies the signature, audience, immutable repository/owner IDs, branch, event and exact workflow, with separate permissions for review, preparation and publication. No LP secret is required in GitHub. `LP_REVIEW_URL` optionally overrides the public authority endpoint. A dedicated `RUNNER_REVIEW_TOKEN` (at least 32 characters, different from the private administrator secret) is supported only for trusted manual runners. Keep the repository public so installations can read notices/releases anonymously.

`Module review` runs without private credentials. `Module review relay` checks the exact reviewed commit using trusted static analyzers and reports to LP. A merged module PR receives an authoritative semver and waits for delivery. `Prepare combined release` maintains one release PR, with approved modules stamped and hashed. `Publish combined release` verifies the merged delivery, creates the official tag/Release, promotes the delivered LP versions, and opens an announcement for comments. Publication retries are idempotent. The initial tag release has its own one-time workflow.

## Installations

Use the version settings or the update notice. The installer fetches the original repository, builds serially in a separate worktree, verifies the bundle, preserves private module previews and switches source/static paths together. Failed health checks restore the previous runtime and static paths. Environment and `/etc/luxipanel` data remain private. Installed/enabled modules and entitlements are not reset.

Local source edits or custom commits block automatic replacement. Resolve them or archive them explicitly before choosing a new official tag. Older flat-layout installations should use the one-time legacy migration helper; simply pulling the new unrelated repository history is insufficient. The helper preserves the old checkout and configuration and is run manually.

Desktop/mobile source is part of each Release. Signed installers, Play Store/App Store submissions and OTA updates require a separate explicit platform publication.
