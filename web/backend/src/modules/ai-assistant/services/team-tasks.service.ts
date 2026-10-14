// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team tasks service — the runtime behind the leader→workers delegation cycle.
 *
 * A LEADER agent (supervisor with subordinates) assigns work with `team.assign`:
 * this service spawns a real background chat for the worker (agent-run-registry,
 * same mechanics as the `chats.create` tool) and anchors a persistent TeamTask
 * on the board (team-tasks.repository). `team.collect` then WAITS — bounded —
 * for those tasks to reach a terminal state and hands the leader the results,
 * so it can synthesize one consolidated answer for the user.
 *
 * Wake-up paths for a waiting leader (all read the same board):
 *   1. Our own `onComplete` on the worker run closes the task and pings the
 *      in-memory waiters (primary path).
 *   2. `Events.AI_CHAT_FINISHED` closes tasks whose run did NOT go through our
 *      `onComplete` (e.g. a CLI run recovered after a panel restart).
 *   3. Lazy reconciliation: a `running` task whose worker conversation has no
 *      live run / CLI job and is stale gets closed from the conversation's
 *      persisted messages (covers API runs killed by a restart).
 *
 * The in-memory waiters are an optimization only — the sidecar board is the
 * source of truth (fail-closed per-server executor, like conversations).
 *
 * ── Layout ──────────────────────────────────────────────────────────────────
 * This file is a FAÇADE re-exporting the same public surface. The
 * implementation is split under `./team-tasks/`:
 *   • interruption.ts  — restart-note placeholders (`isInterruptionPlaceholder`).
 *   • worker-quota.ts  — per-user worker slot cap (in-process Map).
 *   • waiters.ts       — collect wait/ping (in-process Map).
 *   • task-events.ts   — live `team_task_update` fan-out (SSE + event bus).
 *   • worker-spawn.ts  — create worker chat + start its run (`spawnWorker`).
 *   • lifecycle.ts     — deferred dispatch, token budgets, single-close
 *                        `finalizeTask`, verify gate, plan mirror, leader nudge.
 *   • service.ts       — the `teamTasksService` object (assign/collect/…).
 */

export { CLI_RECOVERY_INTERRUPTED_TEXT, TASK_INTERRUPTED_ERROR, isInterruptionPlaceholder } from "./team-tasks/interruption.js";
export { validateWorkerProject, spawnWorker } from "./team-tasks/worker-spawn.js";
export type { WorkerRunOptions, RunAgentFn, SpawnWorkerInput } from "./team-tasks/worker-spawn.js";
export { teamTasksService } from "./team-tasks/service.js";
export type { AssignTaskInput } from "./team-tasks/service.js";
