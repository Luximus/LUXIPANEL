// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import {
  clampResultSummary,
  isTerminalTaskStatus,
  sanitizeTaskTitle,
  TASK_RESULT_SUMMARY_MAX,
  toTaskView,
  toTeamTaskSnapshot,
  type TeamTask,
} from "./team-task.types.js";

describe("team-task.types", () => {
  it("isTerminalTaskStatus: done/failed/canceled are terminal, pending/running are not", () => {
    expect(isTerminalTaskStatus("done")).toBe(true);
    expect(isTerminalTaskStatus("failed")).toBe(true);
    expect(isTerminalTaskStatus("canceled")).toBe(true);
    expect(isTerminalTaskStatus("pending")).toBe(false);
    expect(isTerminalTaskStatus("running")).toBe(false);
  });

  it("clampResultSummary trims and caps long answers with a truncation marker", () => {
    expect(clampResultSummary("  hola  ")).toBe("hola");
    const long = "x".repeat(TASK_RESULT_SUMMARY_MAX + 500);
    const clamped = clampResultSummary(long);
    expect(clamped.length).toBeLessThan(long.length);
    expect(clamped).toContain("…[truncado");
    expect(clamped.startsWith("x".repeat(100))).toBe(true);
  });

  it("clampResultSummary keeps short answers intact", () => {
    expect(clampResultSummary("respuesta corta")).toBe("respuesta corta");
  });

  it("sanitizeTaskTitle collapses whitespace, caps at 120 and falls back to the task", () => {
    expect(sanitizeTaskTitle("  Revisar\n\nel   login  ", "fallback")).toBe("Revisar el login");
    expect(sanitizeTaskTitle("t".repeat(300), "fallback")).toHaveLength(120);
    expect(sanitizeTaskTitle(undefined, "Arregla el bug del footer")).toBe("Arregla el bug del footer");
    expect(sanitizeTaskTitle(123, "   ")).toBe("Tarea delegada");
  });

  it("toTaskView keeps only card fields and omits empty optionals", () => {
    const task: TeamTask = {
      id: "t1",
      leaderConversationId: "conv-l",
      leaderAgentId: "a-lead",
      workerAgentId: "a-w",
      workerAgentName: "Backend",
      workerConversationId: "conv-w",
      title: "Tarea",
      task: "haz algo",
      status: "running",
      createdAt: "2026-07-01T00:00:00.000Z",
      user: null,
    };
    const view = toTaskView(task);
    expect(view).toEqual({
      id: "t1",
      title: "Tarea",
      status: "running",
      workerAgentId: "a-w",
      workerAgentName: "Backend",
      workerConversationId: "conv-w",
      planId: null,
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    expect("user" in view).toBe(false);
    expect("task" in view).toBe(false);
  });

  it("toTeamTaskSnapshot maps to assignee-first rehydration fields with null-normalized optionals", () => {
    const base: TeamTask = {
      id: "t1",
      leaderConversationId: "conv-l",
      leaderAgentId: "a-lead",
      workerAgentId: "a-w",
      workerAgentName: "Backend",
      workerConversationId: "conv-w",
      title: "Tarea",
      task: "haz algo",
      status: "running",
      createdAt: "2026-07-01T00:00:00.000Z",
      user: null,
    };
    expect(toTeamTaskSnapshot(base)).toEqual({
      taskId: "t1",
      leaderConversationId: "conv-l",
      title: "Tarea",
      assigneeAgentId: "a-w",
      assigneeName: "Backend",
      state: "running",
      childConversationId: "conv-w",
      planId: null,
      stepIndex: null,
      pendingPermission: false,
      error: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      startedAt: null,
      finishedAt: null,
    });
  });

  it("toTeamTaskSnapshot carries plan/step, permission and terminal timestamps", () => {
    const done: TeamTask = {
      id: "t2",
      leaderConversationId: "conv-l",
      leaderAgentId: "a-lead",
      planId: "plan-1",
      stepIndex: 2,
      workerAgentId: "a-w",
      workerAgentName: "Frontend",
      workerConversationId: "conv-w2",
      title: "UI",
      task: "pinta",
      status: "done",
      pendingPermission: true,
      error: "boom",
      createdAt: "2026-07-01T00:00:00.000Z",
      startedAt: "2026-07-01T00:00:05.000Z",
      finishedAt: "2026-07-01T00:01:00.000Z",
      user: null,
    };
    const snap = toTeamTaskSnapshot(done);
    expect(snap.planId).toBe("plan-1");
    expect(snap.stepIndex).toBe(2);
    expect(snap.state).toBe("done");
    expect(snap.assigneeAgentId).toBe("a-w");
    expect(snap.pendingPermission).toBe(true);
    expect(snap.error).toBe("boom");
    expect(snap.startedAt).toBe("2026-07-01T00:00:05.000Z");
    expect(snap.finishedAt).toBe("2026-07-01T00:01:00.000Z");
  });
});
