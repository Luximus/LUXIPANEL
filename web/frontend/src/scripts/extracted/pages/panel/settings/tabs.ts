// Settings page — tab nav (underline + count badges), topbar title, smtp tab
// visibility. bumpSecurityBadge is written here, called from security.
import type { TabId } from "./state";
import { TAB_IDS } from "./state";
import { t } from "./dom";
import { setUnderlineTabState } from "/scripts/extracted/lib/tabs.js";
import { switchView, tabDirection } from "/scripts/extracted/lib/dom.js";

/** SSOT for the "settings tab activated" CustomEvent name. Sub-scripts of the
 *  settings page listen for this to lazy-load their panel when it becomes
 *  visible. `bundle:false` sibling scripts (modules-cache / servers-script1)
 *  can't import this and carry a coupling comment instead. */
export const SETTINGS_TAB_EVENT = "lxp:settings-tab:activated";
/** SSOT for the sessionStorage key holding the last-active settings tab id. */
export const SETTINGS_TAB_SESSION_KEY = "settings-tab";

export function setSmtpVisibility(visible: boolean) {
  document.querySelectorAll<HTMLElement>(".tab-btn[data-tab='smtp']").forEach((el) => {
    el.style.display = visible ? "" : "none";
  });

  const panel = document.getElementById("panel-smtp");
  if (panel) {
    panel.style.display = visible ? "" : "none";
    panel.setAttribute("aria-hidden", visible ? "false" : "true");
  }
}

// ── Tabs (estilo modules: underline + count badge) ────────────────────
// E-03: cuerpo compartido en /scripts/extracted/lib/tabs.js.
export function setSettingsTabState(buttons: HTMLButtonElement[], activeButton: HTMLButtonElement) {
  buttons.forEach((btn) => setUnderlineTabState(btn, btn === activeButton));
}

export function updateSettingsTabCounts() {
  // Solo los tabs con conteo REAL llevan badge (security / credentials /
  // data-usage). El resto no renderiza `#tab-<id>-count` en el SSR, así que
  // no hay nada que actualizar aquí. Los números los publican los sub-scripts
  // al pintar sus tarjetas/tablas; hasta que llegan mostramos "—".
  const setCount = (id: string, value: number | string) => {
    const el = document.getElementById(`tab-${id}-count`);
    if (el) el.textContent = typeof value === "number" ? String(value) : value;
  };
  // security: si hay count cacheado por credentials/main, úsalo; si no, "—"
  const sec = (window as any).__lxpSecurityMethodCount;
  setCount("security", typeof sec === "number" ? sec : "—");
  // credentials: número de tarjetas con token configurado (poblado por
  // credentials-script1 al pintarlas). Default "—" hasta que llegue.
  const cred = (window as any).__lxpCredentialsConfigured;
  setCount("credentials", typeof cred === "number" ? cred : "—");
}

/** Suma `extraPasskeys` al método-configurado-cache (TOTP=1 ó 0; passkeys=N).
 *  Llamar desde load2FAStatusSettings (TOTP) y loadPasskeysSettings (passkeys). */
export function bumpSecurityBadge(extraPasskeys: number) {
  const cur = (window as any).__lxpSecurityMethodCount;
  const base = typeof cur === "number" ? cur : 0;
  const next = base + extraPasskeys;
  (window as any).__lxpSecurityMethodCount = next;
  const badge = document.getElementById("tab-security-count");
  if (badge) badge.textContent = String(next);
}

// Refleja el tab activo en el título del topbar del panel: "Ajustes · <Tab>".
// El nodo `#panel-topbar-title` lo provee PanelLayout (genérico para todas las
// páginas); solo lo mutamos aquí. El nombre del tab se lee de su propia pestaña
// (primer <span> del botón) para no duplicar el mapeo id→i18n. Se ejecuta desde
// activateTab, así cubre el cambio de tab Y los deep-links (init → activateTab).
export function updateTopbarTitle(activeBtn: HTMLButtonElement | null) {
  const titleEl = document.getElementById("panel-topbar-title");
  if (!titleEl) return;
  const base = t("pageTitle", "Ajustes");
  const tabLabel = activeBtn?.querySelector("span")?.textContent?.trim();
  titleEl.textContent = tabLabel ? `${base} · ${tabLabel}` : base;
}

let lastActivatedTab: string = "";

export function activateTab(id: TabId) {
  const availableTabs = document
    .querySelectorAll<HTMLButtonElement>(".tab-btn[data-tab]")
    .length
    ? Array.from(document.querySelectorAll<HTMLButtonElement>(".tab-btn[data-tab]"))
        .filter((btn) => btn.style.display !== "none")
        .map((btn) => (btn.dataset.tab as TabId | undefined))
        .filter((tab): tab is TabId => Boolean(tab))
    : [...TAB_IDS];

  const targetTab: TabId = availableTabs.includes(id) ? id : (availableTabs[0] ?? "general");

  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab-btn"));
  const targetBtn = buttons.find((b) => b.dataset.tab === targetTab);
  if (targetBtn) setSettingsTabState(buttons, targetBtn);
  updateTopbarTitle(targetBtn ?? null);
  // Entrada animada del panel (preset motion.css); dirección según el orden
  // de los tabs visibles. `lastActivatedTab` recuerda el tab previo.
  const panels = Array.from(document.querySelectorAll<HTMLElement>(".tab-panel"));
  const direction = tabDirection(availableTabs.indexOf(lastActivatedTab as TabId), availableTabs.indexOf(targetTab));
  switchView(panels, panels.find((panel) => panel.id.endsWith(targetTab)), { direction });
  lastActivatedTab = targetTab;
  sessionStorage.setItem(SETTINGS_TAB_SESSION_KEY, targetTab);
  // Notificar a sub-scripts con carga perezosa (p.ej. modules-cache.ts) que
  // su panel pasó a ser visible — sin esto, una restauración de tab desde
  // sessionStorage en F5/SPA-nav no dispara ningún load.
  window.dispatchEvent(new CustomEvent(SETTINGS_TAB_EVENT, { detail: { tabId: targetTab } }));
}
