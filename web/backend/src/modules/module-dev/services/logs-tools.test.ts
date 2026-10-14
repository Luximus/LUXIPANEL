import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { repairRuntime } from "../../../shared/diagnostics/repair-bridge.js";
import { logsRepairTools } from "./logs-tools.js";

let root: string; let outside: string;
beforeAll(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), "lxp-repair-tools-")); outside = await fs.mkdtemp(path.join(os.tmpdir(), "lxp-private-")); await fs.writeFile(path.join(outside, "private.ts"), "private"); await fs.symlink(outside, path.join(root, "escape")); });
afterAll(async () => { await fs.rm(root, { recursive: true, force: true }); await fs.rm(outside, { recursive: true, force: true }); });
const call = (name: string, data: unknown) => logsRepairTools.find((t) => t.name.endsWith(`_${name}`))!.handler(data);
const context = (allow = true) => ({ cwd: root, evidenceFile: path.join(outside, "evidence.ndjson"), approve: async () => allow });
describe("Logs repair capability confinement", () => {
  it("has no authority outside a repair run", async () => { expect((await call("read", { path: "source.ts" })).ok).toBe(false); });
  it("rejects traversal, secrets, git metadata and symlink escapes", async () => {
    await repairRuntime.run(context(), async () => { for (const file of ["../private.ts", "/etc/passwd", ".env", ".git/config", "escape/private.ts"]) expect((await call("write", { path: file, content: "bad" })).ok).toBe(false); });
    expect(await fs.readFile(path.join(outside, "private.ts"), "utf8")).toBe("private");
  });
  it("creates and reads source files only after approval", async () => {
    await repairRuntime.run(context(false), async () => { expect((await call("write", { path: "source.ts", content: "denied" })).ok).toBe(false); });
    await expect(fs.stat(path.join(root, "source.ts"))).rejects.toThrow();
    await repairRuntime.run(context(), async () => { expect((await call("write", { path: "src/source.ts", content: "export const fixed = true;" })).ok).toBe(true); expect(JSON.stringify((await call("read", { path: "src/source.ts" })).output)).toContain("fixed"); });
  });
  it("provides complete evidence in pages without exposing an arbitrary input path", async () => {
    await fs.writeFile(path.join(outside, "evidence.ndjson"), Array.from({ length: 12 }, (_, n) => JSON.stringify({ message: `event-${n}` })).join("\n") + "\n");
    await repairRuntime.run(context(), async () => {
      const result = await call("evidence", { offset: 10, limit: 2 }); expect(result.ok).toBe(true);
      expect(result.output).toMatchObject({ total: 12, hasMore: false, events: [{ message: "event-10" }, { message: "event-11" }] });
    });
  });
});
