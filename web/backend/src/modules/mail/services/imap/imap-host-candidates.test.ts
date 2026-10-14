// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — buildHostCandidates (imap-connection.ts).
 *
 * Guards the per-server isolation fix: when a `targetHost` is supplied (REMOTE
 * session) the candidate list must lead with the target's host and NEVER
 * include "localhost"; with no targetHost (LOCAL session) the historical
 * behaviour — including the trailing localhost fallback — is preserved.
 */

import { describe, expect, it } from "vitest";
import { buildHostCandidates } from "./imap-connection.js";

describe("buildHostCandidates", () => {
  it("LOCAL (no targetHost): keeps the localhost fallback (unchanged behaviour)", () => {
    const hosts = buildHostCandidates("user@example.com", "localhost");
    expect(hosts).toContain("localhost");
    // domain-derived candidates are still present
    expect(hosts).toContain("mail.example.com");
  });

  it("REMOTE (targetHost set): dials the target host first and NEVER localhost", () => {
    const hosts = buildHostCandidates("user@example.com", "localhost", "203.0.113.9");
    expect(hosts[0]).toBe("203.0.113.9");
    expect(hosts).not.toContain("localhost");
    // still tries domain-derived names after the target host
    expect(hosts).toContain("mail.example.com");
  });

  it("REMOTE: an explicit non-localhost preferred host is kept, localhost dropped", () => {
    const hosts = buildHostCandidates("u@d.com", ["localhost", "mx.d.com"], "10.0.0.5");
    expect(hosts).toContain("mx.d.com");
    expect(hosts).not.toContain("localhost");
    expect(hosts[0]).toBe("10.0.0.5");
  });

  it("REMOTE with a blank targetHost falls back to LOCAL semantics", () => {
    // normalizeHost("") → null, so an empty string is treated as "no target".
    const hosts = buildHostCandidates("user@example.com", "localhost", "   ");
    expect(hosts).toContain("localhost");
  });
});
