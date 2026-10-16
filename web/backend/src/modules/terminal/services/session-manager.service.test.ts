import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";

vi.mock("../../../config/env.js", () => ({ env: { TERMINAL_MAX_SESSIONS: 10, TERMINAL_IDLE_TIMEOUT_MS: 1_800_000 } }));
vi.mock("../../../shared/logger/index.js", () => ({ createModuleLogger: () => ({ info: vi.fn(), warn: vi.fn() }) }));

import { sessionManagerService } from "./session-manager.service.js";

function mockSession(sessionId: string) {
  const ws = { readyState: WebSocket.OPEN, send: vi.fn(), close: vi.fn() } as unknown as WebSocket;
  const pty = { pid: 1, kill: vi.fn() };
  return {
    sessionId,
    userId: 7,
    username: "user",
    ws,
    pty: pty as never,
    createdAt: new Date(),
    lastActivityAt: new Date(),
  };
}

afterEach(() => sessionManagerService.stop());

describe("terminal session replacement", () => {
  it("ignores close and PTY exit callbacks from a replaced socket", () => {
    const oldSession = mockSession("persistent-id");
    const newSession = mockSession("persistent-id");
    sessionManagerService.add(oldSession);
    sessionManagerService.add(newSession);

    expect(sessionManagerService.close(7, "persistent-id", "ws-close", oldSession.ws)).toBe(false);
    expect(sessionManagerService.close(7, "persistent-id", "process-exit", oldSession.ws)).toBe(false);
    expect(sessionManagerService.list()).toHaveLength(1);
    expect(newSession.pty.kill).not.toHaveBeenCalled();

    expect(sessionManagerService.close(7, "persistent-id", "ws-close", newSession.ws)).toBe(true);
    expect(sessionManagerService.list()).toHaveLength(0);
    expect(newSession.pty.kill).toHaveBeenCalledOnce();
  });
});
