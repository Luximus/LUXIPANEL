// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Túnel del portal LP: solo intercepta bearers `lxp_live_`, kill-switch con la
 * env vacía, comparación timing-safe y sesión sintetizada admin/local dentro
 * del contexto de executor (incidente pestaña Agentes IA 2026-07-20).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const envState = vi.hoisted(() => ({ credential: "" }));
vi.mock("../../../config/env.js", () => ({
  env: {
    // El logger compartido (importado transitivamente) lee estas claves.
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    get LP_PANEL_CREDENTIAL() {
      return envState.credential;
    },
  },
}));
vi.mock("../../../shared/lp-api-key.js", () => ({ lpApiKey: () => envState.credential || null }));

const executorCalls = vi.hoisted(() => ({ ran: [] as Array<{ userId?: number; username?: string }> }));
vi.mock("../../../shared/executor/factory.js", () => ({
  getExecutorAsync: vi.fn(async () => ({ target: { id: "local" } })),
}));
vi.mock("../../../shared/executor/context.js", () => ({
  runWithExecutor: vi.fn((_exec: unknown, fn: () => void, userId?: number, user?: { username?: string }) => {
    executorCalls.ran.push({ userId, username: user?.username });
    fn();
  }),
}));

import { lpPanelCredentialAuth, skipIfPanelCredential } from "./lp-panel-credential.middleware.js";
import { AuthError } from "../../../shared/errors/index.js";

const CRED = "lxp_live_" + "a".repeat(64);

function mkReq(bearer?: string): Request {
  return {
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    ip: "127.0.0.1",
    path: "/agent",
  } as unknown as Request;
}

function mkRes(): Response {
  return { locals: {} } as unknown as Response;
}

beforeEach(() => {
  envState.credential = "";
  executorCalls.ran.length = 0;
});

describe("lpPanelCredentialAuth", () => {
  it("sin bearer lxp_live_ pasa de largo hacia requireAuth (sin user)", async () => {
    const res = mkRes();
    const next = vi.fn();
    await lpPanelCredentialAuth(mkReq("eyJhbGciOi.jwt.normal"), res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.locals.user).toBeUndefined();
  });

  it("kill-switch: sin clave configurada → 401 explícito para bearers lxp_live_", async () => {
    const res = mkRes();
    const next = vi.fn();
    await lpPanelCredentialAuth(mkReq(CRED), res, next);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AuthError);
    expect(String((next.mock.calls[0]?.[0] as Error).message)).toContain("API KEY");
  });

  it("credencial incorrecta → 401 (sin sesión)", async () => {
    envState.credential = CRED;
    const res = mkRes();
    const next = vi.fn();
    await lpPanelCredentialAuth(mkReq("lxp_live_" + "b".repeat(64)), res, next);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AuthError);
    expect(res.locals.user).toBeUndefined();
  });

  it("credencial correcta → sesión admin lp-portal local, dentro del executor context", async () => {
    envState.credential = CRED;
    const res = mkRes();
    const next = vi.fn();
    await lpPanelCredentialAuth(mkReq(CRED), res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.locals.user).toMatchObject({ username: "lp-portal", kind: "admin", targetId: "local" });
    expect(res.locals.bridgedSession).toMatchObject({ targetId: "local", local: true });
    expect(executorCalls.ran[0]).toEqual({ userId: 0, username: "lp-portal" });
  });
});

describe("skipIfPanelCredential", () => {
  it("con user ya autenticado NO invoca requireAuth", () => {
    const inner = vi.fn();
    const res = mkRes();
    res.locals.user = { username: "lp-portal" };
    const next = vi.fn();
    skipIfPanelCredential(inner)(mkReq(), res, next);
    expect(inner).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it("sin user delega en requireAuth", () => {
    const inner = vi.fn();
    const res = mkRes();
    const next = vi.fn();
    skipIfPanelCredential(inner)(mkReq(), res, next);
    expect(inner).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
