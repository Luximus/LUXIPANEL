// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGrepArgs, parseGrepOutput, contentSearchService } from "./content-search.service.js";
import { ALLOWED_BASES, setAllowedBases } from "./filesystem.service.js";

describe("contentSearchService", () => {
  let tempRoot = "";
  let originalBases: string[] = [];

  beforeEach(() => {
    originalBases = [...ALLOWED_BASES];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "luxipanel-grep-"));
    setAllowedBases([tempRoot]);
  });

  afterEach(() => {
    setAllowedBases(originalBases);
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("builds literal (-F) args for text mode with excludes", () => {
    const args = buildGrepArgs(tempRoot, { path: tempRoot, query: "old-domain.com", mode: "text" });
    expect(args).toContain("-rnI");
    expect(args).toContain("-F"); // literal
    expect(args).toContain("-i"); // case-insensitive by default
    expect(args).toContain("--exclude-dir=node_modules");
    expect(args).toContain("--exclude-dir=.git");
    // pattern is passed via -e, then the path last
    const eIdx = args.indexOf("-e");
    expect(args[eIdx + 1]).toBe("old-domain.com");
    expect(args[args.length - 1]).toBe(tempRoot);
  });

  it("uses -E and the email regex for the email preset (forced case-insensitive)", () => {
    const args = buildGrepArgs(tempRoot, { path: tempRoot, mode: "email", caseSensitive: true });
    expect(args).toContain("-E");
    expect(args).toContain("-i"); // forced regardless of caseSensitive
    const eIdx = args.indexOf("-e");
    expect(args[eIdx + 1]).toContain("@");
  });

  it("respects caseSensitive for regex mode (no -i)", () => {
    const args = buildGrepArgs(tempRoot, { path: tempRoot, query: "Foo", mode: "regex", caseSensitive: true });
    expect(args).toContain("-E");
    expect(args).not.toContain("-i");
  });

  it("parses grep output into per-file groups and counts", () => {
    const stdout = [
      "/srv/app/.env:3:OLD=old-domain.com",
      "/srv/app/.env:9:URL=http://old-domain.com",
      "/srv/app/config/app.php:12:'host' => 'old-domain.com',",
      "",
    ].join("\n");
    const res = parseGrepOutput(stdout, 500);
    expect(res.totalMatches).toBe(3);
    expect(res.files).toHaveLength(2);
    const env = res.files.find((f) => f.name === ".env");
    expect(env?.matches).toHaveLength(2);
    expect(env?.matches[0]).toEqual({ line: 3, text: "OLD=old-domain.com" });
    expect(res.truncated).toBe(false);
  });

  it("marks truncated when the cap is hit", () => {
    const lines = Array.from({ length: 6 }, (_, i) => `/f.txt:${i + 1}:hit`).join("\n");
    const res = parseGrepOutput(lines, 3);
    expect(res.totalMatches).toBe(3);
    expect(res.truncated).toBe(true);
  });

  it("returns empty without running grep when text mode has no query", async () => {
    const exec = vi.fn();
    const res = await contentSearchService.search(
      { target: { id: "remote", name: "R" }, exec } as never,
      { path: tempRoot, query: "  ", mode: "text" },
    );
    expect(res.totalMatches).toBe(0);
    expect(exec).not.toHaveBeenCalled();
  });

  it("runs grep piped into head and parses the result", async () => {
    const exec = vi.fn(async () => ({
      stdout: "/x/.env:1:SECRET=1\n",
      stderr: "",
      exitCode: 0,
      durationMs: 1,
    }));
    const res = await contentSearchService.search(
      { target: { id: "remote", name: "R" }, exec } as never,
      { path: tempRoot, query: "SECRET", mode: "text" },
    );
    const cmd = exec.mock.calls[0]![0] as string;
    expect(cmd).toContain("grep");
    expect(cmd).toContain("| head -n");
    expect(res.totalMatches).toBe(1);
    expect(res.files[0]?.matches[0]?.line).toBe(1);
  });
});
