// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Effective login methods resolver (PUBLIC / pre-auth).
 *
 * Public login has no authenticated target yet. Resolve every method from
 * this installation's security settings using an explicit local executor.
 * The UI and authentication endpoints share this policy; an ambient selected
 * remote server must never override the installation's login policy.
 */

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
 * Resolve the login methods enabled for the panel. All three (password,
 * passkey, recovery) are sourced from the local per-server security sidecar —
 * the panel is self-hosted and authoritative for its own login policy.
 */
export async function resolveEffectiveLoginMethods(): Promise<EffectiveLoginMethods> {
  const settings = await securitySettingsService.read(localExecutor);
  return {
    password: settings.loginAllowPassword,
    passkey: settings.loginAllowPasskey,
    recovery: settings.loginAllowRecovery,
    hcaptchaEnabled: settings.hcaptchaEnabled,
    hcaptchaSitekey: settings.hcaptchaSitekey,
  };
}
