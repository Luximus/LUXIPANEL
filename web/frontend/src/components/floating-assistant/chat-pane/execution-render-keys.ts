// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useState } from "react";
import type { ChatTurn } from "../chat-engine";
import type { ExecutionTurn } from "./execution-turns";

type Row = { key: number; group: ExecutionTurn };
type Keys = { rows: Row[]; nextKey: number };
const members = (group: ExecutionTurn) => [...group.phases, group.turn];
const id = (turn: ChatTurn) => turn.messageId?.trim()
  ? JSON.stringify([turn.role, !!turn.compacted, turn.messageId]) : undefined;
const stamp = (turn: ChatTurn) => typeof turn.createdAt === "number" && Number.isFinite(turn.createdAt)
  ? JSON.stringify([turn.role, !!turn.compacted, turn.createdAt]) : undefined;

/** UI identity only. Page offsets, streamed text and the latest phase are not
 * execution identities. Keep a surface through any uniquely matching phase;
 * never transfer an open console to a different message at the same offset. */
export function reconcileExecutionKeys(groups: ExecutionTurn[], previous?: Keys): Keys {
  const old = previous?.rows ?? [];
  const byId = new Map<string, Set<number>>();
  const byStamp = new Map<string, Array<{ key: number; turn: ChatTurn }>>();
  const byReference = new Map<ChatTurn, Set<number>>();
  for (const row of old) for (const turn of members(row.group)) {
    const identity = id(turn), timestamp = stamp(turn);
    if (identity) byId.set(identity, new Set([...(byId.get(identity) ?? []), row.key]));
    if (timestamp) byStamp.set(timestamp, [...(byStamp.get(timestamp) ?? []), { key: row.key, turn }]);
    byReference.set(turn, new Set([...(byReference.get(turn) ?? []), row.key]));
  }
  const unique = (keys: number[]) => {
    const values = new Set(keys);
    return values.size === 1 ? [...values][0] : undefined;
  };
  const matches = groups.map(group => {
    const turns = members(group);
    const identified = turns.flatMap(turn => [...(byId.get(id(turn) ?? "") ?? [])]);
    if (identified.length) return unique(identified);
    const references = turns.flatMap(turn => [...(byReference.get(turn) ?? [])]);
    if (references.length) return unique(references);
    // Timestamps preserve legacy messages and the first assignment of an id,
    // but cannot override two contradictory durable ids.
    return unique(turns.flatMap(turn => (byStamp.get(stamp(turn) ?? "") ?? [])
      .filter(candidate => !id(turn) || !id(candidate.turn) || id(turn) === id(candidate.turn))
      .map(candidate => candidate.key)));
  });
  const matchCounts = new Map<number, number>();
  for (const key of matches) if (key !== undefined) matchCounts.set(key, (matchCounts.get(key) ?? 0) + 1);
  let nextKey = previous?.nextKey ?? 0;
  const rows = groups.map((group, index) => {
    let key = matches[index];
    // An ambiguous split must not inherit the same controls in two bubbles.
    if (key !== undefined && matchCounts.get(key) !== 1) key = undefined;
    const prior = old[index];
    if (key === undefined && prior && old.length === groups.length && !matchCounts.has(prior.key)
      && prior.group.firstIndex === group.firstIndex && prior.group.turn.role === group.turn.role
      && !!prior.group.turn.compacted === !!group.turn.compacted
      && members(prior.group).every(turn => !id(turn) && !stamp(turn))) {
      // A just-created placeholder has no durable identity yet. Preserve its
      // existing slot only until its first identified snapshot arrives.
      key = prior.key;
    }
    return { key: key ?? nextKey++, group };
  });
  return { rows, nextKey };
}

/** Reset on target/chat changes; retain no cross-conversation disclosure state.
 * Adjust render state before children commit, avoiding a closed-frame flash. */
export function useExecutionRenderKeys(groups: ExecutionTurn[], scope: string) {
  const [state, setState] = useState(() => ({ scope, groups, ...reconcileExecutionKeys(groups) }));
  let current = state;
  if (state.scope !== scope || state.groups !== groups) {
    current = { scope, groups, ...reconcileExecutionKeys(groups, state.scope === scope ? state : undefined) };
    setState(current);
  }
  return current.rows.map(({ key, group }) => ({ ...group, renderKey: key }));
}
