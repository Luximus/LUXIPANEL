// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { localizeFileValidation } from "./validation-i18n.js";

describe("editor validation localization", () => {
  it("translates controlled messages without changing line and column", () => {
    const result = localizeFileValidation("en", {
      validator: "env", valid: false, errors: [
        { line: 2, message: 'Línea no válida (se esperaba CLAVE=valor): "NOT VALID"' },
        { line: 3, column: 7, message: "JSON no válido" },
      ],
    });
    expect(result.errors).toEqual([
      { line: 2, message: "Invalid line (expected KEY=value): “NOT VALID”" },
      { line: 3, column: 7, message: "Invalid JSON" },
    ]);
  });

  it("keeps external parser diagnostics intact", () => {
    expect(localizeFileValidation("fr", {
      validator: "php", valid: false, errors: [{ line: 3, message: "syntax error, unexpected ';'" }],
    }).errors[0]?.message).toBe("syntax error, unexpected ';'");
    expect(localizeFileValidation("ja", {
      validator: "nginx", valid: false, errors: [{ message: "Faltan 2 llave(s) de cierre «}»." }],
    }).errors[0]?.message).toBe("閉じ波かっこ「}」が 2 個不足しています。");
  });
});
