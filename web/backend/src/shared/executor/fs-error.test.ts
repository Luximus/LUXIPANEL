// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import { mapFsError } from "./fs-error.js";
import { ForbiddenError, NotFoundError } from "../errors/errors.js";

describe("mapFsError", () => {
  const P = "/home/dayz";

  it("SFTP PERMISSION_DENIED (code 3) → ForbiddenError/403", () => {
    const e = mapFsError({ code: 3, message: "Permission denied" }, P);
    expect(e).toBeInstanceOf(ForbiddenError);
    expect((e as ForbiddenError).statusCode).toBe(403);
    expect(e.message).toContain(P);
  });

  it("SFTP NO_SUCH_FILE (code 2) → NotFoundError/404", () => {
    const e = mapFsError({ code: 2, message: "No such file" }, P);
    expect(e).toBeInstanceOf(NotFoundError);
    expect((e as NotFoundError).statusCode).toBe(404);
  });

  it("Node fs EACCES → ForbiddenError/403", () => {
    const err = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    const e = mapFsError(err, P);
    expect(e).toBeInstanceOf(ForbiddenError);
    expect((e as ForbiddenError).statusCode).toBe(403);
  });

  it("Node fs EPERM → ForbiddenError/403", () => {
    const err = Object.assign(new Error("EPERM"), { code: "EPERM" });
    expect(mapFsError(err, P)).toBeInstanceOf(ForbiddenError);
  });

  it("Node fs ENOENT → NotFoundError/404", () => {
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    const e = mapFsError(err, P);
    expect(e).toBeInstanceOf(NotFoundError);
    expect((e as NotFoundError).statusCode).toBe(404);
  });

  it("string-only 'Permission denied' message → ForbiddenError", () => {
    expect(mapFsError(new Error("SFTP: Permission denied"), P)).toBeInstanceOf(ForbiddenError);
  });

  it("unknown error is re-thrown untouched (not masked as permission)", () => {
    const orig = new Error("connection reset by peer");
    const e = mapFsError(orig, P);
    expect(e).toBe(orig);
    expect(e).not.toBeInstanceOf(ForbiddenError);
    expect(e).not.toBeInstanceOf(NotFoundError);
  });

  it("simulated executor.readdir rejecting with EACCES maps to 403", async () => {
    const readdir = () => Promise.reject(Object.assign(new Error("EACCES"), { code: "EACCES" }));
    let caught: unknown;
    try {
      await readdir();
    } catch (err) {
      caught = mapFsError(err, P);
    }
    expect(caught).toBeInstanceOf(ForbiddenError);
    expect((caught as ForbiddenError).statusCode).toBe(403);
  });
});
