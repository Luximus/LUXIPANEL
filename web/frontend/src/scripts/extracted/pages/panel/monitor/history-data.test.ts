import { describe, expect, it } from "vitest";
import { bucketPoints, peakPoints, type HistoryBucket } from "./history-data";

const emptyMetrics = { cpu: 0, ram: 0, disk: 0, rx: 0, tx: 0 };
function bucket(index: number): HistoryBucket {
  return { index, fromTs: index * 60_000, toTs: (index + 1) * 60_000, sampleCount: 3,
    average: { ...emptyMetrics, cpu: index }, maximum: { ...emptyMetrics, cpu: index + 5 } };
}

describe("monitor chart points", () => {
  it("breaks the line across missing intervals while retaining bucket details", () => {
    const points = bucketPoints([bucket(0), bucket(1), bucket(5)], 0, "cpu");
    expect(points).toHaveLength(4);
    expect(points[2]?.y).toBeNull();
    expect(points[3]?.bucket?.index).toBe(5);
    expect(points[3]?.y).toBe(5);
  });

  it("keeps the source snapshot on a peak marker", () => {
    const snapshot = { ts: 120_000, cpu: { usagePercent: 91 }, memory: { usagePercent: 50 },
      disk: { usagePercent: 40 }, network: { rxBytesPerSec: 1, txBytesPerSec: 2 } };
    const points = peakPoints([snapshot], 0, "cpu");
    expect(points[0]).toMatchObject({ x: 2, y: 91, snapshot, peak: true });
  });
});
