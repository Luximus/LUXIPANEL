// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — cloudflare/models: the pure IP helpers (reused by the server-IP
 * probe and the access-rule schema) and the request-schema guards that keep
 * out-of-whitelist values from ever reaching Cloudflare.
 */

import { describe, it, expect } from "vitest";
import {
  isValidIpv4,
  isValidIpv6,
  isValidIp,
  isValidIpOrCidr,
  setSettingSchema,
  purgeSchema,
  accessRuleSchema,
  dnsCreateSchema,
} from "./index.js";

describe("IP helpers", () => {
  it("isValidIpv4 accepts dotted quads in range and rejects the rest", () => {
    expect(isValidIpv4("1.2.3.4")).toBe(true);
    expect(isValidIpv4("255.255.255.255")).toBe(true);
    expect(isValidIpv4("256.1.1.1")).toBe(false);
    expect(isValidIpv4("1.2.3")).toBe(false);
    expect(isValidIpv4("1.2.3.4.5")).toBe(false);
    expect(isValidIpv4("a.b.c.d")).toBe(false);
  });

  it("isValidIpv6 accepts compressed/full v6 and rejects non-v6", () => {
    expect(isValidIpv6("2001:db8::1")).toBe(true);
    expect(isValidIpv6("::1")).toBe(true);
    expect(isValidIpv6("1.2.3.4")).toBe(false);
    // more than one "::" compression group is rejected
    expect(isValidIpv6("2001::db8::1")).toBe(false);
  });

  it("isValidIp is the union of v4 and v6", () => {
    expect(isValidIp("8.8.8.8")).toBe(true);
    expect(isValidIp("2001:db8::1")).toBe(true);
    expect(isValidIp("not-an-ip")).toBe(false);
  });

  it("isValidIpOrCidr validates the prefix bits per family", () => {
    expect(isValidIpOrCidr("1.2.3.4")).toBe(true);
    expect(isValidIpOrCidr("1.2.3.0/24")).toBe(true);
    expect(isValidIpOrCidr("1.2.3.0/33")).toBe(false); // >32 for v4
    expect(isValidIpOrCidr("2001:db8::/32")).toBe(true);
    expect(isValidIpOrCidr("2001:db8::/129")).toBe(false); // >128 for v6
    expect(isValidIpOrCidr("1.2.3.0/x")).toBe(false);
  });
});

describe("setSettingSchema whitelist", () => {
  it("accepts a whitelisted value for the setting", () => {
    expect(setSettingSchema.safeParse({ setting: "ssl", value: "full" }).success).toBe(true);
  });

  it("rejects a value outside the setting's whitelist", () => {
    const r = setSettingSchema.safeParse({ setting: "ssl", value: "banana" });
    expect(r.success).toBe(false);
  });

  it("rejects a value valid for a DIFFERENT setting", () => {
    // "medium" is valid for security_level, never for always_use_https.
    expect(setSettingSchema.safeParse({ setting: "always_use_https", value: "medium" }).success).toBe(
      false,
    );
  });
});

describe("purgeSchema mutual exclusivity", () => {
  it("accepts everything:true alone", () => {
    expect(purgeSchema.safeParse({ everything: true }).success).toBe(true);
  });

  it("accepts a non-empty files list alone", () => {
    expect(purgeSchema.safeParse({ files: ["https://x/a.js"] }).success).toBe(true);
  });

  it("rejects both everything and files together", () => {
    expect(purgeSchema.safeParse({ everything: true, files: ["https://x/a.js"] }).success).toBe(false);
  });

  it("rejects neither", () => {
    expect(purgeSchema.safeParse({}).success).toBe(false);
  });

  it("rejects more than 30 files", () => {
    const files = Array.from({ length: 31 }, (_, i) => `https://x/${i}.js`);
    expect(purgeSchema.safeParse({ files }).success).toBe(false);
  });
});

describe("accessRuleSchema", () => {
  it("accepts a plain IP and a CIDR range", () => {
    expect(accessRuleSchema.safeParse({ mode: "block", ip: "1.2.3.4" }).success).toBe(true);
    expect(accessRuleSchema.safeParse({ mode: "whitelist", ip: "1.2.3.0/24" }).success).toBe(true);
  });

  it("rejects an invalid IP/range", () => {
    expect(accessRuleSchema.safeParse({ mode: "block", ip: "999.1.1.1" }).success).toBe(false);
  });

  it("rejects an unknown mode", () => {
    expect(accessRuleSchema.safeParse({ mode: "nuke", ip: "1.2.3.4" }).success).toBe(false);
  });
});

describe("dnsCreateSchema ttl guard", () => {
  const base = { type: "A" as const, name: "www.example.com", content: "1.2.3.4" };
  it("accepts ttl=1 (automatic)", () => {
    expect(dnsCreateSchema.safeParse({ ...base, ttl: 1 }).success).toBe(true);
  });
  it("accepts ttl within 60..86400", () => {
    expect(dnsCreateSchema.safeParse({ ...base, ttl: 3600 }).success).toBe(true);
  });
  it("rejects ttl between 2 and 59", () => {
    expect(dnsCreateSchema.safeParse({ ...base, ttl: 30 }).success).toBe(false);
  });
  it("rejects an unsupported record type", () => {
    expect(dnsCreateSchema.safeParse({ ...base, type: "SRV" }).success).toBe(false);
  });
});
