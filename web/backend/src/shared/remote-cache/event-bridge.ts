// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/remote-cache/event-bridge.ts — wire the event bus to targeted
 * cache refreshes for the few mutation paths that DO NOT go through
 * `dataStore` (the data-store mutators already trigger `scheduleRefresh`
 * by themselves).
 *
 * This is redundancy / defense-in-depth: covers cases like settings sync
 * from LP-LICENSE-SERVER that write the sidecar via `remoteConfig.write`
 * directly. The listener uses `getContextExecutor()` because events fire
 * from inside a request — if the panel is processing a settings sync, the
 * per-request executor is already bound via AsyncLocalStorage.
 *
 * Fail-open: a missing executor (events fired from boot/timer contexts) is
 * silently ignored — the engine will pick the change up on its next tick.
 */

import { eventBus, Events } from "../events/index.js";
import { getContextExecutor } from "../executor/context.js";
import { createModuleLogger } from "../logger/index.js";

import { scheduleRefresh } from "./refresh.js";

const log = createModuleLogger("remote-cache.event-bridge");

const MAPPINGS: ReadonlyArray<{
  event: string;
  module: string;
  collection: string;
}> = [
  // Settings sync (LP overlay): admin/settings sidecar may be written
  // outside dataStore via remoteConfig.
  { event: Events.SETTINGS_UPDATED, module: "admin", collection: "settings" },

  // Linux system users / groups — when a panel module creates/edits a user
  // (useradd / passwd), the engine's `getent` collector will see it on its
  // next tick anyway, but we kick a targeted refresh so it's instant.
  { event: Events.USER_CREATED, module: "users", collection: "system" },
  { event: Events.USER_UPDATED, module: "users", collection: "system" },
  { event: Events.USER_DELETED, module: "users", collection: "system" },
  { event: Events.ROLE_CREATED, module: "users", collection: "roles" },
  { event: Events.ROLE_UPDATED, module: "users", collection: "roles" },
  { event: Events.ROLE_DELETED, module: "users", collection: "roles" },

  // Mail accounts.
  { event: Events.ACCOUNT_CREATED, module: "mail", collection: "accounts" },
  { event: Events.ACCOUNT_UPDATED, module: "mail", collection: "accounts" },
  { event: Events.ACCOUNT_DELETED, module: "mail", collection: "accounts" },
];

let wired = false;

/**
 * Idempotent. Safe to call once at boot — subsequent calls are no-ops so
 * tests / hot reload don't accumulate listeners.
 */
export function wireRemoteCacheEventBridge(): void {
  if (wired) return;
  wired = true;
  for (const m of MAPPINGS) {
    eventBus.on(m.event, () => {
      const executor = getContextExecutor();
      if (!executor) return; // fired from boot/timer scope: engine picks it up on its tick
      void scheduleRefresh(executor, m.module, m.collection);
    });
  }
  log.info({ count: MAPPINGS.length }, "remote-cache event bridge wired");
}

/** Test seam. */
export function _resetEventBridgeForTests(): void {
  wired = false;
}
