// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { readFileSync } from "node:fs";
import { quoteArg, type Executor, type ExecResult } from "./executor/index.js";
import { CONFIG_DIR } from "../config/paths.js";

const runner = readFileSync(new URL("./resource-guard.py", import.meta.url)).toString("base64");
export interface ResourceGuardOptions {
  kind: "cli" | "browser";
  queueSeconds?: number;
  runtimeSeconds?: number;
  /** Internal override can only LOWER the fixed safety ceiling. */
  memoryMaxMiB?: number;
}

/** Run on the selected executor; no local-host probes or unguarded fallback. */
export function guardCommand(command: string, options: ResourceGuardOptions): string {
  const bootstrap = `import base64; exec(compile(base64.b64decode('${runner}'), 'luxipanel-resource-guard', 'exec'))`;
  const admissionPolicyPath = `${CONFIG_DIR.replace(/\/+$/, "")}/monitor/assistant-admission.json`;
  return `python3 -c ${quoteArg(bootstrap)} ${quoteArg(JSON.stringify({ ...options, admissionPolicyPath }))} /bin/bash -c ${quoteArg(command)}`;
}

export function resourceGuardFailure(output: string): string | null {
  for (const line of output.split("\n")) {
    try {
      const event = JSON.parse(line);
      if (event.type === "error" && /^RESOURCE_GUARD_(?:UNAVAILABLE|BUSY|MEMORY|INTERRUPTED)$/.test(event.code) && typeof event.message === "string") return event.message;
    } catch { /* provider output / DOM */ }
  }
  return null;
}

export async function execGuardedBrowser(executor: Executor, command: string, timeoutMs: number): Promise<ExecResult> {
  const result = await executor.exec(guardCommand(command, { kind: "browser", queueSeconds: 10, runtimeSeconds: Math.ceil(timeoutMs / 1000) }), { timeoutMs: timeoutMs + 60_000 });
  const failure = resourceGuardFailure(result.stdout);
  if (failure) throw new Error(failure);
  return result;
}
