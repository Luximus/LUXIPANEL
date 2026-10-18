// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { messagePresentation } from "./message-presentation.js";

describe("conservative message presentation", () => {
  it.each([
    "Documento completo.\n\n" + "Contenido ".repeat(100),
    "手順と説明\n\n" + "詳細 ".repeat(100),
    "```ts\nconst answer = 42;\n```\n\nPlan completo.",
    "Primera frase. Segunda frase. Tercera frase que debe conservarse.",
  ])("keeps a complete answer without guessing the user's requested format", content => {
    expect(messagePresentation(content).presentation).toBe("full");
  });

  const packet = 'kind: result\nsummary: "Pruebas completas. Despliegue pendiente."\ndata:\n  deployed: false';
  it("uses only a validated packet's explicit summary", () => {
    expect(messagePresentation(packet)).toEqual({
      presentation: "summary", displaySummary: "Pruebas completas. Despliegue pendiente.",
    });
    expect(messagePresentation('kind: result\nsummary: "Parcial"\ndata: [')).toMatchObject({ presentation: "full" });
  });
  it.each([{ pending: true }, { error: "Sin confirmar" }, { interrupted: true }, { awaitingInput: true }])(
    "never conceals an unresolved outcome or question", state => {
      expect(messagePresentation(packet, state)).toEqual({ presentation: "full" });
    },
  );
  it("keeps structured blockers visible", () => {
    expect(messagePresentation(packet.replace("kind: result", "kind: blocked")).presentation).toBe("full");
  });
});
