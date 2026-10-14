// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hosting controller — REST handlers for tenant account management.
 *
 * Reseller API endpoints (require admin session OR API key):
 *   POST   /api/hosting/accounts
 *   GET    /api/hosting/accounts
 *   GET    /api/hosting/accounts/:id
 *   PUT    /api/hosting/accounts/:id
 *   DELETE /api/hosting/accounts/:id
 *   POST   /api/hosting/accounts/:id/suspend
 *   POST   /api/hosting/accounts/:id/unsuspend
 *   POST   /api/hosting/accounts/:id/change-password
 *   GET    /api/hosting/accounts/:id/stats
 *
 * Auth endpoints (public):
 *   POST   /api/hosting/auth/login
 *   POST   /api/hosting/auth/logout
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { hostingService } from "../services/hosting.service.js";
import { authService } from "../../auth/services/auth.service.js";
import { tokenService } from "../../auth/services/token.service.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { emailSchema } from "../../../shared/validators/index.js";
import { getExecutor, LOCAL_TARGET_ID } from "../../../shared/executor/index.js";
import { extractIp } from "../../../shared/utils/ip.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { isAdminSession } from "../middlewares/tenant-scope.middleware.js";
import { readTenantUsage } from "../../../shared/quota/quota-checker.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { HostingAccount } from "../models/hosting-account.model.js";
import { hostingDefaultsRepository } from "../repositories/hosting-defaults.repository.js";
import { apiResponseMessage } from "../../../shared/i18n/responses.js";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";

// ── Validation schemas ─────────────────────────────────────────

const createSchema = z.object({
  templateId: z.string().uuid().optional(),
  username:         z.string().min(3).max(32).regex(/^[a-z][a-z0-9_-]*$/, "Empieza por letra; minúsculas, dígitos, - y _"),
  password:         z.string().min(8).max(128),
  displayName:      z.string().min(1).max(128).optional(),
  email:            emailSchema.optional(),
  plan:             z.enum(["basic", "pro", "business", "custom"]).optional(),
  allowedModules:   z.array(z.string()).optional(),
  diskQuotaMb:      z.coerce.number().int().min(256).optional(),
  bandwidthQuotaMb: z.coerce.number().int().min(1024).optional(),
  maxDomains:       z.coerce.number().int().min(0).optional(),
  maxEmailAccounts: z.coerce.number().int().min(0).optional(),
  maxDatabases:     z.coerce.number().int().min(0).optional(),
  maxSubUsers:      z.coerce.number().int().min(0).optional(),
  jailEnabled:      z.boolean().optional(),
  notes:            z.string().max(1000).optional(),
  expiresAt:        z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
});

const updateSchema = createSchema.omit({ username: true, password: true }).partial();

const changePasswordSchema = z.object({ password: z.string().min(8).max(128) });

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  remember: z.boolean().optional().default(false),
});

const listSchema = z.object({
  search: z.string().optional(),
  username: z.string().max(160).optional(),
  plan: z.enum(["basic", "pro", "business", "custom"]).optional(),
  sortBy: z.enum(["username", "plan", "status", "tenantGroup", "createdAt", "updatedAt"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  status: z.enum(["active", "suspended", "terminated"]).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});

const defaultsSchema = z.object({
  plan: z.enum(["basic", "pro", "business", "custom"]),
  diskQuotaMb: z.number().int().min(256).max(10_000_000),
  bandwidthQuotaMb: z.number().int().min(1024).max(100_000_000),
  maxDomains: z.number().int().min(1).max(100_000),
  maxEmailAccounts: z.number().int().min(1).max(100_000),
  maxDatabases: z.number().int().min(0).max(100_000),
  maxSubUsers: z.number().int().min(0).max(100_000),
  jailEnabled: z.boolean(),
  allowedModules: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(100),
});

const auditSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ── Helpers ────────────────────────────────────────────────────

/** Strip the password hash before returning an account to a client. */
function safeAccount(a: HostingAccount): Omit<HostingAccount, "passwordHash"> {
  const { passwordHash: _omit, ...rest } = a;
  return rest;
}

/**
 * Scope guard for self-service hosting reads (audit, stats): an admin / API-key
 * caller may read any account; a `kind:"hosting"` session may read ONLY its own
 * account.id (its `userId` IS the account id — see auth.service.loginHosting).
 * Throws ForbiddenError otherwise. Returns nothing; mutates nothing.
 */
function assertCanReadAccount(res: Response, id: number): void {
  if (isAdminSession(res)) return;
  const user = res.locals.user as SessionUser | undefined;
  if (isHostingSession(user) && (user!.tenantId ?? user!.userId) === id) return;
  throw new ForbiddenError("No puedes ver los datos de otra cuenta");
}

// ── Controller ─────────────────────────────────────────────────

export const hostingController = {
  getDefaults: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ok: true, data: await hostingDefaultsRepository.get(getExecutor(req)) });
  }),

  saveDefaults: asyncHandler(async (req: Request, res: Response) => {
    const defaults = defaultsSchema.parse(req.body);
    const data = await hostingDefaultsRepository.save(getExecutor(req), { id: "defaults", ...defaults });
    res.json({ ok: true, data });
  }),

  /** GET /api/hosting/accounts — real accounts from the per-server sidecar. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const q = listSchema.parse(req.query);
    const executor = getExecutor(req);
    const { rows, total, counts } = await hostingService.list(
      { search: q.search, username: q.username, plan: q.plan, status: q.status, sortBy: q.sortBy, sortDir: q.sortDir, limit: q.limit, offset: (q.page - 1) * q.limit },
      executor,
    );
    res.json({
      ok: true,
      data: rows.map(safeAccount),
      total,
      page: q.page,
      pageSize: q.limit,
      totalPages: Math.ceil(total / q.limit) || 1,
      counts,
      meta: { total, counts, page: q.page, pageSize: q.limit },
    });
  }),

  /** GET /api/hosting/accounts/:id */
  getOne: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    const executor = getExecutor(req);
    const account = await hostingService.findById(id, executor);
    res.json({ ok: true, data: safeAccount(account) });
  }),

  /** POST /api/hosting/accounts */
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = createSchema.parse(req.body);
    const executor = getExecutor(req);
    const account = await hostingService.create(body, executor);
    res.status(201).json({ ok: true, data: safeAccount(account) });
  }),

  /** PUT /api/hosting/accounts/:id */
  update: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    const body = updateSchema.parse(req.body);
    const executor = getExecutor(req);
    const account = await hostingService.update(id, body, executor);
    res.json({ ok: true, data: safeAccount(account) });
  }),

  /** DELETE /api/hosting/accounts/:id */
  terminate: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    const executor = getExecutor(req);
    await hostingService.terminate(id, executor);
    res.json({ ok: true, message: apiResponseMessage(res.locals.locale, "accountTerminated") });
  }),

  /** POST /api/hosting/accounts/:id/suspend */
  suspend: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    const account = await hostingService.suspend(id, getExecutor(req));
    res.json({ ok: true, data: safeAccount(account) });
  }),

  /** POST /api/hosting/accounts/:id/unsuspend */
  unsuspend: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    const account = await hostingService.unsuspend(id, getExecutor(req));
    res.json({ ok: true, data: safeAccount(account) });
  }),

  /** POST /api/hosting/accounts/:id/change-password */
  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    const { password } = changePasswordSchema.parse(req.body);
    await hostingService.changePassword(id, password, getExecutor(req));
    res.json({ ok: true, message: apiResponseMessage(res.locals.locale, "passwordUpdated") });
  }),

  /**
   * GET /api/hosting/accounts/:id/stats — quotas + live usage (Fase 6).
   *
   * Scope: admin/API-key sees any account; a `kind:"hosting"` session sees ONLY
   * its own account.id (same self-service guard as /audit).
   *
   * On a remote target we MEASURE the tenant's real consumption (disk via
   * repquota→du fallback, domains/mail/db/sub-users via the tenant-scope
   * ownership filters) and return the enriched contract shape. On the panel host
   * (`target.id === "local"`) there is no tenant VPS to probe, so we return the
   * caps with zeroed usage (du-best-effort, no warnings).
   */
  stats: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    assertCanReadAccount(res, id);
    const executor = getExecutor(req);
    const account = await hostingService.findById(id, executor);

    const usage = executor.target.id === LOCAL_TARGET_ID
      ? {
          diskUsedMb: 0,
          quotaMethod: "du-best-effort" as const,
          domainsUsed: 0,
          emailAccountsUsed: 0,
          databasesUsed: 0,
          subUsersUsed: 0,
          warnings: [] as string[],
        }
      : await readTenantUsage(executor, account);

    const diskPercentUsed =
      account.diskQuotaMb > 0
        ? Math.min(100, Math.round((usage.diskUsedMb / account.diskQuotaMb) * 100))
        : 0;

    res.json({
      ok: true,
      data: {
        id:               account.id,
        username:         account.username,
        plan:             account.plan,
        status:           account.status,
        diskQuotaMb:      account.diskQuotaMb,
        diskUsedMb:       usage.diskUsedMb,
        diskPercentUsed,
        quotaMethod:      usage.quotaMethod,
        bandwidthQuotaMb: account.bandwidthQuotaMb,
        bandwidthUsedMb:  0, // PENDIENTE Fase 9 — sin método on-box fiable (tc/iptables).
        maxDomains:       account.maxDomains,
        domainsUsed:      usage.domainsUsed,
        maxEmailAccounts: account.maxEmailAccounts,
        emailAccountsUsed: usage.emailAccountsUsed,
        maxDatabases:     account.maxDatabases,
        databasesUsed:    usage.databasesUsed,
        maxSubUsers:      account.maxSubUsers,
        subUsersUsed:     usage.subUsersUsed,
        warnings:         usage.warnings,
        timestamp:        new Date().toISOString(),
      },
    });
  }),

  /**
   * GET /api/hosting/accounts/:id/audit — tenant lifecycle audit history.
   * Scope: admin/API-key sees any account; a hosting session sees ONLY its own.
   */
  audit: asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    assertCanReadAccount(res, id);
    const { limit } = auditSchema.parse(req.query);
    const executor = getExecutor(req);
    const { total, entries } = await hostingService.getAudit(id, limit, executor);
    res.json({ ok: true, data: entries, total });
  }),

  // ── Auth endpoints ─────────────────────────────────────────────

  /**
   * POST /api/hosting/auth/login (PUBLIC).
   *
   * No pre-auth session exists here, so we do NOT call getExecutor(req): the
   * password login derives the VPS from the request host's subdomain and uses
   * the per-VPS service key (provided by LP) to validate. authService.loginHosting
   * connects, validates bcrypt on the VPS, and mints the privilege-dropped
   * `kind:"hosting"` session.
   */
  login: asyncHandler(async (req: Request, res: Response) => {
    const { username, password, remember } = loginSchema.parse(req.body);
    const host = (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host;
    const { token, expiresAt, account, mfaPending } = await authService.loginHosting(username, password, remember, {
      ip: extractIp(req),
      userAgent: req.headers["user-agent"] || "",
      host,
    });
    tokenService.setSessionCookie(res, token, mfaPending ? false : remember, expiresAt);
    res.json({ ok: true, mfaPending: !!mfaPending, data: { user: account, expiresAt } });
  }),

  /** POST /api/hosting/auth/logout */
  logout: asyncHandler(async (_req: Request, res: Response) => {
    tokenService.clearSessionCookie(res);
    res.json({ ok: true, message: apiResponseMessage(res.locals.locale, "loggedOut") });
  }),
};
