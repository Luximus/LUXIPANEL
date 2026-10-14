// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — mailTlsOptions (mail-host.ts).
 *
 * Guards the remote-target fix: a vault target is usually an IP literal, and a
 * mail cert is issued for `mail.<domain>`, never the IP — so dialing the IP
 * with strict validation failed with ERR_TLS_CERT_ALTNAME_INVALID. For IP
 * literals we must send/validate the domain-derived servername while keeping
 * validation STRICT; hostnames stay untouched; loopback stays relaxed.
 */

import { describe, expect, it } from "vitest";
import { isLoopbackHost, mailTlsOptions } from "./mail-host.js";

describe("mailTlsOptions", () => {
  it("loopback: relaxed validation and no servername", () => {
    for (const host of ["localhost", "127.0.0.1", "::1"]) {
      expect(isLoopbackHost(host)).toBe(true);
      expect(mailTlsOptions(host, "user@example.com")).toEqual({ rejectUnauthorized: false });
    }
  });

  it("hostname candidate: strict validation, servername left to the library (key absent)", () => {
    const opts = mailTlsOptions("mail.example.com", "user@example.com");
    expect(opts).toEqual({ rejectUnauthorized: true });
    expect("servername" in opts).toBe(false);
  });

  it("IP literal (remote vault target): strict validation against mail.<domain>", () => {
    expect(mailTlsOptions("198.51.100.7", "user@example.com")).toEqual({
      rejectUnauthorized: true,
      servername: "mail.example.com",
    });
    expect(mailTlsOptions("2001:db8::1", "User@Example.COM")).toEqual({
      rejectUnauthorized: true,
      servername: "mail.example.com",
    });
  });

  it("IP literal without a usable domain: strict validation, no servername", () => {
    expect(mailTlsOptions("198.51.100.7", "not-an-address")).toEqual({ rejectUnauthorized: true });
  });
});
