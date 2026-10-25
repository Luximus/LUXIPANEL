// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import { systemStatsService } from "./system-stats.service.js";

// ── Characterization: pure parsers ──────────────────────────────────────────
// These fix the exact byte-level behavior of the raw-output parsers. They must
// NOT change across the local/remote paths (both consume the same functions),
// so they guard against regressions when the execution boundary is refactored.

describe("systemStatsService parsers (characterization)", () => {
  describe("_sumNetDev (/proc/net/dev → rx/tx)", () => {
    it("sums rx (col 1) and tx (col 9), skipping the two header lines and `lo`", () => {
      const text = [
        "Inter-|   Receive                                                |  Transmit",
        " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
        "    lo: 500 1 0 0 0 0 0 0 500 1 0 0 0 0 0 0",
        "  eth0: 1000 10 0 0 0 0 0 0 2000 20 0 0 0 0 0 0",
        "  eth1:  300  3 0 0 0 0 0 0  400  4 0 0 0 0 0 0",
      ].join("\n");
      expect(systemStatsService._sumNetDev(text)).toEqual({ rx: 1300, tx: 2400 });
    });

    it("returns zeros for empty/garbage input", () => {
      expect(systemStatsService._sumNetDev("\n\n")).toEqual({ rx: 0, tx: 0 });
    });
  });

  describe("_parsePsLines (ps -eo pid,%cpu,%mem,args → ProcLite[])", () => {
    it("parses pid/name/cpu/mem and honors the row limit", () => {
      const text = [
        "  1234 12.3 4.5 nginx: worker",
        "   567 8.0 30.2 postgres --password=secret",
        "     1 0.0 0.1 /sbin/init",
      ].join("\n");
      expect(systemStatsService._parsePsLines(text, 2)).toEqual([
        { pid: 1234, name: "nginx", cpu: 12.3, mem: 4.5 },
        { pid: 567, name: "postgres", cpu: 8.0, mem: 30.2 },
      ]);
    });

    it("identifies projects and Astro checks without storing tokens", () => {
      const text = [
        "385956 120.0 21.1 node ./node_modules/.bin/../astro/bin/astro.mjs check --token=secret",
        "2230 5.0 4.0 node /var/www/LUXIPANEL/.releases/branch-abc/web/backend/dist/server.js --password=secret",
      ].join("\n");
      expect(systemStatsService._parsePsLines(text)).toEqual([
        { pid: 385956, name: "Astro check", cpu: 120, mem: 21.1 },
        { pid: 2230, name: "node LUXIPANEL/web/backend/dist/server.js", cpu: 5, mem: 4 },
      ]);
    });

    it("does not persist unusual executable names or secret arguments", () => {
      const rows = systemStatsService._parsePsLines("99 1.0 2.0 TOKEN=secret --password=private");
      expect(rows).toEqual([{ pid: 99, name: "unknown", cpu: 1, mem: 2 }]);
    });

    it("skips malformed lines (missing fields / non-numeric pid)", () => {
      const text = ["garbage", "  42 1.0 2.0 sshd", "   x 1 1 foo"].join("\n");
      expect(systemStatsService._parsePsLines(text)).toEqual([
        { pid: 42, name: "sshd", cpu: 1, mem: 2 },
      ]);
    });
  });

  describe("_parseProcStat (/proc/stat cpu line → CpuTimes)", () => {
    it("sums the first five counters into total", () => {
      expect(systemStatsService._parseProcStat("cpu 100 0 100 800 0 0 0 0 0 0")).toEqual({
        user: 100, nice: 0, sys: 100, idle: 800, irq: 0, total: 1000,
      });
    });

    it("returns null for a non-cpu line", () => {
      expect(systemStatsService._parseProcStat("cpu0 1 2 3 4 5 6")).toBeNull();
    });
  });

  describe("_parseDfLine (df -B1 / → disk bytes)", () => {
    it("reads total/used/available bytes and the Use% column", () => {
      expect(systemStatsService._parseDfLine("/dev/sda1 10000000 2500000 7500000 25% /")).toEqual({
        totalBytes: 10_000_000,
        usedBytes: 2_500_000,
        availableBytes: 7_500_000,
        usagePercent: 25,
      });
    });

    it("returns zeros for a malformed line", () => {
      expect(systemStatsService._parseDfLine("bogus")).toEqual({
        totalBytes: 0, usedBytes: 0, availableBytes: 0, usagePercent: 0,
      });
    });
  });
});

describe("systemStatsService.collectWithExecutor", () => {
  it("builds a snapshot from remote command output", async () => {
    // collectWithExecutor runs a SINGLE aggregated `sh -lc` command whose
    // segments are delimited by this sentinel. The mock returns the full joined
    // payload (loadavg, free -b, /proc/stat, df, /proc/net/dev, uptime, then the
    // two best-effort `ps` audits) so the remote parse path is exercised — and,
    // since the local fallback is gone (fail-closed), this is the only path.
    const SEP = "__LUXIPANEL_MONITOR_SEP__";
    const exec = vi.fn(async (cmd: string) => {
      if (!cmd.includes(SEP)) throw new Error(`Unexpected command: ${cmd}`);
      const segments = [
        "1.00 0.50 0.25 1/100 12345\n",
        [
          "              total        used        free      shared  buff/cache   available",
          "Mem:        2000000    1000000     500000          0     500000    1500000",
          "Swap:             0          0          0",
        ].join("\n") + "\n",
        "cpu 100 0 100 800 0 0 0 0 0 0\n",
        "Filesystem 1B-blocks Used Available Use% Mounted on\n/dev/sda1 10000000 2500000 7500000 25% /\n",
        [
          "Inter-|   Receive                                                |  Transmit",
          " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
          "eth0: 1000 0 0 0 0 0 0 0 2000 0 0 0 0 0 0 0",
        ].join("\n") + "\n",
        "1234.56 0.00\n",
        "", // ps by cpu (best-effort, empty)
        "", // ps by mem (best-effort, empty)
      ];
      return { stdout: segments.join(`${SEP}\n`), stderr: "", exitCode: 0, durationMs: 1 };
    });

    const snapshot = await systemStatsService.collectWithExecutor({
      target: { id: "remote-target", name: "Remote Target" },
      exec,
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      mkdir: vi.fn(),
      unlink: vi.fn(),
      rename: vi.fn(),
      spawn: vi.fn(),
    } as never);

    expect(snapshot.ts).toBeTypeOf("number");
    expect(snapshot.cpu.loadAvg1m).toBeCloseTo(1, 2);
    expect(snapshot.memory.totalBytes).toBe(2_000_000);
    expect(snapshot.memory.freeBytes).toBe(1_500_000);
    expect(snapshot.disk.totalBytes).toBe(10_000_000);
    expect(snapshot.network.rxBytesPerSec).toBe(0);
    expect(snapshot.network.txBytesPerSec).toBe(0);
    expect(snapshot.uptime).toBe(1234);
  });
});
