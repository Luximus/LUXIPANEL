// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Spam filters controller — stores panel-level SpamAssassin preferences.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { getContextExecutor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { parseStoredJson } from "./_shared/parse-stored-json.js";
import { spamTargetKey } from "../services/spam-settings.service.js";
import { applySpamSettings, inspectSpamIntegration } from "../services/spam-assassin.service.js";
import { rebuildAllAccountsWithGlobalFilters } from "./global-filters.shared.js";
import { getExecutor } from "../../../shared/executor/index.js";

const log = createModuleLogger("mail-spam-filters");

const SPAM_FILTERS_KEY = "mail_spam_filters_v1";

const requiredScoreSelectValues = ["1", "4", "5", "8", "10", "custom"] as const;
type RequiredScoreSelect = (typeof requiredScoreSelectValues)[number];

type SpamCalculatedScore = {
  type: string;
  score: number;
};

type SpamFiltersSettings = {
  enabled: boolean;
  spamBoxEnabled: boolean;
  autoDeleteEnabled: boolean;
  requiredScoreSelect: RequiredScoreSelect;
  requiredScore: number;
  customRequiredScore: number | null;
  autoDeleteThresholdScore: number;
  whitelistFrom: string[];
  blacklistFrom: string[];
  calculatedScores: SpamCalculatedScore[];
};

const fallbackScoreTypes = [
  "ACCESSDB",
  "ACCT_PHISHING_MANY",
  "ACT_NOW_CAPS",
  "ADMAIL",
  "ADMITS_SPAM",
  "ALL_TRUSTED",
  "ARC_SIGNED",
  "ARC_TRUSTED",
  "ARC_VALID",
  "BAYES_00",
  "BAYES_05",
  "BAYES_20",
  "BAYES_40",
  "BAYES_50",
  "BAYES_60",
  "BAYES_80",
  "BAYES_95",
  "BAYES_99",
  "BAYES_999",
  "BITCOIN_SPAM_01",
  "BITCOIN_SPAM_02",
  "BODY_URI_ONLY",
  "DKIM_SIGNED",
  "DKIM_VALID",
  "DMARC_PERMERROR",
  "DMARC_TEMPERROR",
  "FREEMAIL_FROM",
  "FREEMAIL_REPLYTO",
  "HTML_IMAGE_ONLY_24",
  "HTML_MESSAGE",
  "MISSING_SUBJECT",
  "MIME_HTML_ONLY",
  "MIME_QP_LONG_LINE",
  "RCVD_IN_BL_SPAMCOP_NET",
  "RCVD_IN_DNSWL_BLOCKED",
  "RCVD_IN_PBL",
  "RCVD_IN_SBL",
  "RCVD_IN_XBL",
  "SPF_FAIL",
  "SPF_HELO_FAIL",
  "SPF_NONE",
  "SPF_PASS",
  "SUBJ_ALL_CAPS",
  "SUBJ_DOLLARS",
  "SUBJECT_DIET",
  "TO_EQ_FM_DOM_HTML_ONLY",
  "TO_EQ_FM_SPF_FAIL",
  "URIBL_BLACK",
  "URIBL_BLOCKED",
  "URIBL_DBL_BLOCKED",
  "URIBL_DBL_SPAM",
  "URIBL_RED",
  "URI_HEX",
  "URI_NOVOWEL",
  "USER_IN_BLOCKLIST",
  "USER_IN_WELCOMELIST",
  "XPRIO",
  "local_GOOGLE_LUCKY",
];

const defaultSettings: SpamFiltersSettings = {
  enabled: false,
  spamBoxEnabled: true,
  autoDeleteEnabled: false,
  requiredScoreSelect: "5",
  requiredScore: 5,
  customRequiredScore: null,
  autoDeleteThresholdScore: 5,
  whitelistFrom: [],
  blacklistFrom: [],
  calculatedScores: [],
};

const scoreItemSchema = z.object({
  type: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_]+$/),
  score: z.coerce.number().min(-1000).max(1000),
});

const storedSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  spamBoxEnabled: z.boolean().default(true),
  autoDeleteEnabled: z.boolean().default(false),
  requiredScoreSelect: z.enum(requiredScoreSelectValues).default("5"),
  requiredScore: z.coerce.number().min(0).max(999).default(5),
  customRequiredScore: z.coerce.number().min(0).max(999).nullable().default(null),
  autoDeleteThresholdScore: z.coerce.number().int().min(1).max(999).default(5),
  whitelistFrom: z.array(z.string().trim().regex(/^[A-Za-z0-9_.+*%-]+@[A-Za-z0-9.-]+$/).max(255)).max(500).default([]),
  blacklistFrom: z.array(z.string().trim().regex(/^[A-Za-z0-9_.+*%-]+@[A-Za-z0-9.-]+$/).max(255)).max(500).default([]),
  calculatedScores: z.array(scoreItemSchema).max(1000).default([]),
});

const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  spamBoxEnabled: z.boolean().optional(),
  autoDeleteEnabled: z.boolean().optional(),
  requiredScoreSelect: z.enum(requiredScoreSelectValues).optional(),
  requiredScore: z.coerce.number().min(0).max(999).optional(),
  customRequiredScore: z.coerce.number().min(0).max(999).nullable().optional(),
  autoDeleteThresholdScore: z.coerce.number().int().min(1).max(999).optional(),
  whitelistFrom: z.array(z.string().trim().regex(/^[A-Za-z0-9_.+*%-]+@[A-Za-z0-9.-]+$/).max(255)).max(500).optional(),
  blacklistFrom: z.array(z.string().trim().regex(/^[A-Za-z0-9_.+*%-]+@[A-Za-z0-9.-]+$/).max(255)).max(500).optional(),
  calculatedScores: z.array(scoreItemSchema).max(1000).optional(),
}).refine((value) => Object.keys(value).length > 0, "No fields to update");

const requiredScorePresetMap: Record<Exclude<RequiredScoreSelect, "custom">, number> = {
  "1": 1,
  "4": 4,
  "5": 5,
  "8": 8,
  "10": 10,
};

function uniqueStringList(input: string[]): string[] {
  return [...new Set(input.map((v) => v.trim().toLowerCase()))].filter(Boolean);
}

function normalizeCalculatedScores(items: SpamCalculatedScore[]): SpamCalculatedScore[] {
  const out: SpamCalculatedScore[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const type = item.type.trim().toUpperCase();
    if (!type || seen.has(type)) continue;
    seen.add(type);
    out.push({
      type,
      score: Number(item.score),
    });
  }
  return out;
}

function normalizeSettings(input: SpamFiltersSettings): SpamFiltersSettings {
  const normalized: SpamFiltersSettings = {
    ...defaultSettings,
    ...input,
    whitelistFrom: uniqueStringList(input.whitelistFrom ?? []),
    blacklistFrom: uniqueStringList(input.blacklistFrom ?? []),
    calculatedScores: normalizeCalculatedScores(input.calculatedScores ?? []),
  };

  if (normalized.requiredScoreSelect === "custom") {
    const custom = Number(normalized.customRequiredScore);
    if (normalized.customRequiredScore !== null && Number.isFinite(custom)) {
      normalized.requiredScore = custom;
      normalized.customRequiredScore = custom;
    } else {
      normalized.requiredScore = 5;
      normalized.customRequiredScore = 5;
    }
  } else {
    normalized.requiredScore = requiredScorePresetMap[normalized.requiredScoreSelect];
    normalized.customRequiredScore = null;
  }

  if (normalized.autoDeleteThresholdScore < normalized.requiredScore) {
    normalized.autoDeleteThresholdScore = Math.max(1, Math.ceil(normalized.requiredScore));
  }

  return normalized;
}

function parseStoredSettings(raw: string | null): SpamFiltersSettings {
  return parseStoredJson(raw, storedSettingsSchema.transform(normalizeSettings), { ...defaultSettings });
}

// SpamAssassin rule names are read from the CONNECTED SERVER's SpamAssassin
// config dirs (`/usr/share/spamassassin`, `/etc/mail/spamassassin`,
// `/etc/spamassassin`) via the per-request Executor — NOT with `node:fs` on the
// panel host. The cache is therefore keyed by `executor.target.id`: a rule set
// discovered on server X must never be served for server Y (per-server
// isolation). Fail-open on a read error: fall back to the generic bundled rule
// list (public SpamAssassin rule names, no tenant data).
const cachedScoreTypesByTarget = new Map<string, { data: string[]; expiresAt: number }>();
const SCORE_TYPES_TTL_MS = 10 * 60 * 1000;
const sortedFallbackScoreTypes = [...fallbackScoreTypes].sort((a, b) => a.localeCompare(b));

async function loadSpamScoreTypes(): Promise<string[]> {
  const executor = getContextExecutor();
  // No per-server executor in scope (fail-closed on the isolation invariant):
  // serve the generic bundled list — it carries no server-specific data — but
  // do NOT cache it under any target key.
  if (!executor) return sortedFallbackScoreTypes;

  const targetId = executor.target.id;
  const now = Date.now();
  const cached = cachedScoreTypesByTarget.get(targetId);
  if (cached && cached.expiresAt > now) return cached.data;

  // One round-trip: cat every `.cf` under the three SpamAssassin dirs on the
  // connected server. `find … -exec cat {} +` batches into a single process; a
  // missing dir is silenced so partial installs still yield what exists.
  let stdout = "";
  try {
    const res = await executor.exec(
      "find /usr/share/spamassassin /etc/mail/spamassassin /etc/spamassassin " +
        "-type f -name '*.cf' -exec cat {} + 2>/dev/null",
      { timeoutMs: 15_000 },
    );
    stdout = res.stdout || "";
  } catch (err) {
    log.warn({ err, targetId }, "Failed to read SpamAssassin rules on the connected server — using fallback list");
  }

  const set = new Set<string>();
  const ruleRegex = /^(?:header|body|uri|rawbody|full|meta)\s+([A-Za-z0-9_]+)\b/;
  for (const lineRaw of stdout.split(/\r?\n/g)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(ruleRegex);
    if (!match?.[1]) continue;
    const key = match[1].trim().toUpperCase();
    if (key) set.add(key);
  }

  const discovered = Array.from(set).sort((a, b) => a.localeCompare(b));
  const data = discovered.length > 0 ? discovered : sortedFallbackScoreTypes;

  cachedScoreTypesByTarget.set(targetId, { data, expiresAt: now + SCORE_TYPES_TTL_MS });
  return data;
}

export const spamFiltersController = {
  /** GET /api/mail/spam-filters */
  list: asyncHandler(async (req: Request, res: Response) => {
    const raw = await settingsRepository.get(spamTargetKey());
    const data = parseStoredSettings(raw);
    const integration = await inspectSpamIntegration(getExecutor(req));
    res.json({ ok: true, data: { ...data, applied: Boolean(raw), integration, legacyConfigured: !raw && Boolean(await settingsRepository.get(SPAM_FILTERS_KEY)) } });
  }),

  /** GET /api/mail/spam-filters/score-types */
  scoreTypes: asyncHandler(async (_req: Request, res: Response) => {
    const data = await loadSpamScoreTypes();
    res.json({ ok: true, data });
  }),

  /** PUT /api/mail/spam-filters */
  update: asyncHandler(async (req: Request, res: Response) => {
    const patch = updateSettingsSchema.parse(req.body);
    const key = spamTargetKey();
    const raw = await settingsRepository.get(key);
    const current = parseStoredSettings(raw);
    const merged = normalizeSettings({
      ...current,
      ...patch,
    });

    const executor = getExecutor(req);
    await applySpamSettings(executor, merged);
    await settingsRepository.set(
      key,
      JSON.stringify(merged),
      "mail",
      "Spam Filters preferences",
    );
    try {
      await rebuildAllAccountsWithGlobalFilters(req);
    } catch (error) {
      if (raw !== null) await settingsRepository.set(key, raw, "mail", "Restored mail spam settings");
      else await settingsRepository.delete(key);
      await applySpamSettings(executor, current).catch((restoreError) => log.error({ restoreError }, "Could not restore SpamAssassin config"));
      await rebuildAllAccountsWithGlobalFilters(req).catch((restoreError) => log.error({ restoreError }, "Could not restore Sieve spam filters"));
      throw error;
    }
    eventBus.emit(Events.SETTINGS_UPDATED, { key });
    res.json({ ok: true, data: { ...merged, applied: true, integration: await inspectSpamIntegration(getExecutor(req)) } });
  }),
};
