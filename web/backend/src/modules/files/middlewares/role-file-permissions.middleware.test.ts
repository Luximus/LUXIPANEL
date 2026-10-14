// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../../../shared/errors/index.js";

const canAccessPath = vi.fn();
let resolvedPath = "/srv/checked";
vi.mock("../../../shared/executor/index.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return { ...original, getExecutor: () => ({ exec: async () => ({ stdout: resolvedPath + "\n", stderr: "", exitCode: 0 }) }) };
});
vi.mock("../../auth/services/role-permissions.service.js", () => ({
  canAccessPath: (...a: unknown[]) => canAccessPath(...a),
}));

const { enforceFilePathPermission } = await import("./role-file-permissions.middleware.js");
const { ALLOWED_BASES, setAllowedBases } = await import("../services/filesystem.service.js");
const originalBases = [...ALLOWED_BASES];

type AnyReq = { query: Record<string, unknown>; body?: Record<string, unknown>; originalUrl: string };

async function run(body: Record<string, unknown>, query: Record<string, unknown> = {}) {
  const req = { query, body, originalUrl: "/api/files/test" } as AnyReq;
  const res = { locals: { user: { username: "u", kind: "panel", permissions: {} } } };
  const next = vi.fn();
  await new Promise<void>((resolve) => {
    enforceFilePathPermission("write")(req as never, res as never, ((error?: Error) => { if (error) next(error); else next(); resolve(); }) as never);
  });
  return next;
}

beforeEach(() => {
  setAllowedBases(["/srv", "/etc"]);
  resolvedPath = "/srv/checked";
  canAccessPath.mockReset();
  // Deny anything under /etc, allow the rest.
  canAccessPath.mockImplementation((_user: unknown, p: unknown) => !String(p).startsWith("/etc"));
});
afterEach(() => setAllowedBases(originalBases));

describe("enforceFilePathPermission — archive payload keys (B2)", () => {
  it("denies a traversal/denied path in body.archive", async () => {
    const next = await run({ archive: "/etc/passwd", destDir: "/srv/out" });
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("denies a denied path in body.destDir (extract destination)", async () => {
    const next = await run({ archive: "/srv/a.tar.gz", destDir: "/etc/cron.d" });
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("denies when any entry of body.sources escapes (compress)", async () => {
    const next = await run({ sources: ["/srv/ok.txt", "/etc/shadow"], dest: "/srv/a.tar.gz" });
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("denies a denied path in body.dest and query.dest (upload)", async () => {
    expect(await run({ dest: "/etc/systemd" })).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(await run({}, { dest: "/etc/systemd" })).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("checks EVERY whitelisted archive key against the role policy", async () => {
    const next = await run({ archive: "/srv/a.zip", destDir: "/srv/out", sources: ["/srv/x", "/srv/y"], dest: "/srv/d" });
    expect(next).toHaveBeenCalledWith(); // allowed → next() with no error
    const checked = canAccessPath.mock.calls.map((c) => c[1]);
    for (const p of ["/srv/a.zip", "/srv/out", "/srv/x", "/srv/y", "/srv/d"]) {
      expect(checked).toContain(p);
    }
  });

  it("still allows a clean payload", async () => {
    const next = await run({ archive: "/srv/a.tar.gz", destDir: "/srv/out" });
    expect(next).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it("denies a symlink whose resolved target escapes the allowed role path", async () => {
    resolvedPath = "/etc/shadow";
    expect(await run({ path: "/srv/alias" })).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
