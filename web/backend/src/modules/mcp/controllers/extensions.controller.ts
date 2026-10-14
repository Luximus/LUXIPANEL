// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP Extensions Controller — Install, configure, and manage MCPs
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { extensionRegistryService } from "../services/extension-registry.service.js";
import { secretsRepository } from "../repositories/secrets.repository.js";
import { auditRepository } from "../repositories/audit.repository.js";
import { mcpRuntimeService } from "../services/mcp-runtime.service.js";
import { mcpConnectionService } from "../services/mcp-connection.service.js";
import { mcpPolicyService, type AuthContext } from "../services/mcp-policy.service.js";
import { secretManagerService } from "../services/secret-manager.service.js";
import { AppError, ForbiddenError, ValidationError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { mcpMessage, safeMcpErrorMessage } from "./extensions-i18n.js";
import type { MCPInstallRequest, MCPTestConnectionResponse, MCPInstallResponse, MCPToolsResponse } from "../models/mcp.types.js";

const log = createModuleLogger("mcp-controller");

// Helper: Validate extension ID format
function validateExtensionId(id: string, locale: unknown): void {
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new ValidationError(mcpMessage(locale, "invalidExtensionId"));
  }
}

// Helper: Validate tool name format
function validateToolName(name: string, locale: unknown): void {
  if (!/^[a-z0-9_.-]+$/i.test(name)) {
    throw new ValidationError(mcpMessage(locale, "invalidToolName"));
  }
}

// Helper: derive the MCP authorization context from the session.
// Session identity lives on `res.locals.user` ({ userId, kind, ... }) set by
// the session middleware — NOT `req.user` (which is undefined here, making
// isAdmin always undefined and denying every MCP call). Admin = kind "admin".
function buildAuthContext(res: Response): AuthContext {
  const sessionUser = res.locals.user;
  return {
    userId: sessionUser?.userId,
    isAdmin: sessionUser?.kind === "admin",
  };
}

type ResolvedExtension = NonNullable<ReturnType<typeof extensionRegistryService.getById>>;

// Shared preamble for every `/:id` handler: resolve the extension (404 if
// unknown), optionally enforce it is an MCP server, and derive the auth
// context. The id/tool-name FORMAT checks stay in each handler so their exact
// ordering/precedence is preserved. Authorization also stays per-handler: 4
// endpoints gate on `canUseExtension`, `call-tool` gates on `canCallTool`, each
// with its own message.
function resolveExtension(
  id: string,
  res: Response,
  opts: { requireMcpKind?: boolean } = {},
): { ext: ResolvedExtension; authContext: AuthContext } {
  const ext = extensionRegistryService.getById(id);
  if (!ext) throw new AppError(mcpMessage(res.locals.locale, "extensionNotFound"), 404, ErrorCodes.NOT_FOUND);
  if (opts.requireMcpKind && ext.kind !== "mcp_server") {
    throw new ForbiddenError(mcpMessage(res.locals.locale, "mcpOnly"));
  }
  const authContext = buildAuthContext(res);
  return { ext, authContext };
}

export const extensionsController = {
  /**
   * POST /api/mcp/:id/install
   * Install and configure an MCP
   */
  install: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { config, secrets } = (req.body ?? {}) as MCPInstallRequest;

    // Validate extension ID format
    validateExtensionId(id, res.locals.locale);

    // Resolve extension (404), enforce MCP kind, derive auth context.
    const { ext, authContext } = resolveExtension(id, res, { requireMcpKind: true });

    // Check authorization
    if (!mcpPolicyService.canUseExtension(id, authContext)) {
      throw new ForbiddenError(mcpMessage(res.locals.locale, "accessDenied"));
    }

    // Validate config against extension schema
    if (ext.configFields) {
      for (const field of ext.configFields) {
        if (field.required && !config?.[field.key] && !secrets?.[field.key]) {
          throw new ValidationError(mcpMessage(res.locals.locale, "missingField", { field: field.key }));
        }
      }
    }

    // Filter config/secrets to the DECLARED schema keys. Persisted secrets are
    // handed to the spawned MCP child as `env` (mcp-connection.service), so an
    // undeclared extra key (`PATH`, `NODE_OPTIONS`, `LD_PRELOAD`, …) would
    // otherwise be injected into that process's environment. Only keep what the
    // extension's schema actually declares. (When no schema is declared we keep
    // the input untouched to avoid breaking schemaless extensions; the child-env
    // allowlist in mcp-connection is the backstop there.)
    const declaredKeys = new Set((ext.configFields ?? []).map((f) => f.key));
    const filterToSchema = <T extends Record<string, any> | undefined>(obj: T): Record<string, any> => {
      if (!obj) return {};
      if (declaredKeys.size === 0) return { ...obj };
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (declaredKeys.has(k)) out[k] = v;
        else log.warn({ id, key: k }, "Dropping undeclared config/secret key on install");
      }
      return out;
    };
    const cleanConfig = filterToSchema(config);
    const cleanSecrets = filterToSchema(secrets);

    // Limit config size to prevent DOS
    const fullConfig = { ...cleanConfig, ...cleanSecrets };
    if (JSON.stringify(fullConfig).length > 10000) {
      throw new ValidationError(mcpMessage(res.locals.locale, "configTooLarge"));
    }

    // Save encrypted secrets
    await secretsRepository.save(id, fullConfig);

    // Save non-secret config
    if (config && Object.keys(cleanConfig).length > 0) {
      await extensionRegistryService.setConfig(id, cleanConfig);
    }

    // Mark as installed
    await extensionRegistryService.enable(id);
    await extensionRegistryService.setStatus(id, "idle");

    log.info({ id }, "MCP installed and configured");

    res.json({
      ok: true,
      extensionId: id,
      status: "idle",
    } as MCPInstallResponse);
  }),

  /**
   * POST /api/mcp/:id/test-connection
   * Test MCP connectivity and validate configuration
   */
  testConnection: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };

    // Validate extension ID format
    validateExtensionId(id, res.locals.locale);

    // Resolve extension (404), enforce MCP kind, derive auth context.
    const { ext, authContext } = resolveExtension(id, res, { requireMcpKind: true });

    // Check authorization
    if (!mcpPolicyService.canUseExtension(id, authContext)) {
      throw new ForbiddenError(mcpMessage(res.locals.locale, "accessDenied"));
    }

    // Set status to "connecting"
    await extensionRegistryService.setStatus(id, "connecting");

    try {
      // Validate config (ext already loaded + null-checked above).
      const secrets = await secretsRepository.get(id);

      if (!secrets) {
        await extensionRegistryService.setStatus(id, "error", mcpMessage(res.locals.locale, "credentialsMissing"));
        res.json({
          ok: false,
          connected: false,
          error: mcpMessage(res.locals.locale, "credentialsMissing"),
        } as MCPTestConnectionResponse);
        return;
      }

      // Validate required fields based on extension
      if (ext.configFields) {
        for (const field of ext.configFields) {
          if (field.required && !secrets[field.key]) {
            const message = mcpMessage(res.locals.locale, "missingField", { field: field.key });
            await extensionRegistryService.setStatus(id, "error", message);
            res.json({
              ok: false,
              connected: false,
              error: message,
            } as MCPTestConnectionResponse);
            return;
          }
        }
      }

      // Attempt to connect to MCP
      await mcpRuntimeService.start(id);

      // Test if connection is healthy
      const isHealthy = await mcpConnectionService.healthCheck(id);
      if (!isHealthy) {
        throw new Error("Health check failed");
      }

      log.info({ id }, "MCP connection test passed");

      res.json({
        ok: true,
        connected: true,
        message: mcpMessage(res.locals.locale, "connected", { name: ext.name }),
      } as MCPTestConnectionResponse);
    } catch (err) {
      const errMsg = (err as Error).message;
      const safeErrorMsg = safeMcpErrorMessage(res.locals.locale, errMsg);
      await extensionRegistryService.setStatus(id, "error", safeErrorMsg);

      log.error({ err, id }, "MCP connection test failed");

      // Distinguish upstream failure from success for proxies/monitoring:
      // timeout → 504, any other connection failure → 502.
      res.status(/timeout|ETIMEDOUT|timed out/i.test(errMsg) ? 504 : 502).json({
        ok: false,
        connected: false,
        error: safeErrorMsg,
      } as MCPTestConnectionResponse);
    }
  }),

  /**
   * POST /api/mcp/:id/uninstall
   * Uninstall and remove MCP configuration (CSRF-protected, state-changing).
   */
  uninstall: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };

    // Validate extension ID format
    validateExtensionId(id, res.locals.locale);

    // Resolve extension (404) + derive auth context.
    const { ext, authContext } = resolveExtension(id, res);

    // Check authorization
    if (!mcpPolicyService.canUseExtension(id, authContext)) {
      throw new ForbiddenError(mcpMessage(res.locals.locale, "accessDenied"));
    }

    // Disable extension
    await extensionRegistryService.disable(id);

    // Delete encrypted secrets
    await secretsRepository.delete(id);

    log.info({ id }, "MCP uninstalled");

    res.json({ ok: true, message: mcpMessage(res.locals.locale, "uninstalled", { name: ext.name }) });
  }),

  /**
   * POST /api/mcp/:id/tools
   * List available tools from MCP
   */
  listTools: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };

    // Validate extension ID format
    validateExtensionId(id, res.locals.locale);

    // Resolve extension (404) + derive auth context.
    const { authContext } = resolveExtension(id, res);

    // Check authorization
    if (!mcpPolicyService.canUseExtension(id, authContext)) {
      throw new ForbiddenError(mcpMessage(res.locals.locale, "accessDenied"));
    }

    try {
      const tools = await mcpRuntimeService.getTools(id);
      const filteredTools = mcpPolicyService.filterTools(tools, authContext);
      log.debug({ id, toolCount: filteredTools.length }, "Listed tools from MCP");

      res.json({
        ok: true,
        tools: filteredTools,
      } as MCPToolsResponse);
    } catch (err) {
      const errMsg = (err as Error).message;
      const safeErrorMsg = safeMcpErrorMessage(res.locals.locale, errMsg);
      log.error({ err, id }, "Failed to list tools");

      res.status(/timeout|ETIMEDOUT|timed out/i.test(errMsg) ? 504 : 502).json({
        ok: false,
        error: safeErrorMsg,
        tools: [],
      });
    }
  }),

  /**
   * POST /api/mcp/:id/call-tool/:toolName
   * Execute a tool from MCP
   */
  callTool: asyncHandler(async (req: Request, res: Response) => {
    const { id, toolName } = req.params as { id: string; toolName: string };
    const { arguments: args } = (req.body ?? {}) as { arguments?: Record<string, any> };

    // Validate extension ID and tool name format
    validateExtensionId(id, res.locals.locale);
    validateToolName(toolName, res.locals.locale);

    // Resolve extension (404) + derive auth context.
    const { authContext } = resolveExtension(id, res);

    // Check authorization
    if (!mcpPolicyService.canCallTool(id, toolName, authContext)) {
      throw new ForbiddenError(mcpMessage(res.locals.locale, "accessDenied"));
    }

    const startTime = Date.now();

    try {
      const result = await mcpRuntimeService.callTool(id, toolName, args || {});
      const duration = Date.now() - startTime;

      // Mask sensitive arguments before logging
      const maskedArgs = args ? secretManagerService.maskSecrets(args) : null;
      await auditRepository.logToolCall(id, toolName, authContext.userId || null, maskedArgs, result, null, duration);

      log.info({ id, toolName, duration }, "Tool executed successfully");

      res.json({
        ok: true,
        result,
        duration,
      });
    } catch (err) {
      const duration = Date.now() - startTime;
      const errMsg = (err as Error).message;
      const safeErrorMsg = safeMcpErrorMessage(res.locals.locale, errMsg);

      // Mask sensitive arguments before logging
      const maskedArgs = args ? secretManagerService.maskSecrets(args) : null;
      await auditRepository.logToolCall(id, toolName, authContext.userId || null, maskedArgs, null, safeErrorMsg, duration);

      log.error({ err, id, toolName }, "MCP tool execution failed");

      res.status(/timeout|ETIMEDOUT|timed out/i.test(errMsg) ? 504 : 502).json({
        ok: false,
        error: safeErrorMsg,
        duration,
      });
    }
  }),
};
