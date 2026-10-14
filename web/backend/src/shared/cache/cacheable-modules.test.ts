// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — shared/cache/cacheable-modules.ts
 *
 * These guard the security invariants: allowlist-by-default, no volatile
 * module ever cacheable, no NEVER_CACHE collection registered, and the
 * registry stays internally consistent.
 */

import { describe, it, expect } from "vitest";
import {
  VOLATILE_MODULES,
  NEVER_CACHE,
  assertNotVolatile,
  isVolatileModule,
  cachePolicyFor,
  isCacheable,
  listCacheableCollections,
  cacheableRegistry,
} from "./cacheable-modules.js";

describe("default is NOT cacheable (allowlist)", () => {
  it("returns null for an unknown module/collection", () => {
    expect(cachePolicyFor("totally-unknown", "whatever")).toBeNull();
    expect(isCacheable("totally-unknown", "whatever")).toBe(false);
  });

  it("returns null for a known module but unregistered collection", () => {
    expect(cachePolicyFor("auth", "not-registered")).toBeNull();
    expect(cachePolicyFor("mail", "not-registered")).toBeNull();
  });
});

describe("volatile modules are never cacheable", () => {
  it("every volatile module returns null and reports volatile", () => {
    for (const mod of VOLATILE_MODULES) {
      expect(isVolatileModule(mod)).toBe(true);
      expect(cachePolicyFor(mod, "anything")).toBeNull();
      expect(isCacheable(mod, "anything")).toBe(false);
    }
  });

  it("assertNotVolatile throws for volatile modules, passes otherwise", () => {
    for (const mod of VOLATILE_MODULES) {
      expect(() => assertNotVolatile(mod)).toThrow(/volatile/i);
    }
    expect(() => assertNotVolatile("auth")).not.toThrow();
    expect(() => assertNotVolatile("mail")).not.toThrow();
  });

  it("the agreed volatile set is present", () => {
    // `cron` and `backup` are module-level NOT volatile because their
    // config collections (`cron/jobs`, `backup/schedules`) are static; the
    // volatile run-streams (`cron/history`, `backup/jobs`) are blocked
    // individually in NEVER_CACHE.
    for (const mod of [
      "files",
      "terminal",
      "terminal-cli",
      "monitor",
      "security-audit",
    ]) {
      expect(VOLATILE_MODULES.has(mod)).toBe(true);
    }
  });
});

describe("NEVER_CACHE security/ephemeral collections", () => {
  it("keeps hosting tenant records off the cache and out of the exported policy", () => {
    expect(NEVER_CACHE.has("hosting/accounts")).toBe(true);
    expect(cachePolicyFor("hosting", "accounts")).toBeNull();
    expect(listCacheableCollections().some((entry) => entry.module === "hosting" && entry.collection === "accounts")).toBe(false);
  });

  it("auth security collections are blocked (defence in depth)", () => {
    // The `auth` module currently has no DataTable endpoints so it's not
    // registered as cacheable, but if a future feature added an
    // `auth/<safe-collection>`, the NEVER_CACHE list must still block the
    // sensitive collections below.
    for (const key of NEVER_CACHE) {
      const [mod, col] = key.split("/");
      expect(cachePolicyFor(mod!, col!)).toBeNull();
      expect(isCacheable(mod!, col!)).toBe(false);
    }
  });
});

describe("registry integrity", () => {
  const entries = listCacheableCollections();

  it("no cacheable module is volatile", () => {
    for (const mod of Object.keys(cacheableRegistry)) {
      expect(VOLATILE_MODULES.has(mod)).toBe(false);
    }
  });

  it("no cacheable entry is on NEVER_CACHE", () => {
    for (const e of entries) {
      expect(NEVER_CACHE.has(`${e.module}/${e.collection}`)).toBe(false);
    }
  });

  it("every entry has a positive interval and (if present) a non-empty projection", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.policy.defaultIntervalSeconds).toBeGreaterThan(0);
      if (e.policy.projection !== undefined) {
        expect(e.policy.projection.length).toBeGreaterThan(0);
      }
    }
  });

  it("every system-collector entry declares a collector id", () => {
    for (const e of entries) {
      if (e.policy.source === "system-collector") {
        expect(e.policy.collector).toBeTruthy();
      }
    }
  });

  it("listCacheableCollections is consistent with cachePolicyFor", () => {
    for (const e of entries) {
      expect(cachePolicyFor(e.module, e.collection)).toBe(e.policy);
    }
  });

  it("the registry is deeply frozen", () => {
    expect(Object.isFrozen(cacheableRegistry)).toBe(true);
    for (const mod of Object.values(cacheableRegistry)) {
      expect(Object.isFrozen(mod)).toBe(true);
      expect(Object.isFrozen(mod.collections)).toBe(true);
    }
  });
});

describe("known agreed entries are present with the expected source", () => {
  it.each([
    ["users", "system", "system-collector"],
    ["users", "roles", "system-collector"],
    ["admin", "settings", "sidecar-mirror"],
    ["mail", "accounts", "system-collector"],
    ["mail", "filters", "sidecar-mirror"],
    ["notifications", "notifications", "sidecar-mirror"],
    ["webhooks", "webhooks", "sidecar-mirror"],
    ["webhooks", "api-keys", "sidecar-mirror"],
    ["nginx", "sites", "system-collector"],
  ])("%s/%s -> %s", (mod, col, source) => {
    const p = cachePolicyFor(mod, col);
    expect(p).not.toBeNull();
    expect(p!.source).toBe(source);
  });
});
