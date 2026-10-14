import { describe, it, expect } from "vitest";
import {
  renderWatchdogScript,
  renderWatchdogUnit,
  sustainedSamples,
  WATCHDOG_UNIT,
} from "./resource-watchdog.service.js";
import {
  DEFAULT_WATCHDOG_CONFIG,
  watchdogConfigSchema,
  type WatchdogConfig,
} from "../models/watchdog.model.js";

const baseConfig: WatchdogConfig = {
  ...DEFAULT_WATCHDOG_CONFIG,
  enabled: true,
  cpuPercent: 95,
  memPercent: 90,
};

describe("watchdogConfigSchema", () => {
  it("accepts a full valid config", () => {
    expect(watchdogConfigSchema.parse(baseConfig)).toMatchObject({ cpuPercent: 95, memPercent: 90 });
  });

  it("rejects enabling without any threshold", () => {
    const r = watchdogConfigSchema.safeParse({ ...baseConfig, cpuPercent: null, memPercent: null });
    expect(r.success).toBe(false);
  });

  it("allows disabled config without thresholds", () => {
    const r = watchdogConfigSchema.safeParse({
      ...baseConfig,
      enabled: false,
      cpuPercent: null,
      memPercent: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejects thresholds below 50% (foot-gun guard)", () => {
    expect(watchdogConfigSchema.safeParse({ ...baseConfig, cpuPercent: 30 }).success).toBe(false);
    expect(watchdogConfigSchema.safeParse({ ...baseConfig, memPercent: 49 }).success).toBe(false);
  });

  it("rejects non-integer and out-of-range tuning values", () => {
    expect(watchdogConfigSchema.safeParse({ ...baseConfig, sustainedSeconds: 10 }).success).toBe(false);
    expect(watchdogConfigSchema.safeParse({ ...baseConfig, intervalSeconds: 2 }).success).toBe(false);
    expect(watchdogConfigSchema.safeParse({ ...baseConfig, cooldownMinutes: 1 }).success).toBe(false);
    expect(watchdogConfigSchema.safeParse({ ...baseConfig, cpuPercent: 95.5 }).success).toBe(false);
  });
});

describe("sustainedSamples", () => {
  it("derives consecutive samples from the sustained window", () => {
    expect(sustainedSamples({ ...baseConfig, sustainedSeconds: 120, intervalSeconds: 15 })).toBe(8);
  });

  it("never drops below 2 samples (single spike can't reboot)", () => {
    expect(sustainedSamples({ ...baseConfig, sustainedSeconds: 30, intervalSeconds: 300 })).toBe(2);
    expect(sustainedSamples({ ...baseConfig, sustainedSeconds: 30, intervalSeconds: 30 })).toBe(2);
  });
});

describe("renderWatchdogScript", () => {
  it("bakes the validated thresholds and tuning into the script", () => {
    const s = renderWatchdogScript({
      ...baseConfig,
      sustainedSeconds: 120,
      intervalSeconds: 15,
      bootGraceMinutes: 10,
      cooldownMinutes: 30,
    });
    expect(s).toContain("CPU_MAX=95");
    expect(s).toContain("MEM_MAX=90");
    expect(s).toContain("INTERVAL=15");
    expect(s).toContain("SUSTAIN=8");
    expect(s).toContain("BOOT_GRACE=600");
    expect(s).toContain("COOLDOWN=1800");
  });

  it("renders an empty variable for a disabled threshold", () => {
    const s = renderWatchdogScript({ ...baseConfig, cpuPercent: null });
    expect(s).toContain("CPU_MAX=\n");
    expect(s).toContain("MEM_MAX=90");
  });

  it("contains the reboot action and every safety rail", () => {
    const s = renderWatchdogScript(baseConfig);
    expect(s).toContain("systemctl reboot");
    expect(s).toContain("BOOT_GRACE");
    expect(s).toContain("last-reboot");
    expect(s).toContain("COOLDOWN");
    // sustained counters reset when the condition clears
    expect(s).toContain("else cpu_count=0");
    expect(s).toContain("else mem_count=0");
  });

  it("emits real shell expansions (no TS template artifacts)", () => {
    const s = renderWatchdogScript(baseConfig);
    expect(s).toContain("$(read_cpu)");
    expect(s).toContain('"$INTERVAL"');
    expect(s).not.toContain("undefined");
    expect(s).not.toContain("NaN");
  });
});

describe("renderWatchdogUnit", () => {
  it("points at the generated script and restarts on failure", () => {
    const u = renderWatchdogUnit();
    expect(u).toContain("ExecStart=/usr/local/lib/luxipanel/resource-watchdog.sh");
    expect(u).toContain("Restart=always");
    expect(u).toContain("WantedBy=multi-user.target");
    expect(WATCHDOG_UNIT).toBe("luxipanel-resource-watchdog");
  });
});
