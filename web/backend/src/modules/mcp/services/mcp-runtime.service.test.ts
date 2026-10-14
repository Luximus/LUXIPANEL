// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mcpRuntimeService } from "./mcp-runtime.service.js";
import { extensionRegistryService } from "./extension-registry.service.js";
import { secretsRepository } from "../repositories/secrets.repository.js";
import { mcpConnectionService } from "./mcp-connection.service.js";

// Mock dependencies
vi.mock("./extension-registry.service.js");
vi.mock("../repositories/secrets.repository.js");
vi.mock("./mcp-connection.service.js");

describe("MCPRuntimeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("start", () => {
    it("should start an MCP successfully", async () => {
      const mockExt = {
        id: "github-mcp",
        name: "GitHub MCP",
        kind: "mcp_server",
        entrypoint: "npx @modelcontextprotocol/server-github",
      };

      vi.mocked(extensionRegistryService.getById).mockReturnValue(mockExt);
      vi.mocked(secretsRepository.get).mockResolvedValue({
        githubToken: "ghp_token",
        owner: "luxisoft",
      });
      vi.mocked(mcpConnectionService.connect).mockResolvedValue(undefined);
      vi.mocked(extensionRegistryService.setStatus).mockResolvedValue(
        undefined
      );

      await mcpRuntimeService.start("github-mcp");

      expect(mcpConnectionService.connect).toHaveBeenCalledWith(
        "github-mcp",
        mockExt.entrypoint,
        { githubToken: "ghp_token", owner: "luxisoft" }
      );

      expect(extensionRegistryService.setStatus).toHaveBeenCalledWith(
        "github-mcp",
        "connected"
      );
    });

    it("should handle missing extension", async () => {
      vi.mocked(extensionRegistryService.getById).mockReturnValue(undefined);

      await expect(mcpRuntimeService.start("unknown-mcp")).rejects.toThrow(
        "not found"
      );
    });

    it("should handle non-MCP extension", async () => {
      const mockExt = {
        id: "mail",
        kind: "module",
      };

      vi.mocked(extensionRegistryService.getById).mockReturnValue(mockExt as any);

      await expect(mcpRuntimeService.start("mail")).rejects.toThrow(
        "not MCP"
      );
    });

    it("should set error status on connection failure", async () => {
      const mockExt = {
        id: "github-mcp",
        kind: "mcp_server",
        entrypoint: "npx @modelcontextprotocol/server-github",
      };

      vi.mocked(extensionRegistryService.getById).mockReturnValue(mockExt);
      vi.mocked(secretsRepository.get).mockResolvedValue({});
      vi.mocked(mcpConnectionService.connect).mockRejectedValue(
        new Error("Connection failed")
      );
      vi.mocked(extensionRegistryService.setStatus).mockResolvedValue(
        undefined
      );

      await expect(mcpRuntimeService.start("github-mcp")).rejects.toThrow(
        "Connection failed"
      );

      expect(extensionRegistryService.setStatus).toHaveBeenCalledWith(
        "github-mcp",
        "error",
        expect.any(String)
      );
    });
  });

  describe("stop", () => {
    it("should stop an MCP", async () => {
      vi.mocked(mcpConnectionService.disconnect).mockResolvedValue(undefined);
      vi.mocked(extensionRegistryService.setStatus).mockResolvedValue(
        undefined
      );

      await mcpRuntimeService.stop("github-mcp");

      expect(mcpConnectionService.disconnect).toHaveBeenCalledWith("github-mcp");
      expect(extensionRegistryService.setStatus).toHaveBeenCalledWith(
        "github-mcp",
        "idle"
      );
    });
  });

  describe("getTools", () => {
    it("should retrieve tools from MCP", async () => {
      const mockTools = [
        { name: "list_repos", description: "List repositories" },
        { name: "create_issue", description: "Create issue" },
      ];

      vi.mocked(mcpConnectionService.listTools).mockResolvedValue(mockTools as any);

      const result = await mcpRuntimeService.getTools("github-mcp");

      expect(result).toEqual(mockTools);
    });

    it("should handle retrieval errors", async () => {
      vi.mocked(mcpConnectionService.listTools).mockRejectedValue(
        new Error("MCP not connected")
      );

      await expect(mcpRuntimeService.getTools("github-mcp")).rejects.toThrow(
        "MCP not connected"
      );
    });
  });

  describe("callTool", () => {
    it("should execute a tool and return result", async () => {
      const mockResult = { repos: [] };

      vi.mocked(mcpConnectionService.callTool).mockResolvedValue({
        content: mockResult,
      } as any);

      const result = await mcpRuntimeService.callTool(
        "github-mcp",
        "list_repos",
        { owner: "luxisoft" }
      );

      expect(result).toEqual(mockResult);
      expect(mcpConnectionService.callTool).toHaveBeenCalledWith(
        "github-mcp",
        "list_repos",
        { owner: "luxisoft" }
      );
    });
  });

  describe("shutdown", () => {
    it("should disconnect all MCPs and stop health checks", async () => {
      vi.useFakeTimers();

      // Mock setup
      const mockExt = {
        id: "github-mcp",
        kind: "mcp_server",
        entrypoint: "test",
      };

      vi.mocked(extensionRegistryService.getById).mockReturnValue(mockExt);
      vi.mocked(secretsRepository.get).mockResolvedValue({});
      vi.mocked(mcpConnectionService.connect).mockResolvedValue(undefined);
      vi.mocked(extensionRegistryService.setStatus).mockResolvedValue(
        undefined
      );
      vi.mocked(mcpConnectionService.disconnect).mockResolvedValue(undefined);

      // Start an MCP to register it
      await mcpRuntimeService.start("github-mcp");

      // Shutdown
      await mcpRuntimeService.shutdown();

      expect(mcpConnectionService.disconnect).toHaveBeenCalledWith("github-mcp");

      vi.useRealTimers();
    });
  });
});

describe("built-in MCP configuration", () => {
  it("keeps filesystem roots with spaces in one argv item", async () => {
    vi.mocked(extensionRegistryService.getById).mockReturnValue({ id: "filesystem-mcp", kind: "mcp_server" } as any);
    vi.mocked(secretsRepository.get).mockResolvedValue({ rootPath: "/srv/my project" });
    vi.mocked(mcpConnectionService.connect).mockResolvedValue();
    await mcpRuntimeService.start("filesystem-mcp");
    expect(mcpConnectionService.connect).toHaveBeenCalledWith("filesystem-mcp", ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/srv/my project"], {});
    await mcpRuntimeService.stop("filesystem-mcp");
  });
  it("maps GitHub credentials into the server's declared environment", async () => {
    vi.mocked(extensionRegistryService.getById).mockReturnValue({ id: "github-mcp", kind: "mcp_server" } as any);
    vi.mocked(secretsRepository.get).mockResolvedValue({ githubToken: "test-token", owner: "demo" });
    vi.mocked(mcpConnectionService.connect).mockResolvedValue();
    await mcpRuntimeService.start("github-mcp");
    expect(mcpConnectionService.connect).toHaveBeenCalledWith("github-mcp", ["npx", "-y", "@modelcontextprotocol/server-github"], { GITHUB_PERSONAL_ACCESS_TOKEN: "test-token" });
    await mcpRuntimeService.stop("github-mcp");
  });
});
