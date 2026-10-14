// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { API_LOCALES } from "../../../shared/i18n/errors.js";
import { tmuxMessage } from "./tmux-i18n.js";

describe("tmux response localization", () => {
  it("translates install errors while retaining package manager and diagnostics", () => {
    expect(tmuxMessage("en", "unsupportedManager", { manager: "pkgctl" }))
      .toBe("Unsupported package manager (pkgctl). Install tmux manually.");
    expect(tmuxMessage("ja", "detectFailed", { detail: "SSH timeout" }))
      .toBe("パッケージマネージャーを検出できませんでした: SSH timeout");
  });

  it("covers every supported locale", () => {
    for (const locale of API_LOCALES) expect(tmuxMessage(locale, "noSession").trim()).not.toBe("");
  });
});
