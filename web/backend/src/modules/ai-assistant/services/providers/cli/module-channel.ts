// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Executor } from "../../../../../shared/executor/types.js";
import { quoteArg } from "./shell.js";
import type { ProviderRunOptions } from "../provider.types.js";

export function moduleMcpServer(channel: { url: string; token: string }) {
  return { type: "http", url: channel.url, headers: { Authorization: `Bearer ${channel.token}` } };
}
export function geminiModuleSettings(opts: ProviderRunOptions) {
  const mcpServers = {
    ...(opts.modulesMcp ? { "luxipanel-modules": { httpUrl: opts.modulesMcp.url, headers: { Authorization: `Bearer ${opts.modulesMcp.token}` }, timeout: 300000 } } : {}),
    ...(opts.graphMcp ? { "codebase-graph": { httpUrl: opts.graphMcp.url, headers: { Authorization: `Bearer ${opts.graphMcp.token}` }, timeout: 300000 } } : {}),
  };
  return { mcp: { allowed: Object.keys(mcpServers) }, mcpServers };
}
/** Grok's launch surface has no MCP config flag: this JSON stdin adapter calls
 * precisely the same run-scoped gateway. No token appears in argv or prompt. */
export const MODULE_HELPER = `import fs from "node:fs";
const config = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
let input = "";
for await (const chunk of process.stdin) { input += chunk; if (input.length > 24 * 1024 * 1024) throw new Error("Input too large"); }
const call = JSON.parse(input);
let channel = config, name = "modules__" + call.operation;
if (call.operation === "graph") {
  if (!config.graph || typeof call.tool !== "string" || !/^graph\\.[a-z0-9_]+$/.test(call.tool)) throw new Error("Scoped graph tool unavailable");
  channel = config.graph; name = call.tool.replace(".", "__");
} else if (!["list", "describe", "read", "execute"].includes(call.operation)) throw new Error("Invalid module operation");
const response = await fetch(channel.url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(300000), headers: { Authorization: "Bearer " + channel.token, "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: call.arguments ?? {} } }) });
if (!response.ok) throw new Error("Module channel unavailable: " + response.status);
process.stdout.write(JSON.stringify(await response.json()) + "\\n");
`;
export async function prepareModuleAdapter(executor: Executor, id: string, jobId: string, opts: ProviderRunOptions, projectSettings: Record<string, unknown> = {}): Promise<{ env: string; cleanup: string; directive: string }> {
  if (!opts.modulesMcp && !(id === "gemini" && Object.keys(projectSettings).length)) return { env: "", cleanup: "", directive: "" };
  if (id === "gemini") {
    const file = `/tmp/${jobId}-gemini-settings.json`;
    await executor.writeFile(file, Buffer.from(JSON.stringify({ ...projectSettings, ...geminiModuleSettings(opts) })), { mode: 0o600 });
    return { env: `export GEMINI_CLI_SYSTEM_SETTINGS_PATH=${quoteArg(file)};`, cleanup: `rm -f ${quoteArg(file)}`, directive: "Use the luxipanel-modules MCP tools to discover and manage panel modules." };
  }
  if (id !== "grok") return { env: "", cleanup: "", directive: "Use the luxipanel-modules MCP tools: modules__list, modules__describe, modules__read and modules__execute." };
  const file = `/tmp/${jobId}-module-channel.json`, helper = `/tmp/${jobId}-module-tool.mjs`;
  await executor.writeFile(file, Buffer.from(JSON.stringify({ ...opts.modulesMcp, ...(opts.graphMcp ? { graph: opts.graphMcp } : {}) })), { mode: 0o600 });
  await executor.writeFile(helper, Buffer.from(MODULE_HELPER), { mode: 0o600 });
  return { env: "", cleanup: `rm -f ${quoteArg(file)} ${quoteArg(helper)}`, directive: `Manage panel modules through this protected adapter: pipe JSON to node ${quoteArg(helper)} ${quoteArg(file)}. Input: {"operation":"list|describe|read|execute","arguments":{...}}. Start with {"operation":"list"}, then describe with arguments.moduleId. Read/execute need arguments.tool, revision and input from discovery. The panel applies permissions and approval. Do not read or print the credential file.${opts.graphMcp ? " The same adapter accepts {operation: \"graph\", tool: \"graph.<name>\", arguments: {...}} for the separate project-scoped graph channel. Start with graph.list_projects; query only the listed projects." : ""}` };
}
