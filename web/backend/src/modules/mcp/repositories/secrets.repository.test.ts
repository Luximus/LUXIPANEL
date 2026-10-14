// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";
import { secretsRepository } from "./secrets.repository.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import { secretManagerService } from "../services/secret-manager.service.js";

// Mock dependencies
vi.mock("../../admin/repositories/index.js");
vi.mock("../services/secret-manager.service.js");

describe("SecretsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("save", () => {
    it("should encrypt and save configuration", async () => {
      const config = { token: "abc123", key: "xyz" };
      const encrypted = Buffer.from("encrypted");

      vi.mocked(secretManagerService.encrypt).mockResolvedValue({
        encrypted,
        keyId: "v1",
      });

      vi.mocked(settingsRepository.set).mockResolvedValue(undefined as never);

      await secretsRepository.save("github-mcp", config);

      expect(secretManagerService.encrypt).toHaveBeenCalledWith(
        JSON.stringify(config)
      );

      // Config cifrada + keyId, ambos en la categoría "mcp-extensions".
      expect(settingsRepository.set).toHaveBeenCalledWith(
        "mcp.github-mcp.secrets",
        encrypted.toString("base64"),
        "mcp-extensions"
      );
      expect(settingsRepository.set).toHaveBeenCalledWith(
        "mcp.github-mcp.keyId",
        "v1",
        "mcp-extensions"
      );
    });

    it("should handle save errors", async () => {
      vi.mocked(secretManagerService.encrypt).mockResolvedValue({
        encrypted: Buffer.from("test"),
        keyId: "v1",
      });

      vi.mocked(settingsRepository.set).mockRejectedValue(
        new Error("DB error")
      );

      await expect(
        secretsRepository.save("github-mcp", { token: "test" })
      ).rejects.toThrow("DB error");
    });
  });

  describe("get", () => {
    it("should retrieve and decrypt configuration", async () => {
      const decrypted = '{"token":"secret","key":"value"}';
      const encrypted = Buffer.from("encrypted data");

      // settingsRepository.get devuelve el string almacenado (o null).
      vi.mocked(settingsRepository.get).mockImplementation(async (key: string) => {
        if (key === "mcp.github-mcp.secrets") return encrypted.toString("base64");
        if (key === "mcp.github-mcp.keyId") return "v1";
        return null;
      });

      vi.mocked(secretManagerService.decrypt).mockResolvedValue(decrypted);

      const result = await secretsRepository.get("github-mcp");

      expect(result).toEqual({ token: "secret", key: "value" });
      expect(secretManagerService.decrypt).toHaveBeenCalledWith(encrypted, "v1");
    });

    it("should return null if secrets not found", async () => {
      vi.mocked(settingsRepository.get).mockResolvedValue(null);

      const result = await secretsRepository.get("unknown-mcp");

      expect(result).toBeNull();
    });

    it("should handle invalid JSON in decrypted data", async () => {
      vi.mocked(settingsRepository.get).mockImplementation(async (key: string) => {
        if (key === "mcp.github-mcp.secrets") return Buffer.from("data").toString("base64");
        if (key === "mcp.github-mcp.keyId") return "v1";
        return null;
      });

      vi.mocked(secretManagerService.decrypt).mockResolvedValue(
        "invalid json"
      );

      await expect(secretsRepository.get("github-mcp")).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("should delete secrets for an extension", async () => {
      vi.mocked(settingsRepository.delete).mockResolvedValue(true as never);

      await secretsRepository.delete("github-mcp");

      expect(settingsRepository.delete).toHaveBeenCalledWith(
        "mcp.github-mcp.secrets"
      );
      expect(settingsRepository.delete).toHaveBeenCalledWith(
        "mcp.github-mcp.keyId"
      );
    });
  });

  describe("exists", () => {
    it("should check if secrets exist", async () => {
      vi.mocked(settingsRepository.get).mockResolvedValue("ZGF0YQ==");

      const result = await secretsRepository.exists("github-mcp");

      expect(result).toBe(true);
    });

    it("should return false if secrets do not exist", async () => {
      vi.mocked(settingsRepository.get).mockResolvedValue(null);

      const result = await secretsRepository.exists("unknown-mcp");

      expect(result).toBe(false);
    });
  });
});
