import { describe, it, expect } from "vitest";
import { ValidationError } from "../../../shared/errors/index.js";
import {
  resolveRel,
  relFromAbs,
  parentDir,
  isAbsoluteUnixPath,
  hasAllowedNoteExtension,
  assertNoteExtension,
} from "./path-util.js";

const VAULT = "/home/dev/vault";

describe("resolveRel", () => {
  it("resolves a simple note path", () => {
    expect(resolveRel(VAULT, "nota.md")).toBe("/home/dev/vault/nota.md");
  });

  it("resolves a nested note path", () => {
    expect(resolveRel(VAULT, "carpeta/nota.md")).toBe("/home/dev/vault/carpeta/nota.md");
  });

  it("tolerates a trailing slash on the vault path", () => {
    expect(resolveRel("/home/dev/vault/", "nota.md")).toBe("/home/dev/vault/nota.md");
  });

  it("collapses redundant separators and '.' segments", () => {
    expect(resolveRel(VAULT, "a//./b.md")).toBe("/home/dev/vault/a/b.md");
  });

  it("rejects the empty path", () => {
    expect(() => resolveRel(VAULT, "")).toThrow(ValidationError);
  });

  it("rejects '..'", () => {
    expect(() => resolveRel(VAULT, "..")).toThrow(ValidationError);
  });

  it("rejects traversal buried in the path (a/../..)", () => {
    expect(() => resolveRel(VAULT, "a/../..")).toThrow(ValidationError);
  });

  it("rejects any '..' segment even when it would stay inside", () => {
    expect(() => resolveRel(VAULT, "a/../b.md")).toThrow(ValidationError);
  });

  it("rejects absolute paths", () => {
    expect(() => resolveRel(VAULT, "/abs")).toThrow(ValidationError);
  });

  it("rejects NUL bytes", () => {
    expect(() => resolveRel(VAULT, "a\0b")).toThrow(ValidationError);
  });

  it("rejects paths that normalize to nothing", () => {
    expect(() => resolveRel(VAULT, "./.")).toThrow(ValidationError);
  });

  it("rejects a non-absolute vault path", () => {
    expect(() => resolveRel("relative/vault", "nota.md")).toThrow(ValidationError);
  });
});

describe("relFromAbs", () => {
  it("inverts resolveRel", () => {
    const abs = resolveRel(VAULT, "carpeta/nota.md");
    expect(relFromAbs(VAULT, abs)).toBe("carpeta/nota.md");
  });

  it("returns '' for the vault root itself", () => {
    expect(relFromAbs(VAULT, VAULT)).toBe("");
  });
});

describe("parentDir", () => {
  it("returns the containing directory", () => {
    expect(parentDir("/a/b/c.md")).toBe("/a/b");
  });

  it("returns / for top-level entries", () => {
    expect(parentDir("/c.md")).toBe("/");
  });
});

describe("isAbsoluteUnixPath", () => {
  it("accepts absolute paths and rejects relative / NUL ones", () => {
    expect(isAbsoluteUnixPath("/home/dev")).toBe(true);
    expect(isAbsoluteUnixPath("home/dev")).toBe(false);
    expect(isAbsoluteUnixPath("/home/\0dev")).toBe(false);
  });
});

describe("note extensions", () => {
  it("accepts .md, .canvas and .txt", () => {
    expect(hasAllowedNoteExtension("nota.md")).toBe(true);
    expect(hasAllowedNoteExtension("tablero.canvas")).toBe(true);
    expect(hasAllowedNoteExtension("apunte.txt")).toBe(true);
    expect(hasAllowedNoteExtension("Nota.MD")).toBe(true);
  });

  it("rejects other extensions and bare names", () => {
    expect(hasAllowedNoteExtension("script.sh")).toBe(false);
    expect(hasAllowedNoteExtension("nota")).toBe(false);
    expect(hasAllowedNoteExtension(".md")).toBe(false);
  });

  it("assertNoteExtension throws ValidationError for invalid extensions", () => {
    expect(() => assertNoteExtension("script.sh")).toThrow(ValidationError);
    expect(() => assertNoteExtension("nota.md")).not.toThrow();
  });
});
