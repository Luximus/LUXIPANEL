// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests for the CLI bridge `buildLaunch` flag wiring.
 *
 * Scope: the spec-table produces the EXACT shell command the bridge launches
 * detached on the target. This file exercises:
 *   - `buildClaudeAddDirFlag` pure helper (dedup, skip cwd, stable order).
 *   - `CLI_SPECS.claude.buildLaunch` for the 3 approval modes × {add-dir,
 *     mcp-config, both, neither} matrix.
 *   - `CLI_SPECS.minimax.buildLaunch` mirror matrix — proves the minimax
 *     wrapper is wired identically to direct claude.
 *
 * The spec's `buildLaunch` is a pure function (string in → string out); the
 * rest of the bridge (executor, writeFile, etc.) is NOT exercised here — the
 * `cli-bridge.provider.test.ts` is the unit layer; E2E coverage lives in
 * agent-run-registry + per-provider integration tests.
 */
import { describe, expect, it } from "vitest";
import { buildClaudeAddDirFlag, CLI_SPECS } from "./cli-bridge.provider.js";

const baseCtx = {
  promptFile: "/tmp/lxp-cli-abc-prompt.txt",
  logFile: "/tmp/lxp-cli-abc.log",
  exitFile: "/tmp/lxp-cli-abc.exit",
  resume: false as const,
  sessionId: "deadbeef",
};

describe("buildClaudeAddDirFlag", () => {
  it("returns empty string when jailPaths is undefined or empty", () => {
    expect(buildClaudeAddDirFlag("/var/www", undefined)).toBe("");
    expect(buildClaudeAddDirFlag("/var/www", [])).toBe("");
  });

  it("emits --add-dir per path, deduped and with cwd skipped", () => {
    const flag = buildClaudeAddDirFlag("/var/www/LUXIPANEL", [
      "/var/www/LUXIPANEL/frontend",
      "/var/www/LUXIPANEL/backend",
      "/var/www/LUXIPANEL/frontend", // dup
      "/var/www/LUXIPANEL",          // equals cwd
      "/var/www/LUXIPANEL/",         // trailing slash, equals cwd
    ]);
    // Order is preserved by first-seen; cwd + dups removed.
    // `quoteArg` wraps each path in single quotes (defensive shell escaping).
    expect(flag).toBe(
      "--add-dir '/var/www/LUXIPANEL/frontend' --add-dir '/var/www/LUXIPANEL/backend' ",
    );
  });

  it("skips cwd when no cwd is provided (cwd = undefined → nothing to skip)", () => {
    const flag = buildClaudeAddDirFlag(undefined, ["/a", "/b"]);
    expect(flag).toBe("--add-dir '/a' --add-dir '/b' ");
  });

  it("drops empty / non-string entries silently", () => {
    const flag = buildClaudeAddDirFlag(undefined, ["", "/a", "   ", null as unknown as string, undefined as unknown as string, "/b"]);
    expect(flag).toBe("--add-dir '/a' --add-dir '/b' ");
  });
});

describe("CLI_SPECS.claude.buildLaunch — approval mode + jailPaths wiring", () => {
  const spec = CLI_SPECS.claude;
  if (!spec) throw new Error("claude spec missing");

  it("manual mode: keeps --permission-prompt-tool when MCP channel wired", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      cwd: "/var/www/LUXIPANEL/frontend",
      jailPaths: ["/var/www/LUXIPANEL/frontend", "/var/www/LUXIPANEL/backend"],
      mcpConfigFile: "/tmp/lxp-mcp-xyz.json",
      approvalMode: "manual",
    });
    // The full command is the nohup-wrapped script. `quoteArg` shells out
    // paths with nested `'"'"'"…'` escapes — assert the relevant flag set
    // by looking for the flag string + the path string independently
    // (not the exact quoting).
    expect(cmd).toContain("claude -p --output-format stream-json --verbose");
    // `claudeDisallowFlag` ships the value QUOTED (it contains `(` and `*`,
    // both unsafe to leave unquoted inside `bash -c`). The whole command is
    // further wrapped by `loginShell` + `buildNohupLaunch`, so the literal
    // string gets nested-quoted (`'"'"'"…'`); assert on the unquoted value
    // itself, which is preserved byte-for-byte through every escape layer.
    expect(cmd).toContain("Workflow,Bash(codebase-memory-mcp:*)");
    expect(cmd).toContain("--mcp-config");        // path quoted separately
    expect(cmd).toContain("/tmp/lxp-mcp-xyz.json");
    expect(cmd).toContain("--strict-mcp-config");
    expect(cmd).toContain("--permission-prompt-tool mcp__luxipanel-servers__permissions__approve");
    expect(cmd).toContain("--add-dir");           // backend is in jailPaths
    expect(cmd).toContain("/var/www/LUXIPANEL/backend");
    expect(cmd).not.toContain("--dangerously-skip-permissions");
    expect(cmd).not.toContain("--permission-mode plan");
  });

  it("manual mode: NO --permission-prompt-tool when MCP channel absent (fail-safe deny)", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      approvalMode: "manual",
    });
    expect(cmd).not.toContain("--permission-prompt-tool");
    expect(cmd).not.toContain("--mcp-config ");
    expect(cmd).not.toContain("--dangerously-skip-permissions");
  });

  it("hermetic without per-run MCP file: --strict-mcp-config stays on (zero MCP servers — never inherit the user's installed config)", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      approvalMode: "manual",
    });
    expect(cmd).toContain("--strict-mcp-config");
    // No per-run file → no --mcp-config flag (note: `--strict-mcp-config`
    // does NOT contain the `--mcp-config ` substring — single hyphen there).
    expect(cmd).not.toContain("--mcp-config ");
  });

  it("forwards the per-turn model as --model (CLI-mode model selection)", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      approvalMode: "auto",
      model: "claude-haiku-4-5",
    });
    expect(cmd).toContain("--model");
    expect(cmd).toContain("claude-haiku-4-5");
  });

  it("auto mode: --dangerously-skip-permissions + KEEPS --mcp-config for servers.*", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      cwd: "/var/www/LUXIPANEL/frontend",
      jailPaths: ["/var/www/LUXIPANEL/frontend", "/var/www/LUXIPANEL/backend"],
      mcpConfigFile: "/tmp/lxp-mcp-xyz.json",
      approvalMode: "auto",
    });
    expect(cmd).toContain("--dangerously-skip-permissions");
    expect(cmd).toContain("--mcp-config");
    expect(cmd).toContain("/tmp/lxp-mcp-xyz.json");
    expect(cmd).toContain("--strict-mcp-config");
    expect(cmd).not.toContain("--permission-prompt-tool");
    expect(cmd).not.toContain("--permission-mode plan");
    expect(cmd).toContain("--add-dir");
    expect(cmd).toContain("/var/www/LUXIPANEL/backend");
  });

  it("plan mode: --permission-mode plan + keeps --mcp-config for servers.*", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      cwd: "/var/www/LUXIPANEL/frontend",
      jailPaths: ["/var/www/LUXIPANEL/frontend"],
      mcpConfigFile: "/tmp/lxp-mcp-xyz.json",
      approvalMode: "plan",
    });
    expect(cmd).toContain("--permission-mode plan");
    expect(cmd).toContain("--mcp-config");
    expect(cmd).toContain("/tmp/lxp-mcp-xyz.json");
    expect(cmd).toContain("--strict-mcp-config");
    expect(cmd).not.toContain("--permission-prompt-tool");
    expect(cmd).not.toContain("--dangerously-skip-permissions");
  });

  it("defaults to manual when approvalMode is omitted (back-compat)", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      mcpConfigFile: "/tmp/lxp-mcp-xyz.json",
    });
    expect(cmd).toContain("--permission-prompt-tool mcp__luxipanel-servers__permissions__approve");
    expect(cmd).not.toContain("--dangerously-skip-permissions");
  });

  it("empty jailPaths + manual: no --add-dir flag (sandbox stays at default)", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      jailPaths: [],
      approvalMode: "manual",
      mcpConfigFile: "/tmp/lxp-mcp-xyz.json",
    });
    expect(cmd).not.toContain("--add-dir");
  });
});

describe("CLI_SPECS.minimax.buildLaunch — same wiring as claude (mirror matrix)", () => {
  const spec = CLI_SPECS.minimax;
  if (!spec) throw new Error("minimax spec missing");

  it("auto mode wires --dangerously-skip-permissions", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      mcpConfigFile: "/tmp/lxp-mcp-xyz.json",
      approvalMode: "auto",
    });
    expect(cmd).toContain("claude-minimax -p");
    expect(cmd).toContain("--dangerously-skip-permissions");
    expect(cmd).toContain("--mcp-config");
    expect(cmd).toContain("/tmp/lxp-mcp-xyz.json");
    expect(cmd).toContain("--strict-mcp-config");
    expect(cmd).not.toContain("--permission-prompt-tool");
  });

  it("plan mode wires --permission-mode plan", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      mcpConfigFile: "/tmp/lxp-mcp-xyz.json",
      approvalMode: "plan",
    });
    expect(cmd).toContain("--permission-mode plan");
    expect(cmd).not.toContain("--dangerously-skip-permissions");
  });

  it("manual mode keeps --permission-prompt-tool", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      mcpConfigFile: "/tmp/lxp-mcp-xyz.json",
      approvalMode: "manual",
    });
    expect(cmd).toContain("--permission-prompt-tool mcp__luxipanel-servers__permissions__approve");
  });

  it("manual mode with jailPaths adds --add-dir (skip cwd)", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      cwd: "/var/www/LUXIPANEL/frontend",
      jailPaths: ["/var/www/LUXIPANEL/frontend", "/var/www/LUXIPANEL/backend"],
      approvalMode: "manual",
    });
    // backend IS added (not cwd); frontend IS NOT (it's cwd → dedup'd).
    expect(cmd).toContain("--add-dir");
    expect(cmd).toContain("/var/www/LUXIPANEL/backend");
    expect(cmd).toContain("/var/www/LUXIPANEL/frontend"); // present as cwd "cd …"
  });

  it("hermetic without per-run MCP file: --strict-mcp-config stays on (mirror of claude)", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      approvalMode: "manual",
    });
    expect(cmd).toContain("--strict-mcp-config");
    expect(cmd).not.toContain("--mcp-config ");
  });

  it("never passes --model (per-turn model rides in the ANTHROPIC_MODEL env of the wrapper)", () => {
    const cmd = spec.buildLaunch({
      ...baseCtx,
      approvalMode: "auto",
      model: "MiniMax-M3[1m]",
    });
    expect(cmd).not.toContain("--model");
  });
});

// The `describe` is the one-line command header the user sees in the chat's
// mini-terminal bubble. The actual binary on the target (claude, claude-minimax)
// is an implementation detail — the user-facing header should match the
// product name they configured in the Providers tab.
describe("describe() — mini-terminal header per provider", () => {
  it("claude header shows the bare 'claude' binary", () => {
    const spec = CLI_SPECS.claude;
    if (!spec) throw new Error("claude spec missing");
    expect(
      spec.describe({ resume: false, sessionId: "deadbeef" }),
    ).toBe("claude -p --session-id deadbeef");
  });

  it("minimax header shows 'minimax-cli' (NOT 'claude-minimax' — internal wrapper name)", () => {
    // The actual binary on the target is `claude-minimax` (a thin wrapper
    // that execs `claude` with MiniMax endpoint env vars). The user-facing
    // header must use the product name to avoid leaking implementation.
    const spec = CLI_SPECS.minimax;
    if (!spec) throw new Error("minimax spec missing");
    const header = spec.describe({ resume: false, sessionId: "deadbeef" });
    expect(header).toBe("minimax-cli -p --session-id deadbeef");
    expect(header).not.toContain("claude");
  });

  it("minimax resume header reflects the resumed session", () => {
    const spec = CLI_SPECS.minimax;
    if (!spec) throw new Error("minimax spec missing");
    expect(
      spec.describe({ resume: true, sessionId: "abc12345" }),
    ).toBe("minimax-cli -p --resume abc12345");
  });
});

describe("CLI_SPECS.{claude,minimax}.buildLaunch — live-steering FIFO (stdinFifo)", () => {
  // The full command is nohup+loginShell-wrapped (nested `quoteArg`), which
  // mangles literal quotes — so assert on UNQUOTED substrings only (the path,
  // the flags, the `$(cat`/`</dev/null` markers), never the exact quoting.
  const fifo = "/tmp/lxp-cli-abc-stdin.fifo";

  it("claude WITHOUT stdinFifo: legacy one-shot (prompt argv + </dev/null), byte-identical", () => {
    const spec = CLI_SPECS.claude;
    if (!spec) throw new Error("claude spec missing");
    const cmd = spec.buildLaunch({ ...baseCtx, approvalMode: "auto" });
    // Legacy path: prompt sourced from the file as an argv, stdin from /dev/null.
    expect(cmd).toContain("$(cat");
    expect(cmd).toContain(baseCtx.promptFile);
    expect(cmd).toContain("</dev/null");
    expect(cmd).not.toContain("--input-format stream-json");
  });

  it("claude WITH stdinFifo: stream-json input from the FIFO, no prompt argv, no </dev/null", () => {
    const spec = CLI_SPECS.claude;
    if (!spec) throw new Error("claude spec missing");
    const cmd = spec.buildLaunch({ ...baseCtx, approvalMode: "auto", stdinFifo: fifo });
    expect(cmd).toContain("claude -p --output-format stream-json --verbose");
    expect(cmd).toContain("--input-format stream-json");
    expect(cmd).toContain(fifo);
    // The prompt no longer rides in as an argv (baseCtx has no append-system
    // file, so `$(cat` would only come from the prompt), and stdin is the FIFO.
    expect(cmd).not.toContain("$(cat");
    expect(cmd).not.toContain("</dev/null");
  });

  it("minimax WITH stdinFifo: same stream-json input wiring as claude", () => {
    const spec = CLI_SPECS.minimax;
    if (!spec) throw new Error("minimax spec missing");
    const cmd = spec.buildLaunch({ ...baseCtx, approvalMode: "auto", stdinFifo: fifo });
    expect(cmd).toContain("claude-minimax -p --output-format stream-json --verbose");
    expect(cmd).toContain("--input-format stream-json");
    expect(cmd).toContain(fifo);
    expect(cmd).not.toContain("</dev/null");
  });

  it("stdinFifo preserves the session + permission flags (steering is additive)", () => {
    const spec = CLI_SPECS.claude;
    if (!spec) throw new Error("claude spec missing");
    const cmd = spec.buildLaunch({
      ...baseCtx,
      stdinFifo: fifo,
      mcpConfigFile: "/tmp/lxp-mcp-xyz.json",
      approvalMode: "manual",
    });
    expect(cmd).toContain("--session-id");      // baseCtx.resume === false
    expect(cmd).toContain("--permission-prompt-tool mcp__luxipanel-servers__permissions__approve");
    expect(cmd).toContain("--input-format stream-json");
  });
});
