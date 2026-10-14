import { describe, expect, it } from "vitest";
import { CLI_SPECS } from "./cli-specs.js";

const ctx = { promptFile: "/tmp/prompt", logFile: "/tmp/log", exitFile: "/tmp/exit", resume: false };

describe("per-turn reasoning in CLI launches", () => {
  it("sets Claude Code effort only for the requested run", () => {
    const changed = CLI_SPECS.claude.buildLaunch({ ...ctx, effort: "high" });
    const automatic = CLI_SPECS.claude.buildLaunch(ctx);
    expect(changed).toContain("CLAUDE_CODE_EFFORT_LEVEL");
    expect(changed).toContain("high");
    expect(automatic).not.toContain("CLAUDE_CODE_EFFORT_LEVEL");
  });

  it("launches the native Codex app-server adapter on both fresh and resumed turns", () => {
    const adapter = { codexAdapterFile: "/tmp/adapter.mjs", codexConfigFile: "/tmp/config.json" };
    const fresh = CLI_SPECS.codex.buildLaunch({ ...ctx, ...adapter, effort: "xhigh" });
    const resumed = CLI_SPECS.codex.buildLaunch({ ...ctx, ...adapter, resume: true, sessionId: "12345678-1234-1234-1234-123456789012" });
    expect(fresh).toContain("node");
    expect(fresh).toContain("/tmp/adapter.mjs");
    expect(resumed).toContain("/tmp/config.json");
    expect(resumed).toContain("flock -w 3600");
    expect(resumed).not.toContain("dangerously-bypass-approvals-and-sandbox");
  });
});

it.each(["claude", "minimax"] as const)("allows the protected gateway alongside scoped graph reads for %s", id => {
  const launch = CLI_SPECS[id].buildLaunch({ ...ctx, mcpConfigFile: "/tmp/mcp.json", modulesMcpAttached: true, graphMcpAttached: true, approvalMode: "manual" });
  expect(launch).toContain("mcp__luxipanel-modules__modules__execute");
  expect(launch).toContain("mcp__codebase-graph__list_projects");
  expect(launch).toContain("--strict-mcp-config");
  expect(launch).not.toContain("--dangerously-skip-permissions");
  expect(launch).not.toContain("mcp__codebase-graph__index_repository");
});
