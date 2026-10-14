// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * System-stats snapshot bridge — lets consumers read the monitor module's
 * latest metrics snapshot WITHOUT a cross-module import (regla del repo:
 * módulos no se importan entre sí).
 *
 * Pattern: provider registry. The OWNER module (monitor) registers a callback
 * at boot (`registerMonitorModule` → `setStatsSnapshotProvider`); consumers
 * (e.g. ai-assistant's context service) call `getLatestStatsSnapshot()`.
 *
 * Fail-open: no provider registered (module disabled / early boot) → `null`,
 * exactly like `statsCollectorService.getLatest()` before the first sample.
 * The interface is intentionally the MINIMAL subset consumers rely on; the
 * monitor's full `StatsSnapshot` is structurally assignable to it.
 *
 * The registry mechanics live in `shared/provider-bridge.ts` (shared with
 * `module-state` and `panel-settings`); this bridge uses its fail-OPEN getter.
 */

import { createProviderBridge } from "../provider-bridge.js";

export interface SharedStatsSnapshot {
  memory: { usagePercent: number };
  disk: { usagePercent: number };
}

type StatsSnapshotProvider = () => SharedStatsSnapshot | null;

const bridge = createProviderBridge<StatsSnapshotProvider>(
  "system-stats: snapshot provider not registered (monitor module not booted)",
);

/** Called ONCE at boot by the owning module (monitor). Idempotent. */
export function setStatsSnapshotProvider(fn: StatsSnapshotProvider): void {
  bridge.set(fn);
}

/** Latest snapshot for the local scope, or `null` when unavailable. */
export function getLatestStatsSnapshot(): SharedStatsSnapshot | null {
  return bridge.getOrNull()?.() ?? null;
}
