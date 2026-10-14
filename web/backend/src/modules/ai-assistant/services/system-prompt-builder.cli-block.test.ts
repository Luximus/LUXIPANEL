// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bloque CLI del system prompt: la promesa de sudo debe reflejar la
 * disponibilidad REAL del askpass (incidente 2026-07-20: un worker sin
 * credencial insistió con `sudo` fallando porque el prompt lo prometía
 * incondicionalmente), y las reglas de formato de tools deben estar siempre.
 */
import { describe, it, expect, vi } from "vitest";

// buildCliModeBlock es puro, pero el módulo que lo exporta arrastra el grafo
// completo del asistente — se stubbea lo que toca I/O al importar.
vi.mock("./providers/cli/cli-sudo-askpass.js", () => ({
  hasSudoCredential: vi.fn(async () => false),
}));

import { buildCliModeBlock } from "./system-prompt-builder.js";

describe("buildCliModeBlock", () => {
  it("con credencial promete askpass no interactivo", () => {
    const block = buildCliModeBlock({ sudoAvailable: true });
    expect(block).toContain("askpass no interactivo");
    expect(block).toContain("Usa `sudo` con normalidad");
    expect(block).not.toContain("SUDO NO DISPONIBLE");
  });

  it("sin credencial prohíbe insistir con sudo y pide reportar lo no verificable", () => {
    const block = buildCliModeBlock({ sudoAvailable: false });
    expect(block).toContain("SUDO NO DISPONIBLE");
    expect(block).toContain("no verificable sin sudo");
    expect(block).not.toContain("askpass no interactivo, así que `sudo` NO pedirá contraseña");
  });

  it("ambas variantes incluyen las reglas de formato de tools", () => {
    for (const sudoAvailable of [true, false]) {
      const block = buildCliModeBlock({ sudoAvailable });
      expect(block).toContain("FORMATO DE HERRAMIENTAS");
      expect(block).toContain('pages: ""');
      expect(block).toContain("MODO CLI ACTIVO");
    }
  });
});
