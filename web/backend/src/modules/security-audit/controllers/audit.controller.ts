// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { v4 as uuid } from "uuid";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { scannersService, aiAnalyzerService } from "../services/index.js";
import type { AuditReport } from "../models/audit-report.model.js";
import { getExecutor, type Executor } from "../../../shared/executor/index.js";
import { remoteConfig } from "../../../shared/remote-config/index.js";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

const log = createModuleLogger("security-audit:controller");
const MODULE_NAME = "security-audit-reports";

interface ReportsConfig {
  reports: AuditReport[];
}

const FALLBACK: ReportsConfig = { reports: [] };

async function readReports(executor: Executor): Promise<AuditReport[]> {
  const cfg = await remoteConfig.read<ReportsConfig>(executor, MODULE_NAME, FALLBACK);
  // Re-hydrate Date fields after JSON round-trip.
  return cfg.reports.map((r) => ({
    ...r,
    startedAt: new Date(r.startedAt),
    completedAt: r.completedAt ? new Date(r.completedAt) : undefined,
  }));
}

async function upsertReport(executor: Executor, report: AuditReport): Promise<void> {
  await remoteConfig.update<ReportsConfig>(executor, MODULE_NAME, FALLBACK, (current) => {
    const next = current.reports.filter((r) => r.id !== report.id);
    return { reports: [report, ...next].slice(0, 20) };
  });
}

export const auditController = {
  /** POST /api/security-audit/start */
  start: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);

    // Concurrency guard: each audit fires 4 scanners in parallel (60-120s
    // timeouts) and rewrites the whole reports sidecar several times over SSH.
    // Refuse to launch another while one is still pending/running (a stale one
    // older than the max scanner window is treated as abandoned).
    const AUDIT_RUNNING_TTL_MS = 15 * 60 * 1000;
    const existing = await readReports(executor);
    const active = existing.find(
      (r) =>
        (r.status === "running" || r.status === "pending") &&
        Date.now() - r.startedAt.getTime() < AUDIT_RUNNING_TTL_MS,
    );
    if (active) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "securityAuditRunning"));
    }

    const auditId = uuid();
    const report: AuditReport = {
      id: auditId,
      status: "pending",
      startedAt: new Date(),
      findings: [],
      summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
      scanProgress: { bitninja: 0, lynis: 0, rkhunter: 0, chkrootkit: 0, aiAnalysis: 0 },
    };

    await upsertReport(executor, report);
    // Fire-and-forget, but ALWAYS guarded: an unhandled rejection here would
    // bubble to the process-level handler (→ process.exit). `runAudit` already
    // finalizes the report; this `.catch` is the last-resort backstop.
    void runAudit(executor, report).catch((err) => {
      log.error({ auditId, err }, "Audit run rejected unexpectedly");
    });

    log.info({ auditId, target: executor.target.id }, "Audit started");
    res.json({ ok: true, auditId });
  }),

  /** GET /api/security-audit/report/:id */
  getReport: asyncHandler(async (req: Request, res: Response) => {
    const idStr = typeof req.params.id === "string" ? req.params.id : "";
    if (!idStr) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "securityReportIdInvalid"));
    }

    const executor = getExecutor(req);
    const reports = await readReports(executor);
    const report = reports.find((r) => r.id === idStr);
    if (!report) {
      throw new AppError(apiModuleMessage(res.locals.locale, "securityReportNotFound"), 404, ErrorCodes.NOT_FOUND);
    }
    res.json({ ok: true, data: report });
  }),

  /** GET /api/security-audit/scanners — installed status per scanner. */
  scannersStatus: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const data = await scannersService.getInstalledMap(executor);
    res.json({ ok: true, data });
  }),

  /** POST /api/security-audit/scanners/:name/install — install a scanner with defaults. */
  installScanner: asyncHandler(async (req: Request, res: Response) => {
    const name = String(req.params.name ?? "");
    if (!["bitninja", "lynis", "rkhunter", "chkrootkit"].includes(name)) {
      throw new ValidationError("Scanner desconocido");
    }
    const executor = getExecutor(req);
    const sudoPassword = typeof req.body?.sudoPassword === "string" ? req.body.sudoPassword : undefined;
    const licenseKey = typeof req.body?.licenseKey === "string" ? req.body.licenseKey : undefined;
    const data = await scannersService.installScanner(
      executor,
      name as "bitninja" | "lynis" | "rkhunter" | "chkrootkit",
      { sudoPassword, licenseKey },
    );
    res.json({ ok: data.ok, code: data.code, data });
  }),

  /** GET /api/security-audit/reports */
  listReports: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const reports = await readReports(executor);
    res.json({
      ok: true,
      data: reports
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, 20),
    });
  }),
};

async function runAudit(executor: Executor, report: AuditReport) {
  const auditId = report.id;

  report.status = "running";
  await upsertReport(executor, report);

  try {
    log.info({ auditId, target: executor.target.id }, "Running security scanners");
    const findings = await scannersService.runAllScanners(executor);
    report.findings = findings;
    report.scanProgress.bitninja = 100;
    report.scanProgress.lynis = 100;
    report.scanProgress.rkhunter = 100;
    report.scanProgress.chkrootkit = 100;

    findings.forEach((f) => {
      report.summary.totalFindings++;
      // `info` findings are not tallied: `summary` has no `info` bucket, and
      // bumping a missing key would write NaN into the summary.
      if (f.severity !== "info") {
        report.summary[f.severity]++;
      }
    });

    report.scanProgress.aiAnalysis = 50;
    let serverInfo = { hostname: "unknown", platform: "linux", uptime: 0 };
    try {
      const out = await executor.exec("echo \"$(hostname);$(uname -s);$(cut -d' ' -f1 /proc/uptime)\"", { timeoutMs: 5_000 });
      const parts = (out.stdout ?? "").split(";");
      serverInfo = {
        hostname: (parts[0] ?? "").trim() || "unknown",
        platform: ((parts[1] ?? "").trim() || "linux").toLowerCase(),
        uptime: Number.parseInt((parts[2] ?? "0").trim(), 10) || 0,
      };
    } catch {
      // Best-effort: if we cannot pull the info from the target, leave defaults.
    }

    const aiAnalysis = await aiAnalyzerService.analyzeFindings(findings, serverInfo, { auditId });
    report.aiAnalysis = aiAnalysis;
    report.scanProgress.aiAnalysis = 100;
    report.status = "completed";
    report.completedAt = new Date();
    log.info({ auditId, findings: findings.length, threats: aiAnalysis?.keyThreats?.length ?? 0 }, "Audit completed");
  } catch (err) {
    log.error({ auditId, err }, "Audit failed");
    report.status = "failed";
    report.completedAt = new Date();
  } finally {
    // ALWAYS persist a terminal status: a report must never be left stuck in
    // `running` (the UI would poll forever). If this final write itself fails,
    // swallow it — there is no caller to surface to (fire-and-forget) and an
    // unhandled rejection here would reach the process-level crash handler.
    if (report.status === "running") {
      report.status = "failed";
      report.completedAt = new Date();
    }
    try {
      await upsertReport(executor, report);
    } catch (err) {
      log.error({ auditId, err }, "Failed to persist final audit status");
    }
  }
}
