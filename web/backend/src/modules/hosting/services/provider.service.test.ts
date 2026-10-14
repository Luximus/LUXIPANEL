// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ providers: [] as Array<Record<string, unknown>>, findAccount: vi.fn() }));
vi.mock("../repositories/provider.repository.js", () => ({ providerRepository: {
  list: async () => mocks.providers,
  findAccount: mocks.findAccount,
} }));

const { providerService } = await import("./provider.service.js");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

beforeEach(() => { mocks.providers = []; mocks.findAccount.mockReset(); });

describe("hosting provider isolation", () => {
  it("accepts only the current key of an enabled provider", async () => {
    mocks.providers = [{ id: "a", enabled: true, keyHash: hash("lhp_valid"), operations: ["accounts.read"] }];
    expect((await providerService.authenticate("lhp_valid")).id).toBe("a");
    await expect(providerService.authenticate("lhp_wrong")).rejects.toThrow("inválida");
    mocks.providers[0]!.enabled = false;
    await expect(providerService.authenticate("lhp_valid")).rejects.toThrow("inválida");
  });

  it("rejects operations not granted by HOSTING", () => {
    const provider = { operations: ["accounts.read"] } as never;
    expect(() => providerService.assertOperation(provider, "accounts.delete")).toThrow("no concedida");
  });

  it("does not reveal another provider account", async () => {
    mocks.findAccount.mockResolvedValue(null);
    await expect(providerService.getAccount({ id: "a" } as never, "foreign-account")).rejects.toThrow("not found");
  });
});
