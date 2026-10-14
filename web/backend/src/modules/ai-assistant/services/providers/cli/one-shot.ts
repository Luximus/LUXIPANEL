// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * One-shot (non-streaming) CLI completions for features that just need a single
 * text result from a CLI-mode provider (no API key) — e.g. "improve file with
 * AI" (`runCliOnce`, blocking) and the project-map generator (`runCliOnceBackground`,
 * nohup + exit-file polling for runs that exceed the gateway timeout). NOT for
 * chat — that's the streaming `run()` in ./bridge-run.
 */

import { randomUUID } from "node:crypto";
import { quoteArg, type Executor } from "../../../../../shared/executor/index.js";
import { ANSI_RE, loginShell, modelFlag, buildNohupLaunch, sleep } from "./shell.js";
import { CLI_SPECS, claudeDisallowFlag } from "./cli-specs.js";
import type { AssistantProviderId } from "../../../models/assistant-config.types.js";

/**
 * One-shot, BLOCKING CLI completion: write the prompt to a temp file on the
 * target, run the provider CLI once in non-interactive print mode (no nohup, no
 * session, no streaming), capture stdout, and return the final answer. Used by
 * features that just need a single text result from a CLI-mode provider (no API
 * key) — e.g. "improve file with AI". `cwd` (the project dir) gives the CLI the
 * project as context. NOT for chat (that's the streaming `run()` above).
 */
export async function runCliOnce(args: {
  executor: Executor;
  id: AssistantProviderId;
  binOverride?: string;
  model?: string;
  apiKey?: string;
  prompt: string;
  cwd?: string;
  timeoutMs?: number;
}): Promise<string> {
  const spec = CLI_SPECS[args.id];
  if (!spec) throw new Error(`Modo CLI no soportado para ${args.id}.`);
  const bin = args.binOverride ?? spec.bin;
  const model = args.model;
  const rawPf = `/tmp/lxp-cli-oneshot-${randomUUID()}.txt`;
  const pf = quoteArg(rawPf);

  let cliCmd: string;
  switch (args.id) {
    case "claude":
      // stream-json so we can reuse parseClaudeFinalAnswer for a clean answer.
      // One-shot, no user present → NO `--dangerously-skip-permissions`: the run
      // is read-only (analysis/text generation); any mutating tool the model
      // tries auto-denies (it isn't needed for these features).
      // `--strict-mcp-config` with no `--mcp-config` = zero MCP servers: don't
      // inherit the user's installed config (a stale `luxipanel` token would
      // fail the run with MCP_SESSION_EXPIRED; MCP isn't needed here).
      cliCmd = `${bin} -p --output-format stream-json --verbose ${claudeDisallowFlag}--strict-mcp-config${modelFlag("--model", model)} "$(cat ${pf})" </dev/null`;
      break;
    case "codex":
      // `--json` → structured log we parse with parseCodexFinalAnswer (matches
      // the streaming path); `--color never` keeps the JSON clean.
      cliCmd = `${bin} exec --json --color never --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check${modelFlag("--model", model)} "$(cat ${pf})" </dev/null`;
      break;
    case "gemini":
      cliCmd = `${bin} -p "$(cat ${pf})" --yolo${modelFlag("-m", model)} </dev/null`;
      break;
    case "grok":
      // grok-cli: model via GROK_MODEL env (no flag); relies on ambient
      // GROK_API_KEY / ~/.grok auth for one-shot (project-map) runs.
      cliCmd = `${model ? `GROK_MODEL=${quoteArg(model)} ` : ""}${bin} -p "$(cat ${pf})" </dev/null`;
      break;
    case "minimax":
      // Mirror the `claude` one-shot: stream-json + disallowedTools Workflow
      // (read-only analysis; mutating tools auto-deny since no user present)
      // + hermetic `--strict-mcp-config` (no inherited MCP config).
      cliCmd = `${bin} -p --output-format stream-json --verbose ${claudeDisallowFlag}--strict-mcp-config "$(cat ${pf})" </dev/null`;
      break;
    default:
      throw new Error(`Modo CLI no soportado para ${args.id}.`);
  }

  const cdPart = args.cwd ? `cd ${quoteArg(args.cwd)} 2>/dev/null || true; ` : "";
  const full = loginShell(`${cdPart}${cliCmd}`);
  try {
    await args.executor.writeFile(rawPf, Buffer.from(args.prompt, "utf8"));
    const r = await args.executor.exec(full, { timeoutMs: args.timeoutMs ?? 55_000 });
    const raw = r.stdout ?? "";
    const text = spec.parseFinalAnswer?.(raw) || raw.replace(ANSI_RE, "");
    const trimmed = text.trim();
    if (!trimmed) {
      const errSnippet = (r.stderr || raw || `exit ${r.exitCode}`).replace(ANSI_RE, "").trim().slice(0, 300);
      throw new Error(errSnippet || "el CLI no devolvió salida");
    }
    return trimmed;
  } finally {
    void args.executor.exec(`rm -f ${pf}`, { timeoutMs: 5_000 }).catch(() => undefined);
  }
}

/**
 * Non-blocking one-shot CLI completion for LONG runs (can exceed the LP SSH
 * proxy / nginx ~60s gateway limit). Unlike `runCliOnce` (a single blocking
 * exec), this launches the CLI with `nohup` (returns in <1s) and then polls the
 * exit file with short execs — so no single round-trip ever risks a 504. Used by
 * the project map generator, whose deep analysis can take minutes. Same CLI
 * command + parsing as `runCliOnce`.
 */
export async function runCliOnceBackground(args: {
  executor: Executor;
  id: AssistantProviderId;
  binOverride?: string;
  model?: string;
  apiKey?: string;
  prompt: string;
  cwd?: string;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<string> {
  const spec = CLI_SPECS[args.id];
  if (!spec) throw new Error(`Modo CLI no soportado para ${args.id}.`);
  const bin = args.binOverride ?? spec.bin;
  const model = args.model;
  const runId = randomUUID();
  const rawPf = `/tmp/lxp-cli-bg-${runId}.txt`;
  const rawLog = `/tmp/lxp-cli-bg-${runId}.log`;
  const rawExit = `/tmp/lxp-cli-bg-${runId}.exit`;
  const pf = quoteArg(rawPf);

  let cliCmd: string;
  switch (args.id) {
    case "claude":
      // Long background one-shot (project map), no user present → NO
      // `--dangerously-skip-permissions`: read-only analysis; any mutating tool
      // auto-denies (not needed for generating the map). Hermetic
      // `--strict-mcp-config` (no inherited MCP config) like `runCliOnce`.
      cliCmd = `${bin} -p --output-format stream-json --verbose ${claudeDisallowFlag}--strict-mcp-config${modelFlag("--model", model)} "$(cat ${pf})" </dev/null`;
      break;
    case "codex":
      // `--json` → structured log we parse with parseCodexFinalAnswer (matches
      // the streaming path); `--color never` keeps the JSON clean.
      cliCmd = `${bin} exec --json --color never --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check${modelFlag("--model", model)} "$(cat ${pf})" </dev/null`;
      break;
    case "gemini":
      cliCmd = `${bin} -p "$(cat ${pf})" --yolo${modelFlag("-m", model)} </dev/null`;
      break;
    case "grok":
      // grok-cli: model via GROK_MODEL env (no flag); relies on ambient
      // GROK_API_KEY / ~/.grok auth for one-shot (project-map) runs.
      cliCmd = `${model ? `GROK_MODEL=${quoteArg(model)} ` : ""}${bin} -p "$(cat ${pf})" </dev/null`;
      break;
    case "minimax":
      // Mirror the `claude` one-shot: stream-json + disallowedTools Workflow
      // (read-only analysis; mutating tools auto-deny since no user present)
      // + hermetic `--strict-mcp-config` (no inherited MCP config).
      cliCmd = `${bin} -p --output-format stream-json --verbose ${claudeDisallowFlag}--strict-mcp-config "$(cat ${pf})" </dev/null`;
      break;
    default:
      throw new Error(`Modo CLI no soportado para ${args.id}.`);
  }

  const launch = buildNohupLaunch(cliCmd, rawLog, rawExit, args.cwd);
  const deadline = Date.now() + (args.timeoutMs ?? 280_000);
  const pollMs = args.pollMs ?? 4_000;

  try {
    await args.executor.writeFile(rawPf, Buffer.from(args.prompt, "utf8"));
    // Launch detached; returns the PID quickly (well under the gateway limit).
    await args.executor.exec(launch, { timeoutMs: 20_000 });

    let exitCode: number | null = null;
    while (Date.now() < deadline) {
      await sleep(pollMs);
      const r = await args.executor
        .exec(`cat ${quoteArg(rawExit)} 2>/dev/null || true`, { timeoutMs: 15_000 })
        .catch(() => ({ stdout: "", stderr: "", exitCode: 0 }) as { stdout: string; stderr: string; exitCode: number });
      const t = (r.stdout ?? "").trim();
      if (t !== "") {
        const n = parseInt(t, 10);
        exitCode = Number.isFinite(n) ? n : 0;
        break;
      }
    }

    const lr = await args.executor.exec(`cat ${quoteArg(rawLog)} 2>/dev/null || true`, { timeoutMs: 30_000 });
    const raw = lr.stdout ?? "";
    if (exitCode === null) {
      throw new Error("la generación CLI superó el tiempo límite");
    }
    const text = spec.parseFinalAnswer?.(raw) || raw.replace(ANSI_RE, "");
    const trimmed = text.trim();
    if (!trimmed) {
      const errSnippet = (raw || `exit ${exitCode}`).replace(ANSI_RE, "").trim().slice(0, 300);
      throw new Error(errSnippet || "el CLI no devolvió salida");
    }
    return trimmed;
  } finally {
    void args.executor
      .exec(`rm -f ${pf} ${quoteArg(rawLog)} ${quoteArg(rawExit)}`, { timeoutMs: 5_000 })
      .catch(() => undefined);
  }
}
