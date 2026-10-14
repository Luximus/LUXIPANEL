// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALLOWED_BASES, filesystemService, setAllowedBases } from "./filesystem.service.js";

describe("filesystemService.copyFile", () => {
  let tempRoot = "";
  let originalBases: string[] = [];

  beforeEach(() => {
    originalBases = [...ALLOWED_BASES];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "luxipanel-files-"));
    setAllowedBases([tempRoot]);
  });

  afterEach(() => {
    setAllowedBases(originalBases);
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("copies a single file", () => {
    const source = path.join(tempRoot, "source.txt");
    const target = path.join(tempRoot, "nested", "target.txt");
    fs.writeFileSync(source, "hello world", "utf-8");

    filesystemService.copyFile(source, target);

    expect(fs.readFileSync(target, "utf-8")).toBe("hello world");
  });

  it("copies directories recursively", () => {
    const sourceDir = path.join(tempRoot, "source-dir");
    const nestedDir = path.join(sourceDir, "deep", "inside");
    const targetDir = path.join(tempRoot, "copies", "source-dir");
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "root.txt"), "root", "utf-8");
    fs.writeFileSync(path.join(nestedDir, "nested.txt"), "nested", "utf-8");

    filesystemService.copyFile(sourceDir, targetDir);

    expect(fs.readFileSync(path.join(targetDir, "root.txt"), "utf-8")).toBe("root");
    expect(fs.readFileSync(path.join(targetDir, "deep", "inside", "nested.txt"), "utf-8")).toBe("nested");
  });

  it("rejects existing destinations", () => {
    const source = path.join(tempRoot, "source.txt");
    const target = path.join(tempRoot, "target.txt");
    fs.writeFileSync(source, "one", "utf-8");
    fs.writeFileSync(target, "two", "utf-8");

    expect(() => filesystemService.copyFile(source, target)).toThrowError(/Destination already exists/);
  });
});
