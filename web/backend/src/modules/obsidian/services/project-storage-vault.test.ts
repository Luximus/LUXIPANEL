import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Executor } from "../../../shared/executor/types.js";
const state = vi.hoisted(() => ({ root: "", container: null as any, vault: null as any, shared: false }));
vi.mock("../../ai-assistant/services/project-storage.service.js", () => ({ ensureProjectStorage: async () => ({ storagePath: state.root }) }));
vi.mock("../repositories/vaults.repository.js", () => ({ vaultsRepository: {
  findByPath: async (_: unknown, p: string) => state.vault?.path === p ? state.vault : null,
  get: async () => state.vault,
  update: async (_: unknown, _id: string, data: any) => Object.assign(state.vault, data),
  create: async (_: unknown, data: any) => ({ id: "new-vault", ...data }),
} }));
vi.mock("../repositories/containers.repository.js", () => ({ containersRepository: {
  findByRefKey: async () => state.container,
  list: async () => state.shared ? [state.container, { vaultId: state.container.vaultId }] : [state.container],
  update: async (_: unknown, _id: string, data: any) => Object.assign(state.container, data),
  create: async (_: unknown, data: any) => state.container = { id: "container", ...data },
} }));
import { connectProjectStorageVault } from "./project-storage-vault.service.js";
const shell = promisify(exec);
const executor = { exec: async (cmd: string) => { try { return { ...(await shell(cmd)), exitCode: 0 }; } catch (e: any) { return { stdout: e.stdout, stderr: e.stderr, exitCode: 1 }; } } } as Executor;
let dir: string, source: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lxp-notes-migration-")); state.root = join(dir, "permanent"); source = join(dir, "old");
  await mkdir(state.root); await mkdir(source);
  await writeFile(join(state.root, "storage.json"), "{}"); await writeFile(join(state.root, "AGENTS.md"), "Canonical");
  await writeFile(join(source, "Decisiones.md"), "Historical decisions");
  state.container = { id: "container", vaultId: "old-vault", path: source }; state.vault = { id: "old-vault", path: source }; state.shared = false;
});
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
it("preserves original notes and vault identity while moving the project association", async () => {
  const result = await connectProjectStorageVault(executor, { id: "project", title: "Demo" } as any);
  expect(result.id).toBe("old-vault"); expect(state.container.path).toBe(join(state.root, "notes"));
  expect(await readFile(join(state.root, "notes/Decisiones.md"), "utf8")).toBe("Historical decisions");
  expect(await readFile(join(source, "Decisiones.md"), "utf8")).toBe("Historical decisions");
  expect(await readFile(join(state.root, "AGENTS.md"), "utf8")).toBe("Canonical");
  await writeFile(join(state.root, "notes/Decisiones.md"), "New decisions");
  await connectProjectStorageVault(executor, { id: "project", title: "Renamed" } as any);
  expect(await readFile(join(state.root, "notes/Decisiones.md"), "utf8")).toBe("New decisions");
});
it("does not repoint a vault shared with another source", async () => {
  state.shared = true;
  const result = await connectProjectStorageVault(executor, { id: "project", title: "Demo" } as any);
  expect(result.id).toBe("new-vault"); expect(state.vault.path).toBe(source);
});
it("leaves the old association intact when historical notes are unavailable", async () => {
  await rm(source, { recursive: true });
  await expect(connectProjectStorageVault(executor, { id: "project", title: "Demo" } as any)).rejects.toThrow("ubicación anterior");
  expect(state.container.path).toBe(source); expect(state.vault.path).toBe(source);
});
it("reports an existing conflicting destination without overwriting either version", async () => {
  await mkdir(join(state.root, "notes")); await writeFile(join(state.root, "notes/Decisiones.md"), "Other");
  await expect(connectProjectStorageVault(executor, { id: "project", title: "Demo" } as any)).rejects.toThrow();
  expect(await readFile(join(state.root, "notes/Decisiones.md"), "utf8")).toBe("Other");
  expect(state.container.path).toBe(source);
});
