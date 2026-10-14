# v2.0.1

First public source release of the current LUXIPANEL monorepo.

- `web/`: updated server and web workspace, Dev → LOG with separate core/module records, scoped evidence, configurable AI repair, attributed fork PRs, reviewed module/release lifecycle and safe manual updates.
- `desktop/`: current Electron direct-panel client with isolated connection profiles.
- `mobile/`: current native Expo client, direct server login, LOG submenu, repair actions and community/version notices.
- Example configuration uses user-supplied server connections and empty secrets. Signing, service accounts and publisher configuration are excluded.
- Official releases include the core and approved module bundle. Existing server state and module availability are preserved, and local edits/custom commits block replacement.

This release provides source archives for all clients. It does not submit signed store applications. See README.md, RELEASES.md and the per-client guides.
