import { beforeEach, expect, it } from "vitest";
import { syncBrandingScope, LIVE_LOGOS_KEY, LIVE_CSS_KEY, TORNASOL_FLAG_KEY } from "./branding-storage-keys";
beforeEach(() => sessionStorage.clear());
it("clears old server previews and legacy unscoped values", () => {
  sessionStorage.setItem(LIVE_LOGOS_KEY, "old logo");
  syncBrandingScope(sessionStorage, "local");
  expect(sessionStorage.getItem(LIVE_LOGOS_KEY)).toBeNull();
  for (const key of [LIVE_LOGOS_KEY, LIVE_CSS_KEY, TORNASOL_FLAG_KEY]) sessionStorage.setItem(key, "local preview");
  syncBrandingScope(sessionStorage, "remote");
  for (const key of [LIVE_LOGOS_KEY, LIVE_CSS_KEY, TORNASOL_FLAG_KEY]) expect(sessionStorage.getItem(key)).toBeNull();
});
it("retains live previews on navigation within the same server", () => {
  syncBrandingScope(sessionStorage, "remote");
  sessionStorage.setItem(LIVE_LOGOS_KEY, "remote preview");
  syncBrandingScope(sessionStorage, "remote");
  expect(sessionStorage.getItem(LIVE_LOGOS_KEY)).toBe("remote preview");
});
