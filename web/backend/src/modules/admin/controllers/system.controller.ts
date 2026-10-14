// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * System controller — debug configuration and deep health checks.
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { systemInfoService } from "../services/system-info.service.js";
import { processService } from "../services/process.service.js";
import { getRedis } from "../../../shared/redis/index.js";
import { getExecutor, getExecutorForRead, quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

/** Timeout (ms) for reading the system timezone via the executor. */
const TIMEZONE_READ_TIMEOUT_MS = 3_000;
/** Timeout (ms) for setting the system timezone via the executor. */
const TIMEZONE_WRITE_TIMEOUT_MS = 5_000;

async function readSystemTimezone(executor: Executor): Promise<string> {
  try {
    const out = await executor.exec(
      quoteCmd("timedatectl", ["show", "--property=Timezone", "--value"]),
      { timeoutMs: TIMEZONE_READ_TIMEOUT_MS },
    );
    const tz = (out.stdout ?? "").trim();
    if (tz) return tz;
  } catch {
    // fall through
  }
  try {
    const out = await executor.exec(quoteCmd("readlink", ["-f", "/etc/localtime"]), { timeoutMs: TIMEZONE_READ_TIMEOUT_MS });
    const match = (out.stdout ?? "").trim().match(/zoneinfo\/(.+)$/);
    if (match?.[1]) return match[1];
  } catch {
    // fall through
  }
  return "UTC";
}

async function applySystemTimezone(executor: Executor, tz: string): Promise<{ applied: boolean; error?: string }> {
  // Try without sudo first, fall back to sudo. If neither works, the panel
  // keeps the kv-store value but the connected server's OS timezone stays
  // untouched.
  try {
    const out = await executor.exec(quoteCmd("timedatectl", ["set-timezone", tz]), { timeoutMs: TIMEZONE_WRITE_TIMEOUT_MS });
    if (out.exitCode === 0) return { applied: true };
  } catch {
    // fall through to sudo
  }
  try {
    const out = await executor.exec(quoteCmd("sudo", ["timedatectl", "set-timezone", tz]), { timeoutMs: TIMEZONE_WRITE_TIMEOUT_MS });
    if (out.exitCode === 0) return { applied: true };
    return { applied: false, error: (out.stderr || out.stdout || `exit ${out.exitCode}`).trim() };
  } catch (err) {
    return { applied: false, error: errMessage(err) };
  }
}

const log = createModuleLogger("system-ctrl");

/** Sensitive config keys that must never be exposed. */
// SECURITY: this endpoint is exposed to admins over HTTP, so it must NEVER echo
// `process.env` wholesale — that previously leaked LUXIPANEL_KEY, LICENSE_KEY,
// the mTLS private-key PEM, GIT_ENCRYPTION_KEY, SECRET_ROTATION_HMAC, etc.
// We invert to a curated ALLOWLIST of non-sensitive operational vars, and even
// then apply a sensitive-name guard as defense-in-depth so a future var added
// to the allowlist (or matching a safe prefix) can't accidentally leak.
const SAFE_ENV_KEYS = new Set([
  "NODE_ENV", "PORT", "HOST", "LOG_LEVEL",
  "DEFAULT_LOCALE", "SUPPORTED_LOCALES",
  "LUXIPANEL_CONFIG_DIR",
  "HCAPTCHA_ENABLED", "HCAPTCHA_SITEKEY",
  "COOKIE_DOMAIN", "COOKIE_SAMESITE", "COOKIE_SECURE",
  "CORS_ORIGIN", "CORS_CREDENTIALS",
  "SESSION_COOKIE_NAME", "CSRF_COOKIE_NAME", "DISABLE_HTTP_CACHE",
  "JWT_EXPIRES_IN", "JWT_REMEMBER_EXPIRES_IN",
  "MAIL_IMAP_HOST", "MAIL_IMAP_PORT", "MAIL_SMTP_HOST", "MAIL_SMTP_PORT",
  "DOVECOT_GROUP", "DOVECOT_USERS_FILE", "POSTFIX_VMAILBOX", "SIEVEC_BIN",
  "SSH_LOGIN_HOST", "SSH_LOGIN_PORT", "SSH_LOGIN_TIMEOUT_MS",
]);

// Allowlisted prefixes for groups of non-secret tuning vars.
const SAFE_ENV_PREFIXES = [
  "WRITE_QUEUE_", "REMOTE_CACHE_", "FILES_",
  "RATE_LIMIT_", "LOGIN_RATE_LIMIT_", "SSH_PROXY_",
];

// Defense-in-depth: never show a value whose KEY looks secret, even if it
// somehow passes the allowlist.
const SENSITIVE_KEY_RE = /(KEY|SECRET|TOKEN|PASS|CRED|PEM|HMAC|PRIVATE|SALT)/i;

function isSafeEnvKey(k: string): boolean {
  if (SENSITIVE_KEY_RE.test(k)) return false;
  if (SAFE_ENV_KEYS.has(k)) return true;
  return SAFE_ENV_PREFIXES.some((p) => k.startsWith(p));
}

function redactEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (!v) continue;
    if (isSafeEnvKey(k)) result[k] = v;
  }
  return result;
}

export const systemController = {
  /**
   * GET /api/admin/system/info — full server snapshot (CPU, RAM, disk, uptime).
   */
  info: asyncHandler(async (req: Request, res: Response) => {
    // Snapshot of the CONNECTED server, via its executor — never the panel host.
    const snapshot = await systemInfoService.snapshot(getExecutor(req));
    res.json({ ok: true, data: snapshot });
  }),

  /**
   * GET /api/admin/system/health — deep health check: DB, Redis, services.
   */
  health: asyncHandler(async (req: Request, res: Response) => {
    const checks: Record<string, { ok: boolean; message?: string; latencyMs?: number }> = {};

    // Storage (kv-store) — no database; LUXIPANEL persists JSON sidecars on the connected server.
    checks["storage"] = { ok: true, message: "kv-store (no database)" };

    // Redis
    const redisStart = Date.now();
    try {
      const redis = getRedis();
      await redis.ping();
      checks["redis"] = { ok: true, latencyMs: Date.now() - redisStart };
    } catch (err) {
      checks["redis"] = { ok: false, message: (err as Error).message };
    }

    // System services — on the connected server, via its executor.
    const serviceStatuses = await processService.getAllStatuses(getExecutor(req));
    for (const svc of serviceStatuses) {
      checks[`service:${svc.name}`] = {
        ok: svc.active,
        message: svc.active ? undefined : "inactive",
      };
    }

    const allOk = Object.values(checks).every((c) => c.ok);

    log.info({ allOk, checks }, "Health check requested");
    res.status(allOk ? 200 : 503).json({ ok: allOk, data: checks });
  }),

  /**
   * GET /api/admin/system/env — runtime environment info (non-sensitive).
   */
  env: asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      ok: true,
      data: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: Math.floor(process.uptime()),
        env: redactEnv(process.env),
      },
    });
  }),

  /**
   * GET /api/admin/system/timezone — return the timezone reported by the
   * connected server's `timedatectl` / `/etc/localtime`.
   */
  getTimezone: asyncHandler(async (req: Request, res: Response) => {
    // Read path: signal a typed 428 (re-select server) rather than an opaque
    // 500 when the bridge session is gone. See getExecutorForRead.
    const executor = getExecutorForRead(req);
    const tz = await readSystemTimezone(executor);
    res.json({ ok: true, data: { timezone: tz } });
  }),

  /**
   * PUT /api/admin/system/timezone — apply a new timezone to the connected
   * server (best effort: tries `timedatectl` then `sudo -n timedatectl`).
   * Returns `{ applied: boolean }` so the UI can react to soft-failures.
   */
  setTimezone: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const body = z.object({ timezone: z.string().min(1).max(64) }).parse(req.body);
    const result = await applySystemTimezone(executor, body.timezone);
    log.info({ tz: body.timezone, applied: result.applied, target: executor.target.id }, "Timezone change requested");
    res.json({ ok: true, data: { timezone: body.timezone, applied: result.applied, error: result.error } });
  }),
};
