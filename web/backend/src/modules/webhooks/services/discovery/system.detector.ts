// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook discovery detector — system (cron / systemd / config).
 *
 * Surfaces webhook-shaped things that live in OS-level configuration on the
 * connected client server, across three independent sub-scans:
 *   - cron:    /etc/crontab and /etc/cron.d/* lines that curl/wget a URL.
 *   - systemd: unit files whose ExecStart curls/wgets a URL.
 *   - config:  app/system config files under /etc holding webhook URLs
 *              (Slack/Discord/generic webhook keys), nginx excluded.
 *
 * All read-only, `managed: false`. Every sub-scan is independently try/caught
 * so one failing source never loses the others, and the whole detector is
 * fail-soft: any error resolves to [], never throws. Scans are bounded with
 * `head -n` caps and per-command timeouts.
 */

import path from "node:path";

import { quoteArg, type Executor } from "../../../../shared/executor/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import {
  type DiscoveredWebhook,
  makeDiscoveryId,
} from "../../models/discovery.model.js";
import {
  clampRaw,
  firstUrl,
  parseGrepLine,
  type WebhookDetector,
} from "./types.js";

const log = createModuleLogger("webhook-discovery:system");

const EXEC_TIMEOUT_MS = 8000;
const CRON_LINE_LIMIT = 100;
const SYSTEMD_LINE_LIMIT = 100;
const CONFIG_FILE_LIMIT = 50;
const CONFIG_PER_FILE_LIMIT = 5;
const TOTAL_LIMIT = 250;

/** Cron schedule = first 5 whitespace fields, if the line looks cron-shaped. */
function cronSchedule(content: string): string {
  const trimmed = content.trim();
  const fields = trimmed.split(/\s+/);
  if (fields.length >= 6 && /^[\d*/,\-A-Za-z]+$/.test(fields[0] ?? "")) {
    return fields.slice(0, 5).join(" ");
  }
  return "cron";
}

/** A) cron — /etc/crontab + /etc/cron.d/* lines invoking curl/wget over http. */
async function scanCron(executor: Executor): Promise<DiscoveredWebhook[]> {
  const out: DiscoveredWebhook[] = [];
  try {
    const cmd =
      `grep -RInE 'https?://' /etc/crontab /etc/cron.d 2>/dev/null` +
      ` | grep -iE 'curl|wget|http' | head -n ${CRON_LINE_LIMIT}`;
    const res = await executor.exec(cmd, { timeoutMs: EXEC_TIMEOUT_MS });
    const lines = (res.stdout ?? "").split("\n").filter(Boolean);
    for (const line of lines) {
      const parsed = parseGrepLine(line);
      if (!parsed) continue;
      const { file, lineNo, content } = parsed;
      if (content.trim().startsWith("#")) continue;
      const url = firstUrl(content);
      if (!url) continue;
      const location = `${file}:${lineNo}`;
      out.push({
        id: makeDiscoveryId("cron", location, url),
        source: "cron",
        name: path.basename(file),
        target: url,
        location,
        detail: cronSchedule(content),
        enabled: true,
        managed: false,
        raw: clampRaw(content),
      });
    }
  } catch (err) {
    log.debug({ err }, "system: cron scan failed");
  }
  return out;
}

/** B) systemd — unit ExecStart lines that curl/wget over http. */
async function scanSystemd(executor: Executor): Promise<DiscoveredWebhook[]> {
  const out: DiscoveredWebhook[] = [];
  try {
    const cmd =
      `grep -RInE '^ExecStart.*https?://' /etc/systemd/system /lib/systemd/system /usr/lib/systemd/system 2>/dev/null` +
      ` | grep -iE 'curl|wget|http' | head -n ${SYSTEMD_LINE_LIMIT}`;
    const res = await executor.exec(cmd, { timeoutMs: EXEC_TIMEOUT_MS });
    const lines = (res.stdout ?? "").split("\n").filter(Boolean);
    for (const line of lines) {
      const parsed = parseGrepLine(line);
      if (!parsed) continue;
      const { file, lineNo, content } = parsed;
      const url = firstUrl(content);
      if (!url) continue;
      const location = `${file}:${lineNo}`;
      out.push({
        id: makeDiscoveryId("systemd", location, url),
        source: "systemd",
        name: path.basename(file),
        target: url,
        location,
        detail: "ExecStart",
        enabled: null,
        managed: false,
        raw: clampRaw(content),
      });
    }
  } catch (err) {
    log.debug({ err }, "system: systemd scan failed");
  }
  return out;
}

/** C) config — webhook URLs in app/system config files under /etc (no nginx). */
async function scanConfig(executor: Executor): Promise<DiscoveredWebhook[]> {
  const out: DiscoveredWebhook[] = [];
  try {
    // 1) Candidate files mentioning a webhook-ish token.
    const listCmd =
      `grep -RIlE 'hooks\\.slack\\.com|discord(app)?\\.com/api/webhooks|/webhook|webhook_url|WEBHOOK_URL' /etc --exclude-dir=nginx 2>/dev/null` +
      ` | head -n ${CONFIG_FILE_LIMIT}`;
    const listRes = await executor.exec(listCmd, { timeoutMs: EXEC_TIMEOUT_MS });
    const files = (listRes.stdout ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, CONFIG_FILE_LIMIT);

    // 2) Per file, pull webhook-looking URL lines (bounded).
    for (const file of files) {
      try {
        const matchCmd =
          `grep -nIE 'https?://[^[:space:]\\"'"'"']+' ${quoteArg(file)} 2>/dev/null` +
          ` | grep -iE 'hook' | head -n ${CONFIG_PER_FILE_LIMIT}`;
        const matchRes = await executor.exec(matchCmd, {
          timeoutMs: EXEC_TIMEOUT_MS,
        });
        const lines = (matchRes.stdout ?? "").split("\n").filter(Boolean);
        for (const line of lines) {
          // `grep -n` on a single file yields `lineNo:content` (no path prefix).
          const colon = line.indexOf(":");
          if (colon <= 0) continue;
          const lineNo = line.slice(0, colon);
          if (!/^\d+$/.test(lineNo)) continue;
          const content = line.slice(colon + 1);
          if (content.trim().startsWith("#")) continue;
          const url = firstUrl(content);
          if (!url) continue;
          const location = `${file}:${lineNo}`;
          out.push({
            id: makeDiscoveryId("config", location, url),
            source: "config",
            name: path.basename(file),
            target: url,
            location,
            detail: "config",
            enabled: null,
            managed: false,
            raw: clampRaw(content),
          });
        }
      } catch (err) {
        log.debug({ err, file }, "system: config per-file scan failed");
      }
    }
  } catch (err) {
    log.debug({ err }, "system: config scan failed");
  }
  return out;
}

export const systemDetector: WebhookDetector = {
  source: "system",
  async detect(executor: Executor): Promise<DiscoveredWebhook[]> {
    try {
      // Three independent sub-scans: a failure in one must not lose the others
      // (each already swallows its own errors, but allSettled is belt-and-braces).
      const settled = await Promise.allSettled([
        scanCron(executor),
        scanSystemd(executor),
        scanConfig(executor),
      ]);

      const seen = new Set<string>();
      const out: DiscoveredWebhook[] = [];
      for (const r of settled) {
        if (r.status !== "fulfilled") {
          log.debug({ reason: r.reason }, "system: sub-scan rejected");
          continue;
        }
        for (const item of r.value) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          out.push(item);
          if (out.length >= TOTAL_LIMIT) return out;
        }
      }
      return out;
    } catch (err) {
      log.warn({ err }, "system detector failed");
      return [];
    }
  },
};
