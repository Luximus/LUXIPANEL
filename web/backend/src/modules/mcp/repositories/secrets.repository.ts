// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP Secrets Repository — CRUD operations for encrypted MCP configuration
 *
 * NOTE: This is a stub implementation. Full implementation requires:
 * - Define Drizzle schema for panel_mcp_secrets table
 * - Use db.select().from() pattern like other repositories
 *
 * For now, storing in settings with encrypted value
 */

import { settingsRepository } from "../../admin/repositories/index.js";
import { secretManagerService } from "../services/secret-manager.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { runOnPanelHost } from "../../../shared/executor/index.js";

const log = createModuleLogger("mcp-secrets-repo");

// MCP registration + its ENCRYPTED secrets are INSTANCE state (panel host),
// not per-server: the runtime bootstrap reads them at boot with no server
// connected. Persisting via the request's tenant executor wrote them to the
// connected customer's VPS sidecar — leaking secrets cross-tenant and making
// them invisible to the next boot. Pin every read/write to the panel host via
// `runOnPanelHost` (settingsRepository resolves the executor from context).
export const secretsRepository = {
  /**
   * Save encrypted MCP configuration in settings
   */
  async save(extensionId: string, plainConfig: Record<string, string>): Promise<void> {
    const plaintext = JSON.stringify(plainConfig);
    const { encrypted, keyId } = await secretManagerService.encrypt(plaintext);

    return runOnPanelHost(async () => {
      try {
        // Store encrypted config in settings with base64 encoding for text storage
        const encodedConfig = encrypted.toString("base64");
        await settingsRepository.set(`mcp.${extensionId}.secrets`, encodedConfig, "mcp-extensions");
        await settingsRepository.set(`mcp.${extensionId}.keyId`, keyId, "mcp-extensions");
        log.info({ extensionId }, "Saved MCP secrets");
      } catch (err) {
        log.error({ err, extensionId }, "Failed to save MCP secrets");
        throw err;
      }
    });
  },

  /**
   * Retrieve and decrypt MCP configuration
   */
  async get(extensionId: string): Promise<Record<string, string> | null> {
    return runOnPanelHost(async () => {
      try {
        const encodedConfig = await settingsRepository.get(`mcp.${extensionId}.secrets`);
        const keyId = await settingsRepository.get(`mcp.${extensionId}.keyId`);

        if (!encodedConfig || !keyId) {
          return null;
        }

        const encrypted = Buffer.from(encodedConfig, "base64");
        const plaintext = await secretManagerService.decrypt(encrypted, keyId);
        return JSON.parse(plaintext);
      } catch (err) {
        log.error({ err, extensionId }, "Failed to decrypt MCP secrets");
        throw err;
      }
    });
  },

  /**
   * Delete MCP secrets
   */
  async delete(extensionId: string): Promise<void> {
    return runOnPanelHost(async () => {
      try {
        // Delete from settings (would normally delete from panel_mcp_secrets table)
        await settingsRepository.delete(`mcp.${extensionId}.secrets`);
        await settingsRepository.delete(`mcp.${extensionId}.keyId`);
        log.info({ extensionId }, "Deleted MCP secrets");
      } catch (err) {
        log.error({ err, extensionId }, "Failed to delete MCP secrets");
        throw err;
      }
    });
  },

  /**
   * Check if secrets exist for extension
   */
  async exists(extensionId: string): Promise<boolean> {
    return runOnPanelHost(async () => {
      const val = await settingsRepository.get(`mcp.${extensionId}.secrets`);
      return val !== null;
    });
  },
};
