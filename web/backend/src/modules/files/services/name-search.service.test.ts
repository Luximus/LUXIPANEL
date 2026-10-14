// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { mockExecutor as sharedMockExecutor } from "../../../shared/executor/__fixtures__/mock-executor.js";
import {
  buildFindCommand,
  escapeGlob,
  parseFindOutput,
  nameSearchService,
  MAX_LIMIT,
} from "./name-search.service.js";
import { ALLOWED_BASES, setAllowedBases } from "./filesystem.service.js";

function mockExecutor(stdout: string): { executor: Executor; exec: ReturnType<typeof vi.fn> } {
  const executor = sharedMockExecutor(stdout);
  return { executor, exec: executor.exec as ReturnType<typeof vi.fn> };
}

describe("nameSearchService", () => {
  let tempRoot = "";
  let originalBases: string[] = [];

  beforeEach(() => {
    originalBases = [...ALLOWED_BASES];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "luxipanel-namesearch-"));
    setAllowedBases([tempRoot]);
  });

  afterEach(() => {
    setAllowedBases(originalBases);
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  describe("buildFindCommand", () => {
    it("prunes node_modules/.git and bounds the output with head", () => {
      const cmd = buildFindCommand(tempRoot, "index", 100);
      expect(cmd).toContain(`find '${tempRoot}' -mindepth 1`);
      expect(cmd).toContain("'(' -name 'node_modules' -o -name '.git' ')' -prune");
      expect(cmd).toContain("-iname '*index*'");
      expect(cmd).toContain("-printf '%y\\t%p\\n'");
      // limit + 1 so truncation is detectable
      expect(cmd).toContain("head -n 101");
    });

    it("falls back to a POSIX -exec printf variant when find lacks -printf", () => {
      const cmd = buildFindCommand(tempRoot, "index", 10);
      expect(cmd).toContain("if find /dev/null -maxdepth 0 -printf ''");
      expect(cmd).toContain("-exec printf 'd\\t%s\\n'");
      expect(cmd).toContain("-exec printf 'f\\t%s\\n'");
    });

    it("neutralizes single quotes in the query (no shell injection)", () => {
      const payload = "a'; rm -rf /; echo '";
      const cmd = buildFindCommand(tempRoot, payload, 10);
      // The payload must survive as ONE literal argument of -iname: ask a real
      // shell to expand the quoted word instead of eyeballing the quoting.
      const quoted = /-iname (.+?) -printf/.exec(cmd)?.[1];
      expect(quoted).toBeTruthy();
      const expanded = execFileSync("sh", ["-c", `printf '%s' ${quoted}`]).toString();
      expect(expanded).toBe(`*${payload}*`);
    });

    it("escapes glob metacharacters so the query stays a literal substring", () => {
      expect(escapeGlob("a*b?c[d]")).toBe("a\\*b\\?c\\[d\\]");
      const cmd = buildFindCommand(tempRoot, "a*b", 10);
      expect(cmd).toContain("-iname '*a\\*b*'");
    });
  });

  describe("parseFindOutput", () => {
    it("maps %y to file/dir and derives the name", () => {
      const out = ["d\t/srv/app/config", "f\t/srv/app/config/index.ts", "l\t/srv/app/link"].join("\n");
      const result = parseFindOutput(out, 100, "/srv");
      expect(result.items).toEqual([
        { path: "/srv/app/config", name: "config", type: "dir" },
        { path: "/srv/app/config/index.ts", name: "index.ts", type: "file" },
        { path: "/srv/app/link", name: "link", type: "file" },
      ]);
      expect(result.truncated).toBe(false);
      expect(result.base).toBe("/srv");
    });

    it("flags truncated and trims to the limit", () => {
      const out = Array.from({ length: 5 }, (_, i) => `f\t/srv/f${i}.ts`).join("\n");
      const result = parseFindOutput(out, 3, "/srv");
      expect(result.items).toHaveLength(3);
      expect(result.truncated).toBe(true);
    });

    it("drops the base itself and unparseable lines", () => {
      const out = ["d\t/srv", "garbage-without-tab", "", "f\t/srv/a.ts"].join("\n");
      const result = parseFindOutput(out, 100, "/srv");
      expect(result.items).toEqual([{ path: "/srv/a.ts", name: "a.ts", type: "file" }]);
    });
  });

  describe("search", () => {
    it("runs through the executor and returns typed items", async () => {
      const { executor, exec } = mockExecutor(`d\t${tempRoot}/src\nf\t${tempRoot}/src/index.ts\n`);
      const result = await nameSearchService.search(executor, { base: tempRoot, q: "index" });

      expect(exec).toHaveBeenCalledTimes(1);
      const [cmd, opts] = exec.mock.calls[0]!;
      expect(cmd).toContain(`find '${tempRoot}'`);
      expect(opts).toMatchObject({ timeoutMs: 15_000 });
      expect(result).toEqual({
        items: [
          { path: `${tempRoot}/src`, name: "src", type: "dir" },
          { path: `${tempRoot}/src/index.ts`, name: "index.ts", type: "file" },
        ],
        truncated: false,
        base: tempRoot,
      });
    });

    it("returns empty without touching the executor for a too-short query", async () => {
      const { executor, exec } = mockExecutor("");
      const result = await nameSearchService.search(executor, { base: tempRoot, q: "a" });
      expect(exec).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [], truncated: false, base: tempRoot });
    });

    it("clamps the limit to MAX_LIMIT", async () => {
      const { executor, exec } = mockExecutor("");
      await nameSearchService.search(executor, { base: tempRoot, q: "index", limit: 9999 });
      expect(exec.mock.calls[0]![0]).toContain(`head -n ${MAX_LIMIT + 1}`);
    });

    it("rejects a base outside the sandbox", async () => {
      const { executor, exec } = mockExecutor("");
      await expect(
        nameSearchService.search(executor, { base: "/etc", q: "passwd" }),
      ).rejects.toThrow(/outside allowed directories/);
      expect(exec).not.toHaveBeenCalled();
    });
  });
});
