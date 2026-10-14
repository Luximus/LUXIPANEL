// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { settingsRepository } from "../../admin/repositories/index.js";
import { getContextExecutor } from "../../../shared/executor/context.js";
import type { MailFilterDefinition } from "../types/filter.types.js";

export const SPAM_FILTERS_KEY_V2 = "mail_spam_filters_v2";
export function spamTargetKey(): string {
  const targetId = getContextExecutor()?.target.id;
  if (!targetId) throw new Error("No hay servidor de correo conectado");
  return `${SPAM_FILTERS_KEY_V2}:${targetId}`;
}

export async function loadAppliedSpamFilterDefinitions(): Promise<MailFilterDefinition[]> {
  const raw = await settingsRepository.get(spamTargetKey());
  if (!raw) return [];
  let data: { enabled?: boolean; spamBoxEnabled?: boolean; autoDeleteEnabled?: boolean; autoDeleteThresholdScore?: number };
  try { data = JSON.parse(raw); } catch { return []; }
  if (!data.enabled) return [];
  const out: MailFilterDefinition[] = [];
  if (data.autoDeleteEnabled) {
    const stars = "*".repeat(Math.max(1, Math.min(999, Math.ceil(Number(data.autoDeleteThresholdScore) || 5))));
    out.push({
      name: "LUXIPANEL: eliminar spam de puntuación alta", enabled: true,
      rules: [{ part: "spam_bar", match: "contains", value: stars }],
      actions: [{ type: "discard" }, { type: "stop" }],
    });
  }
  if (data.spamBoxEnabled) {
    out.push({
      name: "LUXIPANEL: mover spam a Junk", enabled: true,
      rules: [{ part: "spam_status", match: "contains", value: "Yes" }],
      actions: [{ type: "deliver_to_folder", value: "Junk" }, { type: "stop" }],
    });
  }
  return out;
}
