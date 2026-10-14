// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// env.ts (pulled in transitively via the shared logger) fail-fasts on missing
// core vars — provide the minimal set BEFORE the module under test is imported.
process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";

import type { Executor } from "../../../shared/executor/index.js";
import { fetchCliAccountUsage, clearCliQuotaCache } from "./cli-account-usage.service.js";

/** Shape the claude usage endpoint returns (only the fields we read). */
function claudePayload(utilization: number): string {
  return JSON.stringify({
    five_hour: { utilization, resets_at: "2026-07-11T12:00:00Z" },
    seven_day: { utilization: utilization / 2, resets_at: "2026-07-18T12:00:00Z" },
  });
}

/** Minimal executor double: only `exec` + the identity fields the cache keys on. */
function makeExecutor(targetId: string, exec: Executor["exec"], sshUsername = "operator"): Executor {
  return { target: { id: targetId, name: targetId }, sshUsername, exec } as unknown as Executor;
}

function execOk(stdout: string): Executor["exec"] {
  return vi.fn(async () => ({ stdout, stderr: "", exitCode: 0, durationMs: 1 }));
}

describe("fetchCliAccountUsage — per-server cache", () => {
  beforeEach(() => {
    clearCliQuotaCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    clearCliQuotaCache();
  });

  it("serves the cached value inside the TTL (one SSH exec for repeated calls)", async () => {
    const exec = execOk(claudePayload(40));
    const ex = makeExecutor("srv-a", exec);

    const first = await fetchCliAccountUsage(ex, "claude");
    const second = await fetchCliAccountUsage(ex, "claude");

    expect(first?.fiveHour?.utilization).toBe(40);
    expect(second).toEqual(first);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("re-fetches once the TTL (60 s) has elapsed", async () => {
    const exec = execOk(claudePayload(40));
    const ex = makeExecutor("srv-a", exec);

    await fetchCliAccountUsage(ex, "claude");
    vi.advanceTimersByTime(61_000);
    await fetchCliAccountUsage(ex, "claude");

    expect(exec).toHaveBeenCalledTimes(2);
  });

  it("shares a single SSH round-trip between concurrent callers (single-flight)", async () => {
    let release!: (v: { stdout: string; stderr: string; exitCode: number; durationMs: number }) => void;
    const exec = vi.fn(
      () =>
        new Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }>((resolve) => {
          release = resolve;
        }),
    ) as unknown as Executor["exec"];
    const ex = makeExecutor("srv-a", exec);

    const a = fetchCliAccountUsage(ex, "claude");
    const b = fetchCliAccountUsage(ex, "claude");
    release({ stdout: claudePayload(55), stderr: "", exitCode: 0, durationMs: 1 });

    expect((await a)?.fiveHour?.utilization).toBe(55);
    expect(await b).toEqual(await a);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("never serves one server's quota to another (cache is scoped per target)", async () => {
    const execA = execOk(claudePayload(10));
    const execB = execOk(claudePayload(90));

    const a = await fetchCliAccountUsage(makeExecutor("srv-a", execA), "claude");
    const b = await fetchCliAccountUsage(makeExecutor("srv-b", execB), "claude");

    expect(a?.fiveHour.utilization).toBe(10);
    expect(b?.fiveHour.utilization).toBe(90);
    expect(execA).toHaveBeenCalledTimes(1);
    expect(execB).toHaveBeenCalledTimes(1);
  });

  it("serves the last good value (stale) when the upstream fetch fails", async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: claudePayload(40), stderr: "", exitCode: 0, durationMs: 1 })
      .mockResolvedValue({ stdout: "__NO_CREDS__", stderr: "", exitCode: 0, durationMs: 1 });
    const ex = makeExecutor("srv-a", exec as unknown as Executor["exec"]);

    const fresh = await fetchCliAccountUsage(ex, "claude");
    vi.advanceTimersByTime(61_000);
    const stale = await fetchCliAccountUsage(ex, "claude");

    expect(exec).toHaveBeenCalledTimes(2);
    expect(stale).toEqual(fresh);
  });

  it("degrades to null once the failure outlives the stale window", async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: claudePayload(40), stderr: "", exitCode: 0, durationMs: 1 })
      .mockResolvedValue({ stdout: "__NO_CREDS__", stderr: "", exitCode: 0, durationMs: 1 });
    const ex = makeExecutor("srv-a", exec as unknown as Executor["exec"]);

    await fetchCliAccountUsage(ex, "claude");
    // Past ASSISTANT_CLI_QUOTA_STALE_MS (10 min default) since the last good value.
    vi.advanceTimersByTime(11 * 60_000);
    expect(await fetchCliAccountUsage(ex, "claude")).toBeNull();
  });

  it("returns null without an executor and never touches the cache (fail-closed)", async () => {
    expect(await fetchCliAccountUsage(null, "claude")).toBeNull();
    expect(await fetchCliAccountUsage(undefined, "claude")).toBeNull();
  });

  it("reads Codex weekly usage when primary is the only reported window", async () => {
    const snapshot = JSON.stringify({ payload: { rate_limits: {
      primary: { used_percent: 39, window_minutes: 10080, resets_at: Date.now() / 1000 + 86400 },
      secondary: null,
    } } });
    const exec = execOk(snapshot);
    const quota = await fetchCliAccountUsage(makeExecutor("srv-codex", exec), "codex");

    expect(quota?.fiveHour).toBeNull();
    expect(quota?.sevenDay?.utilization).toBe(39);
    expect(vi.mocked(exec).mock.calls[0]?.[0]).toContain('"$d/luxipanel/homes"');
  });

  it("classifies both Codex windows by duration even when their positions change", async () => {
    const snapshot = JSON.stringify({ payload: { rate_limits: {
      primary: { used_percent: 42, window_minutes: 10080, resets_at: Date.now() / 1000 + 86400 },
      secondary: { used_percent: 17, window_minutes: 300, resets_at: Date.now() / 1000 + 3600 },
    } } });
    const quota = await fetchCliAccountUsage(makeExecutor("srv-codex", execOk(snapshot)), "codex");

    expect(quota?.fiveHour?.utilization).toBe(17);
    expect(quota?.sevenDay?.utilization).toBe(42);
  });

  it("does not turn expired Codex snapshots into a false zero", async () => {
    const snapshot = JSON.stringify({ payload: { rate_limits: {
      primary: { used_percent: 87, window_minutes: 10080, resets_at: Date.now() / 1000 - 1 },
      secondary: null,
    } } });
    expect(await fetchCliAccountUsage(makeExecutor("srv-codex", execOk(snapshot)), "codex")).toBeNull();
  });
});
