/**
 * Monitor — resource watchdog card (/panel/monitor).
 *
 * Standalone extracted script (canonical SPA pattern). It deliberately does
 * NOT live inside the legacy committed monitor-v2.js bundle: this file has a
 * real TS source wired through scripts/build-extracted.mjs.
 *
 * Talks to GET/PUT /api/monitor/watchdog. The PUT is admin-only on the
 * backend; the UI disables the controls for non-admins (#monitor-session
 * carries the SSR user kind).
 */

import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { SCRIPT_INIT_COOLDOWN_MS as INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { showToast as showSharedToast } from "/scripts/extracted/lib/toast.js";

interface WatchdogConfig {
  enabled: boolean;
  cpuPercent: number | null;
  memPercent: number | null;
  sustainedSeconds: number;
  intervalSeconds: number;
  bootGraceMinutes: number;
  cooldownMinutes: number;
}

interface WatchdogStatus {
  installed: boolean;
  active: boolean;
  enabledOnBoot: boolean;
  lastTriggeredAt: number | null;
  lastReason: string | null;
}

const state: { config: WatchdogConfig | null; saving: boolean } = {
  config: null,
  saving: false,
};

function card(): HTMLElement | null {
  return document.getElementById("watchdog-card");
}

function msg(key: string): string {
  return card()?.dataset[key] ?? "";
}

function showToast(text: string, ok = true): void {
  showSharedToast(text, ok);
}

function isAdmin(): boolean {
  const session = document.getElementById("monitor-session");
  return (session?.dataset.userKind ?? "user") === "admin";
}

function inputs(): {
  enabled: HTMLInputElement;
  cpu: HTMLInputElement;
  mem: HTMLInputElement;
  sustained: HTMLSelectElement;
  save: HTMLButtonElement;
  interval: HTMLInputElement | null;
  grace: HTMLInputElement | null;
  cooldown: HTMLInputElement | null;
  settingsSave: HTMLButtonElement | null;
} | null {
  const enabled = document.getElementById("wd-enabled") as HTMLInputElement | null;
  const cpu = document.getElementById("wd-cpu") as HTMLInputElement | null;
  const mem = document.getElementById("wd-mem") as HTMLInputElement | null;
  const sustained = document.getElementById("wd-sustained") as HTMLSelectElement | null;
  const save = document.getElementById("wd-save") as HTMLButtonElement | null;
  if (!enabled || !cpu || !mem || !sustained || !save) return null;
  return { enabled, cpu, mem, sustained, save,
    interval: document.getElementById("wd-interval") as HTMLInputElement | null,
    grace: document.getElementById("wd-grace") as HTMLInputElement | null,
    cooldown: document.getElementById("wd-cooldown") as HTMLInputElement | null,
    settingsSave: document.getElementById("wd-settings-save") as HTMLButtonElement | null,
  };
}

function renderBadge(config: WatchdogConfig, status: WatchdogStatus): void {
  const badge = document.getElementById("wd-badge");
  if (!badge) return;
  const running = config.enabled && status.active;
  badge.className = `inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
    running ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
  }`;
  badge.innerHTML = `<span class="h-1.5 w-1.5 rounded-full ${
    running ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
  }"></span>${running ? msg("badgeActive") : msg("badgeInactive")}`;
}

function renderLast(status: WatchdogStatus): void {
  const el = document.getElementById("wd-last");
  if (!el) return;
  if (status.lastTriggeredAt) {
    const when = new Date(status.lastTriggeredAt * 1000).toLocaleString(document.documentElement.lang || undefined);
    const reason = status.lastReason ? ` (${status.lastReason})` : "";
    el.textContent = `${msg("lastPrefix")} ${when}${reason}`;
  } else {
    el.textContent = `${msg("lastPrefix")} ${msg("never")}`;
  }
}

function render(config: WatchdogConfig, status: WatchdogStatus): void {
  const el = inputs();
  if (!el) return;
  state.config = config;

  el.enabled.checked = config.enabled;
  el.cpu.value = config.cpuPercent == null ? "" : String(config.cpuPercent);
  el.mem.value = config.memPercent == null ? "" : String(config.memPercent);
  const options = [...el.sustained.options].map((o) => Number(o.value));
  const closest = options.reduce(
    (best, v) => (Math.abs(v - config.sustainedSeconds) < Math.abs(best - config.sustainedSeconds) ? v : best),
    options[0] ?? 120,
  );
  el.sustained.value = String(closest);
  if (el.interval) el.interval.value = String(config.intervalSeconds);
  if (el.grace) el.grace.value = String(config.bootGraceMinutes);
  if (el.cooldown) el.cooldown.value = String(config.cooldownMinutes);

  renderBadge(config, status);
  renderLast(status);

  if (!isAdmin()) {
    el.enabled.disabled = true;
    el.cpu.disabled = true;
    el.mem.disabled = true;
    el.sustained.disabled = true;
    el.save.disabled = true;
    for (const field of [el.interval, el.grace, el.cooldown, el.settingsSave]) {
      if (field) field.disabled = true;
    }
    document.getElementById("wd-admin-note")?.classList.remove("hidden");
  }
}

async function load(): Promise<void> {
  if (!card()) return;
  const res = await api.get<{ config: WatchdogConfig; status: WatchdogStatus }>("/api/monitor/watchdog");
  if (!res.ok || !res.data) {
    showToast(msg("loadError"), false);
    return;
  }
  render(res.data.config, res.data.status);
}

function parseThreshold(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n)) return undefined; // invalid
  if (n === 0) return null; // 0 disables this threshold (matches the field hint)
  if (n < 50 || n > 100) return undefined; // invalid
  return n;
}

async function save(): Promise<void> {
  const el = inputs();
  if (!el || state.saving) return;

  const cpuPercent = parseThreshold(el.cpu.value);
  const memPercent = parseThreshold(el.mem.value);
  if (cpuPercent === undefined || memPercent === undefined) {
    showToast(msg("thresholdRequired"), false);
    return;
  }
  const enabled = el.enabled.checked;
  if (enabled && cpuPercent == null && memPercent == null) {
    showToast(msg("thresholdRequired"), false);
    return;
  }

  if (enabled) {
    const accepted = await openConfirm(msg("confirmBody"), {
      title: msg("confirmTitle"),
      confirmText: msg("confirmOk"),
    });
    if (!accepted) return;
  }

  const base = state.config ?? {
    enabled: false,
    cpuPercent: null,
    memPercent: null,
    sustainedSeconds: 120,
    intervalSeconds: 15,
    bootGraceMinutes: 10,
    cooldownMinutes: 30,
  };
  const intervalSeconds = Number(el.interval?.value ?? base.intervalSeconds);
  const bootGraceMinutes = Number(el.grace?.value ?? base.bootGraceMinutes);
  const cooldownMinutes = Number(el.cooldown?.value ?? base.cooldownMinutes);
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 5 || intervalSeconds > 300 ||
      !Number.isInteger(bootGraceMinutes) || bootGraceMinutes < 2 || bootGraceMinutes > 120 ||
      !Number.isInteger(cooldownMinutes) || cooldownMinutes < 5 || cooldownMinutes > 1440) {
    showToast(msg("limitsError"), false);
    return;
  }
  const body: WatchdogConfig = {
    ...base,
    enabled,
    cpuPercent,
    memPercent,
    sustainedSeconds: Number(el.sustained.value) || base.sustainedSeconds,
    intervalSeconds,
    bootGraceMinutes,
    cooldownMinutes,
  };

  state.saving = true;
  const icon = el.save.querySelector("i");
  const prevIcon = icon?.className ?? "";
  if (icon) icon.className = "ti ti-loader-2 animate-spin text-sm";
  el.save.disabled = true;
  if (el.settingsSave) el.settingsSave.disabled = true;
  try {
    const res = await api.put<{ config: WatchdogConfig; status: WatchdogStatus }>(
      "/api/monitor/watchdog",
      body,
    );
    if (res.ok && res.data) {
      showToast(msg("saved"));
      render(res.data.config, res.data.status);
    } else {
      showToast(res.error || msg("error"), false);
    }
  } finally {
    state.saving = false;
    if (icon) icon.className = prevIcon;
    el.save.disabled = !isAdmin() ? true : false;
    if (el.settingsSave) el.settingsSave.disabled = !isAdmin();
  }
}

// ── Lifecycle (canonical SPA pattern) ───────────────────────────────────────
let initLastAt = 0;

function bindOnce(): void {
  const w = window as unknown as { __lxpMonitorWatchdogBound?: boolean };
  if (w.__lxpMonitorWatchdogBound) return;
  w.__lxpMonitorWatchdogBound = true;
  document.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement | null;
    if (target?.closest("#wd-save")) void save();
    if (target?.closest("#wd-settings-save")) void save();
  });
}

function init(): void {
  if (!card()) return;
  bindOnce();
  if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
  initLastAt = Date.now();
  void load();
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();
