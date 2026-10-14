// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-target gating of which modules' agent capabilities the assistant can
 * actually use, and which tools require explicit user confirmation.
 *
 * Layout on the target:
 *   ${LUXIPANEL_CONFIG_DIR}/assistant/modules.json
 *
 * Defaults (when a moduleId or tool name is missing from the sidecar) are
 * computed from the capability registry:
 *   - module:  enabled  = true
 *   - tool:    enabled  = true  (regardless of kind)
 *              requireConfirm = (kind === "action") || dangerous
 */

export interface ModuleAccessToolEntry {
  enabled?: boolean;
  requireConfirm?: boolean;
}

export interface ModuleAccessEntry {
  enabled?: boolean;
  tools?: Record<string, ModuleAccessToolEntry>;
}

export interface ModuleAccessMap {
  [moduleId: string]: ModuleAccessEntry;
}
