// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team task verification — runs the project's "definition of done" recipe
 * (build/test/lint commands) via the per-server Executor before a task may
 * close as `done`. Sequential, stops at the first failure; each command is
 * bounded by ASSISTANT_TEAM_VERIFY_CMD_TIMEOUT_MS (or the project's own
 * timeout). The recipe is HUMAN configuration (project.verify) — the model
 * can only inject commands when ASSISTANT_TEAM_VERIFY_ALLOW_OVERRIDE is on.
 */

import { env } from "../../../config/env.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-team-verify");

/** Cap on the persisted log tail (mirrors TASK_RESULT_SUMMARY_MAX). */
const LOG_TAIL_MAX = 4000;

export interface VerifyRunResult {
  ok: boolean;
  failedCommand?: string;
  exitCode?: number;
  /** Último tramo de stdout+stderr del comando fallido (o resumen OK). */
  logTail: string;
  durationMs: number;
}

export const teamVerifyService = {
  async run(
    executor: Executor,
    args: { commands: string[]; cwd: string; cmdTimeoutMs?: number },
  ): Promise<VerifyRunResult> {
    const timeoutMs = args.cmdTimeoutMs ?? env.ASSISTANT_TEAM_VERIFY_CMD_TIMEOUT_MS;
    const startedAt = Date.now();
    for (const cmd of args.commands) {
      let out: { stdout: string; stderr: string; exitCode: number };
      try {
        out = await executor.exec(cmd, { cwd: args.cwd, timeoutMs });
      } catch (err) {
        return {
          ok: false,
          failedCommand: cmd,
          logTail: `(el comando no pudo ejecutarse: ${(err as Error).message})`.slice(-LOG_TAIL_MAX),
          durationMs: Date.now() - startedAt,
        };
      }
      if (out.exitCode !== 0) {
        const combined = `${out.stdout}\n${out.stderr}`.trim();
        log.info({ cmd, exitCode: out.exitCode, cwd: args.cwd }, "verify command failed");
        return {
          ok: false,
          failedCommand: cmd,
          exitCode: out.exitCode,
          logTail: combined.slice(-LOG_TAIL_MAX),
          durationMs: Date.now() - startedAt,
        };
      }
    }
    return {
      ok: true,
      logTail: `${args.commands.length} comando(s) de verificación OK.`,
      durationMs: Date.now() - startedAt,
    };
  },
};
