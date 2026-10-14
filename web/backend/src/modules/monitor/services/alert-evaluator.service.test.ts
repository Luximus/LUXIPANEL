import { beforeEach, expect, it, vi } from "vitest";
import type { AlertRule } from "../models/alert-rule.model.js";
import type { StatsSnapshot } from "./system-stats.service.js";
import type { Executor } from "../../../shared/executor/index.js";

const repo = vi.hoisted(() => ({
  findEnabledRules: vi.fn(), createEvent: vi.fn().mockResolvedValue(undefined),
  resolveEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../repositories/alert.repository.js", () => ({ alertRepository: repo }));

import { alertEvaluatorService } from "./alert-evaluator.service.js";
import { eventBus, Events } from "../../../shared/events/index.js";

const executor = { target: { id: "local", name: "Local" } } as Executor;
const snapshot = { cpu: { usagePercent: 95 } } as StatsSnapshot;
const rule = (mutedUntil: string | null): AlertRule => ({
  id: 42, name: "CPU elevada", metric: "cpu_usage_percent", operator: "gt",
  threshold: 90, sustainedSamples: 1, enabled: true, mutedUntil,
  createdAt: new Date(), updatedAt: new Date(),
});

beforeEach(() => {
  vi.clearAllMocks();
  alertEvaluatorService.reset();
});

it("records a muted alert without delivering its firing notification", async () => {
  repo.findEnabledRules.mockResolvedValue([rule(new Date(Date.now() + 3600_000).toISOString())]);
  const emit = vi.spyOn(eventBus, "emit");
  try {
    await alertEvaluatorService.evaluate(snapshot, executor, "local");
    expect(repo.createEvent).toHaveBeenCalledOnce();
    expect(emit).not.toHaveBeenCalledWith(Events.ALERT_FIRING, expect.anything());
    expect(alertEvaluatorService.firingRuleIds("local")).toEqual([42]);
    repo.findEnabledRules.mockResolvedValue([]);
    await alertEvaluatorService.evaluate(snapshot, executor, "local");
    expect(emit).not.toHaveBeenCalledWith(Events.ALERT_RESOLVED, expect.anything());
  } finally { emit.mockRestore(); }
});

it("resolves a firing alert when its rule is paused", async () => {
  repo.findEnabledRules.mockResolvedValueOnce([rule(null)]).mockResolvedValueOnce([]);
  await alertEvaluatorService.evaluate(snapshot, executor, "local");
  await alertEvaluatorService.evaluate(snapshot, executor, "local");
  expect(repo.resolveEvent).toHaveBeenCalledWith(42, executor);
  expect(alertEvaluatorService.firingRuleIds("local")).toEqual([]);
});

it("delivers a still-firing alert once when its maintenance mute expires", async () => {
  repo.findEnabledRules.mockResolvedValueOnce([rule(new Date(Date.now() + 3600_000).toISOString())])
    .mockResolvedValue([rule(new Date(Date.now() - 1000).toISOString())]);
  const emit = vi.spyOn(eventBus, "emit");
  try {
    await alertEvaluatorService.evaluate(snapshot, executor, "local");
    await alertEvaluatorService.evaluate(snapshot, executor, "local");
    await alertEvaluatorService.evaluate(snapshot, executor, "local");
    expect(repo.createEvent).toHaveBeenCalledOnce();
    expect(emit.mock.calls.filter(([name]) => name === Events.ALERT_FIRING)).toHaveLength(1);
  } finally { emit.mockRestore(); }
});
