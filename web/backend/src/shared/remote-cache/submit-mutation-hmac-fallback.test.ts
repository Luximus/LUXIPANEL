// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * W1 HIGH-3 follow-up: when the on-box worker REJECTS a job at the HMAC trust
 * boundary (fail-closed worker + panel that enqueued unsigned / with a divergent
 * canonical form — the classic deploy-window skew), the queued CRUD must NOT be
 * left dead. `submitMutation` degrades to the synchronous twin `applyStepsLive`
 * exactly like the "Redis unreachable" path, and emits WRITE_QUEUE_DEGRADED.
 *
 * A GENUINE step failure (the recipe ran partially on the box) must NOT fall
 * back to local — that would double-execute. It must propagate the error.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── module mocks (hoisted) ───────────────────────────────────────────────────
// Fake a provisioned per-server Redis conn so the queue path is taken.
vi.mock("./conn.js", () => ({
  getRemoteCacheConn: vi.fn(async () => ({
    host: "127.0.0.1",
    port: 7379,
    password: "hex",
  })),
}));

// Intercept redis-cli exec: route by the shell command being run.
const execWithRedisAuth = vi.fn();
vi.mock("./redis-cli.js", () => ({
  execWithRedisAuth: (...a: unknown[]) => execWithRedisAuth(...a),
  redisBase: () => "redis-cli",
  escapeSingleQuoted: (s: string) => `'${s}'`,
}));

// scheduleRefresh must not hit a real Redis.
vi.mock("./refresh.js", () => ({ scheduleRefresh: vi.fn(async () => {}) }));

// Worklog is fire-and-forget; keep it inert.
vi.mock("../worklog/worklog-recorder.service.js", () => ({
  recordActivity: vi.fn(async () => {}),
}));
vi.mock("../worklog/worklog-taxonomy.js", () => ({
  taxonomyFor: () => ({ category: "test", stacks: [] }),
}));

import { gzipB64 } from "./codec.js";
import {
  submitMutation,
  isHmacRejection,
  type JobStatus,
  type MutationStep,
} from "./submit-mutation.js";
import { eventBus, Events } from "../events/index.js";
import type { Executor } from "../executor/types.js";

/** Build the execWithRedisAuth router for a given terminal status blob. */
function wireRedis(status: JobStatus): void {
  execWithRedisAuth.mockImplementation(
    async (_ex: unknown, _conn: unknown, shell: string) => {
      if (shell.includes("BLPOP")) {
        // Worker signalled done: non-empty BLPOP reply.
        return { exitCode: 0, stdout: `lpwq:v1:done\n1\n`, stderr: "" };
      }
      if (shell.includes("GET ")) {
        // readJobStatus reads the status blob (gzip+b64, quoted by --no-raw).
        return { exitCode: 0, stdout: `"${gzipB64(JSON.stringify(status))}"\n`, stderr: "" };
      }
      // Enqueue (SET/RPUSH) round-trip succeeds.
      return { exitCode: 0, stdout: "OK\n", stderr: "" };
    },
  );
}

function mockExecutor() {
  const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  const writeFile = vi.fn().mockResolvedValue(undefined);
  // signJob reads the per-box HMAC key over SSH; make it unavailable (unsigned).
  const readFile = vi.fn().mockRejectedValue(new Error("ENOENT"));
  const executor = {
    target: { id: "srv-hmac", name: "srv-hmac" },
    exec,
    writeFile,
    readFile,
  } as unknown as Executor;
  return { executor, exec, writeFile };
}

// A single non-privileged shell step: applyStepsLive → executor.exec("echo hi").
const STEPS: MutationStep[] = [{ type: "sh", cmd: "echo hi" }];

describe("isHmacRejection — classify a terminal failed status", () => {
  it("true: worker HMAC rejection (no failedStep, HMAC error text)", () => {
    expect(
      isHmacRejection({
        jobId: "j",
        state: "failed",
        error: "job payload HMAC missing or invalid",
      }),
    ).toBe(true);
  });

  it("false: genuine step failure (failedStep set)", () => {
    expect(
      isHmacRejection({
        jobId: "j",
        state: "failed",
        error: "sudo: useradd failed",
        failedStep: 0,
        attempts: 1,
      }),
    ).toBe(false);
  });

  it("false: a step failure whose stderr merely mentions hmac (failedStep set)", () => {
    expect(
      isHmacRejection({
        jobId: "j",
        state: "failed",
        error: "openssl: could not load hmac module",
        failedStep: 2,
      }),
    ).toBe(false);
  });

  it("false: poison / attempts exceeded (may have run before, non-HMAC error)", () => {
    expect(
      isHmacRejection({
        jobId: "j",
        state: "failed",
        error: "excedió reintentos (posible job venenoso)",
        attempts: 2,
      }),
    ).toBe(false);
  });

  it("false: corrupt payload (no failedStep, non-HMAC error)", () => {
    expect(
      isHmacRejection({ jobId: "j", state: "failed", error: "job payload missing/corrupt" }),
    ).toBe(false);
  });

  it("false: done", () => {
    expect(isHmacRejection({ jobId: "j", state: "done" })).toBe(false);
  });
});

describe("submitMutation — HMAC rejection degrades to applyStepsLive", () => {
  beforeEach(() => {
    execWithRedisAuth.mockReset();
  });

  it("worker rejected job at HMAC boundary → applyStepsLive runs, mode=applied, DEGRADED emitted", async () => {
    wireRedis({ jobId: "x", state: "failed", error: "job payload HMAC missing or invalid" });
    const { executor, exec } = mockExecutor();

    const degraded: unknown[] = [];
    const onDegraded = (p: unknown) => degraded.push(p);
    const failed: unknown[] = [];
    const onFailed = (p: unknown) => failed.push(p);
    eventBus.on(Events.WRITE_QUEUE_DEGRADED, onDegraded);
    eventBus.on(Events.WRITE_QUEUE_JOB_FAILED, onFailed);
    try {
      const res = await submitMutation(executor, {
        module: "users",
        collection: "system",
        op: "create",
        steps: STEPS,
      });
      // Fell back to the synchronous twin.
      expect(res.mode).toBe("applied");
      expect(res.error).toBeTruthy();
      // The recipe DID run locally (exactly once).
      expect(exec).toHaveBeenCalledWith("echo hi", expect.anything());
      // Degradation is distinguishable; it is NOT reported as a plain job failure.
      expect(degraded).toHaveLength(1);
      expect(failed).toHaveLength(0);
    } finally {
      eventBus.off(Events.WRITE_QUEUE_DEGRADED, onDegraded);
      eventBus.off(Events.WRITE_QUEUE_JOB_FAILED, onFailed);
    }
  });

  it("genuine step failure → propagates error, does NOT re-run locally (no double-execution)", async () => {
    wireRedis({
      jobId: "x",
      state: "failed",
      error: "sudo: useradd: user 'alice' already exists",
      failedStep: 0,
      attempts: 1,
    });
    const { executor, exec } = mockExecutor();

    const failed: unknown[] = [];
    const onFailed = (p: unknown) => failed.push(p);
    eventBus.on(Events.WRITE_QUEUE_JOB_FAILED, onFailed);
    try {
      await expect(
        submitMutation(executor, {
          module: "users",
          collection: "system",
          op: "create",
          steps: STEPS,
        }),
      ).rejects.toThrow(/useradd/i);
      // Must NOT have applied the recipe locally — the worker already ran it.
      expect(exec).not.toHaveBeenCalledWith("echo hi", expect.anything());
      // Reported as a genuine job failure.
      expect(failed).toHaveLength(1);
    } finally {
      eventBus.off(Events.WRITE_QUEUE_JOB_FAILED, onFailed);
    }
  });
});
