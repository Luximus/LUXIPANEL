import { hostingCronControl, HOSTING_CRON_WRAPPER_PATH } from "../../../shared/tenant/hosting-cron-control.js";
import { getContextUser } from "../../../shared/executor/context.js";
import { authorizationRevision } from "../../../shared/auth/authorization-revision.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cron parser service — read, add, update, toggle, remove, validate and
 * describe crontab entries. Operates on the system crontab for the current
 * user (or root via sudo).
 *
 * Jobs created from the panel are written through a logging WRAPPER so every
 * execution produces a per-run `.log` (see `cron-log.service.ts` + the
 * `lxp-cron-run` wrapper installed by `cron-daemon.service.ts`). The on-disk
 * line is:
 *
 *   <schedule> <wrapperPath> <jobId> <base64(command)> # <comment>
 *
 * `jobId` is a stable UUID generated at creation (NOT a hash of the line), so
 * editing/pausing a job keeps the same id. A paused job is the same line
 * prefixed with `#LXP-OFF `. Lines NOT matching the wrapper are treated as
 * "legacy" external entries: shown read-as-is with a hash id, no logging.
 */

import { randomUUID } from "node:crypto";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { ServiceUnavailableError } from "../../../shared/errors/index.js";
import type { CronJob } from "../models/index.js";
import { CONFIG_DIR } from "@config/paths.js";
import { CRON_ALIASES } from "../constants.js";
import { describeCron } from "./cron-descriptions.js";

export type { CronJob };

const log = createModuleLogger("cron-parser");

/** Prefix that marks a panel-managed job as paused (commented out). */
const DISABLED_PREFIX = "#LXP-OFF ";

/** Aliases accepted by `validate()`: the shared expansion set (`CRON_ALIASES`)
 *  plus `@reboot`, which is valid in a crontab but never time-expanded. */
const SCHEDULE_ALIASES = new Set<string>([...Object.keys(CRON_ALIASES), "@reboot"]);

export function cronBinDir(): string {
  return `${CONFIG_DIR}/cron/bin`;
}
/** Absolute path of the per-execution logging wrapper on the target. */
export function cronWrapperPath(): string {
  return `${cronBinDir()}/lxp-cron-run`;
}
/** Root directory under which per-job execution logs are written. */
export function cronLogsDir(): string {
  return `${CONFIG_DIR}/cron/logs`;
}

/** Simple hash for stable IDs of legacy (non-wrapped) lines. */
function lineId(line: string): string {
  let h = 0;
  for (let i = 0; i < line.length; i++) {
    h = ((h << 5) - h + line.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Normalize a cron expression to the 5 fields a SYSTEM crontab understands.
 * `validate()` accepts a 6-field form (leading seconds) for callers like the
 * AI-cron scheduler that strip it themselves, but the system `cron` daemon has
 * no seconds field: emitting 6 fields verbatim into a managed line shifts the
 * wrapper/jobId/b64 tokens by one and corrupts the crontab. Drop the seconds
 * field here (matching the AI scheduler's `normalizeSchedule`). `@aliases` and
 * already-5-field expressions pass through unchanged.
 */
function normalizeScheduleTo5(schedule: string): string {
  const s = schedule.trim();
  if (s.startsWith("@")) return s;
  const parts = s.split(/\s+/);
  return parts.length === 6 ? parts.slice(1).join(" ") : s;
}

/** Build the physical crontab line for a panel-managed (wrapped) job. */
export function buildManagedLine(
  schedule: string,
  command: string,
  comment: string | null,
  jobId: string,
  enabled: boolean,
  wrapperPath = cronWrapperPath(),
): string {
  const b64 = Buffer.from(command, "utf-8").toString("base64");
  // SECURITY (audit §5): the comment is interpolated LITERALLY into the crontab
  // line. cron does not treat "#" as an inline comment, so everything after it
  // is passed to the wrapper as arguments — a newline would inject a whole new
  // crontab line (extra job / MAILTO=…), and cron converts "%" in the command
  // portion into a newline + stdin split. Strip CR/LF/% defensively so a
  // managed line can never carry more than one physical line. Input is also
  // rejected at the Zod boundary (jobs.controller / ai-cron schemas).
  const safeComment = comment ? comment.replace(/[\r\n%]/g, " ").trim() : "";
  const commentStr = safeComment ? ` # ${safeComment}` : "";
  const core = `${normalizeScheduleTo5(schedule)} ${wrapperPath} ${jobId} ${b64}${commentStr}`;
  return enabled ? core : DISABLED_PREFIX + core;
}

/**
 * Parse a single physical line into a CronJob, or null when the line is a
 * blank line or a plain comment (not one of our paused jobs).
 */
function parsePhysicalLine(line: string, user: string): CronJob | null {
  let work = line.trim();
  if (!work) return null;

  let enabled = true;
  if (work.startsWith(DISABLED_PREFIX)) {
    enabled = false;
    work = work.slice(DISABLED_PREFIX.length).trim();
  } else if (work.startsWith("#")) {
    return null; // plain comment
  }

  const parts = work.split(/\s+/);
  const alias = parts[0]?.startsWith("@") ?? false;
  const offset = alias ? 1 : 5;
  if (parts.length <= offset) return null;
  const schedule = parts.slice(0, offset).join(" ");
  const commandToken = parts[offset];
  const wrapper = commandToken === cronWrapperPath() || commandToken === HOSTING_CRON_WRAPPER_PATH ||
    /\/\.local\/libexec\/luxipanel\/lxp-cron-run$/.test(commandToken || "");

  // Panel-managed (wrapped) line: <schedule> <wrapper> <jobId> <b64> [# comment]
  if (wrapper && parts.length >= offset + 3) {
    const jobId = parts[offset + 1]!;
    const b64 = parts[offset + 2]!;
    let command = b64;
    try {
      command = Buffer.from(b64, "base64").toString("utf-8");
    } catch {
      /* keep raw token if not valid base64 */
    }
    const cidx = work.indexOf(" # ");
    const comment = cidx >= 0 ? work.slice(cidx + 3).trim() : null;
    return { id: jobId, schedule, command, comment, user, enabled, managed: true, wrapperPath: commandToken, raw: line };
  }

  // Legacy external line — keep behaviour: hash id, inline comment, no logs.
  const rest = parts.slice(offset).join(" ");
  const inlineIdx = rest.indexOf(" # ");
  const command = inlineIdx >= 0 ? rest.slice(0, inlineIdx).trim() : rest;
  const inlineComment = inlineIdx >= 0 ? rest.slice(inlineIdx + 3).trim() : null;
  return {
    id: lineId(work),
    schedule,
    command,
    comment: inlineComment,
    user,
    enabled,
    managed: false,
    raw: line,
  };
}

/**
 * Transform crontab content line by line. `fn` receives the parsed job and
 * returns: a string to REPLACE the line, `null` to DELETE it, or `undefined`
 * to keep it unchanged. Non-job lines (blanks/comments) are always kept.
 */
function transformRaw(
  raw: string,
  user: string,
  fn: (job: CronJob) => string | null | undefined,
): { content: string; changed: boolean } {
  const lines = raw.split("\n");
  const out: string[] = [];
  let changed = false;
  const seen = new Map<string, number>();
  for (const line of lines) {
    const job = parsePhysicalLine(line, user);
    if (!job) {
      out.push(line);
      continue;
    }
    if (!job.managed) {
      const count = (seen.get(job.id) ?? 0) + 1;
      seen.set(job.id, count);
      if (count > 1) job.id = `${job.id}-${count}`;
    }
    const res = fn(job);
    if (res === null) {
      changed = true;
      continue;
    }
    if (typeof res === "string" && res !== line) {
      changed = true;
      out.push(res);
      continue;
    }
    out.push(line);
  }
  return { content: out.join("\n"), changed };
}

export const cronParserService = {
  /** Generate a fresh stable job id. */
  newJobId(): string {
    return randomUUID();
  },

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async listWithExecutor(user: string, executor: Executor, access?: { direct?: boolean }): Promise<CronJob[]> {
    return this._parse(await this.getRawWithExecutor(user, executor, access), user);
  },

  // ---------------------------------------------------------------------------
  // Mutations — content builders (shared by local / executor / write-behind)
  // ---------------------------------------------------------------------------

  /** Append a new managed job line, returning the new crontab body + its id. */
  buildAdd(
    raw: string,
    schedule: string,
    command: string,
    comment: string | null,
    wrapperPath = cronWrapperPath(),
  ): { content: string; jobId: string } {
    const jobId = this.newJobId();
    const newLine = buildManagedLine(schedule, command, comment, jobId, true, wrapperPath);
    const content = raw.trimEnd() + "\n" + newLine + "\n";
    return { content, jobId };
  },

  /** Replace a job (by id) preserving its enabled state. */
  buildUpdate(
    raw: string,
    user: string,
    id: string,
    schedule: string,
    command: string,
    comment: string | null,
    wrapperPath = cronWrapperPath(),
  ): { content: string; changed: boolean } {
    return transformRaw(raw, user, (job) =>
      job.id === id ? buildManagedLine(schedule, command, comment, id, job.enabled, job.wrapperPath || wrapperPath) : undefined,
    );
  },

  /** Toggle a job's paused state (by id). */
  buildToggle(raw: string, user: string, id: string): { content: string; changed: boolean; enabled: boolean } {
    let enabled = true;
    const res = transformRaw(raw, user, (job) => {
      if (job.id !== id) return undefined;
      enabled = !job.enabled;
      if (job.managed) {
        return buildManagedLine(job.schedule, job.command, job.comment, job.id, enabled, job.wrapperPath);
      }
      // Legacy line: toggle the raw prefix directly.
      const trimmed = job.raw.trim();
      return enabled ? trimmed.replace(DISABLED_PREFIX, "") : DISABLED_PREFIX + trimmed;
    });
    return { ...res, enabled };
  },

  /** Remove a job by id. */
  buildRemove(raw: string, user: string, id: string): { content: string; changed: boolean } {
    return transformRaw(raw, user, (job) => (job.id === id ? null : undefined));
  },

  // ---------------------------------------------------------------------------
  // Executor operations (SSH for remote targets, sudo-wrapped localExecutor for
  // the panel's own box) — the ONLY write path. No module runs commands on the
  // panel host directly (CLAUDE.md hard rule): even the local target goes
  // through the executor, never a local child process / shell-out.
  // ---------------------------------------------------------------------------

  async addWithExecutor(schedule: string, command: string, comment: string | null, user: string, executor: Executor, access?: { direct?: boolean; wrapperPath?: string }): Promise<string> {
    const raw = await this.getRawWithExecutor(user, executor, access);
    const { content, jobId } = this.buildAdd(raw, schedule, command, comment, access?.wrapperPath);
    await this.writeWithExecutor(content, user, executor, access);
    log.info({ user, schedule, jobId, target: executor.target.id }, "Cron job added via executor");
    return jobId;
  },

  // ---------------------------------------------------------------------------
  // Write-behind planners (compute new body WITHOUT writing)
  // ---------------------------------------------------------------------------

  async planAddWithExecutor(schedule: string, command: string, comment: string | null, user: string, executor: Executor, access?: { direct?: boolean; wrapperPath?: string }): Promise<{ content: string; jobId: string }> {
    const raw = await this.getRawWithExecutor(user, executor, access);
    return this.buildAdd(raw, schedule, command, comment, access?.wrapperPath);
  },

  async planUpdateWithExecutor(id: string, schedule: string, command: string, comment: string | null, user: string, executor: Executor, access?: { direct?: boolean; wrapperPath?: string }): Promise<{ content: string; changed: boolean }> {
    const raw = await this.getRawWithExecutor(user, executor, access);
    return this.buildUpdate(raw, user, id, schedule, command, comment, access?.wrapperPath);
  },

  async planToggleWithExecutor(id: string, user: string, executor: Executor, access?: { direct?: boolean }): Promise<{ content: string; changed: boolean; enabled: boolean }> {
    const raw = await this.getRawWithExecutor(user, executor, access);
    return this.buildToggle(raw, user, id);
  },

  async planRemoveWithExecutor(id: string, user: string, executor: Executor, access?: { direct?: boolean }): Promise<{ content: string; changed: boolean }> {
    const raw = await this.getRawWithExecutor(user, executor, access);
    return this.buildRemove(raw, user, id);
  },

  async removeWithExecutor(id: string, user: string, executor: Executor, access?: { direct?: boolean }): Promise<boolean> {
    const { content, changed } = await this.planRemoveWithExecutor(id, user, executor, access);
    if (!changed) return false;
    await this.writeWithExecutor(content, user, executor, access);
    log.info({ user, id, target: executor.target.id }, "Cron job removed via executor");
    return true;
  },

  async updateWithExecutor(id: string, schedule: string, command: string, comment: string | null, user: string, executor: Executor, access?: { direct?: boolean; wrapperPath?: string }): Promise<boolean> {
    const { content, changed } = await this.planUpdateWithExecutor(id, schedule, command, comment, user, executor, access);
    if (!changed) return false;
    await this.writeWithExecutor(content, user, executor, access);
    return true;
  },

  async toggleWithExecutor(id: string, user: string, executor: Executor, access?: { direct?: boolean }): Promise<{ changed: boolean; enabled: boolean }> {
    const { content, changed, enabled } = await this.planToggleWithExecutor(id, user, executor, access);
    if (changed) await this.writeWithExecutor(content, user, executor, access);
    return { changed, enabled };
  },

  // ---------------------------------------------------------------------------
  // Validation + human description
  // ---------------------------------------------------------------------------

  /** Validate a cron expression (5 or 6 fields, or an @alias). */
  validate(expression: string): { valid: boolean; error?: string } {
    const expr = expression.trim();
    if (SCHEDULE_ALIASES.has(expr)) {
      return { valid: true };
    }
    const parts = expr.split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      return { valid: false, error: "Se esperaban 5 o 6 campos" };
    }
    const five = parts.length === 6 ? parts.slice(1) : parts;
    const ranges: Array<[string | undefined, number, number]> = [
      [five[0], 0, 59], [five[1], 0, 23], [five[2], 1, 31], [five[3], 1, 12], [five[4], 0, 7],
    ];
    for (const [field, lo, hi] of ranges) {
      if (!field) return { valid: false, error: "Campo vacío" };
      // each comma item: "*", "*/n", "a", "a-b", "a-b/n"
      for (const item of field.split(",")) {
        if (item === "*") continue;
        const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(item);
        if (!m) return { valid: false, error: `Campo "${field}" inválido` };
        const base = m[1]!;
        if (base !== "*") {
          for (const n of base.split("-")) {
            const v = parseInt(n, 10);
            if (isNaN(v) || v < lo || v > hi) {
              return { valid: false, error: `Campo "${field}" fuera de rango [${lo}-${hi}]` };
            }
          }
        }
      }
    }
    return { valid: true };
  },

  /** Localized description of common five-field cron expressions. */
  describe(expression: string, locale: unknown = "es"): string {
    return describeCron(expression, locale);
  },

  // ---------------------------------------------------------------------------
  // Raw I/O
  // ---------------------------------------------------------------------------

  async getRawWithExecutor(user: string, executor: Executor, access?: { direct?: boolean }): Promise<string> {
    const control = hostingCronControl(executor, user);
    if (control) { executor = control; access = { ...access, direct: false }; }
    const direct = access?.direct === true;
    const cmd = direct
      ? quoteCmd("crontab", ["-l"])
      : quoteCmd("sudo", ["crontab", "-u", user, "-l"]);
    // timeoutMs: a `sudo crontab -l` waiting on a password prompt would
    // otherwise hang the request forever (DirectSshExecutor only arms a timer
    // when given one).
    const res = await executor.exec(cmd, { timeoutMs: 8_000 });
    if (res.exitCode === 0) return res.stdout;
    // `crontab -l` exits non-zero with "no crontab for <user>" when the user
    // simply has no crontab yet — that's an EMPTY crontab, not a failure.
    if (/no crontab for/i.test(res.stderr ?? "")) return "";
    // Any OTHER non-zero exit (permission denied, sudo prompt, transport blip)
    // is a REAL failure. Previously this returned "" and the caller installed
    // that empty body, silently wiping every scheduled task — fail closed.
    throw new ServiceUnavailableError(
      "No se pudo leer el crontab del servidor; operación cancelada para no perder tareas programadas.",
    );
  },

  async writeWithExecutor(content: string, user: string, executor: Executor, access?: { direct?: boolean }): Promise<void> {
    const control = hostingCronControl(executor, user);
    if (control) {
      // Never install a customer-selected host shell, environment or runner.
      const jobs = this._parse(content, user);
      content = "SHELL=/bin/sh\nPATH=/usr/bin:/bin\n" + jobs.map(job => buildManagedLine(job.schedule, job.command, job.comment, job.id, job.enabled, HOSTING_CRON_WRAPPER_PATH)).join("\n") + "\n";
      const actor = getContextUser();
      if (!actor || actor.authorizationRevision !== await authorizationRevision(control.target.id)) throw new ForbiddenError("Authorization changed; retry the operation");
      const command = quoteCmd("printf", ["%s", Buffer.from(content).toString("base64")]) + " | base64 -d | " + quoteCmd("sudo", ["-n", "crontab", "-u", user, "-"]);
      const installed = await control.exec(command, { timeoutMs: 8_000 });
      if (installed.exitCode !== 0) throw new ServiceUnavailableError("Hosting crontab installation failed");
      return;
    }
    // Stage the crontab over SFTP, then install it with `crontab <file>`. Two
    // reasons this is a staged file, never a shell string:
    //   1) it keeps sudo's stdin free for the password (see git history), and
    //   2) the crontab body is multi-line and can contain any character; going
    //      through `executor.writeFile` (SFTP) writes it BYTE-FOR-BYTE, so a
    //      command with quotes/`$`/`;`/`#`/newlines can never break out of a
    //      token or inject an extra crontab line (the old `echo '…' | crontab -`
    //      path had to single-quote-escape and did not survive every payload).
    const tmp = `/tmp/.lxp-cron-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await executor.writeFile(tmp, content.endsWith("\n") ? content : `${content}\n`);
    try {
      const direct = access?.direct === true;
      const cmd = direct
        ? quoteCmd("crontab", [tmp])
        : quoteCmd("sudo", ["crontab", "-u", user, tmp]);
      // Bound the install too: a stuck `sudo crontab <file>` (password prompt)
      // must not hold the request open indefinitely.
      const res = await executor.exec(cmd, { timeoutMs: 8_000 });
      if (res.exitCode !== 0) {
        throw new Error(`crontab install failed: ${res.stderr || res.stdout || "error"}`);
      }
    } finally {
      await executor.unlink(tmp).catch(() => undefined);
    }
  },

  _parse(raw: string, user: string): CronJob[] {
    const jobs: CronJob[] = [];
    const seen = new Map<string, number>();
    for (const line of raw.split("\n")) {
      const job = parsePhysicalLine(line, user);
      if (job) {
        if (!job.managed) {
          const count = (seen.get(job.id) ?? 0) + 1;
          seen.set(job.id, count);
          if (count > 1) job.id = `${job.id}-${count}`;
        }
        jobs.push(job);
      }
    }
    return jobs;
  },
};
