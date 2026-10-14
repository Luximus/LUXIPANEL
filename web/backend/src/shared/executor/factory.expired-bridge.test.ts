// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";

const h = vi.hoisted(() => ({ material: vi.fn(), remove: vi.fn(), disposed: vi.fn() }));
vi.mock("../../modules/auth/services/ssh-credentials-cache.service.js", () => ({
  sshCredentialsCache: { get: h.material, delete: h.remove },
}));
vi.mock("./direct-ssh-executor.js", () => ({
  DirectSshExecutor: class {
    target: { id: string; name: string };
    constructor(id: string, name: string) { this.target = { id, name }; }
    dispose = h.disposed;
  },
}));
vi.mock("./sudo-exec-wrap.js", () => ({ wrapExecutorWithSudo: (executor: unknown) => executor }));
vi.mock("../preview-sandbox/runtime.js", () => ({ bumpPreviewSessionEpoch: vi.fn() }));
vi.mock("../remote-cache/redis-cli.js", () => ({ disposeRedisAuthTmp: vi.fn(async () => undefined) }));

import { disposeDirectExecutor, getExecutor, getExecutorAsync, hydrateDirectSshExecutor } from "./factory.js";

function request(bridge: string, target = "remote"): Request {
  return { res: { locals: { bridgedSession: { direct: true, bridgeSessionId: bridge, targetId: target, targetName: target } } } } as unknown as Request;
}

describe("expired direct bridges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.material.mockResolvedValue(null);
    h.remove.mockResolvedValue(undefined);
    h.disposed.mockResolvedValue(undefined);
  });

  it("signals reconnection when credentials have expired during async hydration", async () => {
    await expect(getExecutorAsync(request("expired-async"))).rejects.toMatchObject({ statusCode: 428, code: "BRIDGE_SESSION_REQUIRED" });
  });

  it("signals reconnection if logout removes the executor after request authentication", async () => {
    h.material.mockResolvedValueOnce({ host: "remote.example" });
    await hydrateDirectSshExecutor("revoked-during-request", "remote", "Remote");
    const req = request("revoked-during-request");
    expect(getExecutor(req).target.id).toBe("remote");
    await disposeDirectExecutor("revoked-during-request");
    expect(() => getExecutor(req)).toThrow(expect.objectContaining({ statusCode: 428, code: "BRIDGE_SESSION_REQUIRED" }));
    await expect(getExecutorAsync(req)).rejects.toMatchObject({ statusCode: 428, code: "BRIDGE_SESSION_REQUIRED" });
  });

  it("rejects an executor belonging to another target instead of using it", async () => {
    h.material.mockResolvedValueOnce({ host: "remote.example" });
    await hydrateDirectSshExecutor("different-target", "server-a", "A");
    expect(() => getExecutor(request("different-target", "server-b"))).toThrow(expect.objectContaining({ statusCode: 428, code: "BRIDGE_SESSION_REQUIRED" }));
    expect(h.disposed).toHaveBeenCalledOnce();
  });
});
