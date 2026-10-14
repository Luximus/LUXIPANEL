// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests de la ventana acotada del historial saliente (límites del gateway LP).
import { describe, expect, it } from "vitest";
import {
  buildOutgoingHistory,
  MAX_MSG_CONTENT,
  MAX_SEND_MESSAGES,
  MAX_TOTAL_CONTENT,
} from "./outgoing-history";

describe("buildOutgoingHistory", () => {
  it("apenda siempre el mensaje nuevo del usuario al final", () => {
    const out = buildOutgoingHistory([{ role: "assistant", content: "hola" }], "nuevo");
    expect(out).toEqual([
      { role: "assistant", content: "hola" },
      { role: "user", content: "nuevo" },
    ]);
  });

  it("descarta turnos previos vacíos o de solo espacios (turno interrumpido)", () => {
    const out = buildOutgoingHistory(
      [
        { role: "user", content: "pregunta" },
        { role: "assistant", content: "" },
        { role: "assistant", content: "   " },
      ],
      "sigues ahí?",
    );
    expect(out).toEqual([
      { role: "user", content: "pregunta" },
      { role: "user", content: "sigues ahí?" },
    ]);
  });

  it("recorta cada contenido al máximo del gateway con marcador", () => {
    const out = buildOutgoingHistory(
      [{ role: "assistant", content: "x".repeat(MAX_MSG_CONTENT + 500) }],
      "y".repeat(MAX_MSG_CONTENT + 500),
    );
    for (const m of out) {
      expect(m.content.length).toBeLessThanOrEqual(MAX_MSG_CONTENT);
      expect(m.content.endsWith("… [recortado]")).toBe(true);
    }
  });

  it("ventana a los últimos turnos sin pasarse del máximo de mensajes", () => {
    const prior = Array.from({ length: 100 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `m${i}`,
    }));
    const out = buildOutgoingHistory(prior, "final");
    expect(out).toHaveLength(MAX_SEND_MESSAGES);
    expect(out[0]?.content).toBe(`m${100 - (MAX_SEND_MESSAGES - 1)}`);
    expect(out[out.length - 1]).toEqual({ role: "user", content: "final" });
  });

  it("respeta el presupuesto total soltando los turnos más antiguos", () => {
    const prior = Array.from({ length: MAX_SEND_MESSAGES - 1 }, (_, i) => ({
      role: "assistant" as const,
      content: `${i}:${"x".repeat(MAX_MSG_CONTENT - 10)}`,
    }));
    const out = buildOutgoingHistory(prior, "final");
    const total = out.reduce((n, m) => n + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_CONTENT);
    // Se conserva la cola (los más recientes) y el mensaje final.
    expect(out[out.length - 1]).toEqual({ role: "user", content: "final" });
    expect(out[out.length - 2]?.content.startsWith(`${MAX_SEND_MESSAGES - 2}:`)).toBe(true);
  });

  it("nunca suelta el mensaje final aunque él solo agote el presupuesto", () => {
    const out = buildOutgoingHistory(
      [{ role: "assistant", content: "previo" }],
      "z".repeat(MAX_MSG_CONTENT + 1),
    );
    expect(out).toHaveLength(2);
    expect(out[1]?.role).toBe("user");
  });
});
