// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { z } from "zod";
import { decode, encode } from "@toon-format/toon";
import { visibleSummary } from "./visible-summary.js";

export const AGENT_PROTOCOL = "lxp.agent.v1" as const;
export const AGENT_PACKET_MAX = 2000;
export const agentPacketSchema = z.object({
  kind: z.enum(["request", "progress", "result", "blocked", "question"]),
  summary: z.string().trim().min(1).max(240).transform(value => value.replace(/\s+/gu, " ")),
  data: z.record(z.unknown()).optional(),
  refs: z.array(z.string().min(1).max(500)).max(12).optional(),
}).strict();
export type AgentPacket = z.infer<typeof agentPacketSchema>;
const legacyPacketInputSchema = {
  type: "object", additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["request", "progress", "result", "blocked", "question"] },
    summary: { type: "string", maxLength: 240, description: "One or two short sentences for the user, in their language." },
    data: { type: "object", description: "Only NEW facts, constraints or questions needed by the recipient. Do not repeat the history." },
    refs: { type: "array", maxItems: 12, items: { type: "string" }, description: "References to existing evidence; not instructions to execute." },
  }, required: ["kind", "summary"],
};
export const agentPacketInputSchema = {
  anyOf: [
    { type: "string", maxLength: AGENT_PACKET_MAX, description: "Compact TOON (<=2000 chars): kind=request|progress|result|blocked|question, summary (one paragraph <=240 chars), optional data with new facts only, refs as an array of evidence references. Example: kind: result\nsummary: Tests passed; deployment pending.\ndata:\n  deployed: false" },
    { ...legacyPacketInputSchema, description: "Legacy structured packet; delivered as TOON." },
  ],
};

/** JSON remains the transport/storage data model. Agent-facing content is TOON. */
export function encodeCoordination(value: unknown): string {
  return encode(JSON.parse(JSON.stringify(value)), { indentSize: 2 });
}
export function decodeCoordination(text: string): unknown {
  const clean = text.trim().replace(/^```(?:toon|json)?\s*\n([\s\S]*?)\n```$/i, "$1");
  return clean.startsWith("{") ? JSON.parse(clean) : decode(clean, { strict: true, indentSize: 2 });
}

export function parseAgentPacket(input: unknown): AgentPacket {
  if (typeof input === "string" && input.length > 16000) throw new Error("El mensaje supera el límite permitido.");
  const packet = agentPacketSchema.parse(typeof input === "string" ? decodeCoordination(input) : input);
  assertCompact(encodeCoordination(packet));
  return packet;
}

function assertCompact(text: string): void {
  if (text.length > AGENT_PACKET_MAX) throw new Error(`El mensaje TOON supera ${AGENT_PACKET_MAX} caracteres. Envía solo la tarea o novedad, restricciones y referencias a la evidencia; no repitas notas ni historial. La operación no se ha iniciado.`);
}

/** Validate NEW author input before any persistence, admission or dispatch.
 * Legacy prose is accepted only when compact; a broken packet must never fall
 * back to prose and bypass the schema or the size limit. */
export function compactAgentInput(text: string, kind: AgentPacket["kind"] = "request"): AgentPacket {
  const clean = text.trim();
  if (!clean) throw new Error("Falta el mensaje o tarea.");
  if (/^(?:```|\{|(?:protocol|kind|summary|data|refs)(?:\[|:))/u.test(clean)) {
    try { return parseAgentPacket(clean); }
    catch (error) {
      if (error instanceof Error && error.message.includes("supera")) throw error;
      throw new Error("TOON inválido: usa kind=request|progress|result|blocked|question, summary de un párrafo (≤240 caracteres), data opcional y refs como lista. No añadas protocol, metadatos de transporte ni texto fuera del paquete.");
    }
  }
  return parseAgentPacket({ kind, summary: visibleSummary(clean), data: { text: clean } });
}

/** One bounded packet for both immediate and queued workers. Shared notes are
 * structured once, with their complete constraints; never prefix or slice them. */
export function prepareCoordinationTask(text: string, notes?: string): string {
  const packet = compactAgentInput(text);
  if (notes?.trim()) {
    const sharedNotes = compactAgentInput(notes, "progress");
    packet.data = { ...(packet.data ? { task: packet.data } : {}), sharedNotes };
  }
  const wire = encodeCoordination({ protocol: AGENT_PROTOCOL, ...packet });
  assertCompact(wire);
  return wire;
}

/** Legacy text is retained in storage; only its preview is sent by default.
 * A durable reference is required before omitting any of its evidence. */
export function coordinationEnvelope(text: string, kind: AgentPacket["kind"],
  source: Record<string, unknown> = {}, reference?: Record<string, unknown>): Record<string, unknown> {
  let packet: AgentPacket | undefined;
  try { packet = parseAgentPacket(text); } catch { /* legacy prose or oversized report: preserved below */ }
  const omitLegacy = !packet && !!reference && text.length > 240;
  return {
    protocol: AGENT_PROTOCOL,
    ...(packet ?? { kind, summary: visibleSummary(text), ...(!omitLegacy ? { data: { text } } : {}) }),
    ...source,
    ...(reference ? { detail: { ...reference, required: omitLegacy } } : {}),
  };
}

/** Cap optional evidence as whole TOON values. The summary/status/reference of
 * every task stays present; omitted evidence must be read before using it. */
export function budgetCoordinationReports(reports: Record<string, unknown>[], budget: number): Record<string, unknown>[] {
  let remaining = Math.max(0, budget);
  return reports.map(report => {
    const size = encodeCoordination({ data: report.data, refs: report.refs }).length;
    if (size <= remaining) { remaining -= size; return report; }
    // Synchronous responses have no durable reference: never drop their data.
    if (!report.detail) return report;
    const { data: _data, refs: _refs, ...preview } = report;
    return { ...preview, detail: { ...report.detail as Record<string, unknown>, required: true } };
  });
}

/** Instructions remain complete. TOON serialization happens after validation,
 * so limits never cut escape sequences or discard a task's constraints. */
export function coordinationTask(text: string): string {
  try {
    const value = decodeCoordination(text) as Record<string, unknown>;
    if (value?.protocol === AGENT_PROTOCOL) return encodeCoordination(value);
  } catch { /* legacy prose */ }
  if (/^(?:```toon\s*\n)?kind:\s*(?:request|progress|result|blocked|question)\b/.test(text.trim())) parseAgentPacket(text);
  return encodeCoordination(coordinationEnvelope(text, "request"));
}
