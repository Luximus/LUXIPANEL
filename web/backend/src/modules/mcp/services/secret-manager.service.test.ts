// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, beforeAll } from "vitest";
import { env } from "../../../config/env.js";
import { secretManagerService } from "./secret-manager.service.js";

describe("SecretManager", () => {
  beforeAll(() => {
    // Set encryption key for tests. The service reads the Zod-validated
    // `env.ENCRYPTION_KEY` (bound at boot), not `process.env` directly, so the
    // test drives the value through `env`.
    env.ENCRYPTION_KEY = ("test-" + "encryption-key-at-least-32-characters-long");
  });

  it("should encrypt and decrypt plaintext", async () => {
    const plaintext = '{"password": "secret123", "token": "abcdef"}';

    // Encrypt
    const { encrypted } = await secretManagerService.encrypt(plaintext);
    expect(encrypted).toBeInstanceOf(Buffer);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);

    // Decrypt — succeeding proves the async scrypt KDF derives the SAME key on
    // decrypt as on encrypt (same masterKey + salt → identical 256-bit key).
    const decrypted = await secretManagerService.decrypt(encrypted, "v1");
    expect(decrypted).toBe(plaintext);
  });

  it("derives a stable key: a ciphertext round-trips across independent calls", async () => {
    // Two separate decrypt calls re-derive the key from the embedded salt; both
    // must succeed and agree — the KDF is deterministic and event-loop-safe.
    const plaintext = "stable-key-check";
    const { encrypted } = await secretManagerService.encrypt(plaintext);
    const [d1, d2] = await Promise.all([
      secretManagerService.decrypt(encrypted, "v1"),
      secretManagerService.decrypt(encrypted, "v1"),
    ]);
    expect(d1).toBe(plaintext);
    expect(d2).toBe(plaintext);
  });

  it("should produce different ciphertexts for same plaintext (due to random IV/salt)", async () => {
    const plaintext = "same text";

    const { encrypted: enc1 } = await secretManagerService.encrypt(plaintext);
    const { encrypted: enc2 } = await secretManagerService.encrypt(plaintext);

    // Different ciphertexts
    expect(enc1.toString("hex")).not.toBe(enc2.toString("hex"));

    // But both decrypt to same plaintext
    expect(await secretManagerService.decrypt(enc1, "v1")).toBe(plaintext);
    expect(await secretManagerService.decrypt(enc2, "v1")).toBe(plaintext);
  });

  it("should fail to decrypt with wrong key", async () => {
    const { encrypted } = await secretManagerService.encrypt("secret");

    // Change key (the service re-reads env.ENCRYPTION_KEY on each call).
    const originalKey = env.ENCRYPTION_KEY;
    env.ENCRYPTION_KEY = "different-key-that-is-32-chars-long";
    try {
      await expect(secretManagerService.decrypt(encrypted, "v1")).rejects.toThrow("Failed to decrypt");
    } finally {
      env.ENCRYPTION_KEY = originalKey;
    }
  });

  it("should mask sensitive fields in config", () => {
    const config = {
      owner: "Luxisoft",
      githubToken: "ghp_verylongtoken",
      apiKey: "key123",
      publicField: "visible",
    };

    const masked = secretManagerService.maskSecrets(config, ["githubToken", "apiKey"]);

    expect(masked).toEqual({
      owner: "Luxisoft",
      githubToken: "***",
      apiKey: "***",
      publicField: "visible",
    });
  });

  it("should handle empty sensitive values", () => {
    const config = { token: "", password: "secret" };
    const masked = secretManagerService.maskSecrets(config);

    expect(masked.token).toBe(""); // empty stays empty
    expect(masked.password).toBe("***");
  });
});
