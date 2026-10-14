// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests for the LOCAL SSH target vault at-rest crypto.
 *
 * These pin the CURRENT behaviour of `encryptSecret` / `decryptSecret`
 * (AES-256-GCM + HKDF-SHA256, payload `v2:<iv>:<tag>:<ct>`) BEFORE any refactor
 * touches this auth-adjacent surface. The master key is derived once per process
 * from CREDENTIAL_VAULT_KEY (or, as a dev fallback, the JWT secret), so all
 * round-trips in one run share the same key — exactly the production invariant.
 */

import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "./servers-vault-crypto.js";

describe("servers-vault-crypto — at-rest AES-256-GCM + HKDF", () => {
  it("round-trips arbitrary non-empty plaintext (encrypt → decrypt is identity)", () => {
    for (const plain of [
      "hunter2",
      "unicode: ñ 世界 🔐",
      "-----BEGIN OPENSSH PRIVATE KEY-----\nline\n-----END-----\n",
      "a".repeat(4096),
    ]) {
      const blob = encryptSecret(plain);
      expect(decryptSecret(blob)).toBe(plain);
    }
  });

  it("EDGE CASE: an empty-string secret does NOT round-trip (decrypt throws)", () => {
    // Empty plaintext → empty ciphertext hex → the `v2:<iv>:<tag>:` envelope
    // has an empty 4th component, which decryptSecret rejects as malformed.
    // Documented, not exercised in prod: callers encrypt only non-empty secrets
    // (Zod `secret: min(1)`; passphrase encrypted only when truthy).
    const blob = encryptSecret("");
    expect(blob.endsWith(":")).toBe(true);
    expect(() => decryptSecret(blob)).toThrow(/format/i);
  });

  it("emits the versioned `v2:<ivHex>:<tagHex>:<ctHex>` envelope", () => {
    const blob = encryptSecret("secret");
    const parts = blob.split(":");
    expect(parts[0]).toBe("v2");
    expect(parts).toHaveLength(4);
    // 12-byte IV → 24 hex chars; 16-byte GCM tag → 32 hex chars.
    expect(parts[1]).toMatch(/^[0-9a-f]{24}$/);
    expect(parts[2]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[3]).toMatch(/^[0-9a-f]*$/);
  });

  it("uses a fresh random IV per call (same plaintext → different ciphertext)", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same");
    expect(decryptSecret(b)).toBe("same");
  });

  it("THROWS on a tampered ciphertext (GCM auth tag mismatch, never silent)", () => {
    const blob = encryptSecret("integrity-protected");
    const [v, iv, tag, ct] = blob.split(":");
    // Flip the last ciphertext byte's low nibble.
    const flipped = ct.slice(0, -1) + (ct.slice(-1) === "0" ? "1" : "0");
    const tampered = [v, iv, tag, flipped].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("THROWS on a tampered auth tag", () => {
    const blob = encryptSecret("integrity-protected");
    const [v, iv, tag, ct] = blob.split(":");
    const badTag = tag.slice(0, -1) + (tag.slice(-1) === "0" ? "1" : "0");
    expect(() => decryptSecret([v, iv, badTag, ct].join(":"))).toThrow();
  });

  it("THROWS when the `v2:` version prefix is missing", () => {
    expect(() => decryptSecret("v1:aa:bb:cc")).toThrow(/v2 prefix/i);
    expect(() => decryptSecret("plaintext")).toThrow(/v2 prefix/i);
  });

  it("THROWS when the envelope is missing a component", () => {
    expect(() => decryptSecret("v2:onlyiv")).toThrow(/format/i);
    expect(() => decryptSecret("v2:iv:tag")).toThrow(/format/i);
  });
});
