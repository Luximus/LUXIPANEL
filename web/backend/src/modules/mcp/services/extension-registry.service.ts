// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Extension Registry — Unified catalog of modules + MCP servers
 *
 * Extends module-registry to include MCP definitions with kind field.
 */

import { notifyModulesChanged } from "../../../shared/module-state/lifecycle.js";
import { moduleRegistryService, type ModuleDefinition } from "../../admin/services/module-registry.service.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { runOnPanelHost } from "../../../shared/executor/index.js";

const log = createModuleLogger("extension-registry");

export interface ExtensionDefinition extends ModuleDefinition {
  kind?: "module" | "mcp_server";
  entrypoint?: string;
}

const KEY = (id: string, field: string) => `extension.${id}.${field}`;

export const extensionRegistryService = {
  /**
   * Get all extensions (modules + MCPs)
   */
  getAll(): ExtensionDefinition[] {
    // Use existing module registry which now has kind field
    return moduleRegistryService.getAll();
  },

  /**
   * Get extension by id
   */
  getById(id: string): ExtensionDefinition | undefined {
    return moduleRegistryService.getById(id);
  },

  /**
   * Get all MCPs only
   */
  getMCPs(): ExtensionDefinition[] {
    return this.getAll().filter((e) => e.kind === "mcp_server");
  },

  /**
   * Get all enabled extensions with their status
   */
  async getEnabledMap(): Promise<Record<string, boolean>> {
    return runOnPanelHost(async () => {
      const rows = await settingsRepository.getByCategory("extensions");
      const map: Record<string, boolean> = {};

      for (const ext of this.getAll()) {
        map[ext.id] = false;
      }

      for (const row of rows) {
        const match = row.key.match(/^extension\.(.+)\.enabled$/);
        if (match && match[1]) map[match[1]] = row.value === "true";
      }

      return map;
    });
  },

  /** Flip an extension's `enabled` flag (shared by enable/disable). */
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const ext = this.getById(id);
    if (!ext) throw new Error(`Unknown extension: ${id}`);
    const verb = enabled ? "enabled" : "disabled";
    await runOnPanelHost(() =>
      settingsRepository.set(KEY(id, "enabled"), String(enabled), "extensions", `Extension ${id} ${verb}`),
    );
    notifyModulesChanged(id);
    log.info({ id }, `Extension ${verb}`);
  },

  /**
   * Enable extension
   */
  async enable(id: string): Promise<void> {
    await this.setEnabled(id, true);
  },

  /**
   * Disable extension
   */
  async disable(id: string): Promise<void> {
    await this.setEnabled(id, false);
  },

  /**
   * Set extension status (for MCPs)
   */
  async setStatus(
    id: string,
    status: "idle" | "connecting" | "connected" | "error",
    error?: string,
  ): Promise<void> {
    await runOnPanelHost(async () => {
      await settingsRepository.set(KEY(id, "status"), status, "extensions");
      if (error) {
        await settingsRepository.set(KEY(id, "lastError"), error.slice(0, 500), "extensions");
      }
      if (status === "connected" || status === "error") {
        await settingsRepository.set(KEY(id, "lastHealthcheckAt"), new Date().toISOString(), "extensions");
      }
    });
    log.info({ id, status }, "Extension status updated");
  },

  /**
   * Set configuration for extension (non-secret)
   */
  async setConfig(id: string, config: Record<string, string>): Promise<void> {
    await runOnPanelHost(() =>
      settingsRepository.set(KEY(id, "config"), JSON.stringify(config), "extensions"),
    );
    notifyModulesChanged(id);
    log.info({ id }, "Extension config updated");
  },
};
