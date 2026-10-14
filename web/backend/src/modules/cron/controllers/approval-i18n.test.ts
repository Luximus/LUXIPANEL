import { describe, expect, it } from "vitest";
import { API_LOCALES } from "../../../shared/i18n/errors.js";
import { approvalText } from "./approval-i18n.js";

describe("public approval page localization", () => {
  it("uses each supported language and fills the agent name", () => {
    for (const locale of API_LOCALES) {
      expect(approvalText(locale, "pageTitle").trim()).not.toBe("");
      const message = approvalText(locale, "expiredBody", { agent: "Example" });
      expect(message).toContain("Example");
      expect(message).not.toContain("{agent}");
    }
  });

  it("uses English for an unsupported language", () => {
    expect(approvalText("xx", "invalidTitle")).toBe("Invalid link");
  });
});
