/** Personal UI preferences are isolated by panel user and active server. */
export function scopedPreferenceKey(moduleId: string, name: string): string {
  const user = document.getElementById("messenger-link")?.getAttribute("data-me") || "anonymous";
  const target = document.getElementById("sidebar-server-switcher")?.getAttribute("data-current-target-id")
    || sessionStorage.getItem("panel-active-target-scope") || "local";
  return `lxp:prefs:${encodeURIComponent(user)}:${encodeURIComponent(target)}:${moduleId}:${name}`;
}

export function readScopedPreference(moduleId: string, name: string, fallback: string): string {
  try { return localStorage.getItem(scopedPreferenceKey(moduleId, name)) ?? fallback; }
  catch { return fallback; }
}

export function writeScopedPreference(moduleId: string, name: string, value: string): void {
  try { localStorage.setItem(scopedPreferenceKey(moduleId, name), value); }
  catch { /* storage may be unavailable in a private browser context */ }
}
