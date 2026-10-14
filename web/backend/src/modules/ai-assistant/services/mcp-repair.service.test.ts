// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests for the MCP repair service.
 *
 * Covers the real-fix contract:
 *   - `mintLongLivedMcpToken` carries the session's `bridgeSessionId` into the
 *     token and returns `expiresAt` in seconds-since-epoch.
 *   - `repair` reinstalls a fresh token into the target CLI config for a CLI
 *     provider, defaults the provider from config, no-ops the reinstall for an
 *     API-only provider, and reports `ok:false` when the reinstall fails.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// config/env fail-fasts on missing env (transitively imported via the logger).
process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";

const signWithExpiry = vi.fn(() => ({ token: "minted.jwt", expiresAt: 0 }));
vi.mock("../../auth/services/token.service.js", () => ({
  tokenService: { signWithExpiry: (...a: unknown[]) => signWithExpiry(...(a as [])) },
}));

const install = vi.fn(async () => ({ ok: true, path: "/root/.claude.json", detail: "Configurado" }));
const supported = new Set(["claude", "gemini", "codex"]);
vi.mock("./mcp-config-writer.service.js", () => ({
  mcpConfigWriterService: { install: (...a: unknown[]) => install(...(a as [])) },
  supportsMcpAutoInstall: (p: string) => supported.has(p),
}));

const load = vi.fn(async () => ({ activeProvider: "claude" }));
vi.mock("../repositories/assistant-config.repository.js", () => ({
  assistantConfigRepository: { load: (...a: unknown[]) => load(...(a as [])) },
}));

import {
  mcpRepairService,
  mintLongLivedMcpToken,
  type McpTokenSession,
} from "./mcp-repair.service.js";
import type { Executor } from "../../../shared/executor/index.js";

const executor = {} as Executor;
const session: McpTokenSession = {
  userId: 7,
  username: "u",
  role: "admin",
  modules: ["assistant"],
  kind: "admin",
  bridgeSessionId: "live-bridge-123",
  targetId: "srv-1",
};

beforeEach(() => {
  signWithExpiry.mockClear();
  install.mockClear();
  load.mockClear();
  install.mockResolvedValue({ ok: true, path: "/root/.claude.json", detail: "Configurado" });
});

describe("mintLongLivedMcpToken", () => {
  it("inherits the session bridgeSessionId and returns seconds-since-epoch expiry", () => {
    const before = Math.floor(Date.now() / 1000);
    const { token, expiresAt } = mintLongLivedMcpToken(session);
    expect(token).toBe("minted.jwt");
    // 30-day TTL in the future, expressed in seconds.
    expect(expiresAt).toBeGreaterThan(before + 29 * 24 * 60 * 60);
    const payload = signWithExpiry.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload["bridgeSessionId"]).toBe("live-bridge-123");
    expect(payload["targetId"]).toBe("srv-1");
  });
});

describe("mcpRepairService.repair", () => {
  it("reinstalls a fresh token into the target CLI config for a CLI provider", async () => {
    const res = await mcpRepairService.repair({
      session,
      executor,
      mcpUrl: "https://panel.example.com/api/ai/mcp",
      provider: "claude",
    });
    expect(res.ok).toBe(true);
    expect(res.reinstalled).toBe(true);
    expect(res.provider).toBe("claude");
    expect(install).toHaveBeenCalledWith(
      "claude",
      "https://panel.example.com/api/ai/mcp",
      "minted.jwt",
      executor,
    );
    // Provider explicit → config not consulted.
    expect(load).not.toHaveBeenCalled();
  });

  it("defaults the provider from the target's active provider", async () => {
    const res = await mcpRepairService.repair({
      session,
      executor,
      mcpUrl: "https://panel.example.com/api/ai/mcp",
    });
    expect(load).toHaveBeenCalledOnce();
    expect(res.provider).toBe("claude");
    expect(res.reinstalled).toBe(true);
  });

  it("no-ops the reinstall for an API-only provider", async () => {
    const res = await mcpRepairService.repair({
      session,
      executor,
      mcpUrl: "https://panel.example.com/api/ai/mcp",
      provider: "deepseek",
    });
    expect(res.ok).toBe(true);
    expect(res.reinstalled).toBe(false);
    expect(res.install).toBeUndefined();
    expect(install).not.toHaveBeenCalled();
  });

  it("reports ok:false when the reinstall into the target config fails", async () => {
    install.mockResolvedValueOnce({ ok: false, path: "/root/.claude.json", detail: "EACCES" });
    const res = await mcpRepairService.repair({
      session,
      executor,
      mcpUrl: "https://panel.example.com/api/ai/mcp",
      provider: "claude",
    });
    expect(res.ok).toBe(false);
    expect(res.reinstalled).toBe(false);
    expect(res.install?.detail).toBe("EACCES");
  });
});
