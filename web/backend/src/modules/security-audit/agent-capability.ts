// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Security Audit — AI agent capability.
 *
 * Read-only: returns the latest audit report stored on the target (if any)
 * and basic SSH/sudo posture from current configs.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { remoteConfig } from "../../shared/remote-config/index.js";
import type { AuditReport } from "./models/audit-report.model.js";

// Must match audit.controller.ts: reports persist via remoteConfig under
// `security-audit-reports` as `{ reports: AuditReport[] }` (newest first).
// (Was reading dataStore "security-audit"/"reports" — a different file that the
// controller never writes → tool always reported "no reports".)
const REPORTS_MODULE = "security-audit-reports";
interface ReportsConfig {
  reports: AuditReport[];
}
const REPORTS_FALLBACK: ReportsConfig = { reports: [] };

export const securityAuditAgentCapability: AgentCapability = {
  moduleId: "security-audit",
  version: 1,
  tools: [
    {
      name: "security-audit.last_report",
      title: "Último informe de auditoría",
      description:
        "Return the most recent security audit report stored on this target: score, " +
        "summary, and the list of findings with their severities.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const cfg = await remoteConfig.read<ReportsConfig>(executor, REPORTS_MODULE, REPORTS_FALLBACK);
        const all = cfg.reports ?? [];
        if (all.length === 0) return { ok: true, output: "Sin informes de auditoría todavía." };
        // Newest first by startedAt (controller already prepends, but sort defensively).
        const latest = [...all].sort((a, b) =>
          String(a.startedAt ?? "") < String(b.startedAt ?? "") ? 1 : -1,
        )[0]!;
        return {
          ok: true,
          output: {
            id: latest.id,
            status: latest.status,
            startedAt: latest.startedAt,
            completedAt: latest.completedAt,
            summary: latest.summary,
            overallRisk: latest.aiAnalysis?.overallRisk,
            findings: (latest.findings ?? []).map((f) => ({
              severity: f.severity,
              scanner: f.scanner,
              title: f.title,
            })),
          },
        };
      },
    },
    {
      name: "security-audit.ssh_posture",
      title: "Postura SSH del servidor",
      description:
        "Inspect /etc/ssh/sshd_config for PermitRootLogin, PasswordAuthentication and " +
        "PubkeyAuthentication settings. Returns the active values (read-only).",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const result = await executor.exec(
          "sudo -n sshd -T 2>/dev/null | grep -Ei '^(permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication) ' || " +
            "grep -Ei '^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication) ' /etc/ssh/sshd_config 2>/dev/null",
          { timeoutMs: 5_000 },
        );
        return { ok: true, output: result.stdout.trim() || "(sin datos)" };
      },
    },
  ],
  suggestedPrompts: [
    "Dame el último informe de auditoría de seguridad",
    "¿Cómo está la configuración SSH?",
  ],
};
