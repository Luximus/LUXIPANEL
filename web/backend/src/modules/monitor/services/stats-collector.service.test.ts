import { describe, expect, it, vi } from "vitest";
import type { StatsSnapshot } from "./system-stats.service.js";

const redis = vi.hoisted(() => ({
  zadd: vi.fn().mockResolvedValue(1),
  zremrangebyscore: vi.fn().mockResolvedValue(0),
  expire: vi.fn().mockResolvedValue(1),
  set: vi.fn().mockResolvedValue("OK"),
  zrangebyscore: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../shared/redis/index.js", () => ({ getRedis: () => redis }));

import { statsCollectorService } from "./stats-collector.service.js";
import { systemStatsService } from "./system-stats.service.js";
import { localExecutor } from "../../../shared/executor/index.js";

describe("stats collector history retention", () => {
  it("stores one history sample per minute while keeping live snapshots fresh", async () => {
    const scope = "retention-test";
    const base = 1_000_000_000_000;
    const snapshot = (ts: number) => ({ ts }) as StatsSnapshot;
    await statsCollectorService.recordSnapshot(snapshot(base), scope);
    await statsCollectorService.recordSnapshot(snapshot(base + 10_000), scope);
    await statsCollectorService.recordSnapshot(snapshot(base + 61_000), scope);

    expect(redis.zadd).toHaveBeenCalledTimes(2);
    expect(redis.expire).toHaveBeenLastCalledWith(`monitor:snapshots:${scope}`, 14 * 86_400);
    expect(redis.set).toHaveBeenCalledTimes(3);
    expect(redis.set).toHaveBeenLastCalledWith(`monitor:latest:${scope}`, expect.any(String), "EX", 86_400);
    expect(statsCollectorService.getLatest(scope)?.ts).toBe(base + 61_000);
  });

  it("evaluates the panel host's alert rules during background collection", async () => {
    const snapshot = { ts: Date.now() } as StatsSnapshot;
    const collect = vi.spyOn(systemStatsService, "collect").mockResolvedValue(snapshot);
    const evaluate = vi.fn().mockResolvedValue(undefined);
    statsCollectorService.setAlertEvaluator({ evaluate });
    try {
      await statsCollectorService._collect();
      expect(evaluate).toHaveBeenCalledWith(snapshot, localExecutor, "local");
    } finally {
      statsCollectorService.setAlertEvaluator({ evaluate: async () => undefined });
      collect.mockRestore();
    }
  });
});
