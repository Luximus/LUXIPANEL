// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { persistedWorkerOutcome } from "./persisted-outcome.js";
import type { ConversationMessage } from "../../repositories/conversations.repository.js";

const answer: ConversationMessage = { role: "assistant", content: "Ajuste verificado", ts: new Date().toISOString() };
describe("persisted worker result", () => {
  it.each([
    { error: "Sin respuesta del servidor", expected: "failed" },
    { interrupted: true, expected: "canceled" },
    { pending: true, expected: null },
    { ask: [{ id: "q1", type: "text" as const, text: "Destino" }], expected: null },
  ])("honors structured state $expected even when prose exists", ({ expected, ...patch }) => {
    const outcome = persistedWorkerOutcome([{ ...answer, ...patch }]);
    expect(outcome?.status ?? null).toBe(expected);
  });
  it("does not reuse an older answer for an unanswered request", () => {
    expect(persistedWorkerOutcome([answer, { role: "user", content: "Ahora despliega", ts: answer.ts }])).toBeUndefined();
  });
  it("accepts a real completed answer and rejects empty evidence", () => {
    expect(persistedWorkerOutcome([answer])).toEqual({ status: "done", resultSummary: answer.content });
    expect(persistedWorkerOutcome([{ ...answer, content: "" }])).toBeUndefined();
  });
});
