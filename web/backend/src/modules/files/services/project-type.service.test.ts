// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projectTypeService } from "./project-type.service.js";
import { ALLOWED_BASES, setAllowedBases } from "./filesystem.service.js";

/** Fake executor backed by an in-memory tree: names per dir + file contents. */
function makeExecutor(names: string[], fileContents: Record<string, string> = {}) {
  const executor = {
    target: { id: "remote", name: "R" },
    readdir: vi.fn(async () => names.map((n) => ({ name: n }))),
    readFile: vi.fn(async (p: string) => {
      const base = p.split("/").pop()!;
      if (fileContents[base] !== undefined) return fileContents[base];
      throw new Error("ENOENT");
    }),
  } as never;
  return executor;
}

describe("projectTypeService.detect", () => {
  let tempRoot = "";
  let originalBases: string[] = [];

  beforeEach(() => {
    originalBases = [...ALLOWED_BASES];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "luxipanel-ptype-"));
    setAllowedBases([tempRoot]);
  });
  afterEach(() => {
    setAllowedBases(originalBases);
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("detects Laravel via artisan + composer laravel/framework", async () => {
    const exec = makeExecutor(
      ["artisan", "composer.json", "public", "routes", "config", "vendor"],
      { "composer.json": JSON.stringify({ require: { "laravel/framework": "^11" } }) },
    );
    const info = await projectTypeService.detect(exec, tempRoot);
    expect(info.type).toBe("laravel");
    expect(info.confidence).toBe("high");
    expect(info.publicRoot).toBe(path.posix.join(tempRoot, "public"));
    const env = info.sections.find((s) => s.key === "env");
    expect(env?.sensitive).toBe(true);
    const pub = info.sections.find((s) => s.key === "public");
    expect(pub?.exists).toBe(true);
    const views = info.sections.find((s) => s.key === "views");
    expect(views?.exists).toBe(false); // no resources/ in listing
  });

  it("detects WordPress via wp-config.php (public root = dir itself)", async () => {
    const exec = makeExecutor(["wp-config.php", "wp-content", "wp-includes", "index.php"]);
    const info = await projectTypeService.detect(exec, tempRoot);
    expect(info.type).toBe("wordpress");
    expect(info.publicRoot).toBe(tempRoot);
    expect(info.sections.find((s) => s.key === "config")?.sensitive).toBe(true);
  });

  it("detects Next.js via the next dependency", async () => {
    const exec = makeExecutor(
      ["package.json", "app", "public"],
      { "package.json": JSON.stringify({ dependencies: { next: "14", react: "18" } }) },
    );
    const info = await projectTypeService.detect(exec, tempRoot);
    expect(info.type).toBe("nextjs");
  });

  it("falls back to generic node for package.json without a framework", async () => {
    const exec = makeExecutor(
      ["package.json", "src"],
      { "package.json": JSON.stringify({ dependencies: { express: "4" } }) },
    );
    const info = await projectTypeService.detect(exec, tempRoot);
    expect(info.type).toBe("node");
  });

  it("detects Django via manage.py", async () => {
    const exec = makeExecutor(["manage.py", "static", "media"]);
    expect((await projectTypeService.detect(exec, tempRoot)).type).toBe("django");
  });

  it("returns unknown for an unrecognised directory", async () => {
    const exec = makeExecutor(["notes.txt", "photo.jpg"]);
    const info = await projectTypeService.detect(exec, tempRoot);
    expect(info.type).toBe("unknown");
    expect(info.sections).toHaveLength(0);
  });
});
