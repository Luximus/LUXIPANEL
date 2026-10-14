// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Module enabled-state bridge — lets consumers read the panel's module
 * enable/disable map (owned by the admin module's `moduleRegistryService`)
 * WITHOUT a cross-module import (regla del repo: módulos no se importan
 * entre sí).
 *
 * Pattern: provider registry. The OWNER module (admin) registers the callback
 * at boot (`registerAdminModule` → `setEnabledMapProvider`); consumers call
 * `getModuleEnabledMap()`.
 *
 * Fail-closed at the bridge, fail-open at the callers: with no provider the
 * promise REJECTS, and every consumer already treats a failed read as "keep
 * everything active" (same semantics as before the decoupling).
 *
 * The registry mechanics live in `shared/provider-bridge.ts` (shared with
 * `panel-settings` and `system-stats`).
 */

import { createProviderBridge } from "../provider-bridge.js";

type EnabledMapProvider = () => Promise<Record<string, boolean>>;

const bridge = createProviderBridge<EnabledMapProvider>(
  "module-state: enabled-map provider not registered (admin module not booted)",
);

/** Called ONCE at boot by the owning module (admin). Idempotent. */
export function setEnabledMapProvider(fn: EnabledMapProvider): void {
  bridge.set(fn);
}

/**
 * Enable/disable map of the GOVERNED panel modules (`id → enabled`) on the
 * context executor's server. Rejects if the admin module has not booted yet.
 */
export async function getModuleEnabledMap(): Promise<Record<string, boolean>> {
  return bridge.get()();
}

export interface ModuleCatalogEntry { id: string; name: string; description: string; kind?: "module" | "mcp_server"; dependencies?: string[]; }
let catalogProvider: (() => ModuleCatalogEntry[]) | undefined;
export function setModuleCatalogProvider(provider: () => ModuleCatalogEntry[]): void { catalogProvider = provider; }
export function getModuleCatalog(): ModuleCatalogEntry[] { return catalogProvider?.() ?? []; }
