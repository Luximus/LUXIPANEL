import { describe, it, expect } from "vitest";
import { loadSessionState, saveSessionState } from "./session-state";

const KEY_THEME = "lxp-theme";
const KEY_LANG = "lxp-language";
const KEY_LEGACY = "desktop-theme";

describe("loadSessionState", () => {
  it("returns defaults (light + 'en') when nothing is stored", () => {
    const state = loadSessionState();
    expect(state).toEqual({ isDark: false, language: "en" });
  });

  it("reports isDark=true when lxp-theme is 'dark'", () => {
    localStorage.setItem(KEY_THEME, "dark");
    expect(loadSessionState().isDark).toBe(true);
  });

  it("reports isDark=false when lxp-theme is 'light'", () => {
    localStorage.setItem(KEY_THEME, "light");
    expect(loadSessionState().isDark).toBe(false);
  });

  it("reports isDark=false for any non-'dark' theme value", () => {
    localStorage.setItem(KEY_THEME, "weird");
    expect(loadSessionState().isDark).toBe(false);
  });

  it("reads the stored language", () => {
    localStorage.setItem(KEY_THEME, "light");
    localStorage.setItem(KEY_LANG, "es");
    expect(loadSessionState().language).toBe("es");
  });

  it("defaults language to 'en' when only theme is set", () => {
    localStorage.setItem(KEY_THEME, "dark");
    expect(loadSessionState().language).toBe("en");
  });

  it("migrates a legacy 'desktop-theme' value into lxp-theme when lxp-theme is unset", () => {
    localStorage.setItem(KEY_LEGACY, "dark");
    const state = loadSessionState();
    expect(state.isDark).toBe(true);
    // migration writes the value into the new key
    expect(localStorage.getItem(KEY_THEME)).toBe("dark");
  });

  it("migrates legacy 'light' and keeps default language during migration", () => {
    localStorage.setItem(KEY_LEGACY, "light");
    const state = loadSessionState();
    expect(state).toEqual({ isDark: false, language: "en" });
    expect(localStorage.getItem(KEY_THEME)).toBe("light");
  });

  it("uses stored language during legacy migration", () => {
    localStorage.setItem(KEY_LEGACY, "dark");
    localStorage.setItem(KEY_LANG, "fr");
    expect(loadSessionState()).toEqual({ isDark: true, language: "fr" });
  });

  it("ignores legacy key when lxp-theme is already set", () => {
    localStorage.setItem(KEY_THEME, "light");
    localStorage.setItem(KEY_LEGACY, "dark");
    // lxp-theme takes precedence; no migration path
    expect(loadSessionState().isDark).toBe(false);
  });

  it("does not migrate when legacy value is empty string (falsy)", () => {
    localStorage.setItem(KEY_LEGACY, "");
    const state = loadSessionState();
    expect(state).toEqual({ isDark: false, language: "en" });
    // empty legacy is falsy -> no copy into lxp-theme
    expect(localStorage.getItem(KEY_THEME)).toBeNull();
  });
});

describe("saveSessionState", () => {
  it("persists isDark=true as 'dark' in both keys", () => {
    saveSessionState({ isDark: true });
    expect(localStorage.getItem(KEY_THEME)).toBe("dark");
    expect(localStorage.getItem(KEY_LEGACY)).toBe("dark");
  });

  it("persists isDark=false as 'light' in both keys (backward compat)", () => {
    saveSessionState({ isDark: false });
    expect(localStorage.getItem(KEY_THEME)).toBe("light");
    expect(localStorage.getItem(KEY_LEGACY)).toBe("light");
  });

  it("persists a non-empty language", () => {
    saveSessionState({ language: "es" });
    expect(localStorage.getItem(KEY_LANG)).toBe("es");
  });

  it("does not persist an empty-string language", () => {
    saveSessionState({ language: "" });
    expect(localStorage.getItem(KEY_LANG)).toBeNull();
  });

  it("ignores isDark when not a boolean (undefined)", () => {
    saveSessionState({ language: "en" });
    expect(localStorage.getItem(KEY_THEME)).toBeNull();
    expect(localStorage.getItem(KEY_LEGACY)).toBeNull();
  });

  it("writes both theme and language in a single call", () => {
    saveSessionState({ isDark: true, language: "de" });
    expect(localStorage.getItem(KEY_THEME)).toBe("dark");
    expect(localStorage.getItem(KEY_LANG)).toBe("de");
  });

  it("round-trips through loadSessionState", () => {
    saveSessionState({ isDark: true, language: "pt" });
    expect(loadSessionState()).toEqual({ isDark: true, language: "pt" });
  });
});
