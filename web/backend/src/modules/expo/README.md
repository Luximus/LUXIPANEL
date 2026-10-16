# Expo module

Manage Expo / React Native apps of the **connected server** from the panel:
EAS builds, store submissions, OTA updates, dev-client QR for real-time testing,
env variables, build quota and store-account credentials.

## Execution model

Every operation runs on the **connected server** via the `Executor`
(selected-target isolation invariant). The local target is the panel host; remote targets execute over direct SSH. EAS CLI calls are
wrapped in `sh -lc` + `injectSudoIntoShellScript` (databases / nginx pattern);
the stored Expo access token is exported into the environment of every `eas`
invocation as `EXPO_TOKEN` (inside the script body, never in argv) and used as
the Bearer for the Expo GraphQL API.

## Secrets

- **Access token** — stored via `settingsRepository`, category `expo`, key
  `expo_token`. Added to `HIDDEN_SETTING_KEYS` so `GET /api/settings` can't leak
  it. Only ever returned masked.
- **Store-account credential files** — Google Play service-account JSON and
  Apple ASC `.p8` are written via SFTP under
  `${LUXIPANEL_CONFIG_DIR}/expo/credentials` on the connected server with mode
  `0600` (bodies never travel through argv) and referenced from `eas.json`
  submit profiles.

## Surface

- HTTP: `router.use("/api/expo", requireAuth, requireModule("expo"))` — GET for
  reads, `csrfProtection` on mutations. See `routes/expo.routes.ts`.
- AI assistant: `expoAgentCapability` (`agent-capability.ts`) exposes the same
  operations as `expo.*` tools so the assistant can drive Expo.

## Files

- `models/` — Zod schemas + domain types.
- `services/expo-config.service.ts` — token storage.
- `services/expo-api.service.ts` — Expo GraphQL (quota / account).
- `services/expo.service.ts` — **facade**: re-exports `expoService` (+
  `classifyDevClientFailure` / `DevClientFailure`). The EAS CLI orchestration is
  split by responsibility under `services/expo/`:
  - `expo-shell.ts` — shell/EAS exec primitives + Metro dev-server helpers.
  - `expo-config-parse.ts` — app config / eas.json parsing.
  - `expo-apps.service.ts` — account, project discovery/info, scaffolding.
    Discovery shows one row per EAS project ID when several local checkouts
    share it; the checkout with installed Expo dependencies is preferred.
    Unlinked local projects keep separate rows. A `.luxipanel-expo-ignore`
    file excludes its directory and descendants from discovery, including an
    explicitly scanned root; use it on archive/audit trees instead of deleting
    pending review work. This is a catalog filter, not an authorization rule.
    Static `app.config.local.json` overrides supply local Expo identity without
    publishing it in `app.json`; discovery, project details and EAS queries use
    the same merged metadata. No JavaScript config is evaluated during reads.
  - `expo-builds.service.ts` — builds, submit, OTA updates, quota.
  - `expo-dev-client.service.ts` — Metro dev-client tunnel.
  - `expo-dependencies.service.ts` — checks local `expo` and `@expo/ngrok` for
    each detected project and runs the administrator-triggered package install
    in a detached systemd unit on the connected server. The project list blocks
    QR until both packages resolve; the start endpoint checks again before
    launching Metro.
  - `expo-env.service.ts` — EAS environment variables.
  - `expo-credentials.service.ts` — store credentials, webhooks, devices.
- `controllers/` — HTTP handlers (`getExecutor(req)`).
- `routes/` — `/api/expo` router.
- `agent-capability.ts` — `expo.*` assistant tools.
- `index.ts` — `registerExpoModule(app)`.

> **No `repositories/` layer.** Expo keeps no per-server `dataStore` collection:
> its only persisted state is the access token (via the shared admin
> `settingsRepository`) plus credential FILES on the connected server. Live app /
> build / env state is read on demand from the EAS CLI + Expo GraphQL API, never
> mirrored into a sidecar — so there is nothing for a repository to wrap.

## v1 limitations

- `eas env:create` value goes via `--value` (the CLI has no stdin mode).
- Dev-client QR capture is best-effort from the Metro startup banner; Metro
  keeps running on the connected server after the bounded startup window.
- `POST /api/expo/dependencies/install` starts an install with the project's
  lockfile package manager; `POST /api/expo/dependencies/status` polls the
  result. Installation can update the project's package manifest and lockfile.
- Quota relies on the Expo GraphQL `Account` subscription; when the schema
  doesn't expose usage metrics it falls back to a CLI build count for the month.
