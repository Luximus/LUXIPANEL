// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth service — audit logging. Part of the merged `authService` surface
 * (`authService.logAudit`). Pure code movement out of auth.service.ts.
 */

import { auditRepository } from "../../repositories/index.js";
import { securitySettingsService } from "../../../admin/services/security-settings.service.js";
import { errMessage, uuid } from "../../../../shared/utils/index.js";
import { log } from "./auth-shared.js";

export const authAuditService = {
  /** Log an audit event. */
  async logAudit(
    eventType: string,
    userId: number | null,
    severity: string,
    meta: { ip: string; userAgent: string },
    context: Record<string, unknown> = {},
  ) {
    try {
      const settings = await securitySettingsService.read();
      if (!settings.auditLogEnabled) return;

      await auditRepository.append({
        id: `audit_${uuid()}`,
        userId,
        eventType,
        severity,
        ip: meta.ip,
        userAgent: meta.userAgent,
        deviceId: null,
        requestId: null,
        context,
      });
    } catch (err) {
      // Pre-auth failures (bad subdomain, LP transport, no SSH key for user,
      // lockout, wrong passphrase) happen BEFORE a target executor exists.
      // Managed-only there is no panel-host store, so there is nowhere
      // per-server to write that audit — skip quietly, don't alarm.
      const msg = errMessage(err);
      if (msg.includes("no executor in scope")) {
        log.debug({ eventType }, "Audit skipped — no server in scope (pre-auth event)");
        return;
      }
      log.error({ err }, "Failed to write audit log");
    }
  },
};
