// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { parseAuthResults } from "./imap.service.js";

describe("parseAuthResults", () => {
  it("extracts spf/dkim/dmarc verdicts from Authentication-Results", () => {
    const result = parseAuthResults([
      {
        key: "authentication-results",
        line:
          "Authentication-Results: mx.google.com; spf=pass smtp.mailfrom=a@b.com; " +
          "dkim=pass header.i=@b.com; dmarc=pass (p=REJECT)",
      },
      { key: "dkim-signature", line: "DKIM-Signature: v=1; a=rsa-sha256; d=b.com; ..." },
      { key: "return-path", line: "Return-Path: <a@b.com>" },
    ]);
    expect(result.spf).toBe("pass");
    expect(result.dkim).toBe("pass");
    expect(result.dmarc).toBe("pass");
    expect(result.dkimSigned).toBe(true);
    expect(result.returnPath).toBe("a@b.com");
  });

  it("flags failing spoofed mail", () => {
    const result = parseAuthResults([
      {
        key: "Authentication-Results",
        line: "Authentication-Results: mx; spf=fail; dkim=none; dmarc=fail",
      },
    ]);
    expect(result.spf).toBe("fail");
    expect(result.dkim).toBe("none");
    expect(result.dmarc).toBe("fail");
    expect(result.dkimSigned).toBe(false);
  });

  it("falls back to the leading verdict word of Received-SPF", () => {
    const result = parseAuthResults([
      { key: "Received-SPF", line: "Received-SPF: SoftFail (domain does not designate sender)" },
    ]);
    expect(result.spf).toBe("softfail");
  });

  it("returns all-null on empty headers", () => {
    const result = parseAuthResults(null);
    expect(result).toEqual({
      spf: null,
      dkim: null,
      dmarc: null,
      returnPath: null,
      dkimSigned: false,
      authenticationResults: null,
    });
  });
});
