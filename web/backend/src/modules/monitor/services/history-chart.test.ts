import { describe, expect, it } from "vitest";
import type { StatsSnapshot } from "./system-stats.service.js";
import { buildHistoryChart, historyBucketMs } from "./history-chart.js";

function snapshot(ts: number, cpu: number): StatsSnapshot {
  return {
    ts,
    cpu: { usagePercent: cpu, loadAvg1m: 0, loadAvg5m: 0, loadAvg15m: 0 },
    memory: { usagePercent: 50, totalBytes: 100, usedBytes: 50, freeBytes: 50 },
    disk: { usagePercent: 40, totalBytes: 100, usedBytes: 40, availableBytes: 60 },
    network: { rxBytesPerSec: 1024, txBytesPerSec: 2048 },
    uptime: 1,
  };
}

describe("history chart aggregation", () => {
  it("uses readable intervals for 6h, 24h and 7d", () => {
    expect(historyBucketMs(6 * 3_600_000)).toBe(5 * 60_000);
    expect(historyBucketMs(24 * 3_600_000)).toBe(15 * 60_000);
    expect(historyBucketMs(7 * 24 * 3_600_000)).toBe(2 * 3_600_000);
  });

  it("keeps exact averages, maximums and a peak audit from all samples", () => {
    const hour = 3_600_000;
    const result = buildHistoryChart([
      snapshot(1 * hour, 10),
      snapshot(1 * hour + 60_000, 90),
      snapshot(1 * hour + 2 * 60_000, 20),
      snapshot(8 * hour, 30),
    ], 0, 24 * hour);
    expect(result.bucketMs).toBe(15 * 60_000);
    expect(result.buckets).toHaveLength(2);
    expect(result.buckets[0]?.sampleCount).toBe(3);
    expect(result.buckets[0]?.average.cpu).toBe(40);
    expect(result.buckets[0]?.maximum.cpu).toBe(90);
    expect(result.summary?.cpu.average).toBe(37.5);
    expect(result.summary?.cpu.maximum).toBe(90);
    expect(result.peaks.cpu.some((peak) => peak.cpu.usagePercent === 90)).toBe(true);
    expect(result.totalSamples).toBe(4);
  });

  it("does not fill days without recorded samples", () => {
    const day = 24 * 3_600_000;
    const result = buildHistoryChart([snapshot(6 * day, 12)], 0, 7 * day);
    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0]?.index).toBe(72);
    expect(result.firstTs).toBe(6 * day);
  });
});
