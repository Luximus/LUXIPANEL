import { afterPrimaryReady } from "/scripts/extracted/lib/startup-state.js";
/**
 * server-clock.ts — pinta la fecha y hora del servidor conectado junto al
 * logo del sidebar (desktop y móvil). El timezone se obtiene una sola vez
 * desde /api/monitor/time (con fallback al tz del navegador) y a partir de
 * ahí el reloj corre cliente-side cada segundo usando un offset absoluto
 * para no martillar al backend. Se vuelve a sincronizar cada 10 minutos.
 *
 * Formato esperado:
 *   Lunes, 11 de mayo de 2026
 *   23:19:32 GMT-5
 */
import { resolvePanelApiPath as apiPath } from "/scripts/extracted/lib/api-client.js";

type ClockState = { offsetMs: number; tz: string };

const CLOCK_TARGETS = ["#sidebar-server-clock", "#sidebar-mobile-server-clock"] as const;

function currentLocale(): string {
  const lang = document.documentElement.lang;
  return lang && lang.trim() ? lang : "es";
}

let state: ClockState | null = null;
let tickHandle: number | null = null;
// 10-minute re-sync handle — previously never tracked so the interval
// survived SPA navigation and piled up a worker thread per swap.
let refreshHandle: number | null = null;

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDate(d: Date, tz: string): string {
  try {
    const formatted = new Intl.DateTimeFormat(currentLocale(), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: tz,
    }).format(d);
    return capitalize(formatted);
  } catch {
    return capitalize(d.toLocaleDateString(currentLocale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }
}

function formatTime(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat(currentLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(d);
  } catch {
    return d.toLocaleTimeString(currentLocale(), { hour12: false });
  }
}

function formatTzLabel(tz: string): string {
  if (!tz) return "";
  try {
    const parts = new Intl.DateTimeFormat(currentLocale(), { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value;
    return tzPart ?? tz;
  } catch {
    return tz;
  }
}

function paintTick(): void {
  if (!state) return;
  // Skip the per-second DOM writes while the tab is hidden (6 querySelector +
  // 3 textContent writes/s otherwise). The clock repaints on visibilitychange.
  if (typeof document !== "undefined" && document.hidden) return;
  const now = new Date(Date.now() + state.offsetMs);
  const dateText = formatDate(now, state.tz);
  const timeText = formatTime(now, state.tz);
  const tzText = formatTzLabel(state.tz);
  for (const selector of CLOCK_TARGETS) {
    const root = document.querySelector<HTMLElement>(selector);
    if (!root) continue;
    const dateEl = root.querySelector<HTMLElement>("[data-clock-date]");
    const timeEl = root.querySelector<HTMLElement>("[data-clock-time]");
    const tzEl = root.querySelector<HTMLElement>("[data-clock-tz]");
    if (dateEl) dateEl.textContent = dateText;
    if (timeEl) timeEl.textContent = timeText;
    if (tzEl) tzEl.textContent = tzText;
  }
}

function startTicking(): void {
  if (tickHandle !== null) window.clearInterval(tickHandle);
  paintTick();
  tickHandle = window.setInterval(paintTick, 1000);
}

async function refreshState(): Promise<void> {
  try {
    const res = await fetch(apiPath("/api/monitor/time"), {
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { ok?: boolean; data?: { iso?: string; tz?: string } };
    const iso = json?.data?.iso;
    const tz = json?.data?.tz;
    if (!iso || !tz) throw new Error("invalid payload");
    const serverNow = Date.parse(iso);
    if (!Number.isFinite(serverNow)) throw new Error("invalid iso");
    state = { offsetMs: serverNow - Date.now(), tz };
  } catch {
    state = { offsetMs: 0, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" };
  }
  startTicking();
}

function hasClock(): boolean {
  return CLOCK_TARGETS.some((sel) => Boolean(document.querySelector(sel)));
}

let cancelStartup: (() => void) | undefined;
function init(): void {
  if (!hasClock()) return;
  if (state) {
    startTicking();
    return;
  }
  cancelStartup?.();
  cancelStartup = afterPrimaryReady(() => void refreshState());
}

// Arm the 10-minute re-sync (idempotent). Called from init() so it is re-armed
// after a before-swap teardown; without this the timer was a one-shot module
// singleton that, once cleared, never came back.
function armResync(): void {
  if (refreshHandle !== null) return;
  refreshHandle = window.setInterval(
    () => { if (hasClock()) void refreshState(); },
    10 * 60 * 1000,
  );
}

function initWithResync(): void {
  init();
  if (hasClock()) armResync();
}

// Repaint immediately when the tab becomes visible again (paintTick no-ops
// while hidden, so the display would otherwise lag up to 1s on return).
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) paintTick();
});

document.addEventListener("astro:page-load", initWithResync);
document.addEventListener("astro:after-swap", initWithResync);
document.addEventListener("astro:before-swap", () => {
  cancelStartup?.();
  // SPA leak guard: every navigation swaps out the layout (and the clock
  // targets), so tear down BOTH timers before the new page mounts. Previously
  // only tickHandle was cleared; the surviving 10-min refreshHandle called
  // refreshState() → startTicking() and resurrected the tick that this handler
  // had just stopped.
  if (tickHandle !== null) {
    window.clearInterval(tickHandle);
    tickHandle = null;
  }
  if (refreshHandle !== null) {
    window.clearInterval(refreshHandle);
    refreshHandle = null;
  }
});
initWithResync();

export {};
