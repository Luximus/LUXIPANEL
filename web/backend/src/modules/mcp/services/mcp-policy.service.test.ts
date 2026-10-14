// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mcpPolicyService } from "./mcp-policy.service.js";
import { extensionRegistryService } from "./extension-registry.service.js";

// Mock dependencies
vi.mock("./extension-registry.service.js");

describe("MCPPolicyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("canUseExtension", () => {
    it("should deny access if user is not admin", () => {
      const ctx = { userId: "user1", isAdmin: false };
      const result = mcpPolicyService.canUseExtension("github-mcp", ctx);

      expect(result).toBe(false);
    });

    it("should allow access for admin role (standalone: no license gate)", () => {
      const ctx = { userId: "user1", isAdmin: true };
      const result = mcpPolicyService.canUseExtension("github-mcp", ctx);

      expect(result).toBe(true);
    });
  });

  describe("canCallTool", () => {
    it("should deny tool call without permission to use extension", () => {
      const ctx = { userId: "user1", isAdmin: false };
      const result = mcpPolicyService.canCallTool("github-mcp", "list_repos", ctx);

      expect(result).toBe(false);
    });

    it("should allow tool call with proper permissions", () => {
      const ctx = { userId: "user1", isAdmin: true };
      const result = mcpPolicyService.canCallTool("github-mcp", "list_repos", ctx);

      expect(result).toBe(true);
    });
  });

  describe("filterTools", () => {
    it("should return empty list if user is not admin", () => {
      const tools = [
        { name: "tool1", origin: "mcp:github-mcp" },
      ];

      const ctx = { userId: "user1", isAdmin: false };
      const result = mcpPolicyService.filterTools(tools, ctx);

      expect(result).toEqual([]);
    });

    it("should filter tools by extension status", () => {
      vi.mocked(extensionRegistryService.getById)
        .mockImplementation((id) => {
          if (id === "github-mcp") {
            return { id: "github-mcp", kind: "mcp_server" } as any;
          }
          return undefined;
        });

      const tools = [
        { name: "tool1", origin: "mcp:github-mcp" },
        { name: "tool2", origin: "mcp:unknown-mcp" },
      ];

      const ctx = { userId: "user1", isAdmin: true };
      const result = mcpPolicyService.filterTools(tools, ctx);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("tool1");
    });

    it("should always allow builtin tools", () => {
      const tools = [
        { name: "builtin_tool", origin: undefined },
        { name: "another_builtin" },
      ];

      const ctx = { userId: "user1", isAdmin: true };
      const result = mcpPolicyService.filterTools(tools, ctx);

      expect(result).toHaveLength(2);
    });
  });
});
