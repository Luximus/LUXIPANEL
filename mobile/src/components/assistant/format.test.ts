// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, describe, expect, it } from "vitest";
import type { ChatMsg } from "../../features/assistant/types";
import {
  compactionLabel,
  formatDuration,
  formatShortDate,
  formatTime,
  formatTokens,
  messageKeys,
  relativeDate,
  setAssistantLocale,
  stripCompactionMarker,
  turnRevision,
} from "./format";

// El idioma activo es estado de módulo (lo publica ChatScreen): se restaura
// tras cada test para no contaminar al siguiente.
afterEach(() => setAssistantLocale("es"));

describe("formatDuration", () => {
  it("milisegundos y segundos con decimal bajo 10 s", () => {
    expect(formatDuration(820)).toBe("820 ms");
    expect(formatDuration(3400)).toBe("3.4 s");
  });

  it("acarrea al minuto en vez de imprimir 60 s", () => {
    expect(formatDuration(59_700)).toBe("1 m 00 s");
    expect(formatDuration(119_600)).toBe("2 m 00 s");
  });

  it("minutos y segundos", () => {
    expect(formatDuration(72_000)).toBe("1 m 12 s");
    expect(formatDuration(3_601_000)).toBe("60 m 01 s");
  });
});

describe("formatTokens", () => {
  it("agrupa miles con el separador del IDIOMA DE LA APP (no el del dispositivo)", () => {
    expect(formatTokens(8595, "es")).toBe("8.595");
    expect(formatTokens(1_234_567, "es")).toBe("1.234.567");
    expect(formatTokens(8595, "en")).toBe("8,595");
    expect(formatTokens(999, "en")).toBe("999");
  });

  it("sin `lang` usa el idioma activo publicado por la pantalla", () => {
    setAssistantLocale("en");
    expect(formatTokens(8595)).toBe("8,595");
    setAssistantLocale("es");
    expect(formatTokens(8595)).toBe("8.595");
  });
});

describe("formatTime", () => {
  const ts = new Date(2026, 6, 14, 15, 5).getTime(); // 15:05 hora local

  it("12h con AM/PM en inglés y 24h en español", () => {
    expect(formatTime(ts, "en")).toMatch(/\b(AM|PM)\b/i);
    expect(formatTime(ts, "es")).toBe("15:05");
  });

  it("sin `lang` usa el idioma activo", () => {
    setAssistantLocale("en");
    expect(formatTime(ts)).toMatch(/\b(AM|PM)\b/i);
  });
});

describe("formatShortDate", () => {
  const ts = new Date(2026, 6, 14, 15, 5).getTime();

  it("respeta el orden de campos del idioma de la app", () => {
    expect(formatShortDate(ts, "es")).toBe("14/07/2026");
    expect(formatShortDate(ts, "en")).toBe("07/14/2026");
    expect(formatShortDate(ts, "ja")).toBe("2026/07/14");
  });
});

describe("relativeDate", () => {
  const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

  it("devuelve el `justNow` que le pasan bajo el minuto", () => {
    expect(relativeDate(iso(30_000), "ahora", "es")).toBe("ahora");
  });

  it("unidades traducidas (ya no 'min'/'h'/'d' fijos)", () => {
    expect(relativeDate(iso(5 * 60_000), "ahora", "es")).toBe("5 min");
    expect(relativeDate(iso(3 * 3_600_000), "ahora", "es")).toBe("3 h");
    expect(relativeDate(iso(2 * 86_400_000), "ahora", "es")).toBe("2 d");
    expect(relativeDate(iso(3 * 3_600_000), "now", "ja")).toBe("3 時間");
    expect(relativeDate(iso(2 * 86_400_000), "now", "fr")).toBe("2 j");
    expect(relativeDate(iso(5 * 60_000), "now", "ru")).toBe("5 мин");
  });

  it("más de 7 días: fecha corta en el formato del idioma", () => {
    const old = new Date(2026, 0, 20, 10, 0).toISOString();
    expect(relativeDate(old, "ahora", "es")).toBe("20/01/2026");
    expect(relativeDate(old, "now", "en")).toBe("01/20/2026");
  });

  it("entradas vacías o no parseables", () => {
    expect(relativeDate(undefined, "ahora")).toBe("");
    expect(relativeDate("no-es-fecha", "ahora")).toBe("");
  });
});

describe("compactionLabel", () => {
  it("interpola el nº de mensajes resumidos en el idioma activo", () => {
    expect(compactionLabel(12, "es")).toBe("12 mensajes anteriores resumidos");
    expect(compactionLabel(12, "en")).toBe("12 earlier messages summarized");
    expect(compactionLabel(12, "ja")).toContain("12");
  });

  it("sin nº conocido cae a 'conversación compactada'", () => {
    expect(compactionLabel(0, "en")).toBe("Conversation compacted");
    expect(compactionLabel(0, "es")).toBe("Conversación compactada");
  });
});

describe("stripCompactionMarker", () => {
  it("quita el marcador inicial en CUALQUIER idioma (el backend lo emite en el del hilo)", () => {
    expect(stripCompactionMarker("[Resumen de la conversación previa]\nHola")).toBe("Hola");
    expect(stripCompactionMarker("[Summary of the previous conversation (12 msgs)] Hi")).toBe("Hi");
    expect(stripCompactionMarker("[以前の会話の要約]\n概要")).toBe("概要");
  });

  it("no toca un cuerpo sin marcador", () => {
    expect(stripCompactionMarker("Resumen sin corchetes")).toBe("Resumen sin corchetes");
    expect(stripCompactionMarker("")).toBe("");
  });
});

describe("messageKeys", () => {
  const msg = (role: "user" | "assistant", createdAt?: number, content = ""): ChatMsg => ({ role, content, createdAt });

  it("clave estable por mensaje aunque cambie su posición (compactación)", () => {
    const before = [msg("user", 1), msg("assistant", 1), msg("user", 2), msg("assistant", 2)];
    const keysBefore = messageKeys(before);
    // Compactación: los dos primeros turnos se pliegan en un divisor nuevo.
    const after = [msg("assistant", 9, "[Resumen]"), msg("user", 2), msg("assistant", 2)];
    const keysAfter = messageKeys(after);
    expect(keysAfter.slice(1)).toEqual(keysBefore.slice(2));
    expect(keysAfter[0]).not.toBe(keysBefore[0]);
  });

  it("misma clave entre deltas del stream (el reducer conserva createdAt)", () => {
    const t0 = [msg("user", 5, "hola"), { ...msg("assistant", 5, ""), pending: true }];
    const t1 = [msg("user", 5, "hola"), { ...msg("assistant", 5, "resp"), pending: true }];
    expect(messageKeys(t1)).toEqual(messageKeys(t0));
  });

  it("usuario y asistente del mismo turno no colisionan", () => {
    const keys = messageKeys([msg("user", 7), msg("assistant", 7)]);
    expect(new Set(keys).size).toBe(2);
  });

  it("mensajes sin createdAt siguen siendo únicos", () => {
    const keys = messageKeys([msg("assistant"), msg("assistant"), msg("user")]);
    expect(new Set(keys).size).toBe(3);
  });
});

describe("turnRevision", () => {
  const live = (): ChatMsg => ({ role: "assistant", content: "", pending: true, tools: [], createdAt: 1 });

  it("no cambia si el turno no cambia (el memo debe SALTARSE el re-render)", () => {
    const m = live();
    expect(turnRevision(m)).toBe(turnRevision(m));
    expect(turnRevision({ ...m })).toBe(turnRevision(m));
  });

  it("cambia con cada delta de texto aunque el objeto sea EL MISMO (el reducer lo muta en sitio)", () => {
    const m = live();
    const before = turnRevision(m);
    m.content += "hola"; // exactamente lo que hace `applyAssistantEvent`
    expect(turnRevision(m)).not.toBe(before);
  });

  it("cambia al abrir una herramienta, al crecer su salida y al terminarla", () => {
    const m = live();
    const r0 = turnRevision(m);
    m.tools!.push({ id: "t1", name: "bash", output: "" });
    const r1 = turnRevision(m);
    expect(r1).not.toBe(r0);
    m.tools![0].output += "línea";
    const r2 = turnRevision(m);
    expect(r2).not.toBe(r1);
    m.tools![0].done = true;
    m.tools![0].success = true;
    expect(turnRevision(m)).not.toBe(r2);
  });

  it("dos herramientas en paralelo: la salida de la 2ª no se confunde con la de la 1ª", () => {
    const m = live();
    m.tools!.push({ id: "a", name: "read", output: "xx" }, { id: "b", name: "grep", output: "" });
    const before = turnRevision(m);
    m.tools![1].output += "xx"; // misma longitud que la 1ª, pero en otro bloque
    expect(turnRevision(m)).not.toBe(before);
  });

  it("cambia al asentar el turno (pending → false, duración y tokens)", () => {
    const m = live();
    const before = turnRevision(m);
    const settled: ChatMsg = { ...m, pending: false, durationMs: 820, tokens: { input: 10, output: 5, total: 15 } };
    expect(turnRevision(settled)).not.toBe(before);
  });

  it("cambia con el gate de permisos, las preguntas, el estado y los errores", () => {
    const base = live();
    const r = turnRevision(base);
    expect(turnRevision({ ...base, permission: { id: "p1", tool: "bash", title: "?" } })).not.toBe(r);
    expect(turnRevision({ ...base, ask: [{ id: "q1", text: "¿?", type: "text" }] })).not.toBe(r);
    expect(turnRevision({ ...base, status: "translating" })).not.toBe(r);
    expect(turnRevision({ ...base, error: "boom" })).not.toBe(r);
    expect(turnRevision({ ...base, translationError: "sin traducir" })).not.toBe(r);
    expect(turnRevision({ ...base, stopped: true })).not.toBe(r);
    expect(turnRevision({ ...base, interrupted: true })).not.toBe(r);
    expect(turnRevision({ ...base, summarizedCount: 3 })).not.toBe(r);
  });

  it("resolver el permiso (permission → null) también cambia la firma", () => {
    const m: ChatMsg = { ...live(), permission: { id: "p1", tool: "bash", title: "?" } };
    const before = turnRevision(m);
    m.permission = null; // `permission_resolved` muta el turno vivo en sitio
    expect(turnRevision(m)).not.toBe(before);
  });

  it("INVARIANTE del memo: en un delta, los turnos ANTERIORES no cambian de firma", () => {
    const history: ChatMsg[] = [
      { role: "user", content: "hola", createdAt: 1 },
      { role: "assistant", content: "respuesta previa", createdAt: 2, tokens: { input: 1, output: 2, total: 3 } },
      { role: "user", content: "otra", createdAt: 3 },
    ];
    const liveTurn = live();
    const msgs = [...history, liveTurn];
    const before = msgs.map(turnRevision);
    liveTurn.content += "token";
    const after = msgs.map(turnRevision);
    // Los 3 primeros turnos: misma firma Y misma identidad ⇒ React.memo los salta.
    expect(after.slice(0, 3)).toEqual(before.slice(0, 3));
    // El turno vivo: firma nueva ⇒ se re-renderiza SOLO él.
    expect(after[3]).not.toBe(before[3]);
  });
});
