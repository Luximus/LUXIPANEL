// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — shared/validators/index.ts
 *
 * Tests Zod schema validation logic.
 */

import { describe, it, expect } from "vitest";
import {
  idParamSchema,
  emailSchema,
  passwordSchema,
  usernameSchema,
  domainSchema,
  quotaSchema,
} from "./index.js";

describe("idParamSchema", () => {
  it("coerces string to number", () => {
    const result = idParamSchema.parse({ id: "5" });
    expect(result.id).toBe(5);
  });

  it("rejects zero", () => {
    expect(() => idParamSchema.parse({ id: 0 })).toThrow();
  });

  it("rejects negative", () => {
    expect(() => idParamSchema.parse({ id: -1 })).toThrow();
  });
});

describe("emailSchema", () => {
  it("accepts valid emails", () => {
    expect(() => emailSchema.parse("user@example.com")).not.toThrow();
    expect(() => emailSchema.parse("USER@EXAMPLE.COM")).not.toThrow();
  });

  it("lowercases the email", () => {
    expect(emailSchema.parse("USER@EXAMPLE.COM")).toBe("user@example.com");
  });

  it("rejects invalid emails", () => {
    expect(() => emailSchema.parse("notanemail")).toThrow();
    expect(() => emailSchema.parse("@domain.com")).toThrow();
  });
});

describe("passwordSchema", () => {
  it("accepts strong passwords", () => {
    expect(() => passwordSchema.parse("SecurePass1")).not.toThrow();
    expect(() => passwordSchema.parse("Another@Valid1")).not.toThrow();
  });

  it("rejects passwords shorter than 8 chars", () => {
    expect(() => passwordSchema.parse("Ab1")).toThrow();
  });

  it("rejects passwords without uppercase", () => {
    expect(() => passwordSchema.parse("nouppercase1")).toThrow();
  });

  it("rejects passwords without lowercase", () => {
    expect(() => passwordSchema.parse("NOLOWERCASE1")).toThrow();
  });

  it("rejects passwords without digits", () => {
    expect(() => passwordSchema.parse("NoDigitsHere")).toThrow();
  });

  // Regression: chpasswd stdin injection. A newline lets an attacker inject a
  // second `user:pass` line (e.g. `root:...`) and `:` is the chpasswd field
  // separator — both must be rejected outright.
  it("rejects newline (chpasswd second-line injection)", () => {
    expect(() => passwordSchema.parse("Aa1aaaa\nroot:Aa1aaaa")).toThrow();
    expect(() => passwordSchema.parse("Aa1aaaa\r\nroot:Aa1aaaa")).toThrow();
  });

  it("rejects the chpasswd field separator ':'", () => {
    expect(() => passwordSchema.parse("Aa1aaaa:bbbb")).toThrow();
  });

  it("rejects other control characters", () => {
    expect(() => passwordSchema.parse("Aa1aaaa\tbbb")).toThrow();
    expect(() => passwordSchema.parse("Aa1aaaa\x00bbb")).toThrow();
    expect(() => passwordSchema.parse("Aa1aaaa\fbbb")).toThrow();
    expect(() => passwordSchema.parse("Aa1aaaa\vbbb")).toThrow();
  });
});

describe("usernameSchema", () => {
  it("accepts valid usernames", () => {
    expect(() => usernameSchema.parse("admin")).not.toThrow();
    expect(() => usernameSchema.parse("user.name_2")).not.toThrow();
    expect(() => usernameSchema.parse("Alice")).not.toThrow();
  });

  it("rejects usernames starting with a digit", () => {
    expect(() => usernameSchema.parse("1user")).toThrow();
  });

  it("rejects usernames that are too short", () => {
    expect(() => usernameSchema.parse("ab")).toThrow();
  });

  it("rejects usernames with invalid characters", () => {
    expect(() => usernameSchema.parse("user name")).toThrow();
    expect(() => usernameSchema.parse("user@name")).toThrow();
  });
});

describe("domainSchema", () => {
  it("accepts valid domain names", () => {
    expect(() => domainSchema.parse("example.com")).not.toThrow();
    expect(() => domainSchema.parse("mail.example.com")).not.toThrow();
    expect(() => domainSchema.parse("sub.domain.co.uk")).not.toThrow();
  });

  it("lowercases the domain", () => {
    expect(domainSchema.parse("Example.COM")).toBe("example.com");
  });

  it("rejects invalid domains", () => {
    expect(() => domainSchema.parse("not a domain")).toThrow();
    expect(() => domainSchema.parse("-invalid.com")).toThrow();
  });
});

describe("quotaSchema", () => {
  it("defaults to 1024", () => {
    expect(quotaSchema.parse(undefined)).toBe(1024);
  });

  it("accepts valid MB values", () => {
    expect(quotaSchema.parse(2048)).toBe(2048);
    expect(quotaSchema.parse(0)).toBe(0);
  });

  it("rejects values over 102400", () => {
    expect(() => quotaSchema.parse(102401)).toThrow();
  });
});
