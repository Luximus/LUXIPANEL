import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({
  store: new Map<string, string>(),
  executor: { target: { id: "server-a" } },
  user: { userId: 7, username: "alice", enabled: true, displayName: "Alice" },
  options: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("../../../shared/redis/index.js", () => ({
  getRedis: () => ({
    setex: async (key: string, _ttl: number, value: string) => {
      mocked.store.set(key, value);
    },
    get: async (key: string) => mocked.store.get(key) ?? null,
    getdel: async (key: string) => {
      const value = mocked.store.get(key) ?? null;
      mocked.store.delete(key);
      return value;
    },
  }),
}));
vi.mock("../../../shared/executor/context.js", () => ({
  getContextExecutor: () => mocked.executor,
  runWithExecutor: (_executor: unknown, fn: () => unknown) => fn(),
}));
vi.mock("../../../shared/panel-url/index.js", () => ({
  getPanelOrigin: async () => "https://panel.example",
}));
vi.mock("../../../config/auth.js", () => ({
  authConfig: { webauthn: { origin: "https://panel.example" } },
}));
vi.mock("../repositories/index.js", () => ({
  panelUserRepository: { findById: async () => mocked.user },
}));
vi.mock("./passkey.service.js", () => ({
  passkeyService: {
    getRegistrationOptions: mocked.options,
    verifyRegistration: mocked.verify,
  },
}));
import { passkeyEnrollmentService as service } from "./passkey-enrollment.service.js";
import type { SessionUser } from "../../../shared/types/index.js";
const user = {
  userId: 7,
  username: "alice",
  bridgeSessionId: "bridge-a",
} as SessionUser;
const grantFrom = (url: string) =>
  new URLSearchParams(new URL(url).hash.slice(1)).get("grant")!;
beforeEach(() => {
  mocked.store.clear();
  mocked.executor.target.id = "server-a";
  mocked.options.mockClear();
  mocked.verify.mockClear();
  mocked.options.mockResolvedValue({ challenge: "challenge" });
  mocked.verify.mockResolvedValue({ id: "credential-a", label: "Laptop" });
});
afterEach(() => vi.useRealTimers());
describe("native passkey enrollment capability", () => {
  it("only registers, is consumed once, and preserves the original server/user binding", async () => {
    const issued = await service.issue(user, "Laptop");
    expect(issued.url).not.toContain("jwt");
    const grant = grantFrom(issued.url);
    const options = await service.options(grant, "https://panel.example");
    await expect(
      service.options(grant, "https://panel.example"),
    ).rejects.toThrow();
    await service.verify(
      options.ceremony,
      {
        id: "credential-a",
        rawId: "credential-a",
        type: "public-key",
        response: {
          clientDataJSON: "client",
          attestationObject: "attestation",
        },
      },
      "https://panel.example",
    );
    expect(mocked.verify).toHaveBeenCalledWith(
      expect.objectContaining({ username: "alice" }),
      expect.anything(),
      "Laptop",
      "https://panel.example",
      issued.id,
    );
    expect((await service.result(issued.id, user)).status).toBe("complete");
    await expect(
      service.verify(options.ceremony, {}, "https://panel.example"),
    ).rejects.toThrow();
    mocked.executor.target.id = "server-b";
    await expect(service.result(issued.id, user)).rejects.toThrow("owner");
  });
  it("rejects another origin and cannot replay the consumed grant", async () => {
    const issued = await service.issue(user, "Laptop");
    const grant = grantFrom(issued.url);
    await expect(
      service.options(grant, "https://phishing.example"),
    ).rejects.toThrow("origin");
    expect(mocked.options).not.toHaveBeenCalled();
    await expect(
      service.options(grant, "https://panel.example"),
    ).rejects.toThrow();
  });
  it("fails closed after expiry or for another user", async () => {
    vi.useFakeTimers();
    const issued = await service.issue(user, "Laptop");
    await expect(
      service.result(issued.id, { ...user, userId: 8 }),
    ).rejects.toThrow("owner");
    vi.advanceTimersByTime(300001);
    await expect(
      service.options(grantFrom(issued.url), "https://panel.example"),
    ).rejects.toThrow("expired");
  });
});
