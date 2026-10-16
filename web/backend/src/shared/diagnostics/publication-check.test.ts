import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assertPublishableSource } from "./publication-check.js";

describe("publication credential checks", () => {
  it.each(["${password}", "${credentials.password}", "${process.env.DB_PASSWORD}"])(
    "allows a complete runtime password reference: %s", (password) => {
      expect(() => assertPublishableSource("const url = `postgresql://app:" + password + "@database/app`;")).not.toThrow();
    },
  );
  it("accepts the deployment runner without treating generated passwords as credentials", () => {
    const source = readFileSync(new URL("../../../scripts/deployments/deployment-tenant.mjs", import.meta.url), "utf8");
    expect(() => assertPublishableSource(source)).not.toThrow();
  });
  it.each([
    "s".repeat(20), "${credentials.password}literal", "literal${password}",
    "${'literal-password'}", "${getPassword()}", "${credentials['password']}",
  ])("rejects literal, mixed or unrecognized password expressions: %s", (password) => {
    expect(() => assertPublishableSource("postgres://app:" + password + "@database/app")).toThrow("credencial");
  });
  it("still detects a real credential after a runtime reference", () => {
    const source = "postgres://app:${credentials.password}@database/app\nmysql://app:" + "s".repeat(20) + "@other/app";
    expect(() => assertPublishableSource(source)).toThrow("credencial");
  });
  it.each([
    "ghp_" + "a".repeat(36),
    'const password = "' + "s".repeat(32) + '";',
    "-----BEGIN " + "PRIVATE KEY-----\nmaterial",
  ])("keeps credential checks independent of runtime URL references", (secret) => {
    expect(() => assertPublishableSource("postgres://app:${password}@database/app\n" + secret)).toThrow("credencial");
  });
});
