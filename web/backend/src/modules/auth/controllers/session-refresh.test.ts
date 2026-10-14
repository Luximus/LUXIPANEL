// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { getContextExecutor, runWithExecutor } from "../../../shared/executor/context.js";
import type { Executor } from "../../../shared/executor/types.js";
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";

const m = vi.hoisted(() => ({ find: vi.fn(), build: vi.fn(), groups: vi.fn(), sign: vi.fn(), verify: vi.fn(), cookie: vi.fn(), direct: vi.fn(), wsSign: vi.fn() }));
vi.mock("../repositories/index.js", () => ({ panelUserRepository: { findById: m.find } }));
vi.mock("../services/auth.service.js", () => ({ authService: { buildTokenPayload: m.build } }));
vi.mock("../services/token.service.js", () => ({ tokenService: { verify: m.verify, sign: m.sign, signWithExpiry: m.wsSign, setSessionCookie: m.cookie } }));
vi.mock("../../../shared/executor/factory.js", () => ({ getDirectExecutorByBridgeSessionId: m.direct, disposeDirectExecutor: vi.fn() }));
vi.mock("../middlewares/session.middleware.js", () => ({ extractToken: () => "session-token" }));
vi.mock("../../users/services/system-accounts.service.js", () => ({ systemAccountsService: { userGroups: m.groups } }));
import { sessionController } from "./session.controller.js";

const scope = { tenantId: 7, owner: "hp123", homeRoot: "/home/hp123", tenantGroup: "h-hp123", maxSubUsers: 3 };
const current = { userId: 91, username: "hp123", kind: "user", role: "user", modules: ["files"], ...scope };
const service = { target: { id: "local", name: "Local" } } as Executor;
const dropped = new PrivilegeDropExecutor(service, "hp123", "/home/hp123");

async function refresh(executor = dropped, user = current) {
  let finish!: () => void;
  const completed = new Promise<void>((resolve) => { finish = resolve; });
  const res = { locals: { user }, json: vi.fn(finish) } as unknown as Response;
  const next = vi.fn(finish);
  await runWithExecutor(executor, async () => {
    sessionController.refresh({} as Request, res, next as NextFunction);
    await completed;
  });
  return { res, next };
}

beforeEach(() => {
  vi.resetAllMocks();
  m.verify.mockResolvedValue({ ...current, bridgeSessionId: "local-bridge", targetId: "local", local: true });
  m.find.mockResolvedValue({ id: 91, username: "hp123", enabled: true, groups: ["old-group"] });
  m.groups.mockResolvedValue(["current-group"]);
  m.build.mockResolvedValue({ userId: 91, username: "hp123", kind: "user", role: "user", modules: ["mail"] });
  m.sign.mockReturnValue({ token: "refreshed", expiresAt: Date.now() + 60_000 });
});

describe("normal panel tenant session refresh", () => {
  it("reads protected identity through the assigned service executor and preserves tenant limits", async () => {
    m.find.mockImplementation(async () => {
      expect(getContextExecutor()).toBe(service);
      return { id: 91, username: "hp123", enabled: true };
    });
    const { next } = await refresh();
    expect(next).not.toHaveBeenCalled();
    expect(m.build).toHaveBeenCalledWith(expect.objectContaining({ id: 91, groups: ["current-group"] }));
    expect(m.sign).toHaveBeenCalledWith(expect.objectContaining({ userId: 91, kind: "user", modules: ["mail"], local: true, ...scope }), false);
  });

  it.each([{ enabled: false, username: "hp123" }, { enabled: true, username: "another-user" }])("rejects disabled or mismatched identities", async (patch) => {
    m.find.mockResolvedValue({ id: 91, ...patch });
    const { next } = await refresh();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(m.sign).not.toHaveBeenCalled();
  });

  it("fails closed if the tenant's executor belongs to another owner", async () => {
    const other = new PrivilegeDropExecutor(service, "another-user", "/home/another-user");
    const { next } = await refresh(other);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(m.find).not.toHaveBeenCalled(); expect(m.sign).not.toHaveBeenCalled();
  });
  it("preserves the complete tenant envelope in short-lived WebSocket tokens", async () => {
    m.wsSign.mockReturnValue({ token: "ws-token" });
    const user = { ...current, maxDomains: 2, maxEmailAccounts: 4, maxDatabases: 3, diskQuotaMb: 100, bandwidthQuotaMb: 200, jailEnabled: true };
    const res = { locals: { user }, json: vi.fn() } as unknown as Response;
    sessionController.getWebsocketToken({} as Request, res, vi.fn());
    await new Promise((resolve) => setImmediate(resolve));
    expect(m.wsSign).toHaveBeenCalledWith(expect.objectContaining({ ...scope, maxDomains: 2, maxEmailAccounts: 4, maxDatabases: 3, diskQuotaMb: 100, bandwidthQuotaMb: 200, jailEnabled: true }), expect.any(Number));
  });
  it("renews the base cookie using the base server, even when the tab points elsewhere", async () => {
    const baseExecutor = { target: { id: "base-server", name: "Base" } } as Executor;
    m.direct.mockResolvedValue(baseExecutor);
    m.verify.mockResolvedValue({ userId: 91, username: "hp123", bridgeSessionId: "base-bridge", targetId: "base-server", direct: true });
    m.find.mockImplementation(async () => {
      expect(getContextExecutor()).toBe(baseExecutor);
      return { id: 91, username: "hp123", enabled: true };
    });
    const { next } = await refresh(service, { userId: 91, username: "hp123", kind: "user", role: "user", modules: [], bridgeSessionId: "tab-bridge" } as typeof current);
    expect(next).not.toHaveBeenCalled();
    expect(m.sign).toHaveBeenCalledWith(expect.objectContaining({ bridgeSessionId: "base-bridge", targetId: "base-server", direct: true }), false);
  });
});
