// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { toTaskView, toTeamTaskSnapshot, type TeamTask, type TeamTaskSnapshot } from "./team-task.types.js";

const task: TeamTask = {
  id: "task", leaderConversationId: "leader-chat", leaderAgentId: "leader",
  workerAgentId: "worker", workerAgentName: "Revisor", workerConversationId: "worker-chat",
  title: "Revisar cambios", task: "Instrucción privada", status: "done",
  createdAt: "2026-10-17T00:00:00Z", finishedAt: "2026-10-17T00:01:00Z",
};
const wire = (value: TeamTaskSnapshot): TeamTaskSnapshot => JSON.parse(JSON.stringify(value));

describe("conversation task snapshot details", () => {
  it("preserves the live file counters, verification and isolation across JSON", () => {
    const source: TeamTask = {
      ...task,
      artifacts: { filesChangedTotal: 2, insertions: 5, deletions: 1 },
      verify: { state: "passed", attempts: 1 },
      isolation: { mode: "lease", branch: "developer", integrated: true },
    };
    const snapshot = wire(toTeamTaskSnapshot(source));
    const live = toTaskView(source);
    expect(snapshot.artifacts).toEqual({ filesChangedTotal: 2, insertions: 5, deletions: 1 });
    expect(snapshot.verify).toEqual({ state: "passed", attempts: 1 });
    expect(snapshot.isolation).toEqual({ mode: "lease", branch: "developer", integrated: true });
    expect(snapshot.artifacts).toEqual(live.artifacts);
    expect(snapshot.verify).toEqual(live.verify);
    expect(snapshot.isolation).toEqual(live.isolation);
    expect(snapshot.assigneeAgentId).toBe(live.workerAgentId);
    expect(snapshot.childConversationId).toBe(live.workerConversationId);
  });

  it("keeps legacy tasks compatible without inventing details", () => {
    expect(wire(toTeamTaskSnapshot(task))).toEqual({
      taskId: "task", leaderConversationId: "leader-chat", title: task.title,
      assigneeAgentId: "worker", assigneeName: "Revisor", state: "done",
      childConversationId: "worker-chat", planId: null, stepIndex: null,
      pendingPermission: false, error: null, createdAt: task.createdAt,
      startedAt: null, finishedAt: task.finishedAt,
    });
  });

  it("retains zero counters and false token flags", () => {
    const artifacts = {
      filesChangedTotal: 0, insertions: 0, deletions: 0,
      tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimated: false, overBudget: false },
    };
    const snapshot = wire(toTeamTaskSnapshot({ ...task, artifacts, verify: { state: "skipped", attempts: 0 } }));
    expect(snapshot.artifacts).toEqual(artifacts);
    expect(snapshot.verify).toEqual({ state: "skipped", attempts: 0 });
    expect(snapshot.isolation).toBeUndefined();
  });

  it.each(["running", "passed", "failed", "skipped"] as const)("keeps verification %s without promoting it to success", state => {
    const snapshot = wire(toTeamTaskSnapshot({
      ...task, status: state === "failed" ? "failed" : "running",
      verify: { state, attempts: 2 },
    }));
    expect(snapshot.verify).toEqual({ state, attempts: 2 });
    expect(snapshot.state).toBe(state === "failed" ? "failed" : "running");
  });

  it("allowlists nested details instead of exposing private task data", () => {
    const source = {
      ...task,
      user: { token: "fixture-private-session" },
      verifyCommands: ["fixture-private-command"],
      verify: { state: "failed", attempts: 1, failedCommand: "fixture-private-command", logTail: "fixture-private-log", exitCode: 1 },
      isolation: {
        mode: "worktree", branch: "developer", integrated: true,
        repoRoot: "/fixture-private-repo", worktreePath: "/fixture-private-worktree",
        cwd: "/fixture-private-cwd", leasePath: "/fixture-private-lease",
        prUrl: "https://fixture.invalid/private", baseSha: "fixture-private-base", headSha: "fixture-private-head",
      },
      artifacts: {
        filesChangedTotal: 2, insertions: 5, deletions: 1,
        filesChanged: [{ path: "fixture-private-file", status: "M", insertions: 5, deletions: 1 }],
        diffPreview: "fixture-private-diff", baseHadUncommitted: true,
        tokens: { inputTokens: 2, outputTokens: 3, totalTokens: 5, estimated: true, overBudget: true, secret: "fixture-private-token" },
      },
    } as unknown as TeamTask;
    for (const result of [toTeamTaskSnapshot(source), toTaskView(source)]) {
      expect(JSON.stringify(result)).not.toContain("fixture-private");
      expect(result.artifacts).toEqual({
        filesChangedTotal: 2, insertions: 5, deletions: 1,
        tokens: { inputTokens: 2, outputTokens: 3, totalTokens: 5, estimated: true, overBudget: true },
      });
      expect(result.verify).toEqual({ state: "failed", attempts: 1 });
      expect(result.isolation).toEqual({ mode: "worktree", branch: "developer", integrated: true });
    }
    const snapshot = toTeamTaskSnapshot(source);
    snapshot.artifacts!.tokens!.totalTokens = 99;
    expect(source.artifacts!.tokens!.totalTokens).toBe(5);
  });
});
