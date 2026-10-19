import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Executor } from "../../../shared/executor/types.js";
const registry = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock("../repositories/vaults.repository.js", () => ({ vaultsRepository: {
  list: async () => registry.rows,
  findByPath: async () => null,
  create: async (_executor: Executor, data: any) => { const vault = { ...data, id: "root-doc" }; registry.rows.push(vault); return vault; },
} }));
import { obsidianService } from "./obsidian.service.js";
const shell = promisify(exec);
const executor = {
  target: { id: "target" },
  exec: async (command: string) => { const result = await shell(command); return { ...result, exitCode: 0 }; },
  readFile: (p: string) => readFile(p, "utf8"),
  writeFile, mkdir, stat,
} as unknown as Executor;
let dir: string;
beforeEach(async () => {
  registry.rows = [];
  dir = await mkdtemp(join(tmpdir(), "lxp-document-vault-"));
  await mkdir(join(dir, "workspace/dependencies"), { recursive: true });
  await writeFile(join(dir, "workspace/AGENTS.md"), "context root");
  await writeFile(join(dir, "workspace/dependencies/other.md"), "context nested");
  await writeFile(join(dir, "outside.md"), "context outside");
  await symlink(join(dir, "outside.md"), join(dir, "workspace/link.md"));
});
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
describe("project documents in Obsidian", () => {
  it("registers the real directory without copying or scaffolding documents", async () => {
    const path = join(dir, "workspace");
    const vault = await obsidianService.createVault(executor, { name: "Project", path, mode: "register" }, { shallow: true });
    expect(vault).toMatchObject({ path, shallow: true });
    expect(await readFile(join(path, "AGENTS.md"), "utf8")).toBe("context root");
    await obsidianService.writeNote(executor, vault, "AGENTS.md", "Edited in Obsidian");
    expect(await readFile(join(path, "AGENTS.md"), "utf8")).toBe("Edited in Obsidian");
  });
  it("limits listing, search and counts to root notes without following symlinks", async () => {
    const vault = await obsidianService.createVault(executor, { name: "Project", path: join(dir, "workspace"), mode: "register" }, { shallow: true });
    const tree = await obsidianService.getTree(executor, vault);
    expect(tree.folders).toEqual([]);
    expect(tree.notes.map(n => n.path)).toEqual(["AGENTS.md"]);
    expect((await obsidianService.search(executor, vault, "context")).map(n => n.path)).toEqual(["AGENTS.md"]);
    expect((await obsidianService.listVaults(executor))[0].noteCount).toBe(1);
  });
  it("keeps existing ordinary vaults recursive", async () => {
    const tree = await obsidianService.getTree(executor, { id: "normal", name: "Normal", path: join(dir, "workspace") });
    expect(tree.notes.map(n => n.path)).toContain("dependencies/other.md");
  });
});
