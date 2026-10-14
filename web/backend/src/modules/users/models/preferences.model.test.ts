// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — toUiPreferences pure mapper (GET /api/preferences/ui contract
 * shape + defaults: theme "system", language null).
 */

import { describe, it, expect } from "vitest";
import { toUiPreferences } from "./preferences.model.js";

describe("toUiPreferences", () => {
  it("applies contract defaults for an empty blob (GET default)", () => {
    expect(toUiPreferences({})).toEqual({ theme: "system", language: null });
  });

  it("passes through a stored theme + language", () => {
    expect(toUiPreferences({ theme: "dark", language: "en" })).toEqual({
      theme: "dark",
      language: "en",
    });
  });

  it("supports region-qualified i18n codes", () => {
    expect(toUiPreferences({ language: "en-US" }).language).toBe("en-US");
  });

  it("coerces a non-string / missing language to null and ignores unrelated fields", () => {
    expect(
      toUiPreferences({ theme: "light", dashboardLayout: "grid", notificationsEnabled: true }),
    ).toEqual({ theme: "light", language: null });
    // A malformed sidecar value must not leak a non-string into the contract.
    expect(toUiPreferences({ language: 42 as unknown as string }).language).toBeNull();
  });
});
