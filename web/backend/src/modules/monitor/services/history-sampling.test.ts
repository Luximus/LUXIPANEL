import { describe, expect, it } from "vitest";
import type { StatsSnapshot } from "./system-stats.service.js";
import { sampleHistory } from "./history-sampling.js";

describe("sampleHistory", () => {
  it("bounds a long range and keeps the largest CPU and network spikes", () => {
    const snapshots = Array.from({ length: 10_000 }, (_, index) => ({
      ts: index,
      cpu: { usagePercent: index === 1_234 ? 99 : 1 },
      memory: { usagePercent: 1 },
      disk: { usagePercent: 1 },
      network: { rxBytesPerSec: index === 8_765 ? 1_000_000 : 1, txBytesPerSec: 1 },
    })) as StatsSnapshot[];
    const sampled = sampleHistory(snapshots);
    expect(sampled.length).toBeLessThanOrEqual(1_200);
    expect(sampled[0]).toBe(snapshots[0]);
    expect(sampled.at(-1)).toBe(snapshots.at(-1));
    expect(sampled).toContain(snapshots[1_234]);
    expect(sampled).toContain(snapshots[8_765]);
    expect(sampled.every((snapshot, index) => index === 0 || snapshot.ts > sampled[index - 1]!.ts)).toBe(true);
  });
});
