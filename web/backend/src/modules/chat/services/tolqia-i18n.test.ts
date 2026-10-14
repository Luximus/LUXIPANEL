// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { localizeTolqiaMessage, summarizeTolqiaAccount } from "./tolqia-i18n.js";

describe("Tolqia response localization", () => {
  it("translates credential and HTTP probe failures", () => {
    expect(localizeTolqiaMessage("en", "Tolqia rechazó el token (no autorizado)"))
      .toBe("Tolqia rejected the token (unauthorized)");
    expect(localizeTolqiaMessage("ja", "Tolqia respondió 503"))
      .toBe("Tolqia はステータス 503 を返しました");
    expect(localizeTolqiaMessage("fr", "upstream detail")).toBe("upstream detail");
  });

  it("builds a complete account summary in the requested language", () => {
    const account = {
      plan: "plus", status: "active", displayName: "Mira",
      limits: { translationParticipants: 8, maxGroups: 3, maxMembers: null },
    };
    expect(summarizeTolqiaAccount("es", account)).toBe("Plan Plus · activo · traducción hasta 8 participantes · 3 grupos · Mira");
    expect(summarizeTolqiaAccount("en", account)).toBe("Plus plan · active · translation for up to 8 participants · 3 groups · Mira");
    expect(summarizeTolqiaAccount("ko", account)).toContain("최대 8명까지 번역");
  });
});
