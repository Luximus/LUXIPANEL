import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const documents = new Map<string, Record<string, unknown>>();
vi.mock("../../../shared/executor/index.js", () => ({ getExecutor: (req: { target?: string }) => ({ target: { id: req.target } }) }));
vi.mock("../../../shared/kv-store/index.js", () => ({
  kv: (executor: { target: { id: string } }) => ({ module: () => ({ collection: () => ({
    get: async (id: string) => documents.get(executor.target.id)?.[id] ?? null,
    transaction: async (fn: (value: Record<string, unknown>) => Promise<{ next: Record<string, unknown>; result: unknown }>) => {
      const result = await fn(documents.get(executor.target.id) ?? {});
      documents.set(executor.target.id, result.next);
      return result.result;
    },
  }) }) }),
}));

import { obsidianPreferencesController } from "./preferences.controller.js";

async function request(method: "get" | "patch", target: string, userId: number, body?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = { target, body } as unknown as Request;
    const res = { locals: { user: { userId } }, json: resolve } as unknown as Response;
    obsidianPreferencesController[method](req, res, reject);
  });
}

describe("Obsidian preferences", () => {
  beforeEach(() => documents.clear());

  it("merges partial updates per user and connected server", async () => {
    await request("patch", "one", 1, { editorMode: "split" });
    await request("patch", "one", 1, { fontSize: 18, lastVaultId: "vault-a" });
    await request("patch", "one", 2, { editorMode: "preview" });
    expect(await request("get", "one", 1)).toMatchObject({ data: { editorMode: "split", fontSize: 18, lastVaultId: "vault-a" } });
    expect(await request("get", "one", 2)).toMatchObject({ data: { editorMode: "preview", fontSize: 14, lastVaultId: null } });
    expect(await request("get", "two", 1)).toMatchObject({ data: { editorMode: "edit", fontSize: 14, lastVaultId: null } });
  });

  it("rejects unsupported values", async () => {
    await expect(request("patch", "one", 1, { fontSize: 40 })).rejects.toBeTruthy();
    await expect(request("patch", "one", 1, { editorMode: "html" })).rejects.toBeTruthy();
  });
});
