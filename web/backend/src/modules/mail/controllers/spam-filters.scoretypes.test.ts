// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — spamFiltersController.scoreTypes.
 *
 * Guards the per-server isolation fix: SpamAssassin rule names are read from
 * the CONNECTED SERVER via the context Executor, and the in-memory cache is
 * keyed by `executor.target.id` — a rule set discovered on server A must never
 * be served for server B, and a second read for the same server is cached.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Keep everything in shared/executor real except getContextExecutor.
vi.mock("../../../shared/executor/index.js", async (orig) => {
  const actual = await orig<typeof import("../../../shared/executor/index.js")>();
  return { ...actual, getContextExecutor: vi.fn() };
});

import { getContextExecutor } from "../../../shared/executor/index.js";
import { spamFiltersController } from "./spam-filters.controller.js";

const mockedGetCtx = vi.mocked(getContextExecutor);

function fakeExecutor(targetId: string, stdout: string) {
  return {
    target: { id: targetId, name: targetId },
    exec: vi.fn().mockResolvedValue({ stdout, stderr: "", exitCode: 0, durationMs: 1 }),
  } as unknown as ReturnType<typeof getContextExecutor> & { exec: ReturnType<typeof vi.fn> };
}

function invoke(): Promise<{ json: ReturnType<typeof vi.fn>; next: ReturnType<typeof vi.fn> }> {
  // asyncHandler(handler)(req,res,next) does not return the promise, so resolve
  // when the handler settles by either responding (json) or erroring (next).
  return new Promise((resolve) => {
    const json = vi.fn(() => resolve({ json, next }));
    const next = vi.fn(() => resolve({ json, next }));
    const res = { json } as unknown as import("express").Response;
    (spamFiltersController.scoreTypes as unknown as (
      req: unknown, res: unknown, next: unknown,
    ) => void)({}, res, next);
  });
}

describe("spamFiltersController.scoreTypes — per-target cache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads rules from the connected server via the executor (uppercased, sorted)", async () => {
    const exec = fakeExecutor("srvA", "header RULE_B x\nbody rule_a y\n# comment\nmeta RULE_B z");
    mockedGetCtx.mockReturnValue(exec);

    const { json } = await invoke();
    expect(exec.exec).toHaveBeenCalledTimes(1);
    const payload = json.mock.calls[0][0];
    expect(payload.ok).toBe(true);
    expect(payload.data).toEqual(["RULE_A", "RULE_B"]);
  });

  it("caches per target: a second read for the SAME server does not hit the executor", async () => {
    const exec = fakeExecutor("srvA", "header RULE_A x");
    mockedGetCtx.mockReturnValue(exec);
    await invoke();
    await invoke();
    // Cached from the previous describe-block run for srvA OR from the first call
    // here — either way the second call must not re-exec.
    expect(exec.exec).not.toHaveBeenCalled();
  });

  it("does NOT share a cached rule set across servers", async () => {
    const execB = fakeExecutor("srvB", "uri ONLY_ON_B x");
    mockedGetCtx.mockReturnValue(execB);
    const { json } = await invoke();
    expect(execB.exec).toHaveBeenCalledTimes(1);
    expect(json.mock.calls[0][0].data).toEqual(["ONLY_ON_B"]);
  });

  it("falls back to the generic list (no exec) when there is no context executor", async () => {
    mockedGetCtx.mockReturnValue(null);
    const { json } = await invoke();
    const data = json.mock.calls[0][0].data as string[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(10); // bundled fallback list
  });
});
