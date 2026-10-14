// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization — the BitNinja license-key config store: masking (the raw
 * key is never returned to the browser), tokenSet flag, and the persistence
 * calls into the shared panel-settings repository under the "bitninja"
 * category.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../admin/repositories/index.js", () => ({
  settingsRepository: { getByCategory: vi.fn(), set: vi.fn() },
}));
vi.mock("../../admin/services/server-settings.service.js", () => ({
  serverSettingsService: { remove: vi.fn() },
}));

import { bitninjaConfigService } from "./bitninja-config.service.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import { serverSettingsService } from "../../admin/services/server-settings.service.js";

const mockedGet = vi.mocked(settingsRepository.getByCategory);
const mockedSet = vi.mocked(settingsRepository.set);
const mockedRemove = vi.mocked(serverSettingsService.remove);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getConfig — masking", () => {
  it("no stored key → tokenSet false, empty preview", async () => {
    mockedGet.mockResolvedValue([] as never);
    expect(await bitninjaConfigService.getConfig(null)).toEqual({ tokenSet: false, tokenPreview: "" });
  });

  it("long key → first4…last4 mask, tokenSet true", async () => {
    mockedGet.mockResolvedValue([{ key: "bitninja_license_key", value: "ABCDEF123456WXYZ" }] as never);
    expect(await bitninjaConfigService.getConfig(null)).toEqual({ tokenSet: true, tokenPreview: "ABCD…WXYZ" });
  });

  it("short key (<=8) → fully bulleted, never revealed", async () => {
    mockedGet.mockResolvedValue([{ key: "bitninja_license_key", value: "abc123" }] as never);
    const cfg = await bitninjaConfigService.getConfig(null);
    expect(cfg.tokenSet).toBe(true);
    expect(cfg.tokenPreview).toBe("••••••");
    expect(cfg.tokenPreview).not.toContain("abc123");
  });
});

describe("saveKey / getKey / clearKey", () => {
  it("saveKey persists the trimmed key under the bitninja category", async () => {
    await bitninjaConfigService.saveKey("  KEY-123  ", null);
    expect(mockedSet).toHaveBeenCalledWith("bitninja_license_key", "KEY-123", "bitninja", "BitNinja license key", undefined);
  });

  it("getKey returns the raw stored value (empty string when unset)", async () => {
    mockedGet.mockResolvedValue([{ key: "bitninja_license_key", value: "RAWKEY" }] as never);
    expect(await bitninjaConfigService.getKey(null)).toBe("RAWKEY");
    mockedGet.mockResolvedValue([] as never);
    expect(await bitninjaConfigService.getKey(null)).toBe("");
  });

  it("clearKey delegates to serverSettingsService.remove", async () => {
    await bitninjaConfigService.clearKey(null);
    expect(mockedRemove).toHaveBeenCalledWith(null, "bitninja_license_key");
  });
});
