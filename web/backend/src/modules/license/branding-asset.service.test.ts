// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests — branding-asset.service.ts
 *
 * This service IS live in standalone: it turns external branding image URLs into
 * hash-addressed `/api/branding/asset/<hash>` proxy paths, caches bytes in Redis,
 * and keeps a durable on-disk URL map so a Redis restart doesn't 404 the logo.
 * These tests pin the observable contract (hashing, register/serve/sourceUrlFor,
 * SSRF guard = only serve previously-registered hashes, MIME allow-list,
 * negative caching) with an in-memory Redis and a stubbed fetch.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// Point the durable map at a throwaway file BEFORE the service module evaluates
// its candidate-path list (vi.hoisted runs before the static import below).
const H = vi.hoisted(() => {
  const nodeOs = require("node:os");
  const nodePath = require("node:path");
  const p = nodePath.join(nodeOs.tmpdir(), `lxp-branding-assets-${process.pid}-${Date.now()}.json`);
  process.env.BRANDING_ASSET_FILE = p;
  return { p };
});

// In-memory Redis supporting the subset the service uses: get/set/getBuffer.
const store = new Map<string, string | Buffer>();
vi.mock("../../shared/redis/index.js", () => ({
  getRedis: () => ({
    async get(k: string) {
      const v = store.get(k);
      return typeof v === "string" ? v : v == null ? null : v.toString();
    },
    async getBuffer(k: string) {
      const v = store.get(k);
      return Buffer.isBuffer(v) ? v : v == null ? null : Buffer.from(String(v));
    },
    async set(k: string, v: string | Buffer) {
      store.set(k, v);
      return "OK";
    },
  }),
}));

import { brandingAssetService, shouldProxyUrl } from "./branding-asset.service.js";

function expectedHash(url: string): string {
  return crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
}

const PNG = "https://cdn.example.com/logo.png";

beforeEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

describe("shouldProxyUrl", () => {
  it("is true only for http(s) URLs", () => {
    expect(shouldProxyUrl("https://x/y.png")).toBe(true);
    expect(shouldProxyUrl("http://x/y.png")).toBe(true);
    expect(shouldProxyUrl("/api/branding/asset/abc")).toBe(false);
    expect(shouldProxyUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(shouldProxyUrl("")).toBe(false);
    expect(shouldProxyUrl(null)).toBe(false);
    expect(shouldProxyUrl(undefined)).toBe(false);
  });
});

describe("register", () => {
  it("returns a deterministic /api/branding/asset/<sha1-16> path", async () => {
    const p = await brandingAssetService.register(PNG);
    expect(p).toBe(`/api/branding/asset/${expectedHash(PNG)}`);
    // Idempotent — same URL -> same hash.
    expect(await brandingAssetService.register(PNG)).toBe(p);
  });
});

describe("sourceUrlFor", () => {
  it("reverses a registered proxy path back to the original URL", async () => {
    const p = await brandingAssetService.register(PNG);
    expect(await brandingAssetService.sourceUrlFor(p)).toBe(PNG);
  });

  it("passes through anything that is not a proxy path", async () => {
    expect(await brandingAssetService.sourceUrlFor(PNG)).toBe(PNG);
    expect(await brandingAssetService.sourceUrlFor("")).toBe("");
  });

  it("returns the input unchanged when the hash is unknown", async () => {
    const unknown = "/api/branding/asset/" + "a".repeat(16);
    expect(await brandingAssetService.sourceUrlFor(unknown)).toBe(unknown);
  });
});

describe("serve (SSRF guard + fetch/caching)", () => {
  it("returns null for a malformed hash without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await brandingAssetService.serve("not-a-hash")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null for an unregistered (but well-formed) hash", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await brandingAssetService.serve("b".repeat(16))).toBeNull();
    // Never fetches a URL it wasn't told about (SSRF guard).
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches and caches bytes for a registered hash", async () => {
    const hash = expectedHash(PNG);
    await brandingAssetService.register(PNG);

    const body = Buffer.from([1, 2, 3, 4]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, { status: 200, headers: { "content-type": "image/png" } }) as any,
    );

    const first = await brandingAssetService.serve(hash);
    expect(first?.mime).toBe("image/png");
    expect(Buffer.from(first!.bytes)).toEqual(body);

    // Second call is served from the Redis byte cache (no second fetch).
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const second = await brandingAssetService.serve(hash);
    expect(Buffer.from(second!.bytes)).toEqual(body);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a non-image MIME and negatively caches it", async () => {
    const hash = expectedHash(PNG);
    await brandingAssetService.register(PNG);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }) as any,
    );

    expect(await brandingAssetService.serve(hash)).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Negative cache short-circuits the retry (no further fetch).
    fetchSpy.mockClear();
    expect(await brandingAssetService.serve(hash)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null when the upstream responds non-OK", async () => {
    const hash = expectedHash(PNG);
    await brandingAssetService.register(PNG);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 404 }) as any,
    );
    expect(await brandingAssetService.serve(hash)).toBeNull();
  });
});
