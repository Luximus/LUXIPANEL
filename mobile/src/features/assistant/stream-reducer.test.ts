// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests del reductor puro de eventos SSE del asistente (fase A2). Los casos
// reconstruyen la semántica del handler inline original de ServerAssistantPane.
import { describe, expect, it } from "vitest";
import { applyAssistantEvent, eventSignalsMcpExpired } from "./stream-reducer";
import type { ChatMsg } from "./types";

/** Turno vivo (pendiente) al final de la conversación, como lo siembra `send()`. */
function pendingTurn(extra?: Partial<ChatMsg>): ChatMsg[] {
  return [
    { role: "user", content: "hola" },
    { role: "assistant", content: "", pending: true, tools: [], ...extra },
  ];
}
const last = (msgs: ChatMsg[]) => msgs[msgs.length - 1]!;

it("stores a live summary without replacing the full answer and clears it for pending work", () => {
  const content = "Respuesta íntegra. ".repeat(100);
  const saved = applyAssistantEvent(pendingTurn({ content }), { type: "done", displaySummary: "Resultado breve." }).msgs;
  expect(last(saved)).toMatchObject({ content, displaySummary: "Resultado breve." });
  const pending = applyAssistantEvent(pendingTurn({ content, displaySummary: "anterior" }), { type: "done", pending: true }).msgs;
  expect(last(pending).displaySummary).toBeUndefined();
});

describe("applyAssistantEvent — deltas de texto", () => {
  it("acumula deltas sucesivos en el contenido del turno vivo", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "text", delta: "Hola" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "text", delta: ", mundo" }).msgs;
    expect(last(msgs).content).toBe("Hola, mundo");
  });

  it("ignora eventos si el último mensaje no está pendiente (misma referencia)", () => {
    const msgs: ChatMsg[] = [{ role: "assistant", content: "listo" }];
    const out = applyAssistantEvent(msgs, { type: "text", delta: "x" });
    expect(out.msgs).toBe(msgs); // sin re-render: referencia intacta
    expect(msgs[0]!.content).toBe("listo");
  });

  it("con tool CLI abierto, los deltas van a la consola del tool, no a la burbuja", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t1", name: "claude.cli" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "text", delta: "$ ls\n" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "text", delta: "src\n" }).msgs;
    expect(last(msgs).content).toBe("");
    expect(last(msgs).tools?.[0]?.output).toBe("$ ls\nsrc\n");
  });
});

describe("applyAssistantEvent — apertura/cierre de tool block", () => {
  it("tool_use abre un bloque y tool_result lo cierra con salida y éxito", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t1", name: "servers.exec", input: { cmd: "uptime" } }).msgs;
    expect(last(msgs).tools).toHaveLength(1);
    expect(last(msgs).tools?.[0]).toMatchObject({ id: "t1", name: "servers.exec", output: "", input: { cmd: "uptime" } });
    expect(last(msgs).tools?.[0]?.done).toBeUndefined();
    msgs = applyAssistantEvent(msgs, { type: "tool_result", id: "t1", success: true, output: "up 3 days" }).msgs;
    expect(last(msgs).tools?.[0]).toMatchObject({ done: true, success: true, output: "up 3 days" });
  });

  it("tool_use es idempotente por id (re-emisión al reanudar un run)", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t1", name: "servers.exec" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t1", name: "servers.exec" }).msgs;
    expect(last(msgs).tools).toHaveLength(1);
  });

  it("tool_result sin id casa con el último tool abierto", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t1", name: "a" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t2", name: "b" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "tool_result", success: false, output: "boom" }).msgs;
    expect(last(msgs).tools?.[1]).toMatchObject({ id: "t2", done: true, success: false, output: "boom" });
    expect(last(msgs).tools?.[0]?.done).toBeUndefined();
  });

  it("tool_result con id desconocido NO se aplica a otro tool", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t1", name: "a" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "tool_result", id: "fantasma", success: true, output: "no es mío" }).msgs;
    expect(last(msgs).tools?.[0]?.done).toBeUndefined();
    expect(last(msgs).tools?.[0]?.output).toBe("");
  });

  it("dos tools en paralelo: cada tool_result cierra el SUYO por id", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t1", name: "a" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t2", name: "b" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "tool_result", id: "t1", success: true, output: "salida A" }).msgs;
    expect(last(msgs).tools?.[0]).toMatchObject({ id: "t1", done: true, output: "salida A" });
    expect(last(msgs).tools?.[1]?.done).toBeUndefined();
    // El result sin id cae en el que sigue ABIERTO, no en el último a secas.
    msgs = applyAssistantEvent(msgs, { type: "tool_result", success: true, output: "salida B" }).msgs;
    expect(last(msgs).tools?.[1]).toMatchObject({ id: "t2", done: true, output: "salida B" });
    expect(last(msgs).tools?.[0]?.output).toBe("salida A");
  });

  it("tool_use sin id: cada uno abre su propio bloque (ids únicos)", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "tool_use", name: "a" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "tool_use", name: "b" }).msgs;
    const tools = last(msgs).tools ?? [];
    expect(tools).toHaveLength(2);
    expect(tools[0]?.id).not.toBe(tools[1]?.id);
  });

  it("output no-string no revienta el reductor (se serializa)", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t1", name: "servers.exec" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "tool_result", id: "t1", success: true, output: { rows: 2 } as never }).msgs;
    expect(last(msgs).tools?.[0]).toMatchObject({ done: true, output: '{"rows":2}' });
  });

  it("tool_result .cli con output no-string no lo promociona como texto crudo roto", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t1", name: "claude.cli" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "tool_result", id: "t1", success: true, output: undefined }).msgs;
    expect(last(msgs).content).toBe("");
  });

  it("tool_result de un tool .cli promociona la respuesta limpia a la burbuja", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t1", name: "claude.cli" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "text", delta: "salida cruda del terminal" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "tool_result", id: "t1", success: true, output: "Respuesta final." }).msgs;
    expect(last(msgs).content).toBe("Respuesta final.");
    // La consola cruda queda en el bloque del tool.
    expect(last(msgs).tools?.[0]?.output).toBe("salida cruda del terminal");
  });

  it("tool_result .cli ignora placeholders \"[…]\" y no pisa la burbuja", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "tool_use", id: "t1", name: "codex.cli" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "tool_result", id: "t1", success: true, output: "[sin salida]" }).msgs;
    expect(last(msgs).content).toBe("");
  });
});

describe("applyAssistantEvent — usage", () => {
  it("acumula tokens del turno y propaga el flag estimated", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "usage", inputTokens: 10, outputTokens: 5 }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "usage", inputTokens: 2, outputTokens: 3, estimated: true }).msgs;
    expect(last(msgs).tokens).toEqual({ input: 12, output: 8, total: 20, estimated: true });
  });
});

describe("applyAssistantEvent — ask / permisos", () => {
  it("ask guarda las preguntas y limpia el estado transitorio", () => {
    let msgs = pendingTurn({ status: "working" });
    const questions = [{ id: "q1", text: "¿Continuar?", type: "single" as const, options: ["Sí", "No"] }];
    msgs = applyAssistantEvent(msgs, { type: "ask", questions }).msgs;
    expect(last(msgs).ask).toEqual(questions);
    expect(last(msgs).status).toBeUndefined();
  });

  it("ask conserva la marca de aprobación estructurada del plan", () => {
    const questions = [{ id: "plan", text: "¿Apruebas?", type: "single" as const, options: ["Aprobar", "Cambios"] }];
    const msgs = applyAssistantEvent(pendingTurn(), { type: "ask", kind: "plan-approval", questions }).msgs;
    expect(last(msgs)).toMatchObject({ ask: questions, askKind: "plan-approval" });
  });

  it("permission_request pinta el gate y permission_resolved lo limpia por id", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "permission_request", id: "p1", tool: "Bash", title: "rm -rf /tmp/x" }).msgs;
    expect(last(msgs).permission).toEqual({ id: "p1", tool: "Bash", title: "rm -rf /tmp/x", detail: undefined });
    // Otro id NO lo limpia…
    msgs = applyAssistantEvent(msgs, { type: "permission_resolved", id: "otro" }).msgs;
    expect(last(msgs).permission).not.toBeNull();
    // …el mismo id sí.
    msgs = applyAssistantEvent(msgs, { type: "permission_resolved", id: "p1" }).msgs;
    expect(last(msgs).permission).toBeNull();
  });

  it("permission_resolved sin id limpia cualquier gate pendiente", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "permission_request", id: "p1", tool: "Bash", title: "x" }).msgs;
    msgs = applyAssistantEvent(msgs, { type: "permission_resolved" }).msgs;
    expect(last(msgs).permission).toBeNull();
  });
});

describe("applyAssistantEvent — status / errores / done", () => {
  it("status working/translating actualiza el estado transitorio; otros lo conservan", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "status", state: "working" }).msgs;
    expect(last(msgs).status).toBe("working");
    msgs = applyAssistantEvent(msgs, { type: "status", state: "translating" }).msgs;
    expect(last(msgs).status).toBe("translating");
    msgs = applyAssistantEvent(msgs, { type: "status", state: "desconocido" }).msgs;
    expect(last(msgs).status).toBe("translating");
  });

  it("translation_error deja aviso colapsable; error marca el error duro del turno", () => {
    let msgs = pendingTurn();
    msgs = applyAssistantEvent(msgs, { type: "translation_error", message: "timeout DeepL" }).msgs;
    expect(last(msgs).translationError).toBe("timeout DeepL");
    msgs = applyAssistantEvent(msgs, { type: "error", message: "proceso abortado" }).msgs;
    expect(last(msgs).error).toBe("proceso abortado");
  });

  it("done no altera los mensajes (el cierre del turno lo hace el pane)", () => {
    const msgs = pendingTurn();
    const out = applyAssistantEvent(msgs, { type: "done" });
    expect(last(out.msgs)).toMatchObject({ content: "", pending: true });
  });
});

describe("efectos — MCP_SESSION_EXPIRED", () => {
  it("detecta errores reales sin confundir texto o lecturas correctas", () => {
    expect(eventSignalsMcpExpired({ type: "text", delta: "x MCP_SESSION_EXPIRED y" })).toBe(false);
    expect(eventSignalsMcpExpired({ type: "tool_result", id: "t", success: false, output: "MCP_SESSION_EXPIRED" })).toBe(true);
    expect(eventSignalsMcpExpired({ type: "error", message: "MCP_SESSION_EXPIRED" })).toBe(true);
    expect(eventSignalsMcpExpired({ type: "text", delta: "todo bien" })).toBe(false);
  });

  it("applyAssistantEvent expone el efecto aunque no haya turno pendiente", () => {
    const msgs: ChatMsg[] = [{ role: "assistant", content: "fin" }];
    const out = applyAssistantEvent(msgs, { type: "error", message: "MCP_SESSION_EXPIRED" });
    expect(out.effects).toEqual({ mcpExpired: true });
    expect(out.msgs).toBe(msgs);
  });
});
