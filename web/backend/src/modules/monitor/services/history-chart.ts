import type { StatsSnapshot } from "./system-stats.service.js";

export type HistoryMetric = "cpu" | "ram" | "disk" | "rx" | "tx";
export type MetricValues = Record<HistoryMetric, number>;
export type MetricSummary = Record<HistoryMetric, { latest: number; average: number; maximum: number }>;

export interface HistoryBucket {
  index: number;
  fromTs: number;
  toTs: number;
  sampleCount: number;
  average: MetricValues;
  maximum: MetricValues;
}

export interface HistoryChart {
  fromTs: number;
  toTs: number;
  bucketMs: number;
  totalSamples: number;
  firstTs: number | null;
  lastTs: number | null;
  latestSnapshot: StatsSnapshot | null;
  summary: MetricSummary | null;
  buckets: HistoryBucket[];
  peaks: Record<HistoryMetric, StatsSnapshot[]>;
}

const METRICS: HistoryMetric[] = ["cpu", "ram", "disk", "rx", "tx"];

function values(snapshot: StatsSnapshot): MetricValues {
  return {
    cpu: snapshot.cpu.usagePercent,
    ram: snapshot.memory.usagePercent,
    disk: snapshot.disk.usagePercent,
    rx: snapshot.network.rxBytesPerSec,
    tx: snapshot.network.txBytesPerSec,
  };
}

function zeroValues(): MetricValues {
  return { cpu: 0, ram: 0, disk: 0, rx: 0, tx: 0 };
}

/** A stable number of readable intervals across every history preset. */
export function historyBucketMs(windowMs: number): number {
  if (windowMs <= 60 * 60_000) return 60_000;
  if (windowMs <= 6 * 60 * 60_000) return 5 * 60_000;
  if (windowMs <= 24 * 60 * 60_000) return 15 * 60_000;
  return 2 * 60 * 60_000;
}

/** Aggregate all stored samples; chart averages and summaries remain exact. */
export function buildHistoryChart(snapshots: StatsSnapshot[], fromTs: number, toTs: number): HistoryChart {
  const bucketMs = historyBucketMs(toTs - fromTs);
  const bins = new Map<number, { count: number; sum: MetricValues; maximum: MetricValues; peak: Record<HistoryMetric, StatsSnapshot> }>();
  const total = zeroValues();
  const maximum = zeroValues();
  let first: StatsSnapshot | null = null;
  let last: StatsSnapshot | null = null;

  for (const snapshot of snapshots) {
    if (!Number.isFinite(snapshot.ts) || snapshot.ts < fromTs || snapshot.ts > toTs) continue;
    const index = Math.min(Math.floor((snapshot.ts - fromTs) / bucketMs), Math.ceil((toTs - fromTs) / bucketMs) - 1);
    const current = values(snapshot);
    let bin = bins.get(index);
    if (!bin) {
      bin = { count: 0, sum: zeroValues(), maximum: zeroValues(), peak: {} as Record<HistoryMetric, StatsSnapshot> };
      bins.set(index, bin);
    }
    bin.count++;
    if (!first || snapshot.ts < first.ts) first = snapshot;
    if (!last || snapshot.ts > last.ts) last = snapshot;
    for (const metric of METRICS) {
      const value = current[metric];
      bin.sum[metric] += value;
      total[metric] += value;
      if (!bin.peak[metric] || value > bin.maximum[metric]) {
        bin.maximum[metric] = value;
        bin.peak[metric] = snapshot;
      }
      maximum[metric] = Math.max(maximum[metric], value);
    }
  }

  const ordered = [...bins].sort(([a], [b]) => a - b);
  const buckets = ordered.map(([index, bin]) => ({
    index,
    fromTs: fromTs + index * bucketMs,
    toTs: Math.min(fromTs + (index + 1) * bucketMs, toTs),
    sampleCount: bin.count,
    average: Object.fromEntries(METRICS.map((metric) => [metric, bin.sum[metric] / bin.count])) as MetricValues,
    maximum: bin.maximum,
  }));
  const peaks = {} as Record<HistoryMetric, StatsSnapshot[]>;
  for (const metric of METRICS) {
    peaks[metric] = ordered
      .map(([, bin]) => bin.peak[metric])
      .filter((snapshot): snapshot is StatsSnapshot => !!snapshot)
      .sort((a, b) => values(b)[metric] - values(a)[metric])
      .slice(0, 6)
      .sort((a, b) => a.ts - b.ts);
  }
  const totalSamples = [...bins.values()].reduce((sum, bin) => sum + bin.count, 0);
  const summary = last && totalSamples
    ? Object.fromEntries(METRICS.map((metric) => [metric, {
      latest: values(last)[metric],
      average: total[metric] / totalSamples,
      maximum: maximum[metric],
    }])) as MetricSummary
    : null;

  return {
    fromTs, toTs, bucketMs, totalSamples,
    firstTs: first?.ts ?? null,
    lastTs: last?.ts ?? null,
    latestSnapshot: last,
    summary, buckets, peaks,
  };
}
