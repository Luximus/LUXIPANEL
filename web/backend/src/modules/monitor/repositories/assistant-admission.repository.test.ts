import { describe, expect, it } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { assistantAdmissionRepository } from "./assistant-admission.repository.js";

function target() {
  const files = new Map<string, string>();
  const writes: Array<{ path: string; mode?: number }> = [];
  const executor = {
    readFile: async (path: string) => {
      if (!files.has(path)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return files.get(path)!;
    },
    exec: async () => ({ exitCode: 0 }),
    writeFile: async (path: string, data: string, opts: { mode?: number }) => {
      writes.push({ path, mode: opts.mode });
      files.set(path, data);
    },
    rename: async (from: string, to: string) => {
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    unlink: async (path: string) => { files.delete(path); },
  } as unknown as Executor;
  return { executor, files, writes };
}

describe("assistant admission on the connected target", () => {
  it("defaults to 85%, then saves an atomic readable target policy", async () => {
    const a = target();
    const b = target();
    expect(await assistantAdmissionRepository.load(a.executor)).toEqual({ memPercent: 85 });
    await assistantAdmissionRepository.save(a.executor, { memPercent: 75 });
    expect(await assistantAdmissionRepository.load(a.executor)).toEqual({ memPercent: 75 });
    expect(await assistantAdmissionRepository.load(b.executor)).toEqual({ memPercent: 85 });
    expect(a.writes).toHaveLength(1);
    expect(a.writes[0]?.mode).toBe(0o644);
    expect([...a.files.keys()]).toEqual([expect.stringMatching(/\/monitor\/assistant-admission\.json$/)]);
  });
  it("rejects invalid percentages before writing", async () => {
    const a = target();
    await expect(assistantAdmissionRepository.save(a.executor, { memPercent: 100 })).rejects.toThrow();
    expect(a.writes).toHaveLength(0);
  });
});
