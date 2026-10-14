// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/index.js", () => ({
  settingsRepository: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    getByCategory: vi.fn(async () => [] as Array<{ key: string; value: string }>),
  },
}));

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(async () => {
      throw new Error("ENOENT");
    }),
  },
}));

import { moduleRegistryService, defaultEnabledModuleIds } from "./module-registry.service.js";
import { settingsRepository } from "../repositories/index.js";

describe("moduleRegistryService", () => {
  beforeEach(() => {
    vi.mocked(settingsRepository.getByCategory).mockReset();
    vi.mocked(settingsRepository.getByCategory).mockResolvedValue([]);
    vi.mocked(settingsRepository.get).mockReset();
    vi.mocked(settingsRepository.set).mockReset();
    vi.mocked(settingsRepository.delete).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes a static catalog with the panel UI presentation overlay", () => {
    const monitor = moduleRegistryService.getById("monitor");
    expect(monitor?.kind).toBe("module");
    expect(monitor?.icon).toBe("activity");

    const mail = moduleRegistryService.getById("mail");
    expect(mail?.configFields?.[0]?.type).toBe("select");
    expect(mail?.configFields?.[0]?.required).toBe(true);
    expect(mail?.dependencies).toEqual(["dns"]);

    const repositoryStore = moduleRegistryService.getById("repository-store");
    expect(repositoryStore?.name).toBe("GitHub");
    expect(repositoryStore?.tag).toBe("free");
    expect(repositoryStore?.icon).toBe("brand-github");

    const fs = moduleRegistryService.getById("filesystem-mcp");
    expect(fs?.kind).toBe("mcp_server");
    expect(fs?.icon).toBe("folder");
    expect(fs?.configFields?.[0]?.key).toBe("rootPath");
  });

  it("resolves dependency order so prerequisites come first", () => {
    expect(moduleRegistryService.getById("mail")?.dependencies).toEqual(["dns"]);
    expect(moduleRegistryService.resolveInstallOrder("mail")).toEqual(["dns", "mail"]);
  });

  it("getAll returns a non-empty list and omits legacy codes", () => {
    const all = moduleRegistryService.getAll();
    expect(all.length).toBeGreaterThan(0);
    // "terminal" es hoy un módulo real del catálogo (FAB + sidebar).
    expect(all.some((m) => m.id === "terminal")).toBe(true);
    // El módulo standalone "ssl" se eliminó (la emisión vive en nginx).
    expect(all.some((m) => m.id === "ssl")).toBe(false);
  });

  it("getEnabledMap reflects panel_settings entries", async () => {
    vi.mocked(settingsRepository.getByCategory).mockResolvedValueOnce([
      { key: "module.monitor.enabled", value: "true" } as never,
      { key: "module.dns.enabled", value: "false" } as never,
    ]);

    const map = await moduleRegistryService.getEnabledMap();
    expect(map.monitor).toBe(true);
    expect(map.dns).toBe(false);
    // Catalog entries that have no explicit row default to false.
    expect(map.backups).toBe(false);
  });

  it("enable() writes the corresponding setting", async () => {
    await moduleRegistryService.enable("monitor");
    expect(settingsRepository.set).toHaveBeenCalledWith(
      "module.monitor.enabled",
      "true",
      "modules",
      expect.any(String),
    );
  });

  it("enable() throws on unknown modules", async () => {
    await expect(moduleRegistryService.enable("does-not-exist")).rejects.toThrow();
  });

  // ── SSOT: the default-enabled set is a subset of the single catalog ──────
  describe("catalog SSOT invariants", () => {
    it("exposes the frozen default-enabled id snapshot", () => {
      expect(Array.isArray(defaultEnabledModuleIds)).toBe(true);
      expect(defaultEnabledModuleIds.length).toBeGreaterThan(0);
      expect(Object.isFrozen(defaultEnabledModuleIds)).toBe(true);
      // Historically load-bearing members that must stay on by default.
      // The old dashboard module is gone: the panel home IS the assistant.
      expect(defaultEnabledModuleIds).not.toContain("dashboard");
      expect(defaultEnabledModuleIds).toContain("assistant");
      expect(defaultEnabledModuleIds).toContain("obsidian"); // implied companion
    });

    it("every default-enabled id resolves to a catalog row (no phantom defaults)", () => {
      for (const id of defaultEnabledModuleIds) {
        expect(moduleRegistryService.getById(id), `default id "${id}" must be catalogued`).toBeDefined();
      }
    });

    it("fresh-install enabled map is exactly the default set restricted to the catalog", async () => {
      // No settings rows → getEnabledMap must mark true precisely the
      // default-enabled ids and nothing else. Guards against the two lists
      // (DEFAULT_ENABLED_MODULES ⊕ CATALOG) drifting apart.
      vi.mocked(settingsRepository.getByCategory).mockResolvedValueOnce([]);
      const map = await moduleRegistryService.getEnabledMap();
      const enabledInMap = Object.entries(map)
        .filter(([, on]) => on)
        .map(([id]) => id)
        .sort();
      expect(enabledInMap).toEqual([...defaultEnabledModuleIds].sort());
    });
  });
});
