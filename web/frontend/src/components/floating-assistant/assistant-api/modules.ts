// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap, type ApiResponse } from "@/lib/api-client";
import type { AssistantProviderId } from "./providers";

// ── Modules / capabilities ────────────────────────────────────────────────

export interface ModuleToolDescriptor {
  name: string;
  title: string;
  description: string;
  kind: "read" | "action";
  dangerous: boolean;
  permission?: string;
  enabled: boolean;
  requireConfirm: boolean;
}

export interface ModuleDataPanelDescriptor {
  name: string;
  title: string;
  description: string;
  ttlSeconds?: number;
}

export interface ResolvedModule {
  moduleId: string;
  catalogModuleId?: string;
  revision?: string;
  coverage?: { operations: number; tools: number };
  enabled: boolean;
  tools: ModuleToolDescriptor[];
  dataPanels: ModuleDataPanelDescriptor[];
  suggestedPrompts: string[];
}

interface ModulesEnvelope {
  ok: boolean;
  modules: ResolvedModule[];
}

// ── Audit + health ────────────────────────────────────────────────────────

export interface AuditEntry {
  id?: string | number;
  ts: string;
  provider: string;
  tool: string;
  success: boolean;
  durationMs: number;
  userId?: string;
  /** Cross-server access record (built from LUXIPANEL-local data only). Present
   *  for `servers.*` tools that reached a server other than the connected one. */
  kind?: "cross-server";
  username?: string;
  targetServerId?: string;
  targetServerName?: string;
  targetHost?: string;
  linuxUser?: string;
}

export interface ProviderPing {
  ok: boolean;
  detail?: string;
}

export const assistantAuditApi = {
  async list(limit = 100): Promise<AuditEntry[]> {
    const res = await api.get<{ ok: boolean; entries: AuditEntry[] }>(
      `/api/ai/audit?limit=${limit}`,
    );
    return unwrap(res, "Failed to load audit log").entries;
  },
  async health(): Promise<ProviderPing> {
    const res = await api.get<{ ok: boolean; ping: ProviderPing }>("/api/ai/health");
    return unwrap(res, "Failed to ping provider").ping;
  },
};

// ── CLI install / status ──────────────────────────────────────────────────

export interface CliStatus {
  installed: boolean;
  loggedIn: boolean;
  binPath?: string;
  version?: string;
  detail?: string;
}
export interface CliSpec {
  id: AssistantProviderId;
  bin: string;
  installCmd: string;
  supported: boolean;
  managedByTerminal?: boolean;
}

// ── MCP token + config ────────────────────────────────────────────────────

export interface McpConfigSnippet {
  path: string;
  format: "json" | "toml";
  snippet: string;
}

export interface McpInstallResult {
  ok: boolean;
  path: string;
  detail: string;
}

export interface McpTokenResponse {
  ok: boolean;
  token: string;
  expiresAt: number;
  mcpUrl: string;
  protocolVersion: string;
  config: McpConfigSnippet | null;
  install?: McpInstallResult;
}

/** Result of `POST /api/ai/mcp/repair` (re-mint + reinstall the MCP token for
 *  the connected server after a stale-session banner). Flat body (no `data`
 *  wrapper), so the api-client surfaces it verbatim on `res.data`. */
export interface McpRepairResult {
  ok: boolean;
  detail: string;
  provider: string;
  reinstalled: boolean;
  /** Epoch seconds of the freshly minted token. */
  expiresAt: number;
  install?: McpInstallResult;
  /** ISO timestamp the backend stamped on the conversation meta (when a
   *  `conversationId` was passed) so the sticky banner can be dismissed. */
  mcpRepairedAt?: string;
}

export const assistantMcpApi = {
  /**
   * Mint a token + config snippet. When `install` is true, the panel also
   * writes the config straight into the target's CLI config file via SSH.
   */
  async mintToken(provider: AssistantProviderId, install = false): Promise<McpTokenResponse> {
    const qs = `provider=${encodeURIComponent(provider)}${install ? "&install=true" : ""}`;
    const res = await api.get<McpTokenResponse>(`/api/ai/mcp/tokens?${qs}`);
    return unwrap(res, "Failed to mint MCP token");
  },
  /**
   * Repair the connected server's MCP session (re-mint + reinstall the token).
   * Returns the raw `ApiResponse` so the caller can branch on the typed 428
   * `BRIDGE_SESSION_REQUIRED` (not connected → reconnect first) vs. a plain
   * `ok:false` failure whose `detail` explains what went wrong. Session-authed;
   * the api-client injects the tab bridge id + CSRF automatically.
   */
  repair(body: { provider?: AssistantProviderId; conversationId?: string } = {}): Promise<ApiResponse<McpRepairResult>> {
    return api.post<McpRepairResult>("/api/ai/mcp/repair", body);
  },
};

export const assistantCliApi = {
  async specs(): Promise<CliSpec[]> {
    const res = await api.get<{ ok: boolean; specs: CliSpec[] }>("/api/ai/cli/specs");
    return unwrap(res, "Failed to load CLI specs").specs;
  },
  async status(id: AssistantProviderId): Promise<CliStatus> {
    const res = await api.get<{ ok: boolean; status: CliStatus }>(`/api/ai/cli/${id}/status`);
    return unwrap(res, "Failed to probe CLI").status;
  },
};

export const assistantModulesApi = {
  async list(): Promise<ResolvedModule[]> {
    const res = await api.get<ModulesEnvelope>("/api/ai/modules");
    return unwrap(res, "Failed to load modules").modules;
  },
  async setModule(id: string, enabled: boolean): Promise<ResolvedModule[]> {
    const res = await api.put<ModulesEnvelope>(`/api/ai/modules/${id}`, { enabled });
    return unwrap(res, "Failed to toggle module").modules;
  },
  async setTool(
    moduleId: string,
    toolName: string,
    patch: { enabled?: boolean; requireConfirm?: boolean },
  ): Promise<ResolvedModule[]> {
    const tail = encodeURIComponent(toolName);
    const res = await api.put<ModulesEnvelope>(
      `/api/ai/modules/${moduleId}/tools/${tail}`,
      patch,
    );
    return unwrap(res, "Failed to toggle tool").modules;
  },
};
