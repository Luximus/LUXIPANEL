// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — webhooks/services/api-key.service.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the repository BEFORE importing the service under test.
vi.mock("../repositories/api-key.repository.js", () => ({
  apiKeyRepository: {
    create: vi.fn(),
    findAll: vi.fn(async () => []),
    findByHash: vi.fn(),
    touchLastUsed: vi.fn(async () => undefined),
    delete: vi.fn(async () => true),
  },
}));

import { apiKeyService } from "./api-key.service.js";
import { apiKeyRepository } from "../repositories/api-key.repository.js";
import { sha256 } from "../../../shared/utils/crypto.js";

describe("apiKeyService.generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiKeyRepository.create).mockImplementation(
      async (data) => ({ id: 1, createdAt: new Date().toISOString(), ...data }) as never,
    );
  });

  it("returns a key starting with lxp_", async () => {
    const { key } = await apiKeyService.generate({ name: "test", scopes: ["read"] });
    expect(key).toMatch(/^lxp_/);
  });

  it("key has prefix of first 12 chars stored separately", async () => {
    const { key, record } = await apiKeyService.generate({ name: "test", scopes: [] });
    expect(record.keyPrefix).toHaveLength(12);
    expect(key.startsWith(record.keyPrefix)).toBe(true);
  });

  it("stores SHA-256 hash of the key, not plaintext", async () => {
    const { key, record } = await apiKeyService.generate({ name: "test", scopes: [] });
    expect(record.keyHash).toBe(sha256(key));
    expect(record.keyHash).not.toContain(key);
  });

  it("generates unique keys on each call", async () => {
    const a = await apiKeyService.generate({ name: "a", scopes: [] });
    const b = await apiKeyService.generate({ name: "b", scopes: [] });
    expect(a.key).not.toBe(b.key);
  });
});

describe("apiKeyService.validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for non-lxp_ prefixed keys", async () => {
    expect(await apiKeyService.validate("plain-token")).toBeNull();
    expect(apiKeyRepository.findByHash).not.toHaveBeenCalled();
  });

  it("returns null when key hash not found in DB", async () => {
    vi.mocked(apiKeyRepository.findByHash).mockResolvedValue(undefined);
    expect(await apiKeyService.validate("lxp_notexist")).toBeNull();
  });

  it("returns null for disabled keys", async () => {
    vi.mocked(apiKeyRepository.findByHash).mockResolvedValue({
      id: 1, enabled: false, expiresAt: null,
    } as never);
    expect(await apiKeyService.validate("lxp_disabled_key")).toBeNull();
  });

  it("returns null for expired keys", async () => {
    vi.mocked(apiKeyRepository.findByHash).mockResolvedValue({
      id: 1, enabled: true, expiresAt: new Date(Date.now() - 1000),
    } as never);
    expect(await apiKeyService.validate("lxp_expired_key")).toBeNull();
  });

  it("returns the record and touches lastUsedAt for valid keys", async () => {
    const mockRecord = { id: 42, enabled: true, expiresAt: null, keyPrefix: "lxp_test" };
    vi.mocked(apiKeyRepository.findByHash).mockResolvedValue(mockRecord as never);

    const result = await apiKeyService.validate("lxp_valid_key_here");
    expect(result).not.toBeNull();
    expect(result?.id).toBe(42);
    expect(apiKeyRepository.touchLastUsed).toHaveBeenCalledWith(42);
  });
});
