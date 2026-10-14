import { describe, expect, it } from "vitest";
import { firewallRuleDeletePath } from "./native-firewall-logic";

describe("firewallRuleDeletePath", () => {
  it("includes the live content signature for a numbered rule", () => {
    const path = firewallRuleDeletePath({ number: 12, to: "22/tcp", from: "Anywhere", action: "ALLOW IN", comment: "SSH admin" });
    const url = new URL(path, "https://panel.example");
    expect(url.pathname).toBe("/api/firewall/rules/12");
    expect(Object.fromEntries(url.searchParams)).toEqual({ to: "22/tcp", from: "Anywhere", action: "ALLOW IN", comment: "SSH admin" });
  });
  it("refuses positional deletion without a rule identity", () => {
    expect(() => firewallRuleDeletePath({ number: 1 })).toThrow("incomplete");
    expect(() => firewallRuleDeletePath({ number: 0, to: "22/tcp", action: "ALLOW IN" })).toThrow("number");
  });
});
