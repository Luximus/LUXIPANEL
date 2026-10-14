// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hosting — AI agent capability.
 *
 * Read-only listing of hosting accounts on the target (safe fields only).
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { runWithExecutor } from "../../shared/executor/index.js";
import { readTenantUsage } from "../../shared/quota/quota-checker.js";
import { hostingService } from "./services/hosting.service.js";

export const hostingAgentCapability: AgentCapability = {
  moduleId: "hosting",
  version: 1,
  tools: [
    {
      name: "hosting.list_accounts",
      title: "Listar cuentas de hosting",
      description:
        "List hosting accounts on this target. Returns username, status, plan, " +
        "disk quota, bandwidth quota, expiration. No password hashes.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          search: { type: "string", description: "Optional substring match on username/displayName" },
          limit: { type: "number", description: "Max rows (1-200), default 50" },
        },
      },
      handler: async (input) => {
        const executor = requireExecutor();
        const search = String((input as { search?: unknown })?.search ?? "") || undefined;
        const rawLimit = (input as { limit?: unknown })?.limit;
        const limit = typeof rawLimit === "number" && Number.isFinite(rawLimit)
          ? Math.max(1, Math.min(200, Math.floor(rawLimit)))
          : 50;
        // hostingService.list resolves via context executor internally — re-pin
        // it here so any nested call resolves to this target.
        const result = await runWithExecutor(executor, async () => {
          const { rows, total } = await hostingService.list({ search, limit });
          return {
            total,
            accounts: rows.map((a) => ({
              id: a.id,
              username: a.username,
              displayName: a.displayName,
              status: a.status,
              plan: a.plan,
              diskQuotaMb: a.diskQuotaMb,
              bandwidthQuotaMb: a.bandwidthQuotaMb,
              email: a.email,
              expiresAt: a.expiresAt,
            })),
          };
        });
        return { ok: true, output: result };
      },
    },
    {
      name: "hosting.list_audit",
      title: "Ver auditoría de una cuenta de hosting",
      description:
        "List the audit history (lifecycle + quota events) for one hosting " +
        "account on this target, newest first. Returns eventType, severity, " +
        "actor, context and timestamp.",
      kind: "read",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "number", description: "Hosting account id" },
          limit: { type: "number", description: "Max rows (1-100), default 50" },
        },
      },
      handler: async (input) => {
        const executor = requireExecutor();
        const rawId = (input as { id?: unknown })?.id;
        const id = typeof rawId === "number" && Number.isFinite(rawId) ? Math.floor(rawId) : NaN;
        if (!Number.isInteger(id) || id <= 0) {
          return { ok: false, output: "Se requiere un 'id' de cuenta válido" };
        }
        const rawLimit = (input as { limit?: unknown })?.limit;
        const limit = typeof rawLimit === "number" && Number.isFinite(rawLimit)
          ? Math.max(1, Math.min(100, Math.floor(rawLimit)))
          : 50;
        const result = await runWithExecutor(executor, () => hostingService.getAudit(id, limit));
        return { ok: true, output: result };
      },
    },
    {
      name: "hosting.account_stats",
      title: "Estadísticas de uso de una cuenta de hosting",
      description:
        "Return quota caps and live usage (disk via du/repquota, domains, " +
        "email accounts, databases, sub-users) for one hosting account on this " +
        "target. Mirrors GET /api/hosting/accounts/:id/stats.",
      kind: "read",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "number", description: "Hosting account id" },
        },
      },
      handler: async (input) => {
        const executor = requireExecutor();
        const rawId = (input as { id?: unknown })?.id;
        const id = typeof rawId === "number" && Number.isFinite(rawId) ? Math.floor(rawId) : NaN;
        if (!Number.isInteger(id) || id <= 0) {
          return { ok: false, output: "Se requiere un 'id' de cuenta válido" };
        }
        const result = await runWithExecutor(executor, async () => {
          const account = await hostingService.findById(id, executor);
          const usage =
            executor.target.id === "local"
              ? {
                  diskUsedMb: 0,
                  quotaMethod: "du-best-effort" as const,
                  domainsUsed: 0,
                  emailAccountsUsed: 0,
                  databasesUsed: 0,
                  subUsersUsed: 0,
                  warnings: [] as string[],
                }
              : await readTenantUsage(executor, account);
          const diskPercentUsed =
            account.diskQuotaMb > 0
              ? Math.min(100, Math.round((usage.diskUsedMb / account.diskQuotaMb) * 100))
              : 0;
          return {
            id: account.id,
            username: account.username,
            plan: account.plan,
            status: account.status,
            diskQuotaMb: account.diskQuotaMb,
            diskUsedMb: usage.diskUsedMb,
            diskPercentUsed,
            quotaMethod: usage.quotaMethod,
            bandwidthQuotaMb: account.bandwidthQuotaMb,
            bandwidthUsedMb: 0,
            maxDomains: account.maxDomains,
            domainsUsed: usage.domainsUsed,
            maxEmailAccounts: account.maxEmailAccounts,
            emailAccountsUsed: usage.emailAccountsUsed,
            maxDatabases: account.maxDatabases,
            databasesUsed: usage.databasesUsed,
            maxSubUsers: account.maxSubUsers,
            subUsersUsed: usage.subUsersUsed,
            warnings: usage.warnings,
            timestamp: new Date().toISOString(),
          };
        });
        return { ok: true, output: result };
      },
    },
  ],
  suggestedPrompts: [
    "¿Qué cuentas de hosting tengo? Muestra las primeras 20.",
    "Muéstrame la auditoría de la cuenta de hosting 1.",
  ],
};
