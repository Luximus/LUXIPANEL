// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization + phase tests for the terminal connection service.
 *
 * (1) Pure helpers (parseCookies / extractToken / extractClientSessionId /
 *     extractOverrideBridgeId / send / createPtyFromStream) are pinned against
 *     the current behavior.
 * (2) Each extracted phase of the former god-function is exercised with mocks —
 *     asserting the SAME WS-failure messages / close codes the inline code sent.
 *
 * node-pty is never loaded: PTYs are faked with plain streams/objects (vitest
 * runs on the threads pool, per CLAUDE.md).
 */
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { once } from "node:events";
import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("../../../shared/websocket/live-auth.js", () => ({ verifyWsAuthorization: async () => {
  const { tokenService } = await import("../../auth/services/token.service.js");
  return tokenService.verify("fixture");
} }));

// ── Mocks for the cross-module dependencies the phases call ────────────────
vi.mock("../../auth/services/token.service.js", () => ({
  tokenService: {
    verify: vi.fn(),
    toSessionUser: vi.fn((p: { userId: number; username: string }) => ({
      id: p.userId,
      username: p.username,
    })),
  },
}));
vi.mock("../../auth/services/role-permissions.service.js", () => ({
  hasActionPermission: vi.fn(() => true),
  canExecuteCommand: vi.fn(() => true),
}));
vi.mock("../../../shared/session/bridge-header.js", () => ({
  resolveOverrideBridge: vi.fn(async () => null),
}));
vi.mock("../../../shared/executor/index.js", () => ({
  quoteArg: (value: string) => `'${value}'`,
  localExecutor: { id: "local", target: { id: "local" } },
  LOCAL_TARGET_ID: "local",
  getDirectExecutorByBridgeSessionId: vi.fn(async () => null),
}));
vi.mock("./terminal-access.service.js", () => ({
  resolveTerminalIdentity: vi.fn(async () => ({ username: "alice", switchUser: false })),
}));
vi.mock("../../../shared/executor/privilege-drop-executor.js", () => ({
  PrivilegeDropExecutor: class {
    willJailInteractiveShell = false;
    target = { id: "pd" };
    exec = vi.fn();
    spawn = vi.fn();
  },
}));
vi.mock("../../../shared/executor/direct-ssh-executor.js", () => ({
  DirectSshExecutor: class {
    target = { id: "ssh" };
    exec = vi.fn();
    spawn = vi.fn();
  },
}));
vi.mock("./session-manager.service.js", () => ({
  sessionManagerService: { add: vi.fn(), touch: vi.fn(), close: vi.fn() },
}));
vi.mock("../../../shared/worklog/worklog-recorder.service.js", () => ({
  recordActivity: vi.fn(),
  subdomainFromExecutor: vi.fn(() => null),
}));
vi.mock("../../../shared/worklog/worklog-taxonomy.js", () => ({
  classifyNotableCommand: vi.fn(() => null),
}));

import type { IncomingMessage } from "http";
import {
  parseCookies,
  extractToken,
  extractClientSessionId,
  extractOverrideBridgeId,
  send,
  createPtyFromStream,
  authenticateTerminalWs,
  resolveTerminalExecutor,
  enforceHostingJail,
  openTerminalPty,
  registerTerminalSession,
  wireTerminalDispatch,
} from "./terminal-connection.service.js";
import { env } from "../../../config/env.js";
import { authConfig } from "../../../config/auth.js";
import { tokenService } from "../../auth/services/token.service.js";
import { hasActionPermission, canExecuteCommand } from "../../../shared/auth/role-permissions.js";
import { resolveOverrideBridge } from "../../../shared/session/bridge-header.js";
import {
  localExecutor,
  getDirectExecutorByBridgeSessionId,
} from "../../../shared/executor/index.js";
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
import { DirectSshExecutor } from "../../../shared/executor/direct-ssh-executor.js";
import { sessionManagerService } from "./session-manager.service.js";
import { classifyNotableCommand } from "../../../shared/worklog/worklog-taxonomy.js";
import { recordActivity } from "../../../shared/worklog/worklog-recorder.service.js";
import { resolveTerminalIdentity } from "./terminal-access.service.js";

const mVerify = tokenService.verify as unknown as ReturnType<typeof vi.fn>;
const mHasAction = hasActionPermission as unknown as ReturnType<typeof vi.fn>;
const mCanExec = canExecuteCommand as unknown as ReturnType<typeof vi.fn>;
const mOverride = resolveOverrideBridge as unknown as ReturnType<typeof vi.fn>;
const mGetDirect = getDirectExecutorByBridgeSessionId as unknown as ReturnType<typeof vi.fn>;
const mAdd = sessionManagerService.add as unknown as ReturnType<typeof vi.fn>;
const mClassify = classifyNotableCommand as unknown as ReturnType<typeof vi.fn>;
const mIdentity = resolveTerminalIdentity as unknown as ReturnType<typeof vi.fn>;

function fakeReq(url: string, cookie?: string): IncomingMessage {
  return { url, headers: cookie ? { cookie } : {} } as unknown as IncomingMessage;
}

const basePayload = {
  userId: 7,
  username: "alice",
  kind: "admin" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mHasAction.mockReturnValue(true);
  mCanExec.mockReturnValue(true);
  mOverride.mockResolvedValue(null);
  mGetDirect.mockResolvedValue(null);
  mClassify.mockReturnValue(null);
  mIdentity.mockResolvedValue({ username: "alice", switchUser: false });
});

// ────────────────────────────────────────────────────────────────────────
// (1) Pure helpers — characterization
// ────────────────────────────────────────────────────────────────────────

describe("parseCookies", () => {
  it("parses a multi-cookie header, trims keys, and preserves `=` in values", () => {
    expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" });
    expect(parseCookies("jwt=x.y.z; other=v")).toEqual({ jwt: "x.y.z", other: "v" });
    expect(parseCookies("k=a=b=c")).toEqual({ k: "a=b=c" });
  });

  it("yields an empty-string key/value for a malformed segment", () => {
    expect(parseCookies("")).toEqual({ "": "" });
  });
});

describe("extractToken", () => {
  const cookieName = authConfig.cookie.sessionName;

  it("prefers the session cookie over the query param", () => {
    const req = fakeReq("/api/terminal/ws?token=QUERY", `${cookieName}=COOKIE`);
    expect(extractToken(req)).toBe("COOKIE");
  });

  it("falls back to the ?token= query param when no cookie", () => {
    expect(extractToken(fakeReq("/api/terminal/ws?token=QUERY"))).toBe("QUERY");
  });

  it("returns null when neither cookie nor query token is present", () => {
    expect(extractToken(fakeReq("/api/terminal/ws"))).toBeNull();
  });
});

describe("extractClientSessionId", () => {
  it("returns a sanitized id of 8–64 allowed chars", () => {
    expect(extractClientSessionId(fakeReq("/?sessionId=abc-DEF_12"))).toBe("abc-DEF_12");
  });

  it("strips disallowed chars then applies the length floor", () => {
    // "a!b@c#d$e" → "abcde" (5 chars) < 8 → null
    expect(extractClientSessionId(fakeReq("/?sessionId=a!b@c%23d$e"))).toBeNull();
  });

  it("returns null when the param is absent", () => {
    expect(extractClientSessionId(fakeReq("/"))).toBeNull();
  });

  it("truncates to 64 chars", () => {
    const long = "x".repeat(100);
    expect(extractClientSessionId(fakeReq(`/?sessionId=${long}`))).toHaveLength(64);
  });
});

describe("extractOverrideBridgeId", () => {
  it("returns the trimmed bridge param when present", () => {
    expect(extractOverrideBridgeId(fakeReq("/?bridge=br-1"))).toBe("br-1");
  });

  it("returns null when absent or blank", () => {
    expect(extractOverrideBridgeId(fakeReq("/"))).toBeNull();
    expect(extractOverrideBridgeId(fakeReq("/?bridge=%20%20"))).toBeNull();
  });
});

describe("send", () => {
  it("serializes and sends JSON when the socket is OPEN", () => {
    const ws = { readyState: 1, send: vi.fn() } as never; // WebSocket.OPEN === 1
    send(ws, { type: "pong" });
    expect((ws as unknown as { send: ReturnType<typeof vi.fn> }).send).toHaveBeenCalledWith(
      JSON.stringify({ type: "pong" }),
    );
  });

  it("does nothing when the socket is not OPEN", () => {
    const ws = { readyState: 3, send: vi.fn() } as never; // CLOSED
    send(ws, { type: "pong" });
    expect((ws as unknown as { send: ReturnType<typeof vi.fn> }).send).not.toHaveBeenCalled();
  });

  it("swallows send() throwing (already-closed race)", () => {
    const ws = {
      readyState: 1,
      send: () => {
        throw new Error("closed");
      },
    } as never;
    expect(() => send(ws, { type: "pong" })).not.toThrow();
  });
});

describe("createPtyFromStream", () => {
  it("bridges stream data/exit and delegates resize/kill", async () => {
    const stream = new PassThrough() as PassThrough & {
      resize?: (c: number, r: number) => void;
      kill?: (s?: string) => void;
    };
    const resize = vi.fn();
    const kill = vi.fn();
    stream.resize = resize;
    stream.kill = kill;

    const pty = createPtyFromStream(stream);
    const out: string[] = [];
    let code: number | null = null;
    pty.onData((d) => out.push(d));
    pty.onExit((c) => {
      code = c;
    });

    pty.resize(120, 40);
    stream.write("hi");
    pty.kill();
    stream.end();
    await once(stream, "close");

    expect(resize).toHaveBeenCalledWith(120, 40);
    expect(kill).toHaveBeenCalledWith("SIGHUP");
    expect(out.join("")).toContain("hi");
    expect(code).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────
// (2a) Phase — authenticateTerminalWs
// ────────────────────────────────────────────────────────────────────────

describe("authenticateTerminalWs", () => {
  it("fails 1008/Unauthorized with 'Authentication required' when no token", async () => {
    const res = await authenticateTerminalWs(fakeReq("/api/terminal/ws"));
    expect(res).toEqual({
      ok: false,
      failure: { message: "Authentication required", code: 1008, reason: "Unauthorized" },
    });
  });

  it("fails 1008/Unauthorized with 'Invalid or expired session' when verify returns null", async () => {
    mVerify.mockResolvedValue(null);
    const res = await authenticateTerminalWs(fakeReq("/api/terminal/ws?token=t"));
    expect(res).toMatchObject({
      ok: false,
      failure: { message: "Invalid or expired session", code: 1008, reason: "Unauthorized" },
    });
  });

  it("fails 1008/Forbidden with 'Insufficient permissions' when terminal.open denied", async () => {
    mVerify.mockResolvedValue(basePayload);
    mHasAction.mockReturnValue(false);
    const res = await authenticateTerminalWs(fakeReq("/api/terminal/ws?token=t"));
    expect(res).toMatchObject({
      ok: false,
      failure: { message: "Insufficient permissions", code: 1008, reason: "Forbidden" },
    });
  });

  it("succeeds and reuses a stable clientSessionId (reattach opt-in)", async () => {
    mVerify.mockResolvedValue(basePayload);
    const res = await authenticateTerminalWs(fakeReq("/api/terminal/ws?token=t&sessionId=stable-1234"));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.auth.sessionId).toBe("stable-1234");
      expect(res.auth.clientSessionId).toBe("stable-1234");
      expect(res.auth.payload).toBe(basePayload);
    }
  });

  it("succeeds and mints a fresh uuid session id when no clientSessionId", async () => {
    mVerify.mockResolvedValue(basePayload);
    const res = await authenticateTerminalWs(fakeReq("/api/terminal/ws?token=t"));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.auth.clientSessionId).toBeNull();
      expect(res.auth.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// (2b) Phase — resolveTerminalExecutor
// ────────────────────────────────────────────────────────────────────────

describe("resolveTerminalExecutor", () => {
  it("returns localExecutor for an EXPLICIT local session (local: true)", async () => {
    const payload = { ...basePayload, local: true, targetId: "local" };
    const res = await resolveTerminalExecutor(payload, fakeReq("/"), "s1");
    expect(res).toEqual({ ok: true, executor: localExecutor });
  });

  it("returns localExecutor when the token carries the `local` target sentinel (no explicit flag)", async () => {
    const payload = { ...basePayload, targetId: "local" };
    const res = await resolveTerminalExecutor(payload, fakeReq("/"), "s1");
    expect(res).toEqual({ ok: true, executor: localExecutor });
  });

  it("fails closed 1008 and NEVER falls to localExecutor when the token has neither a bridge nor an explicit local claim", async () => {
    // Fail-open guard: a WS token with no bridge claims and no `local`/`local`
    // target must NOT open a REAL PTY on the panel host.
    const res = await resolveTerminalExecutor(basePayload, fakeReq("/"), "s1");
    expect(res).toMatchObject({ ok: false, failure: { code: 1008, reason: "No server selected" } });
  });

  it("fails closed 1008 for a token with a foreign targetId but no bridge and no local claim", async () => {
    const payload = { ...basePayload, targetId: "srv-9" };
    const res = await resolveTerminalExecutor(payload, fakeReq("/"), "s1");
    expect(res).toMatchObject({ ok: false, failure: { code: 1008, reason: "No server selected" } });
  });

  it("fails closed 1008/'Bridge session expired' when a direct cookie session no longer resolves", async () => {
    mGetDirect.mockResolvedValue(null);
    const payload = { ...basePayload, bridgeSessionId: "b1", local: false, targetId: "srv-9" };
    const res = await resolveTerminalExecutor(payload, fakeReq("/"), "s1");
    expect(res).toMatchObject({
      ok: false,
      failure: { code: 1008, reason: "Bridge session expired" },
    });
  });

  it("resolves a direct cookie session to its cached executor", async () => {
    const exec = { target: { id: "srv-9" } };
    mGetDirect.mockResolvedValue(exec);
    const payload = { ...basePayload, bridgeSessionId: "b1", local: false, targetId: "srv-9" };
    const res = await resolveTerminalExecutor(payload, fakeReq("/"), "s1");
    expect(res).toEqual({ ok: true, executor: exec });
  });

  it("uses the per-tab override bridge when present", async () => {
    mOverride.mockResolvedValue({ bridgeSessionId: "ob", targetId: "t2", targetName: "node2" });
    const exec = { target: { id: "t2" } };
    mGetDirect.mockResolvedValue(exec);
    const res = await resolveTerminalExecutor(basePayload, fakeReq("/?bridge=ob"), "s1");
    expect(mGetDirect).toHaveBeenCalledWith("ob", "t2", "node2");
    expect(res).toEqual({ ok: true, executor: exec });
  });

  it("fails closed when the per-tab override no longer resolves", async () => {
    mOverride.mockResolvedValue({ bridgeSessionId: "ob", targetId: "t2", targetName: "node2" });
    mGetDirect.mockResolvedValue(null);
    const res = await resolveTerminalExecutor(basePayload, fakeReq("/?bridge=ob"), "s1");
    expect(res).toMatchObject({ ok: false, failure: { code: 1008, reason: "Bridge session expired" } });
  });
});

// ────────────────────────────────────────────────────────────────────────
// (2c) Phase — enforceHostingJail
// ────────────────────────────────────────────────────────────────────────

describe("enforceHostingJail", () => {
  it("passes (null) for a non-hosting session regardless of executor", async () => {
    const res = await enforceHostingJail({ target: { id: "x" } } as never, basePayload, "s1");
    expect(res).toBeNull();
  });

  it("rejects a hosting session whose executor is not privilege-drop", async () => {
    const payload = { ...basePayload, kind: "hosting" as const };
    const res = await enforceHostingJail({ target: { id: "x" } } as never, payload, "s1");
    expect(res).toMatchObject({ code: 1008, reason: "Hosting terminal not privilege-dropped" });
  });

  it("rejects when the jaula is expected but the owner login shell is not jk_chrootsh", async () => {
    const payload = { ...basePayload, kind: "hosting" as const };
    const pd = new PrivilegeDropExecutor() as unknown as {
      exec: ReturnType<typeof vi.fn>;
    };
    pd.exec.mockResolvedValue({ exitCode: 0, stdout: "/bin/bash" });
    const res = await enforceHostingJail(pd as never, payload, "s1");
    expect(res).toMatchObject({ code: 1008, reason: "Hosting jail not provisioned" });
  });

  it("passes when the owner login shell equals the jail tool (jaula provisioned)", async () => {
    const payload = { ...basePayload, kind: "hosting" as const };
    const pd = new PrivilegeDropExecutor() as unknown as { exec: ReturnType<typeof vi.fn> };
    pd.exec.mockResolvedValue({ exitCode: 0, stdout: env.JAIL_TOOL_PATH });
    const res = await enforceHostingJail(pd as never, payload, "s1");
    expect(res).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────
// (2d) Phase — openTerminalPty
// ────────────────────────────────────────────────────────────────────────

describe("openTerminalPty", () => {
  it("rejects a Linux account that is no longer eligible", async () => {
    mIdentity.mockResolvedValueOnce(null);
    const spawn = vi.fn();
    const res = await openTerminalPty({ spawn } as never, basePayload, null, "s1");
    expect(res).toMatchObject({ ok: false, failure: { code: 1008 } });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("starts the shell as the authenticated account when SSH differs", async () => {
    mIdentity.mockResolvedValueOnce({ username: "alice", switchUser: true });
    const spawn = vi.fn(() => new PassThrough());
    const res = await openTerminalPty({ target: { id: "ssh" }, spawn } as never, basePayload, null, "s1");
    expect(res.ok).toBe(true);
    expect(spawn).toHaveBeenCalledWith("sudo", ["-n", "-u", "alice", "-H", "--", env.TERMINAL_SHELL]);
  });
  it("spawns the configured shell (no tmux) for a non-tmux-capable executor", async () => {
    const spawn = vi.fn(() => new PassThrough());
    const executor = { target: { id: "local" }, spawn };
    const res = await openTerminalPty(executor as never, basePayload, null, "s1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.reattached).toBe(false);
    expect(spawn).toHaveBeenCalledWith(env.TERMINAL_SHELL, []);
  });

  it("spawns inside tmux and detects an existing session (reattach) for a DirectSSH executor", async () => {
    const dssh = new DirectSshExecutor() as unknown as {
      exec: ReturnType<typeof vi.fn>;
      spawn: ReturnType<typeof vi.fn>;
    };
    dssh.exec
      .mockResolvedValueOnce({ exitCode: 0, stdout: "ok" }) // tmux present
      .mockResolvedValueOnce({ exitCode: 0, stdout: "yes" }); // has-session
    dssh.spawn.mockReturnValue(new PassThrough());
    const res = await openTerminalPty(dssh as never, basePayload, "stable-1234", "s1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.reattached).toBe(true);
    expect(dssh.spawn).toHaveBeenCalledWith("tmux", [
      "-u",
      "new-session",
      "-A",
      "-s",
      "lxp_7_stable-1234",
    ]);
  });

  it("suppresses managed bashrc autostart only for client-managed sessions", async () => {
    const spawn = vi.fn(() => new PassThrough());
    const res = await openTerminalPty({ target: { id: "ssh" }, spawn } as never, basePayload, null, "s1", true);
    expect(res.ok).toBe(true);
    expect(spawn).toHaveBeenCalledWith("env", ["NO_LXP_CLI_AUTOSTART=1", env.TERMINAL_SHELL]);
  });
  it("keeps authenticated user switching and tmux persistence with client-managed CLI startup", async () => {
    mIdentity.mockResolvedValueOnce({ username: "alice", switchUser: true });
    const dssh = new DirectSshExecutor() as unknown as { exec: ReturnType<typeof vi.fn>; spawn: ReturnType<typeof vi.fn> };
    dssh.exec.mockResolvedValueOnce({ exitCode: 0, stdout: "ok" }).mockResolvedValueOnce({ exitCode: 0, stdout: "yes" });
    dssh.spawn.mockReturnValue(new PassThrough());
    const res = await openTerminalPty(dssh as never, basePayload, "stable-1234", "s1", true);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.reattached).toBe(true);
    expect(dssh.spawn).toHaveBeenCalledWith("sudo", ["-n", "-u", "alice", "-H", "--", "tmux", "-u", "new-session", "-A", "-s", "lxp_7_stable-1234", "env", "NO_LXP_CLI_AUTOSTART=1", env.TERMINAL_SHELL]);
  });

  it("fails 1011/'PTY spawn failed' when spawn throws", async () => {
    const executor = {
      target: { id: "local" },
      spawn: () => {
        throw new Error("boom");
      },
    };
    const res = await openTerminalPty(executor as never, basePayload, null, "s1");
    expect(res).toMatchObject({ ok: false, failure: { code: 1011, reason: "PTY spawn failed" } });
  });
});

// ────────────────────────────────────────────────────────────────────────
// (2e) Phase — registerTerminalSession
// ────────────────────────────────────────────────────────────────────────

function fakePty() {
  return {
    pid: 123,
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn(),
    onExit: vi.fn(),
  };
}

describe("registerTerminalSession", () => {
  it("registers the session and returns null on success", () => {
    const pty = fakePty();
    const res = registerTerminalSession({
      ws: {} as never,
      pty: pty as never,
      sessionId: "s1",
      payload: basePayload as never,
    });
    expect(res).toBeNull();
    expect(mAdd).toHaveBeenCalledOnce();
  });

  it("kills the PTY and fails 1013 when the session cap is reached", () => {
    mAdd.mockImplementation(() => {
      throw new Error("Maximum terminal sessions reached");
    });
    const pty = fakePty();
    const res = registerTerminalSession({
      ws: {} as never,
      pty: pty as never,
      sessionId: "s1",
      payload: basePayload as never,
    });
    expect(pty.kill).toHaveBeenCalledOnce();
    expect(res).toMatchObject({ code: 1013, reason: "Session limit reached" });
    expect((res as { message: string }).message).toContain("Maximum terminal sessions");
  });
});

// ────────────────────────────────────────────────────────────────────────
// (2f) Phase — wireTerminalDispatch
// ────────────────────────────────────────────────────────────────────────

class FakeWs extends EventEmitter {
  readyState = 1; // WebSocket.OPEN
  send = vi.fn();
  close = vi.fn();
}

function lastSent(ws: FakeWs): Record<string, unknown> | undefined {
  const call = ws.send.mock.calls.at(-1);
  return call ? JSON.parse(call[0] as string) : undefined;
}

function wire(overrides: Partial<Parameters<typeof wireTerminalDispatch>[0]> = {}) {
  const ws = new FakeWs();
  const pty = fakePty();
  wireTerminalDispatch({
    ws: ws as never,
    pty: pty as never,
    sessionId: "s1",
    sessionUser: { id: 7, username: "alice" } as never,
    payload: basePayload as never,
    executor: { target: { id: "local" } } as never,
    reattached: false,
    ...overrides,
  });
  return { ws, pty };
}

describe("wireTerminalDispatch", () => {
  it("sends the `connected` frame immediately with pid + reattached", () => {
    const { ws } = wire({ reattached: true });
    expect(lastSent(ws)).toEqual({ type: "connected", sessionId: "s1", pid: 123, reattached: true });
  });

  it("writes allowed input through to the PTY as a single chunk", () => {
    const { ws, pty } = wire();
    ws.emit("message", JSON.stringify({ type: "input", data: "ls\n" }));
    expect(pty.write).toHaveBeenCalledExactlyOnceWith("ls\n");
  });

  it("keeps arrow keys and mouse reports intact in one PTY write", () => {
    const { ws, pty } = wire();
    for (const sequence of ["\x1b[A", "\x1b[1;5D", "\x1b[<35;80;24M"]) {
      ws.emit("message", JSON.stringify({ type: "input", data: sequence }));
    }
    expect(pty.write.mock.calls.map((call) => call[0])).toEqual([
      "\x1b[A", "\x1b[1;5D", "\x1b[<35;80;24M",
    ]);
  });

  it("blocks a command denied by role policy (SIGINT + policy notice, no forward)", () => {
    mCanExec.mockReturnValue(false);
    const { ws, pty } = wire();
    ws.emit("message", JSON.stringify({ type: "input", data: "rm -rf /\r" }));
    // The Enter is NOT forwarded; instead SIGINT (\u0003) is written.
    expect(pty.write).toHaveBeenCalledWith("\u0003");
    expect(pty.write.mock.calls.map((call) => call[0])).toEqual(["rm -rf /", "\u0003"]);
    const sent = lastSent(ws);
    expect(sent?.type).toBe("output");
    expect(String(sent?.data)).toContain("[policy] Comando bloqueado");
  });

  it("records a notable command to the worklog on Enter", () => {
    mClassify.mockReturnValue({ category: "deploy" });
    const { ws } = wire();
    ws.emit("message", JSON.stringify({ type: "input", data: "systemctl restart nginx\n" }));
    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ module: "terminal", action: "notable_command", category: "deploy" }),
    );
  });

  it("answers ping with pong", () => {
    const { ws } = wire();
    ws.emit("message", JSON.stringify({ type: "ping" }));
    expect(lastSent(ws)).toEqual({ type: "pong" });
  });

  it("forwards resize to the PTY with defaults when fields are missing", () => {
    const { ws, pty } = wire();
    ws.emit("message", JSON.stringify({ type: "resize", cols: 100, rows: 30 }));
    expect(pty.resize).toHaveBeenCalledWith(100, 30);
    ws.emit("message", JSON.stringify({ type: "resize" }));
    expect(pty.resize).toHaveBeenCalledWith(80, 24);
  });

  it("errors on unknown message type and on invalid JSON", () => {
    const { ws } = wire();
    ws.emit("message", JSON.stringify({ type: "nope" }));
    expect(lastSent(ws)).toEqual({ type: "error", message: "Unknown message type: nope" });
    ws.emit("message", "{not json");
    expect(lastSent(ws)).toEqual({ type: "error", message: "Invalid message format" });
  });

  it("closes the session on ws close and on ws error", () => {
    const { ws } = wire();
    ws.emit("close", 1000, Buffer.from("bye"));
    expect(sessionManagerService.close).toHaveBeenCalledWith(7, "s1", "ws-close");
    ws.emit("error", new Error("x"));
    expect(sessionManagerService.close).toHaveBeenCalledWith(7, "s1", "ws-error");
  });

  it("pipes PTY output to the socket and forwards PTY exit", () => {
    const { ws, pty } = wire();
    // capture the onData / onExit callbacks the phase registered
    const onData = pty.onData.mock.calls[0][0] as (d: string) => void;
    const onExit = pty.onExit.mock.calls[0][0] as (c: number) => void;
    onData("hello");
    expect(lastSent(ws)).toEqual({ type: "output", data: "hello" });
    onExit(0);
    expect(lastSent(ws)).toEqual({ type: "exit", code: 0 });
    expect(sessionManagerService.close).toHaveBeenCalledWith(7, "s1", "process-exit");
  });
});
