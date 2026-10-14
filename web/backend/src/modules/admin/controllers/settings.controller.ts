// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Settings controller — manage panel settings.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { settingsRepository } from "../repositories/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { getExecutor, getExecutorForRead } from "../../../shared/executor/index.js";
import { securitySettingsService } from "../services/security-settings.service.js";
import { serverSettingsService } from "../services/server-settings.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

const log = createModuleLogger("settings-controller");

// Self-hosted: settings (including branding/layout/login-method keys) are
// written to the LOCAL per-server store — there is no LP-LICENSE-SERVER source
// of truth, so every write routes to the connected server's settings.json.

/**
 * Module-owned secret keys that must NEVER be dumped by the generic settings
 * list endpoints (GET /api/settings[/:category]). They live in the same kv
 * settings bag as everything else, but their modules expose them ONLY as a
 * masked preview via their own config endpoints (e.g. GET /api/cloudflare/config)
 * and consume the raw value server-side. Without this denylist the list
 * endpoints leak the full token to any user with the `admin` module —
 * violating the "never returned to the browser" invariant declared in
 * modules/cloudflare/models/index.ts.
 *
 * NOTE: this is intentionally a key denylist, NOT a broad sensitive-key regex:
 * the Settings UI legitimately round-trips other secret-shaped keys
 * (smtp_password, ai_api_key, s3_secret_key, license_key) as editable form
 * fields, and blanking them here would make the form silently overwrite the
 * stored value with "" on save.
 */
const HIDDEN_SETTING_KEYS = new Set([
  "repository_store.github_token",
  "cloudflare_api_token",
  "openclaw_api_key",
  "expo_token",
  "bitninja_license_key",
  // hCaptcha secret: like the tokens above, it must never be dumped raw by the
  // generic list endpoints. The sitekey is public and stays visible; the secret
  // is consumed server-side (hcaptcha.service) and only ever shown masked.
  "hcaptcha_secret",
]);

/**
 * Secret-shape heuristic: keys whose NAME strongly implies a third-party
 * credential (api token/key, access token, client secret, secret key, private
 * key). Deliberately narrow — it does NOT match bare `_password`/`_token` (the
 * Settings form legitimately round-trips those as editable fields), only the
 * high-confidence "outside credential" shapes. This makes the hide list
 * FAIL-CLOSED: a new module's `foo_api_token` is masked out by default instead
 * of leaking raw just because nobody remembered to add it to the denylist.
 */
const SECRET_KEY_RE =
  /(^|_)(api_?token|api_?key|access_?token|client_?secret|secret_?key|private_?key)($|_)/i;

/** Keys that MATCH the secret heuristic but must remain editable via the generic
 *  Settings form (their modules round-trip them here; hiding would make a save
 *  overwrite the stored value with ""). */
const EDITABLE_SECRET_KEYS = new Set(["ai_api_key", "s3_secret_key"]);

/** True when a settings key must be withheld from the generic list endpoints. */
export function isHiddenSettingKey(key: string): boolean {
  if (HIDDEN_SETTING_KEYS.has(key)) return true;
  if (EDITABLE_SECRET_KEYS.has(key)) return false;
  return SECRET_KEY_RE.test(key);
}

/**
 * The ONLY settings reset by POST /api/settings/reset. These are the AI
 * assistant defaults re-seeded so the assistant keeps working. The reset must
 * touch nothing outside this list — branding, security and every other key
 * share the same per-server sidecar and must survive a reset.
 */
const RESET_AI_DEFAULTS: ReadonlyArray<{ key: string; value: string; category: string; description: string }> = [
  { key: "ai_enabled", value: "true", category: "ai", description: "AI assistant enabled" },
  { key: "ai_provider", value: "anthropic", category: "ai", description: "AI provider" },
  { key: "ai_model", value: "claude-sonnet-4-6", category: "ai", description: "AI model" },
];

const SECURITY_KEYS_TO_FIELD: Record<string, keyof Awaited<ReturnType<typeof securitySettingsService.read>>> = {
  require_2fa: "requireTwoFa",
  audit_log_enabled: "auditLogEnabled",
  // Wire keys must match the frontend settings form (`session_ttl_hours`,
  // `max_login_attempts`). They were previously `session_duration_hours` /
  // `max_failed_login_attempts`, which the form never sends — so the values
  // were silently dropped instead of reaching securitySettingsService.
  session_ttl_hours: "sessionDurationHours",
  max_login_attempts: "maxFailedLoginAttempts",
  login_allow_password: "loginAllowPassword",
  login_allow_passkey: "loginAllowPasskey",
  login_allow_recovery: "loginAllowRecovery",
  hcaptcha_enabled: "hcaptchaEnabled",
  hcaptcha_sitekey: "hcaptchaSitekey",
  hcaptcha_secret: "hcaptchaSecret",
};
function castSecurityValue(field: keyof Awaited<ReturnType<typeof securitySettingsService.read>>, raw: string): boolean | number | string {
  if (field === "sessionDurationHours" || field === "maxFailedLoginAttempts") {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }
  // String-typed security fields (hCaptcha sitekey/secret) round-trip verbatim.
  if (field === "hcaptchaSitekey" || field === "hcaptchaSecret") {
    return raw;
  }
  return raw === "true";
}

const setSettingSchema = z.object({
  key: z.string().min(1).max(128).trim(),
  value: z.string(),
  category: z.string().max(64).default("general"),
  description: z.string().max(512).optional(),
});

const setBulkSchema = z.object({
  settings: z.array(z.object({
    key: z.string().min(1).max(128),
    value: z.string(),
    category: z.string().max(64).optional(),
  })),
});

export const settingsController = {
  /**
   * GET /api/ui/switch-server-behavior — public-ish (any authenticated user)
   * read of the single "open switched server in a new tab" general preference.
   *
   * The sidebar server-switcher is shown to NON-admin users too, but the full
   * `/api/settings` endpoint is admin-gated. This narrow endpoint exposes ONLY
   * the `switch_open_new_tab` boolean (read from the connected server's general
   * settings) so the switcher can honor it for everyone. Fail-open to `false`
   * (current default = same tab) on any error — never blocks the switcher.
   */
  switchServerBehavior: asyncHandler(async (req: Request, res: Response) => {
    let openNewTab = false;
    try {
      const executor = getExecutor(req);
      const entry = await serverSettingsService.getOne(executor, "switch_open_new_tab");
      const v = (entry?.value ?? "").trim().toLowerCase();
      openNewTab = ["true", "1", "yes", "on"].includes(v);
    } catch {
      openNewTab = false;
    }
    res.json({ ok: true, data: { openNewTab } });
  }),

  /** GET /api/settings — list all settings from the connected server file. */
  list: asyncHandler(async (req: Request, res: Response) => {
    // Read path: a missing bridge (e.g. in-memory sessions dropped on a backend
    // restart) surfaces as a typed 428 BRIDGE_SESSION_REQUIRED — the Settings
    // page acts on it (reconnect server) instead of hanging on an opaque 500.
    const executor = getExecutorForRead(req);
    const [bag, securityFromServer] = await Promise.all([
      serverSettingsService.readAll(executor),
      securitySettingsService.read(executor),
    ]);

    const out: Array<{ key: string; value: string; category: string; description: string | null; updatedAt: Date; createdAt: Date }> = [];
    const seen = new Set<string>();

    for (const [key, entry] of Object.entries(bag)) {
      if (isHiddenSettingKey(key)) continue;
      const field = SECURITY_KEYS_TO_FIELD[key];
      const value = field ? String(securityFromServer[field]) : entry.value;
      out.push({ key, value, category: entry.category, description: null, updatedAt: new Date(), createdAt: new Date() });
      seen.add(key);
    }
    // Ensure security keys always appear.
    for (const [key, field] of Object.entries(SECURITY_KEYS_TO_FIELD) as Array<[string, keyof typeof securityFromServer]>) {
      if (seen.has(key)) continue;
      out.push({ key, value: String(securityFromServer[field]), category: "security", description: null, updatedAt: new Date(), createdAt: new Date() });
      seen.add(key);
    }
    res.json({ ok: true, data: out });
  }),

  /** GET /api/settings/:category — list settings by category. */
  listByCategory: asyncHandler(async (req: Request, res: Response) => {
    const category = String(req.params.category);
    const executor = getExecutorForRead(req);
    const [bag, securityFromServer] = await Promise.all([
      serverSettingsService.readAll(executor),
      securitySettingsService.read(executor),
    ]);

    const out: Array<{ key: string; value: string; category: string; description: null; updatedAt: Date; createdAt: Date }> = [];
    const seen = new Set<string>();
    for (const [key, entry] of Object.entries(bag)) {
      if (isHiddenSettingKey(key)) continue;
      if (entry.category !== category) continue;
      const field = SECURITY_KEYS_TO_FIELD[key];
      const value = field ? String(securityFromServer[field]) : entry.value;
      out.push({ key, value, category: entry.category, description: null, updatedAt: new Date(), createdAt: new Date() });
      seen.add(key);
    }
    if (category === "security") {
      for (const [key, field] of Object.entries(SECURITY_KEYS_TO_FIELD) as Array<[string, keyof typeof securityFromServer]>) {
        if (seen.has(key)) continue;
        out.push({ key, value: String(securityFromServer[field]), category: "security", description: null, updatedAt: new Date(), createdAt: new Date() });
        seen.add(key);
      }
    }
    res.json({ ok: true, data: out });
  }),

  /** PUT /api/settings — set a single setting on the connected server. */
  set: asyncHandler(async (req: Request, res: Response) => {
    const body = setSettingSchema.parse(req.body);
    if (isHiddenSettingKey(body.key)) throw new ValidationError(apiModuleMessage(res.locals.locale, "settingsCredentialModule"));
    const executor = getExecutor(req);

    const securityField = SECURITY_KEYS_TO_FIELD[body.key];
    if (securityField) {
      const next = await securitySettingsService.write(executor, { [securityField]: castSecurityValue(securityField, body.value) } as never);
      // Also mirror into the generic settings bag so /api/settings GET sees it.
      await serverSettingsService.setOne(executor, body.key, body.value, "security", body.description);
      eventBus.emit(Events.SETTINGS_UPDATED, { key: body.key });
      res.json({ ok: true, data: { key: body.key, value: String(next[securityField]), category: "security" } });
      return;
    }
    await serverSettingsService.setOne(executor, body.key, body.value, body.category, body.description);
    eventBus.emit(Events.SETTINGS_UPDATED, { key: body.key });
    res.json({ ok: true, data: { key: body.key, value: body.value, category: body.category } });
  }),

  /** PUT /api/settings/bulk — set multiple settings on the connected server. */
  setBulk: asyncHandler(async (req: Request, res: Response) => {
    const body = setBulkSchema.parse(req.body);
    if (body.settings.some((entry) => isHiddenSettingKey(entry.key))) throw new ValidationError(apiModuleMessage(res.locals.locale, "settingsHiddenCredentialsModule"));
    const executor = getExecutor(req);

    const localEntries = [...body.settings];

    // Security-mapped keys are mirrored into the dedicated security sidecar.
    const securityPartial: Partial<Awaited<ReturnType<typeof securitySettingsService.read>>> = {};
    for (const entry of localEntries) {
      const field = SECURITY_KEYS_TO_FIELD[entry.key];
      if (field) {
        (securityPartial as Record<string, unknown>)[field] = castSecurityValue(field, entry.value);
      }
    }
    const localWrites = localEntries;
    try {
      if (localWrites.length > 0) {
        await serverSettingsService.setBulk(executor, localWrites);
      }
      if (Object.keys(securityPartial).length > 0) {
        await securitySettingsService.write(executor, securityPartial);
      }
    } catch (err) {
      // Surface the specific failure (executor resolution, SFTP/SSH, JSON
      // corruption) with full context instead of letting asyncHandler turn
      // it into an opaque 500. The admin can retry or investigate the
      // connected server without digging through pm2 logs.
      const detail = (err as Error).message;
      log.error(
        { err: detail, localCount: localWrites.length, securityKeys: Object.keys(securityPartial), target: executor?.target?.id },
        "settings bulk: local write failed",
      );
      res.status(502).json({
        ok: false,
        code: ErrorCodes.SETTINGS_LOCAL_WRITE_FAILED,
        error: detail,
        localCount: localWrites.length,
        hint:
          "The connected server may be unreachable or its LUXIPANEL_CONFIG_DIR unwritable. " +
          "Check the target's SSH connection and that the sidecar directory exists with 0600 perms.",
      });
      return;
    }

    eventBus.emit(Events.SETTINGS_UPDATED, { keys: body.settings.map((s) => s.key) });
    res.json({
      ok: true,
      localWritten: localWrites.length,
    });
  }),

  /** DELETE /api/settings/:key — delete a setting (DB + server file). */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const key = String(req.params.key);
    const executor = getExecutor(req);
    await serverSettingsService.remove(executor, key);
    res.json({ ok: true });
  }),

  /** POST /api/settings/reset — reset the AI assistant settings to factory
   *  defaults.
   *
   *  IMPORTANT: this ONLY resets the AI keys (see RESET_AI_DEFAULTS). It must
   *  NOT wipe the rest of the per-server settings bag — branding, security and
   *  every other module setting live in the same sidecar, and a blanket
   *  getAll()+delete() loop was destroying them on every reset (total data
   *  loss). Each target key is re-seeded to its default; all other keys are
   *  left untouched. */
  reset: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    for (const def of RESET_AI_DEFAULTS) {
      await settingsRepository.set(def.key, def.value, def.category, def.description, executor);
    }

    eventBus.emit(Events.SETTINGS_UPDATED, { reset: true, keys: RESET_AI_DEFAULTS.map((d) => d.key) });
    res.json({ ok: true });
  }),
};
