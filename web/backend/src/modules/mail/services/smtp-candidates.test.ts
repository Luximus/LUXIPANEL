// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — buildSubmissionCandidates (smtp.service.ts).
 *
 * Mirrors the IMAP guard: a REMOTE session (targetHost set) leads with the
 * target's host and never submits through "localhost"; a LOCAL session keeps
 * the historical candidate ordering (incl. localhost when explicitly set).
 */

import { describe, expect, it } from "vitest";
import { buildSubmissionCandidates } from "./smtp.service.js";

describe("buildSubmissionCandidates", () => {
  it("LOCAL (no targetHost): honours an explicit localhost submission host", () => {
    const combos = buildSubmissionCandidates("user@example.com", "localhost", 587);
    expect(combos.some((c) => c.host === "localhost")).toBe(true);
    expect(combos.some((c) => c.host === "mail.example.com")).toBe(true);
    // ports: configured 587 first, then 465
    expect(combos[0].port).toBe(587);
  });

  it("REMOTE (targetHost set): leads with the target host, never localhost", () => {
    const combos = buildSubmissionCandidates("user@example.com", "localhost", 587, "198.51.100.7");
    expect(combos[0].host).toBe("198.51.100.7");
    expect(combos.some((c) => c.host === "localhost")).toBe(false);
    expect(combos.some((c) => c.host === "mail.example.com")).toBe(true);
  });

  it("REMOTE: 465 secure combos are marked secure; 587 not", () => {
    const combos = buildSubmissionCandidates("u@d.com", "localhost", 465, "10.0.0.5");
    const p465 = combos.find((c) => c.host === "10.0.0.5" && c.port === 465);
    const p587 = combos.find((c) => c.host === "10.0.0.5" && c.port === 587);
    expect(p465?.secure).toBe(true);
    expect(p587?.secure).toBe(false);
    expect(combos.some((c) => c.host === "localhost")).toBe(false);
  });
});
