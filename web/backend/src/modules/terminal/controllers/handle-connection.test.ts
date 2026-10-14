// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Orchestrator wiring test for `handleTerminalConnection`.
 *
 * The 6 phases live in `terminal-connection.service.ts` and are tested there in
 * isolation. THIS file pins the controller's job: it chains the phases in order
 * and, when a phase returns a `WsFailure`, maps it onto exactly
 * `send({type:"error", message})` FOLLOWED BY `ws.close(code, reason)` — then
 * short-circuits (no later phase runs). The happy path reaches
 * `wireTerminalDispatch` without closing the socket.
 *
 * All phases are mocked, so no executor / node-pty is loaded.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock every phase of the connection service ─────────────────────────────
vi.mock("../services/terminal-connection.service.js", () => ({
  authenticateTerminalWs: vi.fn(),
  resolveTerminalExecutor: vi.fn(),
  enforceHostingJail: vi.fn(),
  openTerminalPty: vi.fn(),
  registerTerminalSession: vi.fn(),
  wireTerminalDispatch: vi.fn(),
  // `send` is the real teardown primitive the orchestrator uses; keep a spy so
  // we can assert ordering against `ws.close`.
  send: vi.fn(),
  // Re-exported by the controller; harmless placeholder for the import.
  createPtyFromStream: vi.fn(),
}));

import type { IncomingMessage } from "http";
import { handleTerminalConnection } from "./terminal.controller.js";
import {
  authenticateTerminalWs,
  resolveTerminalExecutor,
  enforceHostingJail,
  openTerminalPty,
  registerTerminalSession,
  wireTerminalDispatch,
  send,
} from "../services/terminal-connection.service.js";

const mAuth = authenticateTerminalWs as unknown as ReturnType<typeof vi.fn>;
const mExec = resolveTerminalExecutor as unknown as ReturnType<typeof vi.fn>;
const mJail = enforceHostingJail as unknown as ReturnType<typeof vi.fn>;
const mPty = openTerminalPty as unknown as ReturnType<typeof vi.fn>;
const mRegister = registerTerminalSession as unknown as ReturnType<typeof vi.fn>;
const mWire = wireTerminalDispatch as unknown as ReturnType<typeof vi.fn>;
const mSend = send as unknown as ReturnType<typeof vi.fn>;

const req = {} as IncomingMessage;

/**
 * Fake ws whose send/close land in a shared `order` log, so we can assert the
 * exact `send-before-close` sequence the legacy inline early-returns produced.
 */
function fakeWs(order: string[]) {
  return {
    close: vi.fn((code: number, reason: string) => {
      order.push(`close:${code}:${reason}`);
    }),
  };
}

// Reasonable "success" values so phases before the failing one pass.
const okAuth = {
  ok: true,
  auth: {
    payload: { userId: 1, username: "u", kind: "admin" },
    sessionUser: { id: 1, username: "u" },
    sessionId: "s1",
    clientSessionId: null,
  },
};
const okExec = { ok: true, executor: { target: { id: "local" } } };
const okPty = { ok: true, pty: { pid: 1 }, reattached: false };

beforeEach(() => {
  vi.clearAllMocks();
  // Default happy path; individual tests override the failing phase.
  mAuth.mockResolvedValue(okAuth);
  mExec.mockResolvedValue(okExec);
  mJail.mockResolvedValue(null);
  mPty.mockResolvedValue(okPty);
  mRegister.mockReturnValue(null);
  // `send` records its call into the ordering log.
  mSend.mockImplementation((_ws: unknown, payload: Record<string, unknown>) => {
    (globalThis as { __order?: string[] }).__order?.push(`send:${JSON.stringify(payload)}`);
  });
});

/** Wire a per-test ordering buffer that `send` mock appends to. */
function withOrder(): string[] {
  const order: string[] = [];
  (globalThis as { __order?: string[] }).__order = order;
  return order;
}

describe("handleTerminalConnection (orchestrator wiring)", () => {
  it.each([
    ["/api/terminal/ws?autostart=client", true],
    ["/api/terminal/ws", false],
    ["/api/terminal/ws?autostart=other", false],
  ])("forwards startup ownership for %s after the connection guards", async (url, clientManagesCli) => {
    const ws = fakeWs(withOrder());
    await handleTerminalConnection(ws as never, { url } as IncomingMessage);
    expect(mPty).toHaveBeenCalledWith(okExec.executor, okAuth.auth.payload, null, "s1", clientManagesCli);
    expect(mJail.mock.invocationCallOrder[0]).toBeLessThan(mPty.mock.invocationCallOrder[0]);
  });

  it("auth failure → send(error) BEFORE close(1008,'Unauthorized') and no further phase", async () => {
    const order = withOrder();
    mAuth.mockResolvedValue({
      ok: false,
      failure: { message: "Authentication required", code: 1008, reason: "Unauthorized" },
    });
    const ws = fakeWs(order);

    await handleTerminalConnection(ws as never, req);

    expect(order).toEqual([
      `send:${JSON.stringify({ type: "error", message: "Authentication required" })}`,
      "close:1008:Unauthorized",
    ]);
    expect(mExec).not.toHaveBeenCalled();
    expect(mJail).not.toHaveBeenCalled();
    expect(mWire).not.toHaveBeenCalled();
  });

  it("executor fail-closed → send(error) BEFORE close(1008,'Bridge session expired'), stops before jail", async () => {
    const order = withOrder();
    mExec.mockResolvedValue({
      ok: false,
      failure: {
        message: "Sesión del servidor expirada. Reconéctate al servidor desde el panel.",
        code: 1008,
        reason: "Bridge session expired",
      },
    });
    const ws = fakeWs(order);

    await handleTerminalConnection(ws as never, { headers: { cookie: "lxp-locale=ja" } } as IncomingMessage);

    expect(mAuth).toHaveBeenCalledOnce();
    expect(order).toEqual([
      `send:${JSON.stringify({
        type: "error",
        message: "サーバーセッションの期限が切れました。パネルから再接続してください。",
      })}`,
      "close:1008:Bridge session expired",
    ]);
    expect(mJail).not.toHaveBeenCalled();
    expect(mPty).not.toHaveBeenCalled();
    expect(mWire).not.toHaveBeenCalled();
  });

  it("PTY spawn failure → send(error) BEFORE close(1011,'PTY spawn failed'), stops before register", async () => {
    const order = withOrder();
    mPty.mockResolvedValue({
      ok: false,
      failure: { message: "No se pudo iniciar la terminal.", code: 1011, reason: "PTY spawn failed" },
    });
    const ws = fakeWs(order);

    await handleTerminalConnection(ws as never, req);

    // reached the pty phase (auth+executor+jail passed)
    expect(mJail).toHaveBeenCalledOnce();
    expect(mPty).toHaveBeenCalledOnce();
    expect(order).toEqual([
      `send:${JSON.stringify({ type: "error", message: "Could not start the terminal." })}`,
      "close:1011:PTY spawn failed",
    ]);
    expect(mRegister).not.toHaveBeenCalled();
    expect(mWire).not.toHaveBeenCalled();
  });

  it("register cap failure → send(error) BEFORE close(1013,'Session limit reached')", async () => {
    const order = withOrder();
    mRegister.mockReturnValue({
      message: "Maximum terminal sessions (5) reached.",
      code: 1013,
      reason: "Session limit reached",
    });
    const ws = fakeWs(order);

    await handleTerminalConnection(ws as never, req);

    expect(order).toEqual([
      `send:${JSON.stringify({ type: "error", message: "Maximum terminal sessions (5) reached." })}`,
      "close:1013:Session limit reached",
    ]);
    expect(mWire).not.toHaveBeenCalled();
  });

  it("happy path → all 6 phases run in order, reaches wireTerminalDispatch, socket NOT closed", async () => {
    const order = withOrder();
    const ws = fakeWs(order);

    await handleTerminalConnection(ws as never, req);

    // No teardown happened.
    expect(order).toEqual([]);
    expect(ws.close).not.toHaveBeenCalled();
    expect(mSend).not.toHaveBeenCalled();

    // All phases ran, and dispatch got the resolved executor + pty + reattached.
    const authOrder = mAuth.mock.invocationCallOrder[0];
    const execOrder = mExec.mock.invocationCallOrder[0];
    const jailOrder = mJail.mock.invocationCallOrder[0];
    const ptyOrder = mPty.mock.invocationCallOrder[0];
    const regOrder = mRegister.mock.invocationCallOrder[0];
    const wireOrder = mWire.mock.invocationCallOrder[0];
    expect(authOrder).toBeLessThan(execOrder);
    expect(execOrder).toBeLessThan(jailOrder);
    expect(jailOrder).toBeLessThan(ptyOrder);
    expect(ptyOrder).toBeLessThan(regOrder);
    expect(regOrder).toBeLessThan(wireOrder);

    expect(mWire).toHaveBeenCalledWith(
      expect.objectContaining({
        ws,
        pty: okPty.pty,
        sessionId: "s1",
        executor: okExec.executor,
        reattached: false,
      }),
    );
  });
});
