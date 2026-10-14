// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — shared/utils/crypto.ts
 */

import { describe, it, expect } from "vitest";
import {
  randomHex,
  randomBase64url,
  uuid,
  hmacSha256,
  encrypt,
  decrypt,
  sha256,
} from "./crypto.js";

describe("randomHex", () => {
  it("returns a hex string of the requested byte length * 2", () => {
    const h = randomHex(16);
    expect(h).toHaveLength(32);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("returns unique values", () => {
    expect(randomHex()).not.toBe(randomHex());
  });
});

describe("randomBase64url", () => {
  it("returns a base64url string", () => {
    const v = randomBase64url(24);
    expect(v).not.toMatch(/[+/=]/); // base64url has no +/=
    expect(v.length).toBeGreaterThan(0);
  });
});

describe("uuid", () => {
  it("returns a valid UUID v4 pattern", () => {
    const id = uuid();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("hmacSha256", () => {
  it("produces deterministic output", () => {
    const a = hmacSha256("key", "value");
    const b = hmacSha256("key", "value");
    expect(a).toBe(b);
  });

  it("produces different output for different keys", () => {
    expect(hmacSha256("key1", "value")).not.toBe(hmacSha256("key2", "value"));
  });

  it("returns a 64-char hex string", () => {
    expect(hmacSha256("k", "v")).toHaveLength(64);
    expect(hmacSha256("k", "v")).toMatch(/^[0-9a-f]+$/);
  });
});

describe("encrypt / decrypt", () => {
  // 32-byte key in hex = 64 hex chars
  const KEY = "0".repeat(64);

  it("round-trips a string", () => {
    const token = encrypt("hello world", KEY);
    expect(decrypt(token, KEY)).toBe("hello world");
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    expect(encrypt("same", KEY)).not.toBe(encrypt("same", KEY));
  });

  it("token format is iv:authTag:cipher (all hex)", () => {
    const token = encrypt("test", KEY);
    const parts = token.split(":");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(part).toMatch(/^[0-9a-f]+$/);
    }
  });

  it("throws on invalid token format", () => {
    expect(() => decrypt("bad", KEY)).toThrow("Invalid encrypted token format");
  });

  it("throws on wrong key (auth tag mismatch)", () => {
    const token = encrypt("secret", KEY);
    const WRONG_KEY = "f".repeat(64);
    expect(() => decrypt(token, WRONG_KEY)).toThrow();
  });
});

describe("sha256", () => {
  it("returns a 64-char hex string", () => {
    const h = sha256("hello");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    expect(sha256("test")).toBe(sha256("test"));
  });

  it("well-known value", () => {
    // echo -n "hello" | sha256sum → 2cf24dba...
    expect(sha256("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});
