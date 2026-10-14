import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const { readNote, getTree } = vi.hoisted(() => ({
readNote: vi.fn(async (_executor: unknown, _vault: unknown, path: string) => ({ path, content: "safe" })),
getTree: vi.fn(async () => ({
  folders: ["Public", "Secret"],
  notes: [
    { path: "Public/ok.md", name: "ok.md", sizeBytes: 1, modifiedAt: "2026-01-01" },
    { path: "Secret/private.md", name: "private.md", sizeBytes: 1, modifiedAt: "2026-01-01" },
  ],
})),
}));
vi.mock("../../../shared/executor/index.js", () => ({ getExecutor: () => ({ target: { id: "server" } }) }));
vi.mock("../../../shared/auth/role-permissions.js", () => ({
  canAccessPath: (_user: unknown, path: string) => !path.includes("/Secret"),
}));
vi.mock("../services/physical-path.js", () => ({
  physicalNotePath: async (_executor: unknown, root: string, rel: string) => ({ root, target: `${root}/${rel}` }),
}));
vi.mock("../services/obsidian.service.js", () => ({ obsidianService: {
  getVault: vi.fn(async () => ({ id: "vault", path: "/vault", name: "Vault" })),
  getTree,
  readNote,
  search: vi.fn(async () => [
    { path: "Public/ok.md", line: 1, text: "safe" },
    { path: "Secret/private.md", line: 1, text: "secret" },
  ]),
  resolveDailyDate: vi.fn(async () => "2026-09-27"),
} }));
vi.mock("../services/context-container.service.js", () => ({ contextContainerService: {} }));

import { obsidianController } from "./obsidian.controller.js";
import { NotFoundError } from "../../../shared/errors/index.js";

async function invoke(method: keyof typeof obsidianController, query: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = { params: { id: "vault" }, query } as unknown as Request;
    const res = { locals: { user: { kind: "user", userId: 1 } }, json: resolve } as unknown as Response;
    obsidianController[method](req, res, reject);
  });
}

describe("Obsidian note path access", () => {
  beforeEach(() => { readNote.mockClear(); getTree.mockClear(); });

  it("rejects direct reads of a denied child path before reading the file", async () => {
    await expect(invoke("readNote", { path: "Secret/private.md" })).rejects.toBeTruthy();
    expect(readNote).not.toHaveBeenCalled();
  });

  it("filters denied entries from the tree and search", async () => {
    const tree = await invoke("tree");
    expect(tree.data.folders).toEqual(["Public"]);
    expect(tree.data.notes.map((n: { path: string }) => n.path)).toEqual(["Public/ok.md"]);
    const results = await invoke("search", { q: "note" });
    expect(results.data.map((n: { path: string }) => n.path)).toEqual(["Public/ok.md"]);
  });

  it("opens today's absent note as a draft without writing", async () => {
    readNote.mockRejectedValueOnce(new NotFoundError("Nota"));
    const result = await invoke("today");
    expect(result.data).toMatchObject({ path: "Daily/2026-09-27.md", exists: false, content: "" });
    expect(readNote).toHaveBeenCalledOnce();
  });

  it("reads an existing daily note without appending", async () => {
    const result = await invoke("today");
    expect(result.data).toMatchObject({ path: "Daily/2026-09-27.md", exists: true, content: "safe" });
    expect(readNote).toHaveBeenCalledOnce();
  });
});
