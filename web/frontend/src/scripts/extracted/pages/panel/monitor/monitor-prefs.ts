/** Per-user, per-target preferences for the Monitor view. */
export interface MonitorPrefs {
  range: "1h" | "6h" | "24h" | "7d";
  metric: "all" | "cpu" | "ram" | "disk" | "network";
  compare: boolean;
  historyRefreshSeconds: 0 | 30 | 60 | 120;
  processesRefreshSeconds: 0 | 15 | 30 | 60;
}

export const MONITOR_PREFS_EVENT = "lxp:monitor:prefs-changed";
const DEFAULTS: MonitorPrefs = {
  range: "1h", metric: "all", compare: false,
  historyRefreshSeconds: 30, processesRefreshSeconds: 15,
};

function key(): string {
  let scope = "local";
  try {
    const switcher = document.getElementById("sidebar-server-switcher");
    scope = (switcher?.getAttribute("data-current-target-id") || sessionStorage.getItem("panel-active-target-scope") || "local").trim() || "local";
  } catch { /* private mode */ }
  const user = document.getElementById("monitor-session")?.dataset.userName || "user";
  return `lxp:monitor:prefs:v1:${encodeURIComponent(scope)}:${encodeURIComponent(user)}`;
}

export function readMonitorPrefs(): MonitorPrefs {
  let raw: Partial<MonitorPrefs> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key()) || "{}");
    raw = parsed && typeof parsed === "object" ? parsed as Partial<MonitorPrefs> : {};
  } catch { /* invalid/private storage */ }
  return {
    range: ["1h", "6h", "24h", "7d"].includes(raw.range || "") ? raw.range! : DEFAULTS.range,
    metric: ["all", "cpu", "ram", "disk", "network"].includes(raw.metric || "") ? raw.metric! : DEFAULTS.metric,
    compare: typeof raw.compare === "boolean" ? raw.compare : DEFAULTS.compare,
    historyRefreshSeconds: ([0, 30, 60, 120] as unknown[]).includes(raw.historyRefreshSeconds) ? raw.historyRefreshSeconds! : DEFAULTS.historyRefreshSeconds,
    processesRefreshSeconds: ([0, 15, 30, 60] as unknown[]).includes(raw.processesRefreshSeconds) ? raw.processesRefreshSeconds! : DEFAULTS.processesRefreshSeconds,
  };
}

export function saveMonitorPrefs(patch: Partial<MonitorPrefs>): MonitorPrefs {
  const next = { ...readMonitorPrefs(), ...patch };
  try { localStorage.setItem(key(), JSON.stringify(next)); } catch { /* memory-restricted browser */ }
  window.dispatchEvent(new CustomEvent(MONITOR_PREFS_EVENT, { detail: next }));
  return next;
}
