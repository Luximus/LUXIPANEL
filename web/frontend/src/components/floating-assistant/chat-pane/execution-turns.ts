// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ChatTurn } from "../chat-engine";
import { isTeamNotice } from "./team-execution";

export interface ExecutionTurn {
  /** Stable surface identity while automatic phases append to this execution. */
  firstIndex: number;
  index: number;
  indices: number[];
  turn: ChatTurn;
  phases: ChatTurn[];
}

/** Presentation only: transport identity, stored history and model context stay
 * untouched. A human request or compaction always starts a separate surface. */
export function groupExecutionTurns(turns: ChatTurn[]): ExecutionTurn[] {
  const result: ExecutionTurn[] = [];
  for (let index = 0; index < turns.length; index++) {
    const turn = turns[index]!;
    if (isTeamNotice(turn)) continue;
    const previous = result.at(-1);
    if (turn.role === "assistant" && !turn.compacted && previous?.turn.role === "assistant" && !previous.turn.compacted) {
      previous.phases.push(previous.turn);
      previous.indices.push(index);
      previous.index = index;
      previous.turn = turn;
    } else {
      result.push({ firstIndex: index, index, indices: [index], turn, phases: [] });
    }
  }
  return result.map(entry => {
    if (!entry.phases.length) return entry;
    const phases = [...entry.phases, entry.turn];
    const usages = phases.flatMap(phase => phase.tokens ? [phase.tokens] : []);
    const durations = phases.flatMap(phase => typeof phase.durationMs === "number" ? [phase.durationMs] : []);
    return { ...entry, turn: { ...entry.turn,
      ...(usages.length ? { tokens: {
        input: usages.reduce((sum, usage) => sum + usage.input, 0),
        output: usages.reduce((sum, usage) => sum + usage.output, 0),
        total: usages.reduce((sum, usage) => sum + usage.total, 0),
        estimated: usages.some(usage => usage.estimated),
      } } : {}),
      ...(durations.length ? { durationMs: durations.reduce((sum, duration) => sum + duration, 0) } : {}),
    } };
  });
}
