// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { z } from "zod";
import { decode, encode } from "@toon-format/toon";
import { visibleSummary } from "./visible-summary.js";

export const AGENT_PROTOCOL = "lxp.agent.v1" as const;
export const agentPacketSchema = z.object({
  kind: z.enum(["request", "progress", "result", "blocked", "question"]),
  summary: z.string().trim().min(1).max(240),
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
    { type: "string", maxLength: 16000, description: "TOON message with kind, summary (<=240 chars), optional data and refs. Example: kind: result\nsummary: Tests passed; deployment pending.\ndata:\n  deployed: false" },
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
  if (encodeCoordination(packet).length > 4000) throw new Error("El mensaje TOON supera 4000 caracteres; usa un resumen y referencias a la evidencia.");
  return packet;
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
