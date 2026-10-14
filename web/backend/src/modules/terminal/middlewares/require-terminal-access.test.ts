// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
vi.mock("../../../shared/executor/factory.js", () => ({ getExecutorAsync: vi.fn(async () => ({ target: { id: "local" } })) }));
vi.mock("../services/terminal-access.service.js", () => ({ resolveTerminalIdentity: vi.fn(async () => ({ username: "alice", switchUser: false })) }));
vi.mock("../../../shared/session/bridge-header.js", () => ({
  readBridgeHeader: (headers: Record<string, string>) => headers["x-bridge-session-id"] ?? null,
  resolveOverrideBridge: vi.fn(async () => null),
}));
import { requireTerminalAccess, requireTerminalOwnerIdentity } from "./require-terminal-access.js";

async function access(user: { kind: string; username: string; userId: number; bridgeSessionId?: string }, bridge?: string) {
  return new Promise<unknown>((resolve) => {
    const req = { headers: bridge ? { "x-bridge-session-id": bridge } : {} } as Request;
    const res = { locals: { user } } as unknown as Response;
    requireTerminalAccess(req, res, (error) => resolve(error ?? null));
  });
}

describe("Terminal HOME access", () => {
  it("rejects nonadmins and an expired or foreign per-tab server", async () => {
    expect(await access({ kind: "user", username: "alice", userId: 1 })).toMatchObject({ statusCode: 403 });
    expect(await access({ kind: "admin", username: "alice", userId: 1, bridgeSessionId: "owned" }, "foreign")).toMatchObject({ statusCode: 403 });
    expect(await access({ kind: "admin", username: "alice", userId: 1, bridgeSessionId: "owned" }, "owned")).toBeNull();
  });
  it("denies file-backed history and CLI access when SSH is another account", () => {
    const next = vi.fn();
    requireTerminalOwnerIdentity({} as Request, { locals: { terminalIdentity: { switchUser: true } } } as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
  it("allows the authenticated Linux account", () => {
    const next = vi.fn();
    requireTerminalOwnerIdentity({} as Request, { locals: { terminalIdentity: { switchUser: false } } } as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
