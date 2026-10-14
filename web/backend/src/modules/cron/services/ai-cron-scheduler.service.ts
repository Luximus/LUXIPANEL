// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI-agent cron scheduler — runs enabled scheduled AI-agent jobs on their cron
 * expressions. Mirrors the backup scheduler: a single setInterval polls every
 * minute for due jobs and executes them autonomously against the panel host
 * (localExecutor), exactly like scheduled backups.
 *
 * Each run streams the agent's events into a per-execution `.log` (START /
 * output / END) via `cronLogService`, reusing the same on-disk layout as the
 * classic cron wrapper so the UI shows both job kinds identically.
 *
 * The agent's allowed tools come from the AI Assistant's per-target
 * module-access gating (`assistantModulesService.allowedTools`, called inside
 * `agentService.run`), so revoking the agent's powers over a module is done
 * from the Assistant's Modules tab — not here.
 *
 * INSTANCE STATE — pinned to `localExecutor` ON PURPOSE. Do NOT migrate this to
 * a per-server context executor. The tick fires with no server connected, and
 * the jobs/logs it drives are orchestration state of THIS panel installation
 * (same rationale as the backup scheduler's panel-host branch and the MCP
 * registry). Only the agent's TOOLS reach the connected target, via the
 * target's own executor — the scheduling loop itself stays panel-local.
 */

import { localExecutor, type Executor } from "../../../shared/executor/index.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
// B-18: was importing `backup`'s copy (a cross-module import); the evaluator is
// now shared. `"local"` preserves the previous clock (server-local components).
import { cronMatches as cronMatchesShared } from "../../../shared/cron/cron-match.js";
import { agentService } from "../../ai-assistant/services/agent.service.js";
import { aiAgentJobRepository, type AiAgentJob } from "../repositories/ai-agent-job.repository.js";
import { agentPresetsRepository } from "../repositories/agent-presets.repository.js";
import { cronApprovalRepository } from "../repositories/approval.repository.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import { cronLogService } from "./cron-log.service.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { env } from "../../../config/env.js";
import { getPanelOrigin } from "../../../shared/panel-url/index.js";
import { escapeHtml as escHtml } from "../html.js";
import { CRON_ALIASES } from "../constants.js";

const log = createModuleLogger("ai-cron-scheduler");

/** Server-local clock, as the previous `backup` matcher used. */
const cronMatches = (expr: string, date: Date): boolean => cronMatchesShared(expr, date, "local");

let _timer: ReturnType<typeof setInterval> | null = null;
const _running = new Set<string>();

/** Internal service identity for scheduled (non-interactive) agent runs. */
const SERVICE_USER: SessionUser = {
  userId: 0,
  username: "cron-agent",
  displayName: "Agente programado",
  role: "admin",
  modules: [],
  kind: "admin",
};

/** Expand an @alias to a 5-field expression; pass through 5/6-field ones. */
function normalizeSchedule(expr: string): string | null {
  const e = expr.trim();
  if (e === "@reboot") return null; // not time-matchable
  if (CRON_ALIASES[e]) return CRON_ALIASES[e]!;
  const parts = e.split(/\s+/);
  if (parts.length === 6) return parts.slice(1).join(" "); // drop seconds field
  if (parts.length === 5) return e;
  return null;
}

function compactTs(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

/**
 * Absolute capability URL of an approval. The base is the panel's CURRENT
 * public origin (per-panel subdomain, learned from authenticated requests —
 * LUXIPANEL is multi-user/multi-server so this is NOT a .env constant);
 * `PANEL_PUBLIC_URL` only acts as an explicit override/fallback.
 */
async function buildApprovalUrl(token: string): Promise<string> {
  const base = (env.PANEL_PUBLIC_URL || (await getPanelOrigin()) || env.CORS_ORIGIN).replace(/\/+$/, "");
  return `${base}/api/cron-approvals/${token}`;
}

/** Inputs for the post-run report email (pure — no I/O). */
interface AgentReportEmailInput {
  jobName: string;
  ok: boolean;
  lastError: string | null;
  durationMs: number;
  projectsLine: string;
  approvalUrl: string | null;
  logTail: string;
}

/**
 * Build the subject/text/html of an agent job's post-run report. Pure
 * presentation: given the run outcome it returns the three message parts, so
 * `runJob` no longer inlines ~40 lines of HTML/text templating (SRP: this owns
 * "what the report looks like", runJob owns "when/to whom it is sent").
 */
export function buildAgentReportEmail(input: AgentReportEmailInput): { subject: string; text: string; html: string } {
  const { jobName, ok, lastError, durationMs, projectsLine, approvalUrl, logTail } = input;
  const seconds = Math.round(durationMs / 1000);
  const subject = `[LUXIPANEL] Agente "${jobName}" — ${ok ? "OK" : "ERROR"}`;
  const text = [
    `Agente: ${jobName}`,
    `Resultado: ${ok ? "OK" : `ERROR — ${lastError ?? "desconocido"}`}`,
    `Duración: ${seconds}s · Proyectos: ${projectsLine}`,
    approvalUrl ? `\nAPROBACIÓN REQUERIDA — revisa y decide aquí:\n${approvalUrl}` : "",
    `\n--- Final del log ---\n${logTail}`,
  ].filter(Boolean).join("\n");
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:640px">` +
    `<h2 style="margin:0 0 8px">Agente «${escHtml(jobName)}» — ` +
    `<span style="color:${ok ? "#059669" : "#dc2626"}">${ok ? "OK" : "ERROR"}</span></h2>` +
    `<p style="margin:0 0 4px;color:#555">Duración: ${seconds}s · Proyectos: ${escHtml(projectsLine)}</p>` +
    (lastError ? `<p style="color:#dc2626">${escHtml(lastError)}</p>` : "") +
    (approvalUrl
      ? `<p style="margin:16px 0"><a href="${approvalUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Revisar y aprobar / denegar</a></p>` +
        `<p style="color:#888;font-size:12px">La continuación (agente encadenado) queda en espera hasta tu decisión.</p>`
      : "") +
    `<pre style="background:#111;color:#ddd;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap">${escHtml(logTail)}</pre>` +
    `</div>`;
  return { subject, text, html };
}

export const aiCronSchedulerService = {
  start(): void {
    if (_timer) return;
    _timer = setInterval(() => void this._tick(), 60_000);
    _timer.unref?.();
    log.info("AI-agent cron scheduler started");
  },

  stop(): void {
    if (_timer) { clearInterval(_timer); _timer = null; }
  },

  async _tick(): Promise<void> {
    const now = new Date();
    let jobs: Array<AiAgentJob & { id: string }>;
    try {
      jobs = await aiAgentJobRepository.listEnabled(localExecutor);
    } catch {
      return;
    }
    for (const job of jobs) {
      const norm = normalizeSchedule(job.schedule);
      if (!norm || !cronMatches(norm, now)) continue;
      if (_running.has(job.id)) continue;
      void this.runJob(job, localExecutor).catch((err) => {
        log.warn({ err, jobId: job.id }, "Scheduled AI-agent job run failed");
      });
    }
  },

  /**
   * Run a single agent job now (used by the scheduler, "run now" and chained
   * triggers). `chain` carries the job ids already executed in this chain so
   * `nextJobId` loops can't recurse forever.
   */
  async runJob(job: AiAgentJob & { id: string }, executor: Executor, chain: ReadonlySet<string> = new Set()): Promise<void> {
    if (_running.has(job.id)) return;
    _running.add(job.id);
    // try/finally guarantees the job is cleared from `_running` even if an
    // unexpected throw escapes below — otherwise the id stays "running" forever
    // and the scheduler never runs it again (audit §5).
    try {
    const startedAt = new Date();
    const ts = compactTs(startedAt);

    // Multi-project: one INDEPENDENT run (own cwd + own log file) per selected
    // project, in parallel. Single/no project keeps the classic one-log layout.
    const rawPaths = job.projectPaths?.length ? job.projectPaths : [job.projectPath ?? null];
    const paths = rawPaths.filter((p, i, a) => a.indexOf(p) === i);
    const multi = paths.length > 1;
    const fileFor = (i: number) => (multi ? `${ts}-p${i + 1}.log` : `${ts}.log`);

    await aiAgentJobRepository
      .update(job.id, { lastStatus: "running", lastRunAt: startedAt.toISOString(), lastLogFile: fileFor(0), lastError: null }, executor)
      .catch(() => undefined);

    // Resolve referenced rule presets to their CURRENT text (once per run).
    let presetRules = "";
    if (job.ruleIds?.length) {
      try {
        const presets = await agentPresetsRepository.get(executor, job.ownerScope ?? (job.ownerUserId != null ? `panel:${job.ownerUserId}` : undefined));
        const byId = new Map(presets.rules.map((r) => [r.id, r.text]));
        presetRules = job.ruleIds
          .map((id) => byId.get(id)?.trim())
          .filter((t): t is string => Boolean(t))
          .join("\n");
      } catch { /* missing presets must not block the run */ }
    }

    const results = await Promise.all(
      paths.map((p, i) => this._runOne(job, executor, p ?? null, fileFor(i), presetRules)),
    );

    const firstError = results.find((r) => r.status === "error");
    const status: AiAgentJob["lastStatus"] = firstError ? "error" : "ok";
    const lastError = firstError?.lastError ?? null;

    await aiAgentJobRepository
      .update(job.id, { lastStatus: status, lastError }, executor)
      .catch(() => undefined);
    log.info({ jobId: job.id, status, projects: multi ? paths.length : undefined }, "AI-agent job finished");

    // Human-in-the-loop gate: with requireApproval the chain is DEFERRED — it
    // only fires when a human approves from the capability URL (sent in the
    // report email). Approvals live on the panel host (like the scheduler).
    const approvalUrl = job.requireApproval
      ? await this._requestApproval(job, status ?? "ok", fileFor(0))
      : null;

    // Recipient is ALWAYS the recovery email of the Linux user who created the
    // job (resolved fresh at send time from their panel record), never a static
    // address. The job opts into mail via requireApproval or a non-empty
    // notifyEmails marker; if it opts in but the owner has no recovery email we
    // skip and warn (create/update validation normally prevents this).
    const wantsEmail = job.requireApproval || job.notifyOwner === true || (job.notifyEmails?.length ?? 0) > 0;
    let recoveryEmail: string | null = null;
    if (wantsEmail && typeof job.ownerUserId === "number") {
      const owner = await panelUserRepository.findById(job.ownerUserId, localExecutor).catch(() => undefined);
      recoveryEmail = owner?.email?.trim() || null;
      if (!recoveryEmail) {
        log.warn(
          { jobId: job.id, ownerUserId: job.ownerUserId },
          "Owner has no recovery email registered — notification skipped",
        );
      }
    }
    // Email report via the mail module's panel-outbound identity (event bus).
    if (wantsEmail && recoveryEmail) {
      const logTail = await cronLogService
        .read(job.id, fileFor(0), executor)
        .then((c) => c.slice(-3000))
        .catch(() => "");
      const { subject, text, html } = buildAgentReportEmail({
        jobName: job.name,
        ok: status === "ok",
        lastError,
        durationMs: Date.now() - startedAt.getTime(),
        projectsLine: paths.filter(Boolean).join(", ") || "—",
        approvalUrl,
        logTail,
      });
      eventBus.emit(Events.SYSTEM_MAIL_SEND, { executor, to: [recoveryEmail], subject, text, html });
    }

    // The chain fires ONCE, after every project run finished — unless a human
    // approval is pending (it fires on approval instead).
    if (!job.requireApproval) await this._runChained(job, executor, chain);
    } finally {
      _running.delete(job.id);
    }
  },

  /**
   * Create the pending human-approval record for a finished run and return its
   * absolute capability URL (or null on failure — never blocks the run).
   * Approvals live on the panel host (like the scheduler), so `localExecutor`.
   */
  async _requestApproval(
    job: AiAgentJob & { id: string },
    status: string,
    logFile: string,
  ): Promise<string | null> {
    try {
      const approval = await cronApprovalRepository.create(
        { jobId: job.id, jobName: job.name, runStatus: status, logFile },
        localExecutor,
      );
      log.info({ jobId: job.id, approvalId: approval.id }, "Human approval requested — chain deferred");
      return await buildApprovalUrl(approval.token);
    } catch (err) {
      log.warn({ jobId: job.id, err: errMessage(err) }, "Failed to create approval request");
      return null;
    }
  },

  /** One agent execution against an optional project path, with its own log. */
  async _runOne(
    job: AiAgentJob & { id: string },
    executor: Executor,
    projectPath: string | null,
    file: string,
    presetRules = "",
  ): Promise<{ status: AiAgentJob["lastStatus"]; lastError: string | null }> {
    const startedAt = new Date();
    const header = [
      `=== START ${startedAt.toISOString()} agentJob=${job.id} provider=${job.providerId} model=${job.model || "default"} mode=${job.agentMode === "multi" ? "multi" : "single"}${projectPath ? ` project=${projectPath}` : ""} ===`,
      `# ${job.name}`,
      `> ${job.prompt}`,
      "--- output ---",
      "",
    ].join("\n");

    const chunks: string[] = [header];
    let status: AiAgentJob["lastStatus"] = "ok";
    let lastError: string | null = null;

    // Execution-mode directive: multi fans out parallel subagents (native in
    // Claude CLI via Task; best-effort elsewhere), single forbids them.
    const modeDirective = job.agentMode === "multi"
      ? "\n\n## Modo de ejecución: MULTI-AGENTE\nDescompón la tarea en subtareas independientes y ejecútalas con subagentes en PARALELO siempre que aporte velocidad o cobertura (si tu entorno tiene herramienta de subagentes/Task, úsala). Al final sintetiza los resultados de todos los subagentes en una única respuesta coherente."
      : "\n\n## Modo de ejecución: AGENTE ÚNICO\nEjecuta toda la tarea tú mismo de forma secuencial. NO lances subagentes ni orquestación paralela.";

    // Rules = referenced presets (resolved upstream) + the job's ad-hoc text.
    const rulesText = [presetRules, job.rules?.trim() ?? ""].filter(Boolean).join("\n");
    const userPrompt = (rulesText
      ? `${job.prompt}\n\n## Reglas y restricciones\n${rulesText}`
      : job.prompt) + modeDirective;

    const ownerId = typeof job.ownerUserId === "number" ? job.ownerUserId : undefined;
    try {
      await runWithExecutor(
        executor,
        async () => {
          for await (const ev of agentService.run([{ role: "user", content: userPrompt }], {
            executor,
            providerId: job.providerId,
            model: job.model || undefined,
            // Saved custom agent: injects its system prompt + tool subset; its
            // provider/model are already mirrored into the job above (so they
            // win via the explicit fields). Fail-open if it was deleted.
            agentId: job.agentId ?? undefined,
            projectId: job.projectId ?? undefined,
            cwd: projectPath ?? undefined,
            user: SERVICE_USER,
            userId: ownerId !== undefined ? String(ownerId) : undefined,
            withContext: true,
            // CRON background runs must NEVER inherit the interactive user's
            // global "auto". Default to "manual" if the job doesn't set one
            // explicitly — the UI surfaces the choice but the server enforces
            // the safe default. A scheduled "auto" job must be opt-in.
            approvalModeOverride: job.approvalModeOverride ?? "manual",
          })) {
            switch (ev.type) {
              case "text":
                chunks.push(ev.delta);
                break;
              case "tool_use":
                chunks.push(`\n[tool ▶ ${ev.name}] ${JSON.stringify(ev.input)}\n`);
                break;
              case "tool_result":
                chunks.push(`[tool ${ev.success ? "✓" : "✗"}] ${ev.output.slice(0, 2000)}\n`);
                break;
              case "error":
                status = "error";
                lastError = ev.message;
                chunks.push(`\n[error] ${ev.message}\n`);
                break;
              default:
                break;
            }
          }
        },
        ownerId,
        SERVICE_USER,
      );
    } catch (err) {
      status = "error";
      lastError = errMessage(err);
      chunks.push(`\n[exception] ${lastError}\n`);
    }

    const finishedAt = new Date();
    if (job.nextJobId) chunks.push(`\n[chain] al terminar → agente ${job.nextJobId}\n`);
    chunks.push(
      "\n--- end output ---\n" +
        `=== END ${finishedAt.toISOString()} exit=${status === "ok" ? 0 : 1} durationMs=${finishedAt.getTime() - startedAt.getTime()} ===\n`,
    );

    await cronLogService.write(job.id, file, chunks.join(""), executor).catch(() => undefined);
    return { status, lastError };
  },

  /** Fire the job chained via `nextJobId` once this run finished. */
  async _runChained(job: AiAgentJob & { id: string }, executor: Executor, chain: ReadonlySet<string>): Promise<void> {
    if (!job.nextJobId) return;
    const visited = new Set(chain).add(job.id);
    if (visited.has(job.nextJobId)) {
      log.warn({ jobId: job.id, nextJobId: job.nextJobId }, "Chained AI-agent job skipped (cycle detected)");
      return;
    }
    if (_running.has(job.nextJobId)) {
      log.warn({ jobId: job.id, nextJobId: job.nextJobId }, "Chained AI-agent job skipped (already running)");
      return;
    }
    let next: (AiAgentJob & { id: string }) | null = null;
    try {
      next = await aiAgentJobRepository.get(job.nextJobId, executor);
    } catch {
      next = null;
    }
    if (!next) {
      log.warn({ jobId: job.id, nextJobId: job.nextJobId }, "Chained AI-agent job not found");
      return;
    }
    log.info({ jobId: job.id, nextJobId: next.id }, "Triggering chained AI-agent job");
    // Chained jobs run even when paused (enabled=false): pausing only stops
    // the cron schedule, not explicit triggers — same as "run now".
    void this.runJob(next, executor, visited).catch((err) => {
      log.warn({ err, jobId: next?.id }, "Chained AI-agent job run failed");
    });
  },

  isRunning(jobId: string): boolean {
    return _running.has(jobId);
  },
};
