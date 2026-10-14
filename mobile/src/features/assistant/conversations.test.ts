// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests del mapeo de mensajes persistidos → turnos del chat (fase A4).
import { describe, expect, it } from "vitest";
import { mapStoredMessages } from "./conversations";

describe("mapStoredMessages", () => {
  it("acepta array plano y envelopes {items}/{messages}", () => {
    const raw = [{ role: "user", content: "hola" }];
    expect(mapStoredMessages(raw)).toHaveLength(1);
    expect(mapStoredMessages({ items: raw })).toHaveLength(1);
    expect(mapStoredMessages({ messages: raw })).toHaveLength(1);
    expect(mapStoredMessages(null)).toEqual([]);
  });

  it("usuario usa textOriginal y asistente textTranslated, con fallback a content/text", () => {
    const out = mapStoredMessages([
      { role: "user", textOriginal: "original", textTranslated: "traducido", content: "content" },
      { role: "assistant", textOriginal: "original", textTranslated: "traducido", content: "content" },
      { role: "assistant", text: "solo-text" },
    ]);
    expect(out[0]).toMatchObject({ role: "user", content: "original" });
    expect(out[1]).toMatchObject({ role: "assistant", content: "traducido" });
    expect(out[2]).toMatchObject({ role: "assistant", content: "solo-text" });
  });

  it("parsea ts a createdAt y conserva tokens/duración", () => {
    const out = mapStoredMessages([
      { role: "user", content: "a", ts: "2026-07-12T10:00:00.000Z", tokens: { input: 1, output: 2, total: 3 }, durationMs: 42 },
      { role: "user", content: "b", ts: "no-es-fecha" },
    ]);
    expect(out[0].createdAt).toBe(Date.parse("2026-07-12T10:00:00.000Z"));
    expect(out[0].tokens?.total).toBe(3);
    expect(out[0].durationMs).toBe(42);
    expect(out[1].createdAt).toBeUndefined();
  });

  it("filtra vacíos pero conserva divisores de compactación", () => {
    const out = mapStoredMessages([
      { role: "assistant", content: "" },
      { role: "assistant", content: "", summarizedCount: 5 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].summarizedCount).toBe(5);
  });

  it("restaura la aprobación pendiente al reabrir una conversación", () => {
    const ask = [{ id: "plan", type: "single" as const, text: "¿Apruebas este plan?", options: ["Aprobar plan", "Pedir cambios"] }];
    const out = mapStoredMessages([{ role: "assistant", content: "Resumen: arreglo\n\nPlan completo:\n1. Corregir", ask, askKind: "plan-approval" }]);
    expect(out[0]).toMatchObject({ ask, askKind: "plan-approval" });
  });

  it("restaura identidad, adjuntos y consola sin volcar el log CLI en la respuesta", () => {
    const out = mapStoredMessages([
      { role: "user", provider: "codex", content: "translated", textOriginal: "original", attachments: [{ id: "photo_1", name: "photo.png", mimeType: "image/png" }] },
      { role: "assistant", cli: true, provider: "codex", content: "Respuesta limpia", cliLog: "$ run\n⏺ tool\n  ⎿ output", textTranslationError: "falló traducción" },
      { role: "user", auto: true, content: "wake up" },
    ]);
    expect(out[0]).toMatchObject({ provider: "codex", content: "original", raw: "translated", attachments: [{ url: "/api/ai/attachments/photo_1" }] });
    expect(out[1]).toMatchObject({ provider: "codex", content: "Respuesta limpia", cli: true, cliHistoryLog: "$ run\n⏺ tool\n  ⎿ output", translationError: "falló traducción" });
    expect(out[2]).toMatchObject({ provider: "codex", auto: true });
  });

  it("extrae solo la última narración de un mensaje CLI antiguo", () => {
    const out = mapStoredMessages([{ role: "assistant", cli: true, content: "$ run\n⏺ Bash\n  ⎿ salida\n\nTerminé la tarea." }]);
    expect(out[0].content).toBe("Terminé la tarea.");
    expect(out[0].cliHistoryLog).toContain("⏺ Bash");
  });

  it("descarta IDs de adjuntos no válidos antes de crear URL autenticada", () => {
    const out = mapStoredMessages([{ role: "user", content: "archivo", attachments: [{ id: "../fuera", name: "fuera" }] }]);
    expect(out[0].attachments).toBeUndefined();
  });
});

it("retains failed and stopped outcomes across reload, including empty answers", () => {
  const out = mapStoredMessages([
    { role: "assistant", cli: true, content: "", cliLog: "Estoy revisando", error: "timeout" },
    { role: "assistant", content: "", interrupted: true },
  ]);
  expect(out).toHaveLength(2);
  expect(out[0]).toMatchObject({ content: "", error: "timeout", cliHistoryLog: "Estoy revisando" });
  expect(out[1]).toMatchObject({ content: "", stopped: true });
});
