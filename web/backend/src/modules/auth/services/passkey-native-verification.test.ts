import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync(
    new URL("./__fixtures__/native-passkey-registration.json", import.meta.url),
    "utf8",
  ),
);
const mock = vi.hoisted(() => ({
  challenge: "",
  create: vi.fn().mockImplementation(async (value: unknown) => value),
}));
vi.mock("../../../shared/redis/index.js", () => ({
  getRedis: () => ({ get: async () => mock.challenge, del: vi.fn() }),
}));
vi.mock("../repositories/index.js", () => ({
  passkeyRepository: { create: mock.create },
}));
vi.mock("../../../config/auth.js", () => ({
  authConfig: {
    webauthn: {
      rpId: "panel.example",
      rpName: "LUXIPANEL",
      origin: "https://panel.example",
    },
  },
}));
vi.mock("../../../shared/logger/index.js", () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  logger: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock("../../../shared/panel-url/index.js", () => ({
  getPanelOrigin: async () => "https://panel.example",
}));
import { passkeyService } from "./passkey.service.js";
import type { PanelUser } from "../models/index.js";
beforeEach(() => {
  mock.challenge = JSON.parse(
    Buffer.from(fixture.response.clientDataJSON, "base64url").toString(),
  ).challenge;
  mock.create.mockClear();
});
describe("native ceremony uses the existing WebAuthn verifier", () => {
  it("verifies the browser credential cryptographically with the panel RP and origin", async () => {
    const result = await passkeyService.verifyRegistration(
      { id: 7, username: "qa" } as PanelUser,
      fixture,
      "Native",
      "https://panel.example",
      "ceremony-id",
    );
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(result.credentialId).toBe(fixture.id);
  });
  it("rejects a credential when the bound challenge is different", async () => {
    mock.challenge = "another-challenge";
    await expect(
      passkeyService.verifyRegistration(
        { id: 7 } as PanelUser,
        fixture,
        "Native",
        "https://panel.example",
        "ceremony-id",
      ),
    ).rejects.toThrow();
    expect(mock.create).not.toHaveBeenCalled();
  });
});
