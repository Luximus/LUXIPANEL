// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization — the single-payload dashboard overview: how each section
 * (stats / disk / services / topProcesses) parses its shell output, the
 * per-section `{ ok, data?, error? }` shape so one failure never sinks the
 * whole overview, local-vs-remote stats routing, and the disk top-folder
 * caching (cold path computes synchronously and seeds the cache).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../monitor/services/system-stats.service.js", () => ({
  systemStatsService: {
    collect: vi.fn(async () => ({ cpu: { loadAvg1m: 0.5, usagePercent: 12 }, memory: { usagePercent: 40 } })),
    collectWithExecutor: vi.fn(async () => ({ cpu: { loadAvg1m: 1.5, usagePercent: 22 }, memory: { usagePercent: 55 } })),
  },
}));

// Neutralize sudo wiring / redaction so we can assert on raw parse behavior.
vi.mock("../../../shared/system/sudo-runtime.js", () => ({
  injectSudoIntoShellScript: async (_e: unknown, cmd: string) => cmd,
  redactSudoSecrets: (s: unknown) => String(s),
}));

import { dashboardOverviewService } from "./dashboard-overview.service.js";
import { systemStatsService } from "../../monitor/services/system-stats.service.js";
import { handlerExecutor, type MockExecHandler } from "../../../shared/executor/__fixtures__/mock-executor.js";

const makeExecutor = (handler: MockExecHandler, id?: string) => handlerExecutor(handler, id) as never;

const DF_LINE = "/dev/sda1 100 60 40 60% /\n";
const DU_OUT = "10\t/small\n5000\t/var\n3000\t/home\n1000\t/usr\n99999\t/\n";
const SERVICES_OUT = "active\ninactive\nactive\nactive\nfailed\ninactive\nactive\n";
const PS_OUT =
  "1234 root 9.5 3.2 20480 nginx\n" +
  "5678 mysql 4.0 12.0 102400 mysqld\n" +
  "bad line here\n";

function defaultHandler(cmd: string) {
  if (cmd.includes("df -B1")) return { stdout: DF_LINE };
  if (cmd.includes("du -xb")) return { stdout: DU_OUT };
  if (cmd.includes("systemctl is-active")) return { stdout: SERVICES_OUT };
  if (cmd.includes("ps -eo")) return { stdout: PS_OUT };
  return { stdout: "" };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dashboardOverviewService.collect — disk", () => {
  it("parses df fields and the du top-folders (grand-total '/' dropped, sorted desc, capped at 3)", async () => {
    const ex = makeExecutor(defaultHandler);
    const { disk } = await dashboardOverviewService.collect(ex);
    expect(disk.ok).toBe(true);
    expect(disk.data).toMatchObject({
      totalBytes: 100,
      usedBytes: 60,
      availableBytes: 40,
      usagePercent: 60,
      mountpoint: "/",
    });
    expect(disk.data!.topFolders).toEqual([
      { path: "/var", bytes: 5000 },
      { path: "/home", bytes: 3000 },
      { path: "/usr", bytes: 1000 },
    ]);
  });

  it("a df failure isolates to the disk section (ok:false + error), other sections still ok", async () => {
    const ex = makeExecutor((cmd) => {
      if (cmd.includes("df -B1")) throw new Error("df exploded");
      return defaultHandler(cmd);
    });
    const overview = await dashboardOverviewService.collect(ex);
    expect(overview.disk.ok).toBe(false);
    expect(overview.disk.error).toContain("df exploded");
    expect(overview.services.ok).toBe(true);
    expect(overview.topProcesses.ok).toBe(true);
  });
});

describe("dashboardOverviewService.collect — services", () => {
  it("maps KEY_SERVICES in order; only 'active' counts as active", async () => {
    const ex = makeExecutor(defaultHandler);
    const { services } = await dashboardOverviewService.collect(ex);
    expect(services.ok).toBe(true);
    expect(services.data).toEqual([
      { name: "postfix", active: true },
      { name: "dovecot", active: false },
      { name: "opendkim", active: true },
      { name: "nginx", active: true },
      { name: "redis-server", active: false },
      { name: "fail2ban", active: false },
      { name: "ufw", active: true },
    ]);
  });
});

describe("dashboardOverviewService.collect — topProcesses", () => {
  it("parses ps rows, converts rss KiB→bytes, and drops unparseable lines", async () => {
    const ex = makeExecutor(defaultHandler);
    const { topProcesses } = await dashboardOverviewService.collect(ex);
    expect(topProcesses.ok).toBe(true);
    expect(topProcesses.data).toEqual([
      { pid: 1234, user: "root", cpuPercent: 9.5, memPercent: 3.2, memRssBytes: 20480 * 1024, command: "nginx" },
      { pid: 5678, user: "mysql", cpuPercent: 4.0, memPercent: 12.0, memRssBytes: 102400 * 1024, command: "mysqld" },
    ]);
  });
});

describe("dashboardOverviewService.collect — stats routing", () => {
  it("target 'local' uses systemStatsService.collect()", async () => {
    const ex = makeExecutor(defaultHandler, "local");
    const { stats } = await dashboardOverviewService.collect(ex);
    expect(stats.ok).toBe(true);
    expect(systemStatsService.collect).toHaveBeenCalled();
    expect(systemStatsService.collectWithExecutor).not.toHaveBeenCalled();
  });

  it("a remote target uses systemStatsService.collectWithExecutor(executor)", async () => {
    const ex = makeExecutor(defaultHandler, "remote-box");
    const { stats } = await dashboardOverviewService.collect(ex);
    expect(stats.ok).toBe(true);
    expect(systemStatsService.collectWithExecutor).toHaveBeenCalled();
    expect(systemStatsService.collect).not.toHaveBeenCalled();
  });
});

describe("dashboardOverviewService.collect — disk cache (cold path)", () => {
  it("runs du exactly once on the cold path and seeds the cache (no du on the immediate second call)", async () => {
    const ex = makeExecutor(defaultHandler, "cache-scope-1");
    await dashboardOverviewService.collect(ex);
    const duCallsAfterFirst = ex.exec.mock.calls.filter((c: unknown[]) => String(c[0]).includes("du -xb")).length;
    expect(duCallsAfterFirst).toBe(1);

    await dashboardOverviewService.collect(ex);
    const duCallsAfterSecond = ex.exec.mock.calls.filter((c: unknown[]) => String(c[0]).includes("du -xb")).length;
    // Warm cache within TTL → still just the one du.
    expect(duCallsAfterSecond).toBe(1);
  });
});
