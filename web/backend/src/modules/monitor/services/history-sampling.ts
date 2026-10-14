import type { StatsSnapshot } from "./system-stats.service.js";

/** Bound chart payloads while retaining the largest spikes of each metric. */
export function sampleHistory(snapshots: StatsSnapshot[], limit = 1_200): StatsSnapshot[] {
  if (snapshots.length <= limit) return snapshots;
  const peakCount = 12;
  const regularCount = limit - 4 * peakCount;
  const selected = new Set<number>();
  for (let index = 0; index < regularCount; index++) {
    selected.add(Math.round(index * (snapshots.length - 1) / (regularCount - 1)));
  }
  const metrics = [
    (snapshot: StatsSnapshot) => snapshot.cpu.usagePercent,
    (snapshot: StatsSnapshot) => snapshot.memory.usagePercent,
    (snapshot: StatsSnapshot) => snapshot.disk.usagePercent,
    (snapshot: StatsSnapshot) => snapshot.network.rxBytesPerSec + snapshot.network.txBytesPerSec,
  ];
  for (const metric of metrics) {
    const peaks = snapshots.map((snapshot, index) => ({ index, value: metric(snapshot) }));
    peaks.sort((a, b) => b.value - a.value);
    peaks.slice(0, peakCount).forEach(({ index }) => selected.add(index));
  }
  return [...selected].sort((a, b) => a - b).map((index) => snapshots[index]!);
}
