// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { API_LOCALES } from "../i18n/errors.js";
import { zodIssues } from "./zod-issues.js";

describe("localized Zod issue projection", () => {
  const schema = z.object({ enabled: z.boolean(), title: z.string().min(2) });
  const result = schema.safeParse({ title: "x" });
  if (result.success) throw new Error("Expected invalid fixture");

  it("retains the API field and message shape in every locale", () => {
    for (const locale of API_LOCALES) {
      const details = zodIssues(result.error.issues, locale);
      expect(details.map((detail) => detail.field)).toEqual(["enabled", "title"]);
      expect(details.every((detail) => detail.message.trim().length > 0)).toBe(true);
      expect(details.every((detail) => Object.keys(detail).join() === "field,message")).toBe(true);
    }
    expect(zodIssues(result.error.issues, "es")[0]?.message).toBe("Este campo es obligatorio");
    expect(zodIssues(result.error.issues, "fr")[1]?.message).toBe("Minimum : 2");
  });

  it("translates known custom refinements and keeps the original when no locale is passed", () => {
    const custom = [{ path: [], code: "custom", message: "Provide title and/or pinned" }];
    expect(zodIssues(custom, "es")[0]?.message).toBe("Indica un título o el estado fijado");
    expect(zodIssues(custom)[0]?.message).toBe("Provide title and/or pinned");
    expect(zodIssues([{ path: ["projectPath"], code: "custom", message: "projectPath debe ser una ruta absoluta" }], "en"))
      .toEqual([{ field: "projectPath", message: "projectPath must be an absolute path" }]);
    expect(zodIssues([{ path: ["previewUrl"], code: "custom", message: "La URL de vista previa debe ser HTTPS o una ruta del panel" }], "ja")[0]?.message)
      .toContain("HTTPS");
  });
});
