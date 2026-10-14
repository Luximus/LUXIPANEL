// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { API_LOCALES } from "../../../shared/i18n/errors.js";
import { MCP_MESSAGE_KEYS, mcpMessage, safeMcpErrorMessage } from "./extensions-i18n.js";

const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("MCP client messages", () => {
  it("has nonempty translations with matching placeholders in every supported locale", () => {
    for (const key of MCP_MESSAGE_KEYS) {
      const canonical = placeholders(mcpMessage("en", key));
      for (const locale of API_LOCALES) {
        const value = mcpMessage(locale, key);
        expect(value.trim(), `${locale}.${key}`).not.toBe("");
        expect(placeholders(value), `${locale}.${key}`).toEqual(canonical);
      }
    }
  });

  it("interpolates extension names without altering their contents", () => {
    expect(mcpMessage("es", "connected", { name: "Servidor {x}" })).toBe("Servidor {x} está conectado y listo para usar");
    expect(mcpMessage("ja", "missingField", { field: "api_key" })).toContain("api_key");
  });

  it("sanitizes raw process errors for the selected locale", () => {
    expect(safeMcpErrorMessage("es", "connect ECONNREFUSED 127.0.0.1:3000")).toBe("No se pudo conectar con el servidor MCP");
    expect(safeMcpErrorMessage("fr", "secret=12345 internal failure")).toBe("Échec de l’opération MCP");
    expect(safeMcpErrorMessage("en", "connect ETIMEDOUT")).toBe("MCP server connection timed out");
  });
});
