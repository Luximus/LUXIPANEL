// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Effective login methods resolver (PUBLIC / pre-auth).
 *
 * At /login there is NO per-server executor in context yet (the SSH bridge is
 * only established AFTER a method succeeds), so a bare
 * `securitySettingsService.read()` resolves to the built-in DEFAULTS
 * (`passkey:false`, `recovery:false`) and every passkey/recovery attempt is
 * wrongly rejected as "disabled" — even when the admin enabled them.
 *
 * In managed mode the source of truth for which methods are enabled is
 * LP-LICENSE-SERVER, keyed by host (subdomain → panel/server). This mirrors
 * exactly how `GET /api/auth/login-methods` decides which tabs to render, so
 * the ENFORCEMENT endpoints (passkey auth-options / auth-verify, recovery
 * verify, password login) agree with what the UI offered. When LP is
 * unreachable we fall back to the per-server sidecar; outside managed mode we
 * read the sidecar directly.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { CONFIG_DIR } from "../../../config/paths.js";
import { runWithExecutor, localExecutor } from "../../../shared/executor/index.js";
import { securitySettingsService } from "../../admin/services/security-settings.service.js";

/**
 * Run pre-auth passkey/recovery LOGIN logic with the panel-host executor pinned.
 *
 * The public /login endpoints read the per-server auth sidecars (users,
 * passkeys, recovery codes) BEFORE any session or SSH bridge exists, so the
 * kv-store has no executor in scope and fails closed (INTERNAL_ERROR / "Could
 * not retrieve authentication options"). Under the LOCAL OVERRIDE — this server
 * is authoritative for passkey/recovery and is co-located with its target — those
 * sidecars live on the panel host itself, so we pin `localExecutor` for the
 * read/verify scope. The post-verify session bridge is still established normally
 * afterwards (see establishBridgeForAuthenticatedUser).
 */
export function withLocalAuthScope<T>(fn: () => Promise<T>): Promise<T> {
  return runWithExecutor(localExecutor, fn);
}

export interface EffectiveLoginMethods {
  password: boolean;
  passkey: boolean;
  recovery: boolean;
  hcaptchaEnabled: boolean;
  hcaptchaSitekey: string;
}

/**
 * LOCAL OVERRIDE — passkey & recovery login are authoritative on THIS server,
 * decoupled from LP-LICENSE-SERVER (operator's explicit choice). At /login there
 * is no per-server executor yet, so `securitySettingsService.read()` resolves to
 * DEFAULTS and can't see the sidecar. The panel is co-located with its target,
 * so we read the per-server security sidecar straight off the local filesystem.
 * Missing/corrupt file → both disabled (fail closed). This deliberately does NOT
 * consult LP for these two methods; password stays LP-managed below.
 */
async function readLocalPasskeyRecoveryToggles(): Promise<{
  passkey: boolean;
  recovery: boolean;
  hcaptchaEnabled: boolean;
  hcaptchaSitekey: string;
}> {
  const base = CONFIG_DIR;
  const file = path.join(base, "security-settings.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as {
      loginAllowPasskey?: unknown;
      loginAllowRecovery?: unknown;
      hcaptchaEnabled?: unknown;
      hcaptchaSitekey?: unknown;
    };
    return {
      passkey: parsed.loginAllowPasskey === true,
      recovery: parsed.loginAllowRecovery === true,
      // hCaptcha is opt-in per server. The sitekey is PUBLIC (rendered client
      // side); the secret is NEVER read here and never leaves the sidecar.
      hcaptchaEnabled: parsed.hcaptchaEnabled === true,
      hcaptchaSitekey: typeof parsed.hcaptchaSitekey === "string" ? parsed.hcaptchaSitekey : "",
    };
  } catch {
    return { passkey: false, recovery: false, hcaptchaEnabled: false, hcaptchaSitekey: "" };
  }
}

/**
 * Resolve the login methods enabled for the panel. All three (password,
 * passkey, recovery) are sourced from the local per-server security sidecar —
 * the panel is self-hosted and authoritative for its own login policy.
 */
export async function resolveEffectiveLoginMethods(): Promise<EffectiveLoginMethods> {
  const local = await readLocalPasskeyRecoveryToggles();
  const settings = await securitySettingsService.read();
  return {
    password: settings.loginAllowPassword,
    passkey: local.passkey,
    recovery: local.recovery,
    hcaptchaEnabled: local.hcaptchaEnabled,
    hcaptchaSitekey: local.hcaptchaSitekey,
  };
}
