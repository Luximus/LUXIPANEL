// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import fs from "node:fs";
import { Duplex, Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Flush pending microtasks — asyncHandler is fire-and-forget (returns void),
 *  so the streaming body runs detached after `download()` returns. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

const getExecutorMock = vi.fn();
const openSftpStreamMock = vi.fn();
const pipelineMock = vi.fn(async () => undefined);
const buildDownloadZipMock = vi.fn(async () => undefined);

vi.mock("../../../shared/executor/index.js", () => ({
  getExecutor: (...args: unknown[]) => getExecutorMock(...args),
  // No pinned user in these streaming tests → the controller skips the
  // re-check of the final joined path (same as admin/internal runs).
  getContextUser: () => null,
  // Minimal shell-quoting stub — join argv so the temp-dir cleanup assertion
  // can still see the command shape (`rm -rf <tmpDir>`).
  quoteCmd: (bin: string, args: string[]) => [bin, ...args].join(" "),
}));

vi.mock("../../../shared/executor/ssh-proxy-client.service.js", () => ({
  sshProxyClient: {
    openSftpStream: (...args: unknown[]) => openSftpStreamMock(...args),
  },
}));

vi.mock("node:stream/promises", () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
}));

// Upload/download streaming is independent of the pre-mutation snapshot hook.
// Stub it to a single-tick no-op so the controller's async ordering matches the
// (fire-and-forget) asyncHandler contract this test relies on.
vi.mock("../services/index.js", () => ({
  snapshotService: { capture: vi.fn(async () => null) },
  archiveService: {
    buildDownloadZip: (...args: unknown[]) => buildDownloadZipMock(...args),
  },
}));
vi.mock("../services/files-config.service.js", () => ({
  filesConfigService: { get: async () => ({ uploadMaxBytes: 536_870_912 }) },
}));

import { uploadController } from "./upload.controller.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import { __resetEscalationCacheForTests } from "../../../shared/system/privilege-escalation.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import type { SessionUser } from "../../../shared/types/index.js";

/** A logged-in panel user for the escalation-gate paths; the connected server's
 *  `id -nG` (mocked per test) decides whether they're sudo/wheel. */
const SUDO_USER = { userId: 1, username: "admin" } as unknown as SessionUser;
const asUser = (fn: () => Promise<void>) => runWithExecutor(null as never, fn, SUDO_USER.userId, SUDO_USER);

function createResponse() {
  class MockResponse {
    statusCode: number;
    headers: Record<string, string | number>;
    locals: Record<string, unknown>;
    constructor() {
      this.statusCode = 200;
      this.headers = {};
      this.locals = {};
    }

    setHeader(name: string, value: string | number): void {
      this.headers[name] = value;
    }

    status(code: number): this {
      this.statusCode = code;
      return this;
    }

    json(_payload: unknown): this {
      return this;
    }
  }

  return new MockResponse();
}

describe("uploadController", () => {
  beforeEach(() => {
    getExecutorMock.mockReset();
    openSftpStreamMock.mockReset();
    pipelineMock.mockReset();
    buildDownloadZipMock.mockReset();
    __resetEscalationCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("streams remote downloads through the SFTP WS", async () => {
    const remoteStream = Readable.from([Buffer.from("hello world")]);
    openSftpStreamMock.mockReturnValueOnce(remoteStream);
    getExecutorMock.mockReturnValueOnce({
      target: { id: "target-1", name: "Target" },
      stat: vi.fn(async () => ({ type: "file", size: 11 })),
      readFile: vi.fn(),
    });

    const req = {
      query: { path: "/tmp/hello.txt" },
      res: { locals: { bridgedSession: { remoteSessionId: "remote-1" } } },
    } as never;
    const res = createResponse();

    await uploadController.download(req, res);

    expect(openSftpStreamMock).toHaveBeenCalledWith("remote-1", "/tmp/hello.txt", "read");
    expect(pipelineMock).toHaveBeenCalledWith(remoteStream, res);
    expect(res.headers["Content-Length"]).toBe(11);
  });

  it("streams a directory as a ZIP built on the target and cleans up the temp dir", async () => {
    const remoteStream = Readable.from([Buffer.from("PK\x03\x04zipbytes")]);
    openSftpStreamMock.mockReturnValueOnce(remoteStream);
    const tmpDir = "/tmp/lxp-dl-abc123";
    const execMock = vi.fn(async (cmd: string) => {
      if (cmd.startsWith("mktemp")) return { stdout: `${tmpDir}\n`, stderr: "", exitCode: 0, durationMs: 1 };
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
    });
    const statMock = vi
      .fn()
      // 1st stat = the source path (a directory)
      .mockResolvedValueOnce({ type: "dir", isDir: true, size: 0 })
      // 2nd stat = the built temp zip
      .mockResolvedValueOnce({ type: "file", isDir: false, size: 42 });
    getExecutorMock.mockReturnValueOnce({
      target: { id: "target-1", name: "Target" },
      exec: execMock,
      stat: statMock,
      readFile: vi.fn(),
    });

    const req = {
      query: { path: "/var/www/site", zip: "true" },
      res: { locals: { bridgedSession: { remoteSessionId: "remote-1" } } },
    } as never;
    const res = createResponse();

    await uploadController.download(req, res);
    await flush();

    // ZIP built via the executor (per-server), not on the panel host.
    expect(buildDownloadZipMock).toHaveBeenCalledTimes(1);
    const [sources, dest, execArg] = buildDownloadZipMock.mock.calls[0]!;
    expect(sources).toEqual(["/var/www/site"]);
    expect(dest).toBe(`${tmpDir}/site.zip`);
    expect((execArg as { target: { id: string } }).target.id).toBe("target-1");
    // Streamed back from the temp zip, and the temp zip is what SFTP reads.
    expect(openSftpStreamMock).toHaveBeenCalledWith("remote-1", `${tmpDir}/site.zip`, "read");
    expect(pipelineMock).toHaveBeenCalledWith(remoteStream, res);
    expect(res.headers["Content-Type"]).toBe("application/zip");
    expect(String(res.headers["Content-Disposition"])).toContain('filename="site.zip"');
    expect(res.headers["Content-Length"]).toBe(42);
    // Scratch dir removed afterwards (rm -rf <tmpDir>).
    expect(execMock.mock.calls.some((c) => String(c[0]).includes("rm") && String(c[0]).includes(tmpDir))).toBe(true);
  });

  it("builds the ZIP locally for the local target", async () => {
    // Local target streams via fs.createReadStream — stub it so the (mocked)
    // pipeline never touches the real (nonexistent) temp path.
    vi.spyOn(fs, "createReadStream").mockReturnValue(
      Readable.from([Buffer.from("zip")]) as unknown as fs.ReadStream,
    );
    const tmpDir = "/tmp/lxp-dl-local";
    const execMock = vi.fn(async (cmd: string) => {
      if (cmd.startsWith("mktemp")) return { stdout: `${tmpDir}\n`, stderr: "", exitCode: 0, durationMs: 1 };
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
    });
    const statMock = vi
      .fn()
      .mockResolvedValueOnce({ type: "file", isDir: false, size: 10 })
      .mockResolvedValueOnce({ type: "file", isDir: false, size: 99 });
    getExecutorMock.mockReturnValueOnce({
      target: { id: "local", name: "Local" },
      exec: execMock,
      stat: statMock,
    });

    const req = { query: { path: "/etc/hosts", zip: "true" }, res: { locals: {} } } as never;
    const res = createResponse();

    await uploadController.download(req, res);
    await flush();

    expect(buildDownloadZipMock).toHaveBeenCalledTimes(1);
    const [sources, dest] = buildDownloadZipMock.mock.calls[0]!;
    expect(sources).toEqual(["/etc/hosts"]);
    expect(dest).toBe(`${tmpDir}/hosts.zip`);
    expect(res.headers["Content-Type"]).toBe("application/zip");
    expect(String(res.headers["Content-Disposition"])).toContain('filename="hosts.zip"');
    expect(pipelineMock).toHaveBeenCalled();
    expect(execMock.mock.calls.some((c) => String(c[0]).includes("rm") && String(c[0]).includes(tmpDir))).toBe(true);
  });

  it("streams remote uploads through the SFTP WS", async () => {
    const remoteStream = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
      final(callback) {
        callback();
      },
    });
    openSftpStreamMock.mockReturnValueOnce(remoteStream);
    getExecutorMock.mockReturnValueOnce({
      target: { id: "target-1", name: "Target" },
      writeFile: vi.fn(),
    });

    const req = {
      query: { dest: "/tmp", filename: "upload.txt" },
      body: Buffer.from("payload"),
      res: { locals: { bridgedSession: { remoteSessionId: "remote-1" } } },
    } as never;
    const res = createResponse();

    await uploadController.upload(req, res);
    // asyncHandler is fire-and-forget, and the handler now awaits a pre-mutation
    // snapshot before streaming — flush pending microtasks so the SFTP call has
    // run before we assert.
    await new Promise((resolve) => setImmediate(resolve));

    expect(openSftpStreamMock).toHaveBeenCalledWith("remote-1", "/tmp/upload.txt", "write");
    expect(pipelineMock).toHaveBeenCalled();
    expect(openSftpStreamMock).toHaveBeenCalledWith("remote-1", "/tmp/upload.txt", "write");
    expect(res.statusCode).toBe(201);
  });

  it("writes the body and returns 201 for a LOCAL-target upload (happy path)", async () => {
    // Happy-path regression guard: a normal upload to the CONNECTED (local)
    // server must persist the raw bytes via executor.writeFile and answer 201.
    // The cache-invalidation drop is fail-open (no exec on this local stub →
    // isExecLike is false → it resolves to a no-op), so it must never turn a
    // successful write into an error response.
    const writeFileMock = vi.fn(async () => undefined);
    getExecutorMock.mockReturnValueOnce({
      target: { id: "local", name: "Local" },
      writeFile: writeFileMock,
    });

    const body = Buffer.from("hello-luxi-upload");
    const req = {
      query: { dest: "/var/www", filename: "index.html" },
      body,
      res: { locals: {} },
    } as never;
    const res = createResponse();

    await uploadController.upload(req, res);
    await new Promise((resolve) => setImmediate(resolve));

    expect(writeFileMock).toHaveBeenCalledWith("/var/www/index.html", body);
    // Local write must NOT go through the SFTP stream path.
    expect(openSftpStreamMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });

  it("falls back to the sudo staging ladder when the direct write is EACCES, and chowns to the dir owner", async () => {
    // Uploading into a dir the panel's local user can't write (e.g.
    // /home/<otheruser>) used to surface as an opaque 500. The direct write
    // throws EACCES; the controller must stage a 0600 temp the user CAN write
    // and `sudo cp` it into place. It must ALSO `sudo chown` the file to the
    // destination dir's owner (resolved via `stat -c %u:%g`) so the file does
    // not stay root-owned and lock the real owner out (the @LuxiCore.zip bug).
    const execMock = vi.fn(async (cmd: string) => {
      // The escalation gate resolves the logged-in user's groups here.
      if (cmd.startsWith("id -nG")) {
        return { stdout: "dayz sudo\n", stderr: "", exitCode: 0, durationMs: 1 };
      }
      // Owner resolution of the destination directory.
      if (cmd.includes("stat") && cmd.includes("%u:%g")) {
        return { stdout: "1000:1000\n", stderr: "", exitCode: 0, durationMs: 1 };
      }
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
    });
    const writeFileMock = vi.fn(async (targetPath: string) => {
      if (targetPath.startsWith("/tmp/")) return undefined; // staging temp: OK
      const err = new Error("EACCES: permission denied, open '/home/dayz/x.zip'") as Error & { code?: string };
      err.code = "EACCES";
      throw err; // direct write to the destination: denied
    });
    getExecutorMock.mockReturnValueOnce({
      target: { id: "local", name: "Local" },
      writeFile: writeFileMock,
      exec: execMock,
    });

    const body = Buffer.from("hello-from-otheruser-home");
    const req = {
      query: { dest: "/home/dayz", filename: "x.zip" },
      body,
      res: { locals: {} },
    } as never;
    const res = createResponse();

    // The upload runs as a sudo-group user, so the ladder is allowed to escalate.
    await asUser(() => uploadController.upload(req, res) as unknown as Promise<void>);
    await new Promise((resolve) => setImmediate(resolve));

    // Direct write attempted at the destination, then a 0600 temp was staged.
    expect(writeFileMock).toHaveBeenCalledWith("/home/dayz/x.zip", body);
    expect(
      writeFileMock.mock.calls.some(
        ([p, , opts]) => String(p).startsWith("/tmp/") && (opts as { mode?: number })?.mode === 0o600,
      ),
    ).toBe(true);
    // The destination DIRECTORY's owner was resolved (numeric uid:gid).
    expect(
      execMock.mock.calls.some(
        (c) => String(c[0]).includes("stat") && String(c[0]).includes("%u:%g") && String(c[0]).includes("/home/dayz"),
      ),
    ).toBe(true);
    // `sudo cp <tmp> /home/dayz/x.zip` ran via the executor (passphrase
    // injected transparently by the sudo boundary).
    expect(
      execMock.mock.calls.some(
        (c) => String(c[0]).includes("sudo") && String(c[0]).includes("cp") && String(c[0]).includes("/home/dayz/x.zip"),
      ),
    ).toBe(true);
    // …and the file was chowned to the dir owner (1000:1000), NOT left root.
    expect(
      execMock.mock.calls.some(
        (c) =>
          String(c[0]).includes("sudo") &&
          String(c[0]).includes("chown") &&
          String(c[0]).includes("1000:1000") &&
          String(c[0]).includes("/home/dayz/x.zip"),
      ),
    ).toBe(true);
    expect(res.statusCode).toBe(201);
  });

  it("does NOT escalate an upload for a NON-privileged user — 403, no sudo cp", async () => {
    // Same EACCES scenario, but the logged-in user is NOT in sudo/wheel on the
    // connected server: the ladder must be refused (typed 403) and NO `sudo cp`
    // may run — the unprivileged user keeps root's files out of reach.
    const execMock = vi.fn(async (cmd: string) => {
      if (cmd.startsWith("id -nG")) {
        return { stdout: "users dayz\n", stderr: "", exitCode: 0, durationMs: 1 };
      }
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
    });
    const writeFileMock = vi.fn(async (targetPath: string) => {
      if (targetPath.startsWith("/tmp/")) return undefined;
      const err = new Error("EACCES: permission denied, open '/root/x.zip'") as Error & { code?: string };
      err.code = "EACCES";
      throw err;
    });
    getExecutorMock.mockReturnValueOnce({
      target: { id: "local", name: "Local" },
      writeFile: writeFileMock,
      exec: execMock,
    });

    const nextMock = vi.fn();
    const req = {
      query: { dest: "/root", filename: "x.zip" },
      body: Buffer.from("denied-payload"),
      res: { locals: {} },
    } as never;
    const res = createResponse();

    await asUser(() => {
      (uploadController.upload as unknown as (a: unknown, b: unknown, c: unknown) => void)(req, res, nextMock);
      return Promise.resolve();
    });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    // The handler forwarded a typed 403 to Express instead of escalating.
    expect(nextMock).toHaveBeenCalledTimes(1);
    expect(nextMock.mock.calls[0]![0]).toBeInstanceOf(ForbiddenError);
    // No `sudo cp` ladder ran.
    const cmds = execMock.mock.calls.map((c) => String(c[0]));
    expect(cmds.some((c) => c.includes("sudo") && c.includes("cp"))).toBe(false);
    expect(res.statusCode).not.toBe(201);
  });

  it("rejects an empty body with 400 (never a silent 201)", async () => {
    getExecutorMock.mockReturnValueOnce({
      target: { id: "local", name: "Local" },
      writeFile: vi.fn(),
    });

    const req = {
      query: { dest: "/var/www", filename: "empty.txt" },
      body: Buffer.alloc(0),
      res: { locals: {} },
    } as never;
    const res = createResponse();

    await uploadController.upload(req, res);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.statusCode).toBe(400);
  });
});
