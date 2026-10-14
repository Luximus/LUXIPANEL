export const HISTORY_METRICS = ["cpu", "ram", "disk", "rx", "tx"] as const;
export type HistoryMetric = typeof HISTORY_METRICS[number];
export type MetricValues = Record<HistoryMetric, number>;

export interface HistorySnapshot {
  ts: number;
  cpu: { usagePercent: number };
  memory: { usagePercent: number };
  disk: { usagePercent: number };
  network: { rxBytesPerSec: number; txBytesPerSec: number };
}

export interface HistoryBucket {
  index: number;
  fromTs: number;
  toTs: number;
  sampleCount: number;
  average: MetricValues;
  maximum: MetricValues;
}

export interface HistoryChart<T extends HistorySnapshot> {
  fromTs: number;
  toTs: number;
  bucketMs: number;
  totalSamples: number;
  firstTs: number | null;
  lastTs: number | null;
  latestSnapshot: T | null;
  summary: Record<HistoryMetric, { latest: number; average: number; maximum: number }> | null;
  buckets: HistoryBucket[];
  peaks: Record<HistoryMetric, T[]>;
}

export interface HistoryPoint<T extends HistorySnapshot> {
  x: number;
  y: number | null;
  bucket?: HistoryBucket;
  snapshot?: T;
  peak?: boolean;
}

/** Bucket indices preserve missing intervals as a null break in Chart.js. */
export function bucketPoints<T extends HistorySnapshot>(
  buckets: HistoryBucket[],
  fromTs: number,
  metric: HistoryMetric,
): HistoryPoint<T>[] {
  const points: HistoryPoint<T>[] = [];
  let previous: HistoryBucket | null = null;
  for (const bucket of buckets) {
    if (previous && bucket.index > previous.index + 1) {
      points.push({ x: (previous.toTs - fromTs + 1) / 60_000, y: null });
    }
    points.push({
      x: ((bucket.fromTs + bucket.toTs) / 2 - fromTs) / 60_000,
      y: bucket.average[metric],
      bucket,
    });
    previous = bucket;
  }
  return points;
}

export function peakPoints<T extends HistorySnapshot>(
  snapshots: T[],
  fromTs: number,
  metric: HistoryMetric,
): HistoryPoint<T>[] {
  const pick = {
    cpu: (snapshot: T) => snapshot.cpu.usagePercent,
    ram: (snapshot: T) => snapshot.memory.usagePercent,
    disk: (snapshot: T) => snapshot.disk.usagePercent,
    rx: (snapshot: T) => snapshot.network.rxBytesPerSec,
    tx: (snapshot: T) => snapshot.network.txBytesPerSec,
  }[metric];
  return snapshots.map((snapshot) => ({
    x: (snapshot.ts - fromTs) / 60_000,
    y: pick(snapshot),
    snapshot,
    peak: true,
  }));
}
