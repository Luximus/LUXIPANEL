// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Regression guard for the exact on-disk formats the write-behind queue
 * serializes. The legacy regenerate* paths and the steps builder share these
 * renderers, so pinning the output here protects both at once: a drift in the
 * dovecot/postfix line format would silently corrupt mail config on apply.
 */
import { describe, it, expect } from "vitest";
import { renderDovecotUsersContent } from "./dovecot.service.js";
import {
  renderPostfixMailboxContent,
  renderPostfixDomainsContent,
} from "./postfix.service.js";

describe("mail file renderers", () => {
  it("dovecot users line: address:hash:uid:gid::home::quota, trailing newline", () => {
    const out = renderDovecotUsersContent([
      { address: "alice@example.com", passwordHash: "{SHA512-CRYPT}$6$x", quotaMb: 2048 },
    ]);
    expect(out.endsWith("\n")).toBe(true);
    const line = out.trimEnd();
    expect(line.startsWith("alice@example.com:{SHA512-CRYPT}$6$x:")).toBe(true);
    expect(line).toContain("/example.com/alice::userdb_quota_rule=*:storage=2048M");
  });

  it("postfix vmailbox: 'address  domain/local/Maildir/'", () => {
    const out = renderPostfixMailboxContent([
      { address: "bob@example.com", domain: "example.com" },
    ]);
    expect(out).toBe("bob@example.com  example.com/bob/Maildir/\n");
  });

  it("postfix virtual_domains: one domain per line, trailing newline", () => {
    expect(renderPostfixDomainsContent(["a.com", "b.com"])).toBe("a.com\nb.com\n");
  });

  it("empty inputs still end with a single newline", () => {
    expect(renderDovecotUsersContent([])).toBe("\n");
    expect(renderPostfixMailboxContent([])).toBe("\n");
    expect(renderPostfixDomainsContent([])).toBe("\n");
  });
});
