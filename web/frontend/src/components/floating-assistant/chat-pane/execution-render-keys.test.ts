// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import type { ChatTurn } from "../chat-engine";
import type { ExecutionTurn } from "./execution-turns";
import { reconcileExecutionKeys } from "./execution-render-keys";

const turn = (messageId?: string, createdAt?: number): ChatTurn => ({ role: "assistant", text: "", tools: [], messageId, createdAt });
const group = (turns: ChatTurn[], firstIndex = 1): ExecutionTurn => ({
  firstIndex, index: firstIndex + turns.length - 1,
  indices: turns.map((_, i) => firstIndex + i), turn: turns.at(-1)!, phases: turns.slice(0, -1),
});

describe("execution surface identity", () => {
  it("retains a surface when a refreshed page changes message offsets", () => {
    const initial = reconcileExecutionKeys([group([turn("current")])]);
    const refreshed = reconcileExecutionKeys([group([turn("older")]), group([turn("current")], 3)], initial);
    expect(refreshed.rows[1]!.key).toBe(initial.rows[0]!.key);
    expect(refreshed.rows[0]!.key).not.toBe(initial.rows[0]!.key);
  });

  it("retains a multi-phase execution even if the first visible phase leaves the page", () => {
    const initial = reconcileExecutionKeys([group([turn("first"), turn("second")], 3)]);
    const refreshed = reconcileExecutionKeys([group([turn("second"), turn("third")], 0)], initial);
    expect(refreshed.rows[0]!.key).toBe(initial.rows[0]!.key);
  });

  it("uses a persisted identity despite changing text, timing and tool data", () => {
    const initial = reconcileExecutionKeys([group([turn("same", 10)])]);
    const final = { ...turn("same", 50), text: "Respuesta final", cliHistoryLog: "Registro" };
    expect(reconcileExecutionKeys([group([final])], initial).rows[0]!.key).toBe(initial.rows[0]!.key);
  });

  it("retains timestamped legacy messages and the later assignment of a durable id", () => {
    const initial = reconcileExecutionKeys([group([turn(undefined, 10)])]);
    const legacy = reconcileExecutionKeys([group([turn(undefined, 10)], 4)], initial);
    const identified = reconcileExecutionKeys([group([turn("assigned", 10)], 4)], legacy);
    expect(identified.rows[0]!.key).toBe(initial.rows[0]!.key);
  });

  it("does not substitute a different message with the same timestamp and offset", () => {
    const initial = reconcileExecutionKeys([group([turn("before", 10)])]);
    expect(reconcileExecutionKeys([group([turn("after", 10)])], initial).rows[0]!.key).not.toBe(initial.rows[0]!.key);
  });

  it("does not attach an old surface to a new request occupying the same slot", () => {
    const initial = reconcileExecutionKeys([group([turn("before")])]);
    expect(reconcileExecutionKeys([group([turn("after")])], initial).rows[0]!.key).not.toBe(initial.rows[0]!.key);
  });

  it("preserves a placeholder when its first identity arrives without shifting slots", () => {
    const initial = reconcileExecutionKeys([group([turn()])]);
    expect(reconcileExecutionKeys([group([turn("assigned", 10)])], initial).rows[0]!.key).toBe(initial.rows[0]!.key);
  });

  it("does not reuse one open surface for both halves of an ambiguous split", () => {
    const initial = reconcileExecutionKeys([group([turn("first"), turn("second")])]);
    const split = reconcileExecutionKeys([group([turn("first")]), group([turn("second")], 3)], initial);
    expect(new Set(split.rows.map(row => row.key)).size).toBe(2);
    expect(split.rows.every(row => row.key !== initial.rows[0]!.key)).toBe(true);
  });

  it("does not collapse a compaction divider into an assistant message", () => {
    const initial = reconcileExecutionKeys([group([turn("same", 10)])]);
    const compacted = { ...turn("same", 10), compacted: true };
    expect(reconcileExecutionKeys([group([compacted])], initial).rows[0]!.key).not.toBe(initial.rows[0]!.key);
  });
});
