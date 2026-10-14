// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { API_LOCALES } from "../../../shared/i18n/errors.js";
import { diagnosticResponseLanguage, localizeDiagnosticChecks } from "./diagnostics-i18n.js";

describe("DNS diagnostic localization", () => {
  it("translates names and results while preserving DNS output", () => {
    const checks = [{ name: "MX record", status: "ok" as const, message: "MX records found", detail: "10 mail.example.com." }];
    expect(localizeDiagnosticChecks("es", checks)).toEqual([{ name: "Registro MX", status: "ok", message: "Se encontraron registros MX", detail: "10 mail.example.com." }]);
    expect(localizeDiagnosticChecks("ja", checks)[0]?.message).toBe("MX レコードが見つかりました");
  });

  it("has an analysis language for every available locale", () => {
    for (const locale of API_LOCALES) expect(diagnosticResponseLanguage(locale)).toBeTruthy();
    expect(diagnosticResponseLanguage("en")).toBe("inglés");
  });
});
