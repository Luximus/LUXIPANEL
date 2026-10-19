import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm, symlink, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exec as shell } from "node:child_process";
import { promisify } from "node:util";
import type { Executor } from "../../../shared/executor/types.js";
import type { AssistantProject } from "../repositories/projects.repository.js";
const state = vi.hoisted(() => ({ rows: new Map<string, any>(), allowed: true, jailed: true, writes: 0, config: "" }));
vi.mock("../../../config/paths.js", () => ({ panelConfigDir: () => state.config }));
vi.mock("../../../shared/executor/index.js", () => ({
  getContextUser: () => ({ kind: "admin" }), pathInFileJail: () => state.jailed,
  quoteArg: (s: string) => `'${s.replace(/'/g, `'\\''`)}'`,
}));
vi.mock("../../../shared/auth/role-permissions.js", () => ({ canAccessPath: () => state.allowed }));
vi.mock("../repositories/projects.repository.js", () => ({ projectsRepository: {
  get: async (ex: Executor) => state.rows.get(ex.target.id),
  update: async (ex: Executor, _id: string, data: any) => { Object.assign(state.rows.get(ex.target.id), data); },
} }));
import { mergeProjectContext, projectDocumentService } from "./project-document.service.js";
import { ensureProjectStorage, projectStorageRoot, projectStorageOperation } from "./project-storage.service.js";
const exec = promisify(shell);
let dir: string;
let project: AssistantProject;
const executor = {
  target: { id: "target-A" },
  exec: async (command: string) => {
    try { return { ...(await exec(command)), exitCode: 0 }; }
    catch (err: any) { return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: 1 }; }
  },
  writeFile: (p: string, data: string, opts: any) => writeFile(p, data, opts),
  readFile: (path: string) => readFile(path, "utf8"),
} as unknown as Executor;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lxp-document-test-"));
  state.config = join(dir, "config");
  project = { id: "project", path: dir, title: "Demo", provider: "claude", instructions: "Reglas previas", icon: "Folder" } as AssistantProject;
  state.rows.clear(); state.rows.set("target-A", project); state.allowed = true; state.jailed = true; state.writes = 0;
});
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
describe("stable project data", () => {
  it("migrates context without changing the original workspace", async () => {
    await writeFile(join(dir, "CLAUDE.md"), "Existing");
    const preview = await projectDocumentService.read(executor, project);
    await expect(stat(projectStorageRoot(project))).rejects.toThrow();
    await projectDocumentService.save(executor, project, preview.content, preview.revision);
    expect(project.instructions).toBe("");
    expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe("Existing");
    expect(await readFile(join(projectStorageRoot(project), "CLAUDE.md"), "utf8")).toBe(preview.content);
    expect((await stat(projectStorageRoot(project))).mode & 0o777).toBe(0o700);
  });
  it("keeps provider settings and context after repeated cwd, name and provider changes", async () => {
    await mkdir(join(dir, ".codex")); await writeFile(join(dir, ".codex/config.toml"), 'model="demo"');
    await ensureProjectStorage(executor, project);
    const root = projectStorageRoot(project);
    for (const provider of ["claude", "codex", "gemini"] as const) {
      project.provider = provider; project.path = "/new/" + provider; project.title = provider;
      expect((await projectDocumentService.read(executor, project)).content).toContain("Reglas previas");
      expect(projectStorageRoot(project)).toBe(root);
      expect(await readFile(join(root, ".codex/config.toml"), "utf8")).toBe('model="demo"');
    }
  });
  it("reads permanent Obsidian edits live and rejects stale saves", async () => {
    await ensureProjectStorage(executor, project); project.instructions = "";
    const snap = await projectDocumentService.read(executor, project);
    await writeFile(join(projectStorageRoot(project), "CLAUDE.md"), "From Obsidian");
    expect(await projectDocumentService.prompt(executor, project)).toContain("From Obsidian");
    await expect(projectDocumentService.save(executor, project, "Stale", snap.revision)).rejects.toThrow("cambió");
  });
  it("serializes migrations and concurrent edits", async () => {
    await Promise.all([ensureProjectStorage(executor, project), ensureProjectStorage(executor, project)]);
    const snap = await projectDocumentService.read(executor, project);
    const results = await Promise.allSettled(["First", "Second"].map(s => projectDocumentService.save(executor, project, s, snap.revision)));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  });
  it("blocks changes of path/provider after an editor snapshot", async () => {
    await ensureProjectStorage(executor, project);
    const snap = await projectDocumentService.read(executor, project); project.path = "/new";
    await expect(projectDocumentService.save(executor, project, "Stale", snap.revision)).rejects.toThrow("cambió");
  });
  it("copies internal links, preserves originals, rejects external links and traversal", async () => {
    await writeFile(join(dir, "AGENTS.md"), "Shared"); await symlink("AGENTS.md", join(dir, "CLAUDE.md"));
    await ensureProjectStorage(executor, project);
    expect(await readFile(join(dir, "AGENTS.md"), "utf8")).toBe("Shared");
    await rm(join(dir, "CLAUDE.md")); await symlink("/etc/passwd", join(dir, "CLAUDE.md"));
    await expect(ensureProjectStorage(executor, { ...project, id: "other" })).rejects.toThrow("fuera del proyecto");
    expect(() => projectStorageRoot({ id: "../escape" })).toThrow();
  });
  it("fails closed on denied access, missing sources and symlinked storage", async () => {
    state.allowed = false; await expect(ensureProjectStorage(executor, project)).rejects.toThrow("acceso");
    state.allowed = true; state.jailed = false; await expect(ensureProjectStorage(executor, project)).rejects.toThrow("acceso");
    state.jailed = true; project.path = join(dir, "missing");
    await expect(ensureProjectStorage(executor, project)).rejects.toThrow("anterior");
    await expect(stat(projectStorageRoot(project))).rejects.toThrow();
    await symlink(dir, projectStorageRoot(project));
    await expect(ensureProjectStorage(executor, project)).rejects.toThrow("insegura");
  });
  it("isolates projects sharing a workspace and checks target revision", async () => {
    await ensureProjectStorage(executor, project);
    const other = { ...project, id: "other" }; await ensureProjectStorage(executor, other);
    await projectStorageOperation(executor, other, "write", "CLAUDE.md", { content: "Other" });
    expect((await projectDocumentService.read(executor, project)).content).not.toContain("Other");
    const snap = await projectDocumentService.read(executor, project);
    await expect(projectDocumentService.save({ ...executor, target: { id: "B" } } as Executor, project, "Wrong", snap.revision)).rejects.toThrow("ya no existe");
  });
  it("saves large documents without argv truncation and supports no cwd", async () => {
    project.path = ""; const snap = await projectDocumentService.read(executor, project);
    const content = "á".repeat(100000);
    await projectDocumentService.save(executor, project, content, snap.revision);
    expect((await projectDocumentService.read(executor, project)).content).toBe(content);
  });
});
