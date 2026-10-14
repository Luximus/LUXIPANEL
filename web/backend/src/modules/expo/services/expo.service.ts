// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo orchestration service — FACADE.
 *
 * Every operation runs on the CONNECTED server through the Executor, never on
 * the panel host (managed-mode isolation invariant). EAS CLI calls are wrapped
 * in `sh -lc` + `injectSudoIntoShellScript` (databases / nginx pattern); the
 * stored Expo access token is exported into the environment of every invocation
 * as EXPO_TOKEN. Store-account credential files (Google service-account JSON,
 * Apple .p8) are written via SFTP under the LUXIPANEL config dir with mode 0600
 * and referenced from eas.json submit profiles — credential bodies never travel
 * through argv.
 *
 * The implementation is split by responsibility under `services/expo/`:
 *   - `expo-shell.ts`         — shell/EAS execution primitives + dev-server helpers.
 *   - `expo-config-parse.ts`  — app config / eas.json parsing.
 *   - `expo-apps.service.ts`  — account, project discovery/info, scaffolding.
 *   - `expo-builds.service.ts`— builds, submit, OTA updates, quota.
 *   - `expo-dev-client.service.ts` — Metro dev-client tunnel.
 *   - `expo-env.service.ts`   — EAS environment variables.
 *   - `expo-credentials.service.ts` — store credentials, webhooks, devices.
 *
 * The GraphQL quota lookup lives in expo-api.service.ts.
 */

import { expoAppsService } from "./expo/expo-apps.service.js";
import { expoBuildsService } from "./expo/expo-builds.service.js";
import { expoCredentialsService } from "./expo/expo-credentials.service.js";
import { expoDevClientService } from "./expo/expo-dev-client.service.js";
import { expoDependenciesService } from "./expo/expo-dependencies.service.js";
import { expoEnvService } from "./expo/expo-env.service.js";

export { classifyDevClientFailure } from "./expo/expo-shell.js";
export type { DevClientFailure } from "./expo/expo-shell.js";

// ── Public surface ──────────────────────────────────────────────────────────

export const expoService = {
  ...expoAppsService,
  ...expoBuildsService,
  ...expoDevClientService,
  ...expoDependenciesService,
  ...expoEnvService,
  ...expoCredentialsService,
};
