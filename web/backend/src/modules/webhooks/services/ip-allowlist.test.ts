// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests — webhooks/services/ip-allowlist.ts
 *
 * Locks the observable contract of `ipAllowed` (gateway IP restriction gate):
 * empty list = allow-all, exact IPv4/IPv6 match, IPv4 CIDR, ::ffff: and
 * :port normalization. Written against the CURRENT behaviour; any change here
 * would change who can reach a gateway ingest endpoint.
 */

import { describe, it, expect } from "vitest";
import { ipAllowed } from "./ip-allowlist.js";

describe("ipAllowed — empty allowlist means no restriction", () => {
  it("allows any IP when list is empty", () => {
    expect(ipAllowed("", "1.2.3.4")).toBe(true);
    expect(ipAllowed("   ", "8.8.8.8")).toBe(true);
    expect(ipAllowed(",", "10.0.0.1")).toBe(true);
  });
});

describe("ipAllowed — exact IPv4 match", () => {
  it("allows an exact listed IP and rejects others", () => {
    expect(ipAllowed("1.2.3.4", "1.2.3.4")).toBe(true);
    expect(ipAllowed("1.2.3.4", "1.2.3.5")).toBe(false);
  });

  it("matches against a comma-separated list", () => {
    expect(ipAllowed("9.9.9.9, 1.2.3.4 , 8.8.8.8", "1.2.3.4")).toBe(true);
    expect(ipAllowed("9.9.9.9, 8.8.8.8", "1.2.3.4")).toBe(false);
  });
});

describe("ipAllowed — IPv4 CIDR subnet match", () => {
  it("matches inside a /24", () => {
    expect(ipAllowed("10.0.0.0/24", "10.0.0.5")).toBe(true);
    expect(ipAllowed("10.0.0.0/24", "10.0.1.5")).toBe(false);
  });

  it("/32 is a single host", () => {
    expect(ipAllowed("10.0.0.7/32", "10.0.0.7")).toBe(true);
    expect(ipAllowed("10.0.0.7/32", "10.0.0.8")).toBe(false);
  });

  it("/0 matches everything", () => {
    expect(ipAllowed("0.0.0.0/0", "203.0.113.9")).toBe(true);
  });

  it("rejects a malformed CIDR (bits out of range) rather than throwing", () => {
    expect(ipAllowed("10.0.0.0/33", "10.0.0.1")).toBe(false);
    expect(ipAllowed("10.0.0.0/abc", "10.0.0.1")).toBe(false);
  });
});

describe("ipAllowed — normalization", () => {
  it("strips ::ffff: IPv4-mapped IPv6 prefix from the client IP", () => {
    expect(ipAllowed("1.2.3.4", "::ffff:1.2.3.4")).toBe(true);
    expect(ipAllowed("10.0.0.0/24", "::ffff:10.0.0.9")).toBe(true);
  });

  it("strips a :port suffix from an IPv4 client address", () => {
    expect(ipAllowed("1.2.3.4", "1.2.3.4:5555")).toBe(true);
  });

  it("matches a bare IPv6 address exactly only", () => {
    expect(ipAllowed("2001:db8::1", "2001:db8::1")).toBe(true);
    expect(ipAllowed("2001:db8::1", "2001:db8::2")).toBe(false);
  });
});
