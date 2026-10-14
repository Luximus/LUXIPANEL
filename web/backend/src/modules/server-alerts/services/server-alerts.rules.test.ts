// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — server-alerts worker firing semantics (metric rules).
 *
 * These lock the decision logic that governs WHICH alerts fire — the breach
 * comparison, the cooldown gate, and the scheduled-due predicate — plus the
 * single-snapshot invariant of `processRules` (stats are collected AT MOST ONCE
 * per tick, shared across every numeric rule; only per-rule `systemctl` probes
 * touch the executor). This is the guard the PERF note asks for: any future
 * batching/parallelization must keep this exact firing behavior.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./server-alerts.service.js", () => ({
  serverAlertsService: {
    listRules: vi.fn(),
    sendImmediate: vi.fn(async () => ({ panel: 1, sent: { expo: 0, web: 0 }, recipients: 1, errors: [] })),
    markRuleFired: vi.fn(async () => undefined),
  },
}));
vi.mock("../../monitor/services/index.js", () => ({
  systemStatsService: { collectWithExecutor: vi.fn() },
}));

import {
  ruleBreaches,
  cooldownPassed,
  scheduledIsDue,
  processRules,
} from "./server-alerts.worker.js";
import { serverAlertsService } from "./server-alerts.service.js";
import { systemStatsService } from "../../monitor/services/index.js";
import type { MetricRule, ScheduledNotification } from "../models/server-alerts.model.js";

const svc = vi.mocked(serverAlertsService);
const stats = vi.mocked(systemStatsService);

function rule(p: Partial<MetricRule>): MetricRule {
  return {
    id: "r1",
    name: "rule",
    metric: "cpu",
    op: ">=",
    threshold: 90,
    service: null,
    enabled: true,
    cooldownMinutes: 30,
    lastFiredAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

function fakeExecutor(systemctlStdout = "inactive"): { exec: ReturnType<typeof vi.fn> } & Record<string, unknown> {
  const exec = vi.fn(async (cmd: string) => {
    if (cmd.includes("systemctl is-active")) return { stdout: systemctlStdout, stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  });
  return { exec, target: { id: "t1", name: "t1" } };
}

function snapshot(over: { cpu?: number; ram?: number; disk?: number; load?: number } = {}) {
  return {
    cpu: { usagePercent: over.cpu ?? 0, loadAvg1m: over.load ?? 0 },
    memory: { usagePercent: over.ram ?? 0 },
    disk: { usagePercent: over.disk ?? 0 },
  } as unknown as Awaited<ReturnType<typeof systemStatsService.collectWithExecutor>>;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ruleBreaches", () => {
  it(">= breaches at or above the threshold", () => {
    expect(ruleBreaches(rule({ op: ">=", threshold: 90 }), 90)).toBe(true);
    expect(ruleBreaches(rule({ op: ">=", threshold: 90 }), 89.9)).toBe(false);
  });
  it("<= breaches at or below the threshold", () => {
    expect(ruleBreaches(rule({ op: "<=", threshold: 10 }), 10)).toBe(true);
    expect(ruleBreaches(rule({ op: "<=", threshold: 10 }), 11)).toBe(false);
  });
  it("== breaches only on equality", () => {
    expect(ruleBreaches(rule({ op: "==", threshold: 5 }), 5)).toBe(true);
    expect(ruleBreaches(rule({ op: "==", threshold: 5 }), 6)).toBe(false);
  });
  it("an unsupported op never breaches", () => {
    expect(ruleBreaches(rule({ op: "down", threshold: 5 }), 5)).toBe(false);
  });
});

describe("cooldownPassed", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");
  it("passes when never fired", () => {
    expect(cooldownPassed(rule({ lastFiredAt: null }), now)).toBe(true);
  });
  it("blocks within the cooldown window", () => {
    const last = new Date(now.getTime() - 10 * 60_000).toISOString(); // 10 min ago
    expect(cooldownPassed(rule({ lastFiredAt: last, cooldownMinutes: 30 }), now)).toBe(false);
  });
  it("passes once the cooldown has elapsed", () => {
    const last = new Date(now.getTime() - 31 * 60_000).toISOString();
    expect(cooldownPassed(rule({ lastFiredAt: last, cooldownMinutes: 30 }), now)).toBe(true);
  });
});

describe("scheduledIsDue", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");
  function sched(p: Partial<ScheduledNotification>): ScheduledNotification {
    return {
      id: "s1",
      title: "t",
      body: "b",
      scheduleAt: null,
      cron: null,
      recurring: false,
      enabled: true,
      signals: null,
      lastFiredAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ...p,
    };
  }
  it("is never due when disabled", () => {
    expect(scheduledIsDue(sched({ enabled: false, scheduleAt: now.toISOString() }), now)).toBe(false);
  });
  it("one-shot: due once its time arrives, then not again after firing", () => {
    const past = new Date(now.getTime() - 60_000).toISOString();
    expect(scheduledIsDue(sched({ scheduleAt: past }), now)).toBe(true);
    expect(scheduledIsDue(sched({ scheduleAt: past, lastFiredAt: now.toISOString() }), now)).toBe(false);
  });
  it("one-shot: not due before its time", () => {
    const future = new Date(now.getTime() + 60_000).toISOString();
    expect(scheduledIsDue(sched({ scheduleAt: future }), now)).toBe(false);
  });
  it("cron: due on a matching minute and guarded against double-fire in the same minute", () => {
    // 12:00 UTC on 2026-07-01.
    expect(scheduledIsDue(sched({ cron: "0 12 * * *" }), now)).toBe(true);
    expect(scheduledIsDue(sched({ cron: "0 12 * * *", lastFiredAt: now.toISOString() }), now)).toBe(false);
  });
  it("cron: uses the saved local time zone", () => {
    expect(scheduledIsDue(sched({ cron: "0 7 * * *", timeZone: "America/Bogota" }), now)).toBe(true);
    expect(scheduledIsDue(sched({ cron: "0 7 * * *", timeZone: "Europe/Madrid" }), now)).toBe(false);
  });
});

describe("processRules — single-snapshot invariant + firing", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");

  it("collects stats AT MOST ONCE for many numeric rules and fires only breached ones", async () => {
    svc.listRules.mockResolvedValue([
      rule({ id: "cpu", metric: "cpu", op: ">=", threshold: 90 }),
      rule({ id: "ram", metric: "ram", op: ">=", threshold: 90 }),
      rule({ id: "disk", metric: "disk", op: ">=", threshold: 90 }),
    ]);
    stats.collectWithExecutor.mockResolvedValue(snapshot({ cpu: 95, ram: 50, disk: 10 }));

    await processRules(fakeExecutor() as never, now);

    // The invariant the PERF note protects: ONE snapshot for N numeric rules.
    expect(stats.collectWithExecutor).toHaveBeenCalledTimes(1);
    // Only the cpu rule breached (95 >= 90); ram/disk did not.
    expect(svc.sendImmediate).toHaveBeenCalledTimes(1);
    expect(svc.markRuleFired).toHaveBeenCalledTimes(1);
    expect(svc.markRuleFired).toHaveBeenCalledWith("cpu", expect.anything());
  });

  it("skips a rule whose cooldown has not elapsed (no snapshot value fires it)", async () => {
    const last = new Date(now.getTime() - 60_000).toISOString(); // 1 min ago
    svc.listRules.mockResolvedValue([
      rule({ id: "cpu", metric: "cpu", op: ">=", threshold: 1, cooldownMinutes: 30, lastFiredAt: last }),
    ]);
    stats.collectWithExecutor.mockResolvedValue(snapshot({ cpu: 100 }));

    await processRules(fakeExecutor() as never, now);

    expect(svc.sendImmediate).not.toHaveBeenCalled();
    expect(svc.markRuleFired).not.toHaveBeenCalled();
  });

  it("does NOT collect a stats snapshot when every rule is service-down", async () => {
    svc.listRules.mockResolvedValue([
      rule({ id: "svc", metric: "service-down", op: "down", threshold: null, service: "nginx" }),
    ]);

    const exec = fakeExecutor("inactive");
    await processRules(exec as never, now);

    expect(stats.collectWithExecutor).not.toHaveBeenCalled();
    // The unit is down → the alert fires via the systemctl probe.
    expect(exec.exec).toHaveBeenCalled();
    expect(svc.sendImmediate).toHaveBeenCalledTimes(1);
    expect(svc.markRuleFired).toHaveBeenCalledWith("svc", expect.anything());
  });

  it("does NOT fire a service-down rule when the unit is active", async () => {
    svc.listRules.mockResolvedValue([
      rule({ id: "svc", metric: "service-down", op: "down", threshold: null, service: "nginx" }),
    ]);

    await processRules(fakeExecutor("active") as never, now);

    expect(svc.sendImmediate).not.toHaveBeenCalled();
  });
  it("does not start cooldown when nobody received the alert", async () => {
    svc.sendImmediate.mockResolvedValueOnce({ panel: 0, sent: { expo: 0, web: 0 }, recipients: 0, errors: [] });
    svc.listRules.mockResolvedValue([rule({ id: "cpu", metric: "cpu", op: ">=", threshold: 90 })]);
    stats.collectWithExecutor.mockResolvedValue(snapshot({ cpu: 95 }));
    await processRules(fakeExecutor() as never, now);
    expect(svc.markRuleFired).not.toHaveBeenCalled();
  });
});
