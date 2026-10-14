// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";

vi.mock("../../../shared/logger/index.js", () => ({
  createModuleLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { mcpConfigWriterService } from "./mcp-config-writer.service.js";

describe("Codex MCP configuration", () => {
  it("replaces an old entry with the HTTP authorization header Codex reads", async () => {
    let content = [
      'model = "fixture"',
      '[mcp_servers.other]',
      'url = "https://other.test/mcp"',
      '[mcp_servers.luxipanel]',
      'transport = "http"',
      'url = "https://old.test/mcp"',
      'headers = { Authorization = "Bearer stale" }',
      '',
    ].join("\n");
    const executor = {
      exec: vi.fn(async () => ({ stdout: "/home/test\n", stderr: "", exitCode: 0 })),
      readFile: vi.fn(async () => content),
      writeFile: vi.fn(async (_path: string, next: string) => { content = next; }),
    } as unknown as Executor;

    const result = await mcpConfigWriterService.install(
      "codex", "https://panel.test/api/ai/mcp", "fresh-token", executor,
    );

    expect(result.ok).toBe(true);
    expect(content).toContain('url = "https://other.test/mcp"');
    expect(content).toContain('http_headers = { Authorization = "Bearer fresh-token" }');
    expect(content).not.toContain('transport = "http"');
    expect(content).not.toMatch(/^headers =/m);
    expect(content).not.toContain("Bearer stale");
  });
});
