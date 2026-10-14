// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { API_LOCALES } from "../../../shared/i18n/errors.js";
import { assistantNotFound } from "./not-found-i18n.js";

describe("assistant resource errors", () => {
  it("returns specific 404 messages in every supported locale", () => {
    for (const locale of API_LOCALES) {
      for (const resource of ["role", "team", "agent", "project", "provider"] as const) {
        const error = assistantNotFound(locale, resource);
        expect(error.statusCode).toBe(404);
        expect(error.message.trim()).not.toBe("");
        expect(error.message.endsWith(" not found not found")).toBe(false);
      }
    }
    expect(assistantNotFound("fr", "project").message).toBe("Projet introuvable");
  });
});
