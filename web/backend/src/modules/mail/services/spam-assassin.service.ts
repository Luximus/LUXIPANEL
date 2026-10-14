// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Apply SpamAssassin rules only when the connected MTA already scans mail. */
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { writeRootOwnedFile, execChecked } from "./staging.helpers.js";

export type AppliedSpamSettings = {
  enabled: boolean;
  requiredScore: number;
  whitelistFrom: string[];
  blacklistFrom: string[];
  calculatedScores: Array<{ type: string; score: number }>;
};
const configPath = "/etc/spamassassin/luxipanel.cf";

export async function inspectSpamIntegration(executor: Executor): Promise<{ available: boolean; reason: string }> {
  const installed = await executor.exec(quoteCmd("command", ["-v", "spamassassin"]));
  if (installed.exitCode !== 0) return { available: false, reason: "SpamAssassin no está instalado en este servidor" };
  const postfix = await executor.exec(quoteCmd("sudo", ["postconf", "-h", "content_filter", "smtpd_milters", "non_smtpd_milters"]));
  if (postfix.exitCode !== 0) return { available: false, reason: "Postfix no está disponible en este servidor" };
  if (!/spamass|amavis/i.test(postfix.stdout)) {
    return { available: false, reason: "Postfix no tiene un filtro SpamAssassin/Amavis conectado; los ajustes no se aplicarán hasta instalarlo" };
  }
  return { available: true, reason: "Filtro SpamAssassin/Amavis detectado en Postfix" };
}

function renderConfig(settings: AppliedSpamSettings): string {
  const lines = [
    "# Managed by LUXIPANEL. Do not edit by hand.",
    `required_score ${settings.enabled ? settings.requiredScore : 999}`,
    "report_safe 0",
    "add_header all Score _SCORE_",
    "add_header all Bar _STARS(*)_",
  ];
  for (const address of settings.whitelistFrom) lines.push(`welcomelist_from ${address}`);
  for (const address of settings.blacklistFrom) lines.push(`blocklist_from ${address}`);
  for (const { type, score } of settings.calculatedScores) lines.push(`score ${type} ${score}`);
  return `${lines.join("\n")}\n`;
}

export async function applySpamSettings(executor: Executor, settings: AppliedSpamSettings): Promise<void> {
  const installed = await executor.exec(quoteCmd("command", ["-v", "spamassassin"]));
  if (!settings.enabled && installed.exitCode !== 0) {
    await execChecked(executor, quoteCmd("sudo", ["rm", "-f", configPath]), "desactivar configuración antispam");
    return;
  }
  if (settings.enabled) {
    const integration = await inspectSpamIntegration(executor);
    if (!integration.available) throw new Error(integration.reason);
  }
  const existing = await executor.exec(quoteCmd("sudo", ["cat", configPath]));
  const oldContent = existing.exitCode === 0 ? existing.stdout : null;
  await execChecked(executor, quoteCmd("sudo", ["install", "-d", "-m", "0755", "/etc/spamassassin"]), "crear configuración antispam");
  await writeRootOwnedFile(executor, "spam", configPath, renderConfig(settings), 0o644, "0644");
  try {
    await execChecked(executor, quoteCmd("sudo", ["spamassassin", "--lint"]), "validar reglas SpamAssassin");
  } catch (error) {
    if (oldContent !== null) await writeRootOwnedFile(executor, "spam", configPath, oldContent, 0o644, "0644");
    else await executor.exec(quoteCmd("sudo", ["rm", "-f", configPath]));
    throw error;
  }
  // Common Debian services; inactive/missing units are ignored because the
  // active scanner can instead be Amavis with its own service name.
  for (const unit of ["spamassassin", "spamd", "amavis", "amavis-new", "spamass-milter"]) {
    const active = await executor.exec(quoteCmd("sudo", ["systemctl", "is-active", "--quiet", unit]));
    if (active.exitCode === 0) await execChecked(executor, quoteCmd("sudo", ["systemctl", "try-reload-or-restart", unit]), `recargar ${unit}`);
  }
}
