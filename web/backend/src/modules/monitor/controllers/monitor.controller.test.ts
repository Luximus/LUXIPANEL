// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Monitor controller — isolation & authorization characterization/regression.
 *
 * Focus: the fail-closed cross-tenant fix. A REMOTE target (executor.target.id
 * !== "local") that returns an empty process list / all-inactive services is
 * served AS-IS — the panel host's `localExecutor` is NEVER consulted to
 * back-fill it (that leaked the panel host's data under the target's session).
 * Plus killProcess authorization + typed-error surface.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

import { monitorController } from "./monitor.controller.js";
import { resolveMonitorExecutor } from "../services/monitor-executor.service.js";
import { AppError } from "../../../shared/errors/index.js";

vi.mock("../services/monitor-executor.service.js", () => ({
  resolveMonitorExecutor: vi.fn(),
}));

const mockedResolve = vi.mocked(resolveMonitorExecutor);

/** Fake executor pinned to a REMOTE target id, with a stubbed exec. */
function remoteExecutor(id: string, exec: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }>) {
  return { target: { id, name: id }, exec: vi.fn(exec) } as never;
}

interface FakeRes {
  locals: Record<string, unknown>;
  statusCode: number;
  body: unknown;
  status: (c: number) => FakeRes;
  json: (b: unknown) => FakeRes;
  set: (...a: unknown[]) => FakeRes;
}

/**
 * asyncHandler returns a fire-and-forget `(req,res,next)=>void` (it swallows the
 * inner promise and routes rejections to `next`). So we can't `await` the
 * handler directly — instead expose a `done` promise resolved the instant the
 * handler reaches a terminal action (`res.json` or `next`) and await THAT.
 */
function makeReqRes(opts: { params?: Record<string, string>; query?: Record<string, string>; body?: unknown; user?: Record<string, unknown>; bridgedSession?: Record<string, unknown> } = {}) {
  const req = { params: opts.params ?? {}, query: opts.query ?? {}, body: opts.body ?? {} } as unknown as Request;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => { resolveDone = r; });
  const res: FakeRes = {
    locals: { user: opts.user ?? { kind: "admin", username: "root", bridgeSessionId: "b1" }, bridgedSession: opts.bridgedSession ?? { direct: true } },
    statusCode: 200,
    body: undefined,
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; resolveDone(); return this; },
    set() { return this; },
  };
  const next = vi.fn(() => resolveDone());
  return { req, res: res as unknown as Response, raw: res, next, done };
}

/** Invoke a wrapped controller handler and wait for its terminal action. */
async function invoke(handler: unknown, req: Request, res: Response, next: () => void, done: Promise<void>): Promise<void> {
  (handler as (r: Request, s: Response, n: () => void) => void)(req, res, next);
  await done;
}

beforeEach(() => {
  mockedResolve.mockReset();
});

describe("monitor processes — remote target isolation (fail-closed)", () => {
  it("serves a remote target's EMPTY process list as [] without touching localExecutor", async () => {
    const exec = remoteExecutor("remote-proc-1", async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 }));
    mockedResolve.mockResolvedValue(exec);

    const { req, res, raw, next, done } = makeReqRes({ query: { sortBy: "cpu", limit: "20" } });
    await invoke(monitorController.processes, req, res, next, done);

    expect((raw.body as { data: { processes: unknown[] } }).data.processes).toEqual([]);
    // The remote executor is consulted exactly ONCE — no second load against a
    // panel-host executor (the removed cross-tenant fallback).
    expect(exec.exec).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("monitor services — remote target isolation (fail-closed)", () => {
  it("serves a remote target's all-inactive services as-is without touching localExecutor", async () => {
    // systemctl show for units that are not present → LoadState=not-found,
    // ActiveState=inactive for every unit ⇒ results.every(active===false).
    const exec = remoteExecutor("remote-svc-1", async (cmd: string) => {
      if (cmd.includes("systemctl show")) {
        return { stdout: "Id=nginx.service\nLoadState=not-found\nActiveState=inactive\n", stderr: "", exitCode: 0, durationMs: 1 };
      }
      throw new Error(`unexpected command: ${cmd}`);
    });
    mockedResolve.mockResolvedValue(exec);

    const { req, res, raw, next, done } = makeReqRes();
    await invoke(monitorController.services, req, res, next, done);

    const data = (raw.body as { data: Array<{ active: boolean }> }).data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.every((s) => s.active === false)).toBe(true);
    // Exactly ONE remote call — the removed fallback would have issued a second
    // systemctl against the panel host.
    expect(exec.exec).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("monitor killProcess — authorization + typed errors", () => {
  it("refuses a protected process (sshd) with 403 PROTECTED_PROCESS", async () => {
    const exec = remoteExecutor("kp-1", async () => ({
      stdout: "sshd\n---\n/usr/sbin/sshd -D\n---\nroot\n",
      stderr: "", exitCode: 0, durationMs: 1,
    }));
    mockedResolve.mockResolvedValue(exec);

    const { req, res, raw, next, done } = makeReqRes({ params: { pid: "4321" } });
    await invoke(monitorController.killProcess, req, res, next, done);

    expect(raw.statusCode).toBe(403);
    expect((raw.body as { code: string }).code).toBe("PROTECTED_PROCESS");
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks a non-admin from killing another user's process (403 NOT_OWNER)", async () => {
    const exec = remoteExecutor("kp-2", async () => ({
      stdout: "myapp\n---\n/opt/myapp\n---\nalice\n",
      stderr: "", exitCode: 0, durationMs: 1,
    }));
    mockedResolve.mockResolvedValue(exec);

    const { req, res, raw, next, done } = makeReqRes({
      params: { pid: "5555" },
      user: { kind: "user", username: "bob", bridgeSessionId: "b1" },
    });
    await invoke(monitorController.killProcess, req, res, next, done);

    expect(raw.statusCode).toBe(403);
    expect((raw.body as { code: string }).code).toBe("NOT_OWNER");
  });

  it("surfaces a failed kill as a typed AppError (no raw err.message echo)", async () => {
    const secret = "sudo password leaked in stderr";
    const exec = remoteExecutor("kp-3", async (cmd: string) => {
      if (cmd.includes("/proc/")) {
        return { stdout: "myapp\n---\n/opt/myapp\n---\nroot\n", stderr: "", exitCode: 0, durationMs: 1 };
      }
      throw new Error(secret); // the kill itself blows up
    });
    mockedResolve.mockResolvedValue(exec);

    const { req, res, raw, next, done } = makeReqRes({ params: { pid: "6666" } });
    await invoke(monitorController.killProcess, req, res, next, done);

    // Thrown to the error middleware as a typed AppError — never res.status(500).json(raw).
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("KILL_FAILED");
    expect(err.message).not.toContain(secret);
    expect(raw.body).toBeUndefined(); // no JSON body written on the throw path
  });
});
