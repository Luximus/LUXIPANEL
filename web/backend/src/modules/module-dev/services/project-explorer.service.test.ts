import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectExplorer } from "./project-explorer.service.js";

describe("project explorer boundaries", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "luxipanel-project-explorer-"));
    await mkdir(join(root, "backend", "src"), { recursive: true });
    await mkdir(join(root, "node_modules"));
    await writeFile(join(root, "backend", "src", "server.ts"), "export const app = true;\n");
    await writeFile(join(root, ".env"), "TOKEN=private");
    await writeFile(join(root, "node_modules", "package.js"), "private");
    await symlink(tmpdir(), join(root, "outside"));
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it("lists source, searches names, and reads selected code", async () => {
    const explorer = createProjectExplorer(root);
    const rootEntries = (await explorer.list()).entries.map((entry) => entry.name);
    expect(rootEntries).toContain("backend");
    expect(rootEntries).not.toContain(".env");
    expect(rootEntries).not.toContain("node_modules");
    expect(rootEntries).not.toContain("outside");
    expect((await explorer.search("server")).results.map((entry) => entry.path)).toContain("backend/src/server.ts");
    expect(await explorer.file("backend/src/server.ts")).toMatchObject({ content: "export const app = true;\n", language: "TypeScript", binary: false });
  });

  it("rejects traversal, hidden files and symlink escapes", async () => {
    const explorer = createProjectExplorer(root);
    await expect(explorer.file("../outside.txt")).rejects.toThrow();
    await expect(explorer.file(".env")).rejects.toThrow();
    await expect(explorer.list("outside")).rejects.toThrow();
    await expect(explorer.file("backend/../../.env")).rejects.toThrow();
  });
});
