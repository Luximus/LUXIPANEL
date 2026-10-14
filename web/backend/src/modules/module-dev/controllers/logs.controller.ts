import { communityActivity, markCommunityRead } from "../services/community-activity.service.js";
import { syncModuleReports, publishIncidentReport, reportModuleIds } from "../services/module-reports.service.js";
import { snapshotModuleSource } from "../../../shared/diagnostics/module-source.js";
import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler, type SessionUser } from "../../../shared/types/index.js";
import { AppError } from "../../../shared/errors/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { diagnosticsStore } from "../../../shared/diagnostics/store.js";
import { repairJobs } from "../../../shared/diagnostics/repair-jobs.js";
import { accessibleDetail, accessibleIncidents, accessibleModuleEvents, logsScope, ownedModuleIds } from "../services/logs-access.service.js";

const automation = z.object({ component: z.string().regex(/^(?:luxipanel|[a-z][a-z0-9-]{2,38})$/), enabled: z.boolean(), severities: z.array(z.enum(["warn", "error", "fatal"])).min(1).max(3) }).strict();
const configSchema = z.object({
  enabled: z.boolean(), retentionDays: z.number().int().min(1).max(365), maxStorageMiB: z.number().int().min(16).max(4096),
  agentId: z.string().max(128), providerId: z.enum(["", "claude", "codex", "gemini", "deepseek", "grok", "minimax"]), model: z.string().max(128),
  effort: z.enum(["low", "medium", "high", "xhigh"]), instructions: z.string().max(12000), approvalMode: z.enum(["auto", "manual"]),
  tokenBudget: z.number().int().min(1000).max(2_000_000), timeoutMinutes: z.number().int().min(1).max(120),
  credentialId: z.string().max(128), baseBranch: z.string().max(128).refine((v) => !v.startsWith("-") && !/[\s\x00-\x1f~^:?*\[\\]/.test(v)), concurrency: z.number().int().min(1).max(4),
  checks: z.array(z.enum(["backend-types", "backend-tests", "frontend-tests", "frontend-build"])).min(1).max(4),
  repairPolicies: z.unknown().optional(), automation: automation.optional(),
}).strict();
const incidentId = z.string().regex(/^[a-f0-9]{24}$/);
const jobId = z.string().uuid();
function context(req: Request, res: Response) {
  const administrator = res.locals.logsUser as SessionUser | undefined;
  if (!administrator) throw new AppError("Administrador local requerido", 403, "FORBIDDEN");
  const executor = getExecutor(req); const user = res.locals.user as SessionUser;
  const view = z.enum(["luxipanel", "modules"]).default("luxipanel").parse(req.query.view);
  return { administrator, executor, user, view, scope: logsScope(view, executor, user) };
}
const act = async <T>(fn: () => Promise<T>): Promise<T> => { try { return await fn(); } catch (err) { if (err instanceof AppError) throw err; throw new AppError(String((err as Error).message), 409, "LOGS_OPERATION_FAILED"); } };
async function authorizedJob(req: Request, res: Response) {
  const c = context(req, res); const job = await act(() => repairJobs.get(c.scope, jobId.parse(req.params.id)));
  if (job.userId !== c.administrator.userId) throw new AppError("Reparación no encontrada", 404, "LOGS_NOT_FOUND");
  return { c, job };
}
export const logsController = {
  community: asyncHandler(async (_req, res) => { const user = (res.locals.authBaseUser || res.locals.user) as SessionUser; res.setHeader("Cache-Control", "private, no-store"); res.json({ ok: true, data: await communityActivity(user, await reportModuleIds(getExecutor(_req), res.locals.user).catch(() => [])) }); }),
  communityRead: asyncHandler(async (req, res) => { const user = (res.locals.authBaseUser || res.locals.user) as SessionUser; await act(() => markCommunityRead(user, z.string().max(100).parse(req.params.id))); res.json({ ok: true }); }),
  list: asyncHandler(async (req, res) => {
    const c = context(req, res); const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(req.query.limit);
    const search = z.string().max(200).default("").parse(req.query.q).toLowerCase();
    const severity = z.enum(["", "warn", "error", "fatal"]).default("").parse(req.query.severity);
    const source = z.string().max(64).default("").parse(req.query.source); const module = z.string().max(128).default("").parse(req.query.module);
    const from = z.string().max(32).default("").parse(req.query.from); const to = z.string().max(32).default("").parse(req.query.to);
    const state = z.string().max(32).default("").parse(req.query.state);
    if (c.view === "modules") await syncModuleReports(c.executor, c.user).catch((error) => { diagnosticsStore.health.error = String((error as Error).message).slice(0, 1000); });
    await repairJobs.syncPublication();
    const [all, repairs] = await Promise.all([accessibleIncidents(c.view, c.executor, c.user), repairJobs.list(c.scope)]);
    const jobs = repairs.filter((j) => j.userId === c.administrator.userId);
    const latest = new Map<string, typeof jobs[number]>(); for (const job of jobs) if (!latest.has(job.incidentId)) latest.set(job.incidentId, job);
    const filtered = all.filter((i) => (!search || `${i.message} ${i.module}`.toLowerCase().includes(search)) && (!severity || i.severity === severity) && (!source || i.source === source) && (!module || i.module === module) && (!from || i.lastSeen >= from) && (!to || i.lastSeen <= to + "T23:59:59.999Z") && (!state || (latest.get(i.id)?.status || "new") === state));
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, data: { items: filtered.slice((page - 1) * limit, page * limit).map((i) => ({ ...i, repair: latest.get(i.id) })), total: filtered.length, page, modules: [...new Set(all.map((i) => i.module))].sort(), sources: [...new Set(all.map((i) => i.source))].sort(), summary: { error: all.filter((i) => i.severity === "error").length, warn: all.filter((i) => i.severity === "warn").length, fatal: all.filter((i) => i.severity === "fatal").length } } });
  }),
  detail: asyncHandler(async (req, res) => {
    const c = context(req, res); const id = incidentId.parse(req.params.id);
    const result = await accessibleDetail(c.view, c.executor, c.user, id, z.coerce.number().int().min(0).default(0).parse(req.query.offset));
    if (!result.incident) throw new AppError("Incidencia no encontrada", 404, "LOGS_NOT_FOUND");
    res.json({ ok: true, data: { ...result, repairs: (await repairJobs.list(c.scope)).filter((j) => j.incidentId === id && j.userId === c.administrator.userId) } });
  }),
  status: asyncHandler(async (req, res) => { context(req, res); res.json({ ok: true, data: { ...diagnosticsStore.health, capture: (await diagnosticsStore.config("instance")).enabled } }); }),
  config: asyncHandler(async (req, res) => {
    const c = context(req, res); const config = await diagnosticsStore.config("instance");
    const readiness = await act(() => repairJobs.readiness("instance", c.administrator, config));
    const ids = [...new Set([...(await ownedModuleIds(c.executor, c.user)), ...(await accessibleModuleEvents(c.executor, c.user)).map((e) => e.component!.id)])];
    res.json({ ok: true, data: { config, ...readiness, components: ["luxipanel", ...ids], policyPrefix: `module:${c.executor.target.id}:${c.user.userId}:` } });
  }),
  saveConfig: asyncHandler(async (req, res) => {
    const c = context(req, res); const { automation: policy, repairPolicies: _ignored, ...input } = configSchema.parse(req.body);
    const saved = await diagnosticsStore.config("instance"); const policies = { ...saved.repairPolicies };
    if (policy) {
      const own = [...await ownedModuleIds(c.executor, c.user), ...(await accessibleModuleEvents(c.executor, c.user)).map((e) => e.component!.id)];
      if (policy.component !== "luxipanel" && !own.includes(policy.component)) throw new AppError("Módulo no disponible para esta identidad y servidor", 403, "FORBIDDEN");
      if (policy.enabled) { const readiness = await repairJobs.readiness("instance", c.administrator, input); if (!readiness.ready) throw new AppError(readiness.issues.join(" "), 409, "LOGS_OPERATION_FAILED"); }
      const key = policy.component === "luxipanel" ? "luxipanel" : `module:${c.executor.target.id}:${c.user.userId}:${policy.component}`;
      policies[key] = { enabled: policy.enabled, severities: policy.severities, since: policies[key]?.enabled && policy.enabled ? policies[key]!.since : new Date().toISOString(), userId: c.administrator.userId, username: c.administrator.username };
    }
    const config = { ...input, repairPolicies: policies }; await diagnosticsStore.saveConfig("instance", config); res.json({ ok: true, data: config });
  }),
  create: asyncHandler(async (req, res) => {
    const c = context(req, res); const { incidentId: id } = z.object({ incidentId }).strict().parse(req.body);
    const evidence = await accessibleDetail(c.view, c.executor, c.user, id);
    if (!evidence.incident) throw new AppError("Incidencia no encontrada", 404, "LOGS_NOT_FOUND");
    const job = await act(async () => repairJobs.create(c.scope, id, c.administrator, { incident: evidence.incident!, events: c.view === "modules" ? (await accessibleModuleEvents(c.executor, c.user)).filter((event) => event.fingerprint === id) : undefined, moduleSource: evidence.incident!.sample.component?.kind === "module" ? await snapshotModuleSource(c.executor, c.user, evidence.incident!.sample.component.id) : undefined })); res.status(202).json({ ok: true, data: job });
  }),
  report: asyncHandler(async (req, res) => { const c = context(req, res); const id = incidentId.parse(req.params.id); res.json({ ok: true, data: await act(() => publishIncidentReport(c.executor, c.user, c.administrator, c.view, id)) }); }),
  jobs: asyncHandler(async (req, res) => { const c = context(req, res); res.json({ ok: true, data: (await repairJobs.list(c.scope)).filter((j) => j.userId === c.administrator.userId) }); }),
  job: asyncHandler(async (req, res) => { const { job } = await authorizedJob(req, res); res.json({ ok: true, data: job }); }),
  cancel: asyncHandler(async (req, res) => { const { c, job } = await authorizedJob(req, res); res.json({ ok: true, data: await act(() => repairJobs.cancel(c.scope, job.id)) }); }),
  retry: asyncHandler(async (req, res) => { const { c, job } = await authorizedJob(req, res); res.status(202).json({ ok: true, data: await act(() => repairJobs.retry(c.scope, job.id, c.administrator)) }); }),
  approve: asyncHandler(async (req, res) => { const { c, job } = await authorizedJob(req, res); const body = z.object({ permissionId: z.string().uuid(), allow: z.boolean() }).strict().parse(req.body); res.json({ ok: true, data: await act(() => repairJobs.approve(c.scope, job.id, body.permissionId, body.allow)) }); }),
};
