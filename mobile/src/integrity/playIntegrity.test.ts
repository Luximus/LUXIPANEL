import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: { OS: "android" },
  env: { playIntegrityEnabled: false, playIntegrityDevBypass: false, googleCloudProjectNumber: "123" },
  missing: false,
  loads: 0,
  prepare: vi.fn(async () => {}),
  token: vi.fn(async () => "native-integrity-token"),
}));
vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("../config/env", () => ({ ENV: mocks.env }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.stubGlobal("__DEV__", false);
  mocks.platform.OS = "android"; mocks.env.playIntegrityEnabled = false; mocks.env.playIntegrityDevBypass = false;
  mocks.missing = false; mocks.loads = 0;
  vi.doMock("@expo/app-integrity", () => {
    mocks.loads++;
    if (mocks.missing) throw new Error("Cannot find native module 'ExpoAppIntegrity'");
    return { prepareIntegrityTokenProviderAsync: mocks.prepare, requestIntegrityCheckAsync: mocks.token };
  });
});

it("starts and keeps disabled integrity a no-op when its native module is missing", async () => {
  mocks.missing = true;
  const integrity = await import("./playIntegrity");
  integrity.warmUpIntegrity();
  expect(await integrity.getIntegrityToken("hash")).toMatchObject({ code: "DISABLED" });
  expect(mocks.loads).toBe(0);
});
it("does not load Android integrity on iOS even when enabled", async () => {
  mocks.platform.OS = "ios"; mocks.env.playIntegrityEnabled = true; mocks.missing = true;
  const integrity = await import("./playIntegrity");
  expect(await integrity.getIntegrityToken("hash")).toMatchObject({ code: "DISABLED" });
  expect(mocks.loads).toBe(0);
});
it("still prepares and supplies a native token when enabled", async () => {
  mocks.env.playIntegrityEnabled = true;
  const integrity = await import("./playIntegrity");
  expect(mocks.loads).toBe(0);
  expect(await integrity.getIntegrityToken("hash")).toEqual({ ok: true, token: "native-integrity-token" });
  expect(mocks.prepare).toHaveBeenCalledWith("123"); expect(mocks.token).toHaveBeenCalledWith("hash");
});
it("blocks protected requests if required native integrity is unavailable", async () => {
  mocks.env.playIntegrityEnabled = true; mocks.missing = true;
  const { requestWithPlayIntegrity } = await import("./requestWithPlayIntegrity");
  const run = vi.fn();
  await expect(requestWithPlayIntegrity({ action: "protected", payloadRelevantForHash: {}, run })).rejects.toMatchObject({ code: "PREPARE_FAILED" });
  expect(run).not.toHaveBeenCalled(); expect(mocks.loads).toBe(1);
});
