import { expect, it } from "vitest";
import type { ChatTurn } from "../chat-engine";
import { groupExecutionTurns } from "./execution-turns";

const request: ChatTurn = { role: "user", text: "Completar la tarea", tools: [] };
const notice: ChatTurn = { role: "user", text: "Informe del equipo", auto: true, tools: [] };
const reply: ChatTurn = { role: "assistant", text: "", tools: [] };

it("folds repeated automatic continuations from stored history without rewriting it", () => {
  const turns = [request, { ...reply, cli: true, completionPending: true, cliHistoryLog: "Inicio" }];
  for (let i = 0; i < 12; i++) turns.push(notice, { ...reply, cli: true, completionPending: true, cliHistoryLog: `Fase ${i}` });
  const before = JSON.stringify(turns);
  const groups = groupExecutionTurns(turns);
  expect(groups).toHaveLength(2);
  expect(groups[1]?.phases).toHaveLength(12);
  expect(groups[1]?.turn.completionPending).toBe(true);
  expect(groups[1]?.firstIndex).toBe(1);
  expect(JSON.stringify(turns)).toBe(before);
});

it("uses the latest outcome and totals usage once across phases", () => {
  const groups = groupExecutionTurns([request,
    { ...reply, error: "Fallo recuperable", tokens: { input: 2, output: 3, total: 5 }, durationMs: 1000 }, notice,
    { ...reply, text: "Trabajo verificado", tokens: { input: 7, output: 4, total: 11, estimated: true }, durationMs: 2000 },
  ]);
  expect(groups[1]?.turn).toMatchObject({ text: "Trabajo verificado", durationMs: 3000,
    tokens: { input: 9, output: 7, total: 16, estimated: true } });
  expect(groups[1]?.turn.error).toBeUndefined();
  expect(groups[1]?.phases[0]?.error).toBe("Fallo recuperable");
});

it("keeps human requests, actionable notices and compaction as separate boundaries", () => {
  const human = { ...notice, auto: false };
  const attention = { ...notice, error: "Aviso que necesita atención" };
  const compacted = { ...reply, compacted: true };
  const groups = groupExecutionTurns([request, reply, human, reply, attention, reply, compacted, reply]);
  expect(groups).toHaveLength(8);
  expect(groups.every(group => group.phases.length === 0)).toBe(true);
});

it("groups adjacent addendum responses and reloaded partial pages by the same boundaries", () => {
  const turns = [request, reply, { ...reply, text: "Segunda fase" }, notice, { ...reply, text: "Final" }];
  expect(groupExecutionTurns(turns.slice(2)).filter(group => group.turn.role === "assistant")).toHaveLength(1);
  const all = groupExecutionTurns(turns);
  expect(all.filter(group => group.turn.role === "assistant")).toHaveLength(1);
  expect(all[1]?.turn.text).toBe("Final");
  expect(all[1]?.phases).toHaveLength(2);
});
