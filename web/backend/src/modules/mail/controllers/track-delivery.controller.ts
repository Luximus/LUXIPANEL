// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Track delivery controller — inspects recent Postfix delivery events.
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { visibleMailDomains } from "./_shared/mail-access.js";
import { domainsService } from "../../nginx/services/domains.service.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const querySchema = z.object({
  recipient: z.string().trim().max(320).optional(),
  mode: z.enum(["all", "blocked_failed"]).optional(),
  max: z.coerce.number().int().min(25).max(500).optional(),
  showSuccess: z.enum(["1", "0"]).optional(),
  showDeferred: z.enum(["1", "0"]).optional(),
  showFailures: z.enum(["1", "0"]).optional(),
  showInProgress: z.enum(["1", "0"]).optional(),
});

type DeliveryStatus = "success" | "deferred" | "failure" | "in_progress";

type DeliveryEvent = {
  queueId: string;
  sentTime: string;
  fromAddress: string;
  recipient: string;
  status: DeliveryStatus;
  result: string;
  spamScore: number | null;
  raw: string;
};

type QueueContext = {
  fromAddress?: string;
  timestamp?: string;
};

function buildPostfixLogsCommand(lines: number): string {
  const safeLines = Math.max(500, Math.min(lines, 12000));
  return [
    "bash -lc",
    "'",
    "if command -v journalctl >/dev/null 2>&1; then",
    `  OUT=$(journalctl -u postfix --since "10 days ago" --no-pager -n ${safeLines} -o short-iso 2>/dev/null || true);`,
    "  if [ -n \"$OUT\" ]; then",
    "    printf \"%s\\n\" \"$OUT\";",
    "    exit 0;",
    "  fi;",
    "fi;",
    `if [ -r /var/log/mail.log ]; then tail -n ${safeLines} /var/log/mail.log; exit 0; fi;`,
    `if [ -r /var/log/maillog ]; then tail -n ${safeLines} /var/log/maillog; exit 0; fi;`,
    "exit 0;",
    "'",
  ].join(" ");
}

function normalizeTimestamp(rawLine: string): string {
  const isoPrefix = rawLine.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{4}|[+-]\d{2}:?\d{2})?)/);
  if (isoPrefix && isoPrefix[1]) {
    const candidate = isoPrefix[1].replace(/,(\d+)/, ".$1");
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const syslogPrefix = rawLine.match(/^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/);
  if (syslogPrefix && syslogPrefix[1]) {
    const now = new Date();
    const parsed = new Date(`${syslogPrefix[1]} ${now.getFullYear()}`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return new Date().toISOString();
}

function toStatus(raw: string): DeliveryStatus {
  if (raw === "sent") return "success";
  if (raw === "deferred") return "deferred";
  if (raw === "bounced" || raw === "expired") return "failure";
  return "in_progress";
}

function parseSpamScore(line: string): number | null {
  const scoreMatch = line.match(/(?:spam[_\s-]?score|score)=(-?\d+(?:\.\d+)?)/i);
  if (!scoreMatch || !scoreMatch[1]) return null;
  const parsed = Number(scoreMatch[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDeliveryEvents(rawLogs: string): DeliveryEvent[] {
  const lines = rawLogs.split(/\r?\n/).filter(Boolean);
  const queue = new Map<string, QueueContext>();
  const events: DeliveryEvent[] = [];

  for (const line of lines) {
    const ts = normalizeTimestamp(line);

    const fromMatch = line.match(/\b([A-F0-9]{5,}):\s+from=<([^>]*)>/i);
    if (fromMatch) {
      const queueId = fromMatch[1] ?? "";
      const fromAddress = (fromMatch[2] ?? "").trim().toLowerCase();
      const current = queue.get(queueId) ?? {};
      queue.set(queueId, { ...current, fromAddress, timestamp: ts });
      continue;
    }

    const statusMatch = line.match(/\b([A-F0-9]{5,}):\s+to=<([^>]*)>.*?status=(sent|deferred|bounced|expired)\s*\((.*)\)\s*$/i);
    if (statusMatch) {
      const queueId = statusMatch[1] ?? "";
      const recipient = (statusMatch[2] ?? "").trim().toLowerCase();
      const status = toStatus((statusMatch[3] ?? "").toLowerCase());
      const result = (statusMatch[4] ?? "").trim();
      const ctx = queue.get(queueId);
      events.push({
        queueId,
        sentTime: ctx?.timestamp ?? ts,
        fromAddress: ctx?.fromAddress ?? "",
        recipient,
        status,
        result,
        spamScore: parseSpamScore(line),
        raw: line,
      });
      continue;
    }

    const activeMatch = line.match(/\b([A-F0-9]{5,}):\s+from=<([^>]*)>.*\(queue active\)/i);
    if (activeMatch) {
      const queueId = activeMatch[1] ?? "";
      const fromAddress = (activeMatch[2] ?? "").trim().toLowerCase();
      events.push({
        queueId,
        sentTime: ts,
        fromAddress,
        recipient: "",
        status: "in_progress",
        result: "Queue active",
        spamScore: parseSpamScore(line),
        raw: line,
      });
    }
  }

  return events.sort((a, b) => b.sentTime.localeCompare(a.sentTime));
}

function filterEvents(
  events: DeliveryEvent[],
  options: {
    recipient: string;
    mode: "all" | "blocked_failed";
    showSuccess: boolean;
    showDeferred: boolean;
    showFailures: boolean;
    showInProgress: boolean;
  },
): DeliveryEvent[] {
  const recipientNeedle = options.recipient.trim().toLowerCase();

  return events.filter((event) => {
    if (options.mode === "blocked_failed") {
      if (event.status !== "failure" && event.status !== "deferred") return false;
    }

    if (event.status === "success" && !options.showSuccess) return false;
    if (event.status === "deferred" && !options.showDeferred) return false;
    if (event.status === "failure" && !options.showFailures) return false;
    if (event.status === "in_progress" && !options.showInProgress) return false;

    if (!recipientNeedle) return true;

    const haystack = `${event.recipient} ${event.fromAddress}`.toLowerCase();
    if (EMAIL_RE.test(recipientNeedle)) {
      return event.recipient === recipientNeedle || event.fromAddress === recipientNeedle;
    }
    return haystack.includes(recipientNeedle);
  });
}

function addressDomain(address: string): string {
  return address.split("@")[1]?.trim().toLowerCase() ?? "";
}

export const trackDeliveryController = {
  /** GET /api/mail/track-delivery */
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = querySchema.parse(req.query);

    const mode = query.mode === "blocked_failed" ? "blocked_failed" : "all";
    const max = query.max ?? 250;
    const showSuccess = query.showSuccess !== "0";
    const showDeferred = query.showDeferred !== "0";
    const showFailures = query.showFailures !== "0";
    const showInProgress = query.showInProgress !== "0";

    const executor = getExecutor(req);
    const raw = await executor.exec(buildPostfixLogsCommand(max * 30));
    const events = parseDeliveryEvents(raw.stdout || "");
    let filtered = filterEvents(events, {
      recipient: query.recipient ?? "",
      mode,
      showSuccess,
      showDeferred,
      showFailures,
      showInProgress,
    });

    const visible = await visibleMailDomains();
    if (visible) {
      const hosted = new Set((await domainsService.list(executor)).map((domain) => domain.name.toLowerCase()));
      filtered = filtered.filter((event) => {
        const recipientDomain = addressDomain(event.recipient);
        const senderDomain = addressDomain(event.fromAddress);
        return visible.has(recipientDomain) || (visible.has(senderDomain) && !hosted.has(recipientDomain));
      }).map((event) => ({ ...event, raw: "" }));
    }

    res.json({
      ok: true,
      data: {
        items: filtered.slice(0, max),
        total: filtered.length,
        retainedDays: 10,
      },
    });
  }),
};
