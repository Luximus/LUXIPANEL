// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — server-alerts worker cron matcher (`cronMatches`).
 *
 * Focus: the dom/dow OR semantics of standard (Vixie) cron. When BOTH the
 * day-of-month and day-of-week fields are restricted, a date matches if EITHER
 * matches — NOT both.
 */

import { describe, it, expect } from "vitest";
import { cronMatches } from "../../../shared/cron/cron-match.js";

describe("cronMatches — dom/dow OR semantics", () => {
  // `0 9 1 * 1` = 09:00 on the 1st OR on any Monday.
  const expr = "0 9 1 * 1";

  it("matches the 1st of the month even when it is NOT Monday", () => {
    // 2026-07-01 is a Wednesday; the 1st (dom) matches.
    expect(cronMatches(expr, new Date(Date.UTC(2026, 6, 1, 9, 0)))).toBe(true);
  });

  it("matches a Monday even when it is NOT the 1st", () => {
    // 2026-07-06 is a Monday; the weekday (dow) matches.
    expect(cronMatches(expr, new Date(Date.UTC(2026, 6, 6, 9, 0)))).toBe(true);
  });

  it("does NOT match a day that is neither the 1st nor a Monday", () => {
    // 2026-07-02 is a Thursday and not the 1st → neither dom nor dow matches.
    expect(cronMatches(expr, new Date(Date.UTC(2026, 6, 2, 9, 0)))).toBe(false);
  });

  it("still honors the minute/hour fields on an otherwise matching day", () => {
    // Correct day (the 1st) but wrong hour → no match.
    expect(cronMatches(expr, new Date(Date.UTC(2026, 6, 1, 10, 0)))).toBe(false);
  });
});

describe("cronMatches — single restricted day field", () => {
  it("dom only: matches the 15th regardless of weekday", () => {
    expect(cronMatches("30 8 15 * *", new Date(Date.UTC(2026, 6, 15, 8, 30)))).toBe(true);
    expect(cronMatches("30 8 15 * *", new Date(Date.UTC(2026, 6, 16, 8, 30)))).toBe(false);
  });

  it("dow only: matches every Sunday (accepts both 0 and 7)", () => {
    // 2026-07-05 is a Sunday.
    const sunday = new Date(Date.UTC(2026, 6, 5, 0, 0));
    expect(cronMatches("0 0 * * 0", sunday)).toBe(true);
    expect(cronMatches("0 0 * * 7", sunday)).toBe(true);
    // 2026-07-06 is a Monday.
    expect(cronMatches("0 0 * * 0", new Date(Date.UTC(2026, 6, 6, 0, 0)))).toBe(false);
  });

  it("both `*`: fires on any day at the given minute/hour", () => {
    expect(cronMatches("0 12 * * *", new Date(Date.UTC(2026, 6, 2, 12, 0)))).toBe(true);
    expect(cronMatches("0 12 * * *", new Date(Date.UTC(2026, 6, 2, 13, 0)))).toBe(false);
  });
});
