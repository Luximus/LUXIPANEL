import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/types.js";

const m = vi.hoisted(() => ({
  local: { target: { id: "local" } },
  context: null as unknown,
  read: vi.fn(),
  write: vi.fn(),
}));
vi.mock("../../../shared/executor/index.js", () => ({
  localExecutor: m.local,
  getContextExecutor: () => m.context,
  runWithExecutor: (_executor: unknown, fn: () => unknown) => fn(),
}));
vi.mock("../../../shared/remote-config/index.js", () => ({ remoteConfig: { read: m.read, write: m.write } }));
vi.mock("../../../shared/logger/index.js", () => ({ createModuleLogger: () => ({ warn: vi.fn() }) }));

const passwordOnly = { loginAllowPassword: true, loginAllowPasskey: false, loginAllowRecovery: false };
const passkeyOnly = { loginAllowPassword: false, loginAllowPasskey: true, loginAllowRecovery: false };
const local = m.local as Executor;
const remote = { target: { id: "remote" } } as Executor;
let stores: Map<string, Record<string, unknown>>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  m.context = null;
  stores = new Map([["local", { ...passkeyOnly }], ["remote", { ...passwordOnly }]]);
  m.read.mockImplementation(async (executor: Executor | null, _name: string, fallback: unknown) => {
    if (!executor) throw new Error("No executor");
    return stores.get(executor.target.id) ?? fallback;
  });
  m.write.mockImplementation(async (executor: Executor, _name: string, data: Record<string, unknown>) => {
    stores.set(executor.target.id, { ...data });
  });
});

describe("effective installation login policy", () => {
  it.each([1, 2, 3, 4, 5, 6, 7])("returns exactly the enabled methods without a session (mask %s)", async mask => {
    const methods = { password: Boolean(mask & 1), passkey: Boolean(mask & 2), recovery: Boolean(mask & 4) };
    stores.set("local", {
      loginAllowPassword: methods.password, loginAllowPasskey: methods.passkey,
      loginAllowRecovery: methods.recovery, hcaptchaEnabled: true, hcaptchaSitekey: "public-key", hcaptchaSecret: "private-key",
    });
    const { resolveEffectiveLoginMethods } = await import("./login-methods.service.js");
    expect(await resolveEffectiveLoginMethods()).toEqual({ ...methods, hcaptchaEnabled: true, hcaptchaSitekey: "public-key" });
    expect(m.read).toHaveBeenCalledWith(local, "security-settings", expect.any(Object));
  });

  it("does not take the policy from an ambient remote target or a no-session default", async () => {
    const { securitySettingsService: settings } = await import("../../admin/services/security-settings.service.js");
    expect((await settings.read()).loginAllowPassword).toBe(true);
    m.context = remote;
    expect((await settings.read()).loginAllowPassword).toBe(true);
    const { resolveEffectiveLoginMethods } = await import("./login-methods.service.js");
    expect(await resolveEffectiveLoginMethods()).toMatchObject({ password: false, passkey: true, recovery: false });
  });

  it("invalidates the same cache after an implicit local save and keeps targets isolated", async () => {
    const { securitySettingsService: settings } = await import("../../admin/services/security-settings.service.js");
    const { resolveEffectiveLoginMethods } = await import("./login-methods.service.js");
    await resolveEffectiveLoginMethods();
    m.context = remote;
    await settings.read();
    m.context = local;
    await settings.write(undefined, passwordOnly);
    expect(await resolveEffectiveLoginMethods()).toMatchObject({ password: true, passkey: false });
    m.context = remote;
    expect(await settings.read()).toMatchObject(passwordOnly);
  });

  it("uses password only for an installation without stored settings", async () => {
    stores.delete("local");
    const { resolveEffectiveLoginMethods } = await import("./login-methods.service.js");
    expect(await resolveEffectiveLoginMethods()).toMatchObject({ password: true, passkey: false, recovery: false });
  });
});

describe("at least one login method", () => {
  it.each([
    { loginAllowPasskey: false },
    { loginAllowPassword: false, loginAllowPasskey: false, loginAllowRecovery: false },
  ])("rejects an empty selection before writing (%j)", async partial => {
    const { securitySettingsService: settings } = await import("../../admin/services/security-settings.service.js");
    await expect(settings.write(local, partial)).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(m.write).not.toHaveBeenCalled();
    expect(await settings.read(local)).toMatchObject(passkeyOnly);
  });

  it("allows switching the last active method in one save", async () => {
    const { securitySettingsService: settings } = await import("../../admin/services/security-settings.service.js");
    await expect(settings.write(local, { loginAllowPasskey: false, loginAllowRecovery: true })).resolves.toMatchObject({
      loginAllowPassword: false, loginAllowPasskey: false, loginAllowRecovery: true,
    });
    expect(m.write).toHaveBeenCalledOnce();
  });

  it("keeps the saved policy after a failed write", async () => {
    const { securitySettingsService: settings } = await import("../../admin/services/security-settings.service.js");
    m.write.mockRejectedValueOnce(new Error("write failed"));
    await expect(settings.write(local, passwordOnly)).rejects.toThrow("write failed");
    expect(await settings.read(local)).toMatchObject(passkeyOnly);
  });
});
