// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `cronMatches()` — the ONE 5-field cron evaluator (B-18).
 *
 * Two INCOMPATIBLE matchers used to answer "should this fire now?":
 *
 *  - `server-alerts.worker.ts` — full grammar (lists, ranges, `*`/n, `a-b/n`),
 *    UTC clock, Vixie dom/dow OR semantics. This is the one kept.
 *  - `backup/services/scheduler.service.ts` — local clock, `*`/n only at the
 *    START of a field (so `0-30/5` silently degraded to "0-30" and `1-5/2` was
 *    read as a plain range), and it AND-ed dom with dow so `0 9 1 * 1` only
 *    fired on a 1st that was also a Monday. Consumed by
 *    `cron/services/ai-cron-scheduler.service.ts` too.
 *
 * The only legitimate difference between them was the CLOCK, so that became a
 * parameter instead of a fork: `"utc"` (alerts) vs `"local"` (backup/AI cron —
 * an admin's `0 3 * * *` means 3am server-local and must stay that way).
 *
 * Grammar per field: `*`, `n`, `a-b`, comma-lists of those, and an optional
 * `/step` on any of them (`*`/15, `0-30/5`). Unparseable parts are skipped
 * (never throw — the caller is a timer tick).
 */

/** Which clock the date's components are read from. */
export type CronClock = "utc" | "local" | (string & {});

interface CronParts {
  minute: number;
  hour: number;
  dayOfMonth: number;
  month: number;
  dayOfWeek: number;
}

function partsOf(date: Date, clock: CronClock): CronParts {
  if (clock !== "utc" && clock !== "local") {
    const format = new Intl.DateTimeFormat("en-US", { timeZone: clock, minute: "numeric", hour: "numeric", hourCycle: "h23", day: "numeric", month: "numeric", weekday: "short" });
    const values = Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]));
    return {
      minute: Number(values.minute), hour: Number(values.hour), dayOfMonth: Number(values.day),
      month: Number(values.month), dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday ?? ""),
    };
  }
  return clock === "utc"
    ? {
        minute: date.getUTCMinutes(),
        hour: date.getUTCHours(),
        dayOfMonth: date.getUTCDate(),
        month: date.getUTCMonth() + 1,
        dayOfWeek: date.getUTCDay(),
      }
    : {
        minute: date.getMinutes(),
        hour: date.getHours(),
        dayOfMonth: date.getDate(),
        month: date.getMonth() + 1,
        dayOfWeek: date.getDay(),
      };
}

/**
 * Does `value` satisfy a single cron field spec?
 * Supports `*`, lists, ranges and steps (`*`/n, `a-b/n`).
 */
export function cronFieldMatches(spec: string, value: number, min: number, max: number): boolean {
  for (const part of spec.split(",")) {
    if (part === "*") return true;
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? Number.parseInt(stepPart, 10) : 1;
    if (!Number.isFinite(step) || step <= 0) continue;
    let lo = min;
    let hi = max;
    if (rangePart && rangePart !== "*") {
      const [a, b] = rangePart.split("-");
      lo = Number.parseInt(a ?? "", 10);
      hi = b !== undefined ? Number.parseInt(b, 10) : lo;
      if (!Number.isFinite(lo)) continue;
      if (!Number.isFinite(hi)) hi = lo;
    }
    for (let v = lo; v <= hi; v += step) {
      if (v === value) return true;
    }
  }
  return false;
}

/**
 * True when `date` matches the 5-field cron expression `min hour dom month dow`.
 *
 * Day-of-month (dom) and day-of-week (dow) follow the standard cron rule: when
 * BOTH are restricted (neither is `*`) the date matches if EITHER matches (OR),
 * not both. So `0 9 1 * 1` fires at 09:00 on the 1st OR on any Monday. When
 * only one of dom/dow is restricted, that field alone gates. (Vixie semantics.)
 *
 * Both `0` and `7` are accepted as Sunday.
 *
 * @param clock `"utc"` reads UTC components, `"local"` reads server-local ones.
 */
export function cronMatches(expr: string, date: Date, clock: CronClock = "utc"): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [min, hour, dom, month, dow] = fields as [string, string, string, string, string];
  const p = partsOf(date, clock);

  if (
    !cronFieldMatches(min, p.minute, 0, 59) ||
    !cronFieldMatches(hour, p.hour, 0, 23) ||
    !cronFieldMatches(month, p.month, 1, 12)
  ) {
    return false;
  }

  const domRestricted = dom.trim() !== "*";
  const dowRestricted = dow.trim() !== "*";
  const domMatch = cronFieldMatches(dom, p.dayOfMonth, 1, 31);
  const dowMatch =
    cronFieldMatches(dow, p.dayOfWeek, 0, 6) ||
    (p.dayOfWeek === 0 && cronFieldMatches(dow, 7, 0, 7));

  if (domRestricted && dowRestricted) return domMatch || dowMatch;
  if (domRestricted) return domMatch;
  if (dowRestricted) return dowMatch;
  return true; // both `*` → only min/hour/month gate
}
