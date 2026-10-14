# Contributing

Fork this repository and open a pull request. Core/client changes target `main`. Community module changes target `modules` and must stay within `web/modules/<id>/`. Register new marketplace modules through Dev before review so ownership remains attributable to the original creator.

Follow the architecture of the application you change. Server modules use models → repositories → services → controllers → routes → index.ts; services do not use Express, effects go through Executor, and target/user state must stay scoped. Community modules use the SDK and declare their effects/capabilities. Consult `web/MODULE-SDK-SPEC.md`.

Use a real GitHub account for contributions. AI-assisted fixes retain the contributor's GitHub authorship and declare the assistance. Never include raw private logs, credentials, configuration, signing files or generated builds. Sanitize public reports and describe relevant verification. A CI failure or missing secret scan blocks automated publication.

Build/typecheck packages serially on shared hosts, with `NODE_OPTIONS=--max-old-space-size=2560`. Run focused tests for the change. Maintainers review PRs and the combined release PR; accepting a module PR prepares a version and does not itself publish it to installations.
