import { describe, expect, it } from "vitest";
import { API_LOCALES } from "./errors.js";
import { aiOutputLanguage } from "./ai-output-language.js";

describe("AI output language", () => {
  it("names every supported locale for user-visible generated content", () => {
    expect(new Set(API_LOCALES.map(aiOutputLanguage)).size).toBe(API_LOCALES.length);
    expect(aiOutputLanguage("ja")).toBe("Japanese");
    expect(aiOutputLanguage("unsupported")).toBe("English");
  });
});
