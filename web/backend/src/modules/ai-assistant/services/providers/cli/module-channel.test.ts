// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import { prepareModuleAdapter, geminiModuleSettings, moduleMcpServer, MODULE_HELPER } from "./module-channel.js";
import type { ProviderRunOptions } from "../provider.types.js";
import type { Executor } from "../../../../../shared/executor/types.js";
const opts = { modulesMcp: { url: "https://panel/api/ai/mcp/modules", token: "test-secret" }, systemPrompt: "", tools: [] } as ProviderRunOptions;
describe("CLI module channel", () => {
  it("uses native HTTP MCP and secure Gemini system settings", () => {
    expect(moduleMcpServer(opts.modulesMcp!)).toMatchObject({ type: "http", headers: { Authorization: "Bearer test-secret" } });
    expect(geminiModuleSettings(opts)).toMatchObject({ mcp: { allowed: ["luxipanel-modules"] }, mcpServers: { "luxipanel-modules": { httpUrl: opts.modulesMcp!.url } } });
  });
  it.each(["claude", "minimax", "codex", "gemini", "grok"])("provides a protected module channel for %s", async id => {
    const writeFile = vi.fn(async () => {}), executor = { writeFile } as unknown as Executor;
    const adapter = await prepareModuleAdapter(executor, id, "lxp-test", opts);
    expect(adapter.directive).not.toContain("test-secret");
    expect(adapter.directive.length).toBeGreaterThan(0);
    for (const [, , permissions] of writeFile.mock.calls as unknown as [string, Buffer, {mode:number}][]) expect(permissions.mode).toBe(0o600);
    if (id === "grok") { expect(writeFile).toHaveBeenCalledTimes(2); expect(adapter.cleanup).toContain("module-channel.json"); }
    if (id === "gemini") expect(adapter.env).toContain("GEMINI_CLI_SYSTEM_SETTINGS_PATH");
  });
});

it("executes the generated Grok helper through the correct protected channels", async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const run = new AsyncFunction("fs", "process", "fetch", "AbortSignal", MODULE_HELPER.replace(/^import fs from "node:fs";\n/, ""));
  const config = { ...opts.modulesMcp, graph: { url: "https://panel/api/ai/mcp/graph", token: "graph-only" } };
  for (const call of [{ operation: "list" }, { operation: "graph", tool: "graph.list_projects" }]) {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ result: {} }) }));
    const write = vi.fn();
    await run({ readFileSync: () => JSON.stringify(config) }, { argv: ["node", "helper", "config"], stdin: (async function* () { yield JSON.stringify(call); })(), stdout: { write } }, fetch, AbortSignal);
    const [url, request] = fetch.mock.calls[0]! as unknown as [string, { body: string; headers: Record<string,string> }];
    expect(url).toBe(call.operation === "graph" ? config.graph.url : config.url);
    expect(JSON.parse(request.body).params.name).toBe(call.operation === "graph" ? "graph__list_projects" : "modules__list");
    expect(write).toHaveBeenCalledWith('{"result":{}}\n');
  }
});
