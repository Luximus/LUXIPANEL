// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const documents = new Map<string, Record<string, unknown>>();
vi.mock("../../../shared/executor/index.js", () => ({
  getExecutor: (req: { target?: string }) => ({ target: { id: req.target } }),
}));
vi.mock("../../../shared/kv-store/index.js", () => ({
  kv: (executor: { target: { id: string } }) => ({
    module: () => ({
      collection: () => ({
        get: async (id: string) =>
          documents.get(executor.target.id)?.[id] ?? null,
        transaction: async (
          fn: (
            value: Record<string, unknown>,
          ) => Promise<{ next: Record<string, unknown>; result: unknown }>,
        ) => {
          const result = await fn(documents.get(executor.target.id) ?? {});
          documents.set(executor.target.id, result.next);
          return result.result;
        },
      }),
    }),
  }),
}));
vi.mock("../../admin/repositories/settings.repository.js", () => ({
  settingsRepository: { get: vi.fn(async () => null) },
}));

import { preferencesController } from "./preferences.controller.js";

async function request(
  method: "get" | "patch",
  target: string,
  userId: number,
  body?: unknown,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = { target, body } as unknown as Request;
    const res = {
      locals: { user: { userId } },
      json: resolve,
    } as unknown as Response;
    preferencesController[method](req, res, reject);
  });
}

describe("terminal preferences", () => {
  beforeEach(() => documents.clear());

  it("keeps partial updates isolated by user and server", async () => {
    await request("patch", "server-a", 1, { fontSize: 18 });
    await request("patch", "server-a", 2, {
      historyOrder: ["commands", "claude", "codex"],
    });
    await request("patch", "server-b", 1, { fontSize: 11 });
    expect(await request("get", "server-a", 1)).toMatchObject({
      data: { fontSize: 18, historyOrder: ["codex", "claude", "commands"] },
    });
    expect(await request("get", "server-a", 2)).toMatchObject({
      data: { fontSize: 13, historyOrder: ["commands", "claude", "codex"] },
    });
    expect(await request("get", "server-b", 1)).toMatchObject({
      data: { fontSize: 11 },
    });
  });

  it("rejects sizes outside the supported range and duplicate history modes", async () => {
    await expect(
      request("patch", "server-a", 1, { fontSize: 21 }),
    ).rejects.toBeTruthy();
    await expect(
      request("patch", "server-a", 1, {
        historyOrder: ["codex", "codex", "commands"],
      }),
    ).rejects.toBeTruthy();
  });
  it("persists visible history modes independently while retaining their full order", async () => {
    await request("patch", "server-a", 1, { historyVisible: ["commands"] });
    await request("patch", "server-a", 1, { fontSize: 17 });
    expect(await request("get", "server-a", 1)).toMatchObject({
      data: {
        historyVisible: ["commands"],
        historyOrder: ["codex", "claude", "commands"],
        fontSize: 17,
      },
    });
    expect(await request("get", "server-b", 1)).toMatchObject({
      data: { historyVisible: ["codex", "claude", "commands"] },
    });
  });
  it("rejects empty, duplicate and unsupported visibility choices", async () => {
    for (const historyVisible of [[], ["codex", "codex"], ["opencode"]])
      await expect(
        request("patch", "server-a", 1, { historyVisible }),
      ).rejects.toBeTruthy();
  });
});
