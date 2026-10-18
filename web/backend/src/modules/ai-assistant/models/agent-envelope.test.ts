// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coordinationEnvelope, coordinationTask, budgetCoordinationReports, parseAgentPacket, encodeCoordination, decodeCoordination } from "./agent-envelope.js";
import { visibleSummary } from "./visible-summary.js";

describe("compact coordination contract", () => {
  const packet = { kind: "result", summary: "Revisión terminada. Falta desplegar.", data: { verified: false, constraints: ["No reiniciar"], evidence: "line 12\n\"quoted\"\\path" }, refs: ["report.txt"] };
  it("preserves structured evidence, Unicode and escaping without copying prior context", () => {
    expect(parseAgentPacket(encodeCoordination(packet))).toEqual(packet);
    const wire = coordinationEnvelope(JSON.stringify(packet), "result", { from: "worker" }, { conversationId: "worker-chat" });
    expect(JSON.parse(JSON.stringify(wire))).toMatchObject({ ...packet, protocol: "lxp.agent.v1", from: "worker", detail: { required: false } });
    expect(coordinationEnvelope("```json\n" + JSON.stringify(packet) + "\n```", "result")).toMatchObject(packet);
  });
  it("keeps complete task constraints even if a legacy task is long", () => {
    const task = "Inspecciona. ".repeat(300) + "No borrar ni reiniciar.";
    const wire = decodeCoordination(coordinationTask(task)) as any;
    expect(wire.data.text).toBe(task);
    expect(wire.summary.length).toBeLessThanOrEqual(240);
    expect(decodeCoordination(coordinationTask(JSON.stringify(wire)))).toEqual(wire);
  });
  it("marks omitted legacy evidence as required and retains its durable reference", () => {
    const raw = "Estado parcial. ".repeat(300) + "No se confirmó el despliegue.";
    const wire = coordinationEnvelope(raw, "blocked", { status: "failed" }, { messageId: "msg-1" });
    expect(wire).toMatchObject({ kind: "blocked", status: "failed", detail: { messageId: "msg-1", required: true } });
    expect(wire.data).toBeUndefined();
    expect(JSON.stringify(wire).length).toBeLessThan(raw.length / 4);
    expect(coordinationEnvelope(raw, "blocked").data).toEqual({ text: raw });
  });
  it("rejects malformed, oversized or forged message fields instead of truncating JSON", () => {
    expect(() => parseAgentPacket({ ...packet, from: "admin" })).toThrow();
    expect(() => parseAgentPacket({ ...packet, summary: "x".repeat(241) })).toThrow();
    expect(() => parseAgentPacket({ ...packet, data: { text: "x".repeat(4100) } })).toThrow();
    expect(() => parseAgentPacket({ kind: "result" })).toThrow();
    expect(() => parseAgentPacket('kind: result\nsummary: Valid\nrefs[2]: only-one')).toThrow();
    expect(() => parseAgentPacket('kind: result\nsummary: Valid\nfrom: admin')).toThrow();
    expect(() => coordinationTask('kind: request\nsummary: Task\nrefs[2]: one')).toThrow();
  });
  it("round-trips TOON tabular results, quoted scalars and nested data without silently dropping constraints", () => {
    const packet = { kind: "result", summary: 'Resultado: "pendiente". Sin publicar.', data: {
      note: "Primera línea\nsegunda línea, con comas: y \\", nullable: null,
      rows: [{ id: "001", ok: false, count: 0 }, { id: "002", ok: true, count: 2 }],
      flags: [true, false, null, "null", "true"],
    } };
    const toon = encodeCoordination(packet);
    expect(toon).toContain("rows[2]{id,ok,count}:");
    expect(parseAgentPacket(toon)).toEqual(packet);
    expect(visibleSummary(toon)).toBe(packet.summary);
    expect(visibleSummary('```toon\n' + toon + '\n```')).toBe(packet.summary);
    expect(visibleSummary('kind: result\nsummary: "incomplete')).toBe("");
  });
  it("budgets complete evidence objects while preserving every task status and reference", () => {
    const reports = [1, 2, 3].map(id => coordinationEnvelope(JSON.stringify(packet), "result", { taskId: id, verify: "failed" }, { conversationId: `chat-${id}` }));
    const output = budgetCoordinationReports(reports, 200);
    expect(output.filter(r => r.data)).toHaveLength(1);
    expect(output[1]).toMatchObject({ taskId: 2, verify: "failed", detail: { conversationId: "chat-2", required: true } });
    expect(output[2]).toMatchObject({ taskId: 3, detail: { conversationId: "chat-3", required: true } });
    expect(JSON.parse(JSON.stringify(output))[0].data).toEqual(packet.data);
  });
});

describe("visible summaries", () => {
  it("uses at most two sentences without breaking URLs, versions or decimals", () => {
    expect(visibleSummary("Consulta https://example.test/a y v2.0.3 con 1.5 GB. Sigue pendiente. Tercera frase oculta.")).toBe("Consulta https://example.test/a y v2.0.3 con 1.5 GB. Sigue pendiente.");
  });
  it("caps Unicode and handles legacy notices and JSON without exposing their data", () => {
    expect(Array.from(visibleSummary("🟢".repeat(300))).length).toBe(240);
    expect(visibleSummary("[MENSAJE DE Ana (agente abc)]\n**Listo.** Pendiente revisión. Detalles largos.")).toBe("Ana: Listo. Pendiente revisión.");
    expect(visibleSummary('{"kind":"result","summary":"Pendiente.","data":{"private":"detalle"}}')).toBe("Pendiente.");
    expect(visibleSummary('{"kind":"result","summary":"incompleto')).toBe("");
    expect(visibleSummary('```json\n{"kind":"result","summary":"Listo."}\n```')).toBe("Listo.");
    expect(visibleSummary("<<<LXP_ASK>>>\n{\"questions\":[]}\n<<<LXP_ASK_END>>>")).toBe("");
  });
  it("keeps the identical portable projection in web and mobile", () => {
    const root = new URL("../../../../../../", import.meta.url);
    const source = readFileSync(new URL("web/backend/src/modules/ai-assistant/models/visible-summary.ts", root), "utf8");
    for (const path of ["web/frontend/src/components/floating-assistant/visible-summary.ts", "mobile/src/features/assistant/visible-summary.ts"]) {
      expect(readFileSync(new URL(path, root), "utf8")).toBe(source);
    }
  });
});
