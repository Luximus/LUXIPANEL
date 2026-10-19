import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exec as shell } from "node:child_process";
import { promisify } from "node:util";
import type { Executor } from "../../../shared/executor/types.js";
import type { AssistantProject } from "../repositories/projects.repository.js";
const state = vi.hoisted(() => ({ rows: new Map<string, any>(), allowed: true, jailed: true, writes: 0 }));
vi.mock("../../../shared/executor/index.js", () => ({
  getContextUser: () => ({ kind: "admin" }), pathInFileJail: () => state.jailed,
  quoteArg: (s: string) => `'${s.replace(/'/g, `'\\''`)}'`,
}));
vi.mock("../../../shared/auth/role-permissions.js", () => ({ canAccessPath: () => state.allowed }));
vi.mock("../repositories/projects.repository.js", () => ({ projectsRepository: {
  get: async (ex: Executor) => state.rows.get(ex.target.id),
  update: async (ex: Executor, _id: string, data: any) => { Object.assign(state.rows.get(ex.target.id), data); },
} }));
vi.mock("./project-structure/project-structure.service.js", () => ({ projectStructureService: {
  writeFile: async (_ex: Executor, p: AssistantProject, rel: string, content: string) => {
    state.writes++; await writeFile(join(p.path, rel), content);
  },
} }));
import { mergeProjectContext, projectDocumentService } from "./project-document.service.js";
const exec = promisify(shell);
let dir: string;
let project: AssistantProject;
const executor = {
  target: { id: "target-A" },
  exec: async (command: string) => {
    try { return { ...(await exec(command)), exitCode: 0 }; }
    catch (err: any) { return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: 1 }; }
  },
  readFile: (path: string) => readFile(path, "utf8"),
} as unknown as Executor;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lxp-document-test-"));
  project = { id: "project", path: dir, title: "Demo", provider: "claude", instructions: "Reglas previas", icon: "Folder" } as AssistantProject;
  state.rows.clear(); state.rows.set("target-A", project); state.allowed = true; state.jailed = true; state.writes = 0;
});
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
describe("canonical project document", () => {
  it("previews migration without writes and preserves both sources on save", async () => {
    await writeFile(join(dir, "CLAUDE.md"), "# Existing\nDo not remove\n");
    const snapshot = await projectDocumentService.read(executor, project);
    expect(snapshot.content).toContain("Reglas previas");
    expect(snapshot.content).toContain("# Existing\nDo not remove\n");
    expect(state.writes).toBe(0);
    await projectDocumentService.save(executor, project, snapshot.content, snapshot.revision);
    expect(project.instructions).toBe("");
    expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe(snapshot.content);
    expect((await projectDocumentService.read(executor, project)).content).toBe(snapshot.content);
  });
  it("reads external edits live for subsequent agent runs", async () => {
    project.instructions = "";
    await writeFile(join(dir, "CLAUDE.md"), "From Obsidian");
    expect(await projectDocumentService.prompt(executor, project)).toContain("From Obsidian");
    await writeFile(join(dir, "CLAUDE.md"), "From CLI");
    expect(await projectDocumentService.prompt(executor, project)).toContain("From CLI");
  });
  it("rejects stale editors without overwriting external changes", async () => {
    const snapshot = await projectDocumentService.read(executor, project);
    await writeFile(join(dir, "CLAUDE.md"), "External revision");
    await expect(projectDocumentService.save(executor, project, "Stale", snapshot.revision)).rejects.toThrow("cambió");
    expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe("External revision");
    expect(state.writes).toBe(0);
  });
  it("rejects provider changes after the snapshot", async () => {
    const snapshot = await projectDocumentService.read(executor, project);
    project.provider = "codex";
    await expect(projectDocumentService.save(executor, project, "Stale", snapshot.revision)).rejects.toThrow("cambió");
  });
  it("serializes concurrent writers", async () => {
    const snapshot = await projectDocumentService.read(executor, project);
    const result = await Promise.allSettled(["First", "Second"].map(content => projectDocumentService.save(executor, project, content, snapshot.revision)));
    expect(result.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(state.writes).toBe(1);
  });
  it.each(["claude", "codex", "gemini"] as const)("uses the %s provider document", async provider => {
    project.provider = provider;
    const snapshot = await projectDocumentService.read(executor, project);
    expect(snapshot.rel).toBe({ claude: "CLAUDE.md", codex: "AGENTS.md", gemini: "GEMINI.md" }[provider]);
  });
  it("preserves internal symlinks and rejects links outside the project", async () => {
    await writeFile(join(dir, "AGENTS.md"), "Shared instructions");
    await symlink("AGENTS.md", join(dir, "CLAUDE.md"));
    const snapshot = await projectDocumentService.read(executor, project);
    await projectDocumentService.save(executor, project, snapshot.content, snapshot.revision);
    expect(await readFile(join(dir, "AGENTS.md"), "utf8")).toBe(snapshot.content);
    await rm(join(dir, "CLAUDE.md"));
    await symlink("/etc/passwd", join(dir, "CLAUDE.md"));
    await expect(projectDocumentService.read(executor, project)).rejects.toThrow("dentro del proyecto");
  });
  it("respects user path policy and the run jail", async () => {
    state.allowed = false;
    await expect(projectDocumentService.read(executor, project)).rejects.toThrow("acceso");
    state.allowed = true; state.jailed = false;
    await expect(projectDocumentService.read(executor, project)).rejects.toThrow("acceso");
  });
  it("never silently truncates a large document in the editor", async () => {
    await writeFile(join(dir, "CLAUDE.md"), "a".repeat(512 * 1024 + 1));
    await expect(projectDocumentService.read(executor, project)).rejects.toThrow("512 KB");
  });
  it("keeps project storage on the selected target", async () => {
    const snapshot = await projectDocumentService.read(executor, project);
    const other = { ...executor, target: { id: "target-B" } } as Executor;
    await expect(projectDocumentService.save(other, project, "Wrong target", snapshot.revision)).rejects.toThrow("ya no existe");
    expect(state.writes).toBe(0);
    expect(project.instructions).toBe("Reglas previas");
  });
  it("does not duplicate legacy instructions already in the document", () => {
    expect(mergeProjectContext("# Rules\nlegacy", "legacy", "Demo")).toBe("# Rules\nlegacy");
  });
  it("preserves context for projects without a directory", async () => {
    expect(await projectDocumentService.prompt(executor, { ...project, path: "" })).toBe("Reglas previas");
  });
});
