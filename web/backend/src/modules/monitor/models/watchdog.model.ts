/**
 * Resource watchdog model — per-server auto-reboot policy.
 *
 * The panel stores the desired thresholds in a per-server sidecar
 * (`monitor/watchdog`) and materializes them as a root systemd service on the
 * CLIENT server (see resource-watchdog.service.ts). The watchdog reboots the
 * server when CPU and/or RAM usage stays at/above the configured maximum for
 * a sustained window — so it keeps working even when nobody is logged into
 * the panel.
 */

import { z } from "zod";

export const watchdogConfigSchema = z
  .object({
    /** Master switch. Off = unit disabled on the client server. */
    enabled: z.boolean(),
    /** Max CPU usage % (50-100). null = don't watch CPU. */
    cpuPercent: z.number().int().min(50).max(100).nullable(),
    /** Max RAM usage % (50-100). null = don't watch RAM. */
    memPercent: z.number().int().min(50).max(100).nullable(),
    /**
     * How long (seconds) the usage must stay at/above the threshold before
     * rebooting. Converted to consecutive samples on the client (min 2
     * samples, so a single spike can never reboot the server).
     */
    sustainedSeconds: z.number().int().min(30).max(3600).default(120),
    /** Sampling interval (seconds) of the on-box loop. */
    intervalSeconds: z.number().int().min(5).max(300).default(15),
    /** Never reboot within this window after boot (prevents reboot loops). */
    bootGraceMinutes: z.number().int().min(2).max(120).default(10),
    /** Minimum time between watchdog reboots (persisted across boots). */
    cooldownMinutes: z.number().int().min(5).max(1440).default(30),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.enabled && cfg.cpuPercent == null && cfg.memPercent == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Define al menos un umbral (CPU o RAM) para activar el reinicio automático",
        path: ["enabled"],
      });
    }
  });

export type WatchdogConfig = z.infer<typeof watchdogConfigSchema>;

export const DEFAULT_WATCHDOG_CONFIG: WatchdogConfig = {
  enabled: false,
  cpuPercent: null,
  memPercent: null,
  sustainedSeconds: 120,
  intervalSeconds: 15,
  bootGraceMinutes: 10,
  cooldownMinutes: 30,
};

/** Live state of the watchdog unit on the client server. */
export interface WatchdogStatus {
  /** Unit file present on the client server. */
  installed: boolean;
  /** systemd unit currently running. */
  active: boolean;
  /** systemd unit enabled at boot. */
  enabledOnBoot: boolean;
  /** Epoch seconds of the last watchdog-initiated reboot, or null. */
  lastTriggeredAt: number | null;
  /** Human reason recorded by the watchdog ("cpu 97% >= 95%"), or null. */
  lastReason: string | null;
}
