// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Panel settings write bridge — lets consumers persist a key in the panel
 * settings store (owned by the admin module's `settingsRepository`) WITHOUT a
 * cross-module import (regla del repo: módulos no se importan entre sí).
 *
 * Pattern: provider registry. The OWNER module (admin) registers the writer
 * at boot (`registerAdminModule` → `setPanelSettingsWriter`); consumers call
 * `writePanelSetting()` — same signature and await semantics as
 * `settingsRepository.set(key, value, category, description)`, resolving the
 * executor from context exactly like the repository does (run inside
 * `runOnPanelHost` for instance-level keys).
 *
 * With no writer registered the promise REJECTS (admin module not booted) —
 * a write must never be silently dropped.
 *
 * The registry mechanics live in `shared/provider-bridge.ts` (shared with
 * `module-state` and `system-stats`).
 */

import { createProviderBridge } from "../provider-bridge.js";

type PanelSettingsWriter = (
  key: string,
  value: string,
  category?: string,
  description?: string,
) => Promise<unknown>;

const bridge = createProviderBridge<PanelSettingsWriter>(
  "panel-settings: writer not registered (admin module not booted)",
);

/** Called ONCE at boot by the owning module (admin). Idempotent. */
export function setPanelSettingsWriter(fn: PanelSettingsWriter): void {
  bridge.set(fn);
}

/** Persist one setting. Rejects if the admin module has not booted yet. */
export async function writePanelSetting(
  key: string,
  value: string,
  category?: string,
  description?: string,
): Promise<void> {
  await bridge.get()(key, value, category, description);
}
