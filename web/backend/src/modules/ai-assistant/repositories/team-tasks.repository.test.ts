// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory dataStore double (per module/collection), mocked BEFORE importing
// the repository (repo pattern for sidecar-backed stores).
const stores = new Map<string, Map<string, Record<string, unknown>>>();
let seq = 0;
vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: (_executor: unknown, mod: string, col: string) => {
    const key = `${mod}/${col}`;
    if (!stores.has(key)) stores.set(key, new Map());
    const map = stores.get(key)!;
    return {
      async get(id: string) {
        return map.get(String(id)) ?? null;
      },
      async list() {
        return [...map.values()];
      },
      async create(data: Record<string, unknown>) {
        const id = (data["id"] as string | undefined) ?? `id-${++seq}`;
        const doc = { ...data, id };
        map.set(String(id), doc);
        return doc;
      },
      async update(id: string, patch: Record<string, unknown>) {
        const cur = map.get(String(id));
        if (!cur) return null;
        const next = { ...cur, ...patch };
        map.set(String(id), next);
        return next;
      },
      async delete(id: string) {
        return map.delete(String(id));
      },
      async transaction(fn: (cur: Record<string, Record<string, unknown>>) => Promise<{ next: Record<string, Record<string, unknown>>; result: unknown }>) {
        const obj: Record<string, Record<string, unknown>> = Object.fromEntries(map);
        const { next, result } = await fn(obj);
        map.clear();
        for (const [k, v] of Object.entries(next)) map.set(k, v);
        return result;
      },
    };
  },
}));

import { teamTasksRepository } from "./team-tasks.repository.js";
import type { TeamTask } from "../models/team-task.types.js";

const executor = null;

function baseTask(over: Partial<TeamTask> = {}): Omit<TeamTask, "id" | "createdAt"> {
  return {
    leaderConversationId: "conv-leader",
    leaderAgentId: "agent-leader",
    workerAgentId: "agent-w",
    workerAgentName: "Backend",
    workerConversationId: `conv-w-${++seq}`,
    title: "Tarea",
    task: "haz algo",
    projectId: null,
    status: "running",
    user: null,
    userId: null,
    ...over,
  };
}

beforeEach(() => {
  stores.clear();
});

describe("teamTasksRepository", () => {
  it("creates tasks with id + createdAt and lists them per leader conversation, oldest first", async () => {
    const a = await teamTasksRepository.createTask(executor, baseTask({ title: "A" }));
    const b = await teamTasksRepository.createTask(executor, baseTask({ title: "B" }));
    await teamTasksRepository.createTask(executor, baseTask({ leaderConversationId: "otro", title: "C" }));
    expect(a.id).toBeTruthy();
    expect(a.createdAt).toBeTruthy();
    const list = await teamTasksRepository.listForLeaderConversation(executor, "conv-leader");
    expect(list.map((t) => t.title)).toEqual(["A", "B"]);
    expect(b.leaderConversationId).toBe("conv-leader");
  });

  it("updateTask patches a running task", async () => {
    const t = await teamTasksRepository.createTask(executor, baseTask());
    const updated = await teamTasksRepository.updateTask(executor, t.id!, {
      status: "done",
      resultSummary: "listo",
      finishedAt: "2026-07-01T00:00:00.000Z",
    });
    expect(updated?.status).toBe("done");
    expect(updated?.resultSummary).toBe("listo");
  });

  it("updateTask is IDEMPOTENT on terminal states: a second close cannot overwrite the outcome", async () => {
    const t = await teamTasksRepository.createTask(executor, baseTask());
    await teamTasksRepository.updateTask(executor, t.id!, { status: "done", resultSummary: "respuesta real" });
    // Competing close (e.g. AI_CHAT_FINISHED listener after our onComplete).
    const second = await teamTasksRepository.updateTask(executor, t.id!, { status: "failed", error: "boom" });
    expect(second?.status).toBe("done");
    const stored = await teamTasksRepository.getTask(executor, t.id!);
    expect(stored?.status).toBe("done");
    expect(stored?.resultSummary).toBe("respuesta real");
    expect(stored?.error).toBeUndefined();
  });

  it("updateTask still allows non-status patches after terminal (collected flag)", async () => {
    const t = await teamTasksRepository.createTask(executor, baseTask());
    await teamTasksRepository.updateTask(executor, t.id!, { status: "done" });
    const marked = await teamTasksRepository.updateTask(executor, t.id!, { collected: true });
    expect(marked?.collected).toBe(true);
    expect(marked?.status).toBe("done");
  });

  it("findByWorkerConversation locates the task bound to a worker chat", async () => {
    const t = await teamTasksRepository.createTask(executor, baseTask({ workerConversationId: "conv-w-buscada" }));
    const found = await teamTasksRepository.findByWorkerConversation(executor, "conv-w-buscada");
    expect(found?.id).toBe(t.id);
    expect(await teamTasksRepository.findByWorkerConversation(executor, "no-existe")).toBeNull();
  });

  it("listActive returns only non-terminal tasks", async () => {
    await teamTasksRepository.createTask(executor, baseTask({ title: "run" }));
    const d = await teamTasksRepository.createTask(executor, baseTask({ title: "done" }));
    await teamTasksRepository.updateTask(executor, d.id!, { status: "done" });
    const active = await teamTasksRepository.listActive(executor);
    expect(active.map((t) => t.title)).toEqual(["run"]);
  });

  it("clearForConversation removes tasks AND plans of that leader chat", async () => {
    await teamTasksRepository.createTask(executor, baseTask());
    await teamTasksRepository.createPlan(executor, {
      leaderConversationId: "conv-leader",
      leaderAgentId: "agent-leader",
      title: "Plan",
      goal: "meta",
      steps: [],
      status: "active",
    });
    const removed = await teamTasksRepository.clearForConversation(executor, "conv-leader");
    expect(removed).toBe(1);
    expect(await teamTasksRepository.listForLeaderConversation(executor, "conv-leader")).toEqual([]);
    expect(await teamTasksRepository.getPlanByConversation(executor, "conv-leader")).toBeNull();
  });

  it("plans: create + patch + latest-by-conversation", async () => {
    const p = await teamTasksRepository.createPlan(executor, {
      leaderConversationId: "conv-leader",
      leaderAgentId: "agent-leader",
      title: "Plan 1",
      goal: "meta",
      steps: [{ title: "paso", status: "pending" }],
      status: "active",
    });
    expect(p.id).toBeTruthy();
    const patched = await teamTasksRepository.patchPlan(executor, p.id!, { status: "completed" });
    expect(patched?.status).toBe("completed");
    const latest = await teamTasksRepository.getPlanByConversation(executor, "conv-leader");
    expect(latest?.id).toBe(p.id);
  });
});
