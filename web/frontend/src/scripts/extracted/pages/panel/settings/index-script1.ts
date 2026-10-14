// Settings page script — entry point. Splits the former 3227-line monolith into
// cohesive submodules; importing them registers their bindings as a side effect.
// This entry keeps only init() + the 4s fetch cooldown + the astro lifecycle hooks.
// Settings has NO DataTable (no handshake) and NO write-behind.
import type { TabId } from "./state";
import { loadI18n } from "./dom";
import { setSmtpVisibility, activateTab, updateSettingsTabCounts, SETTINGS_TAB_SESSION_KEY } from "./tabs";
import { bindEvents } from "./bindings";
import { initCollapsibles } from "./collapsibles";
import { loadSettings, loadBackupSection } from "./settings-io";
import { SCRIPT_INIT_COOLDOWN_MS as INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";

// Cooldown SOLO para fetches. Las bindings/UI deben re-correr siempre
// que el DOM esté fresco (post-swap SPA), si no quedan tabs muertos en
// re-entradas rápidas dentro del cooldown.
export let initLastAt = 0;
export function init() {
  if (!document.getElementById("settings-content") && !document.getElementById("settings-skeleton")) return;

  loadI18n();

  // Siempre re-ejecutar UI + bindings (el DOM puede ser nuevo tras
  // swap). bindEvents usa AbortController internamente para no doblar.
  setSmtpVisibility(false);
  // Deep-link desde los módulos: /panel/settings#cred-<módulo> ó #credentials
  // abre directamente el tab de Credenciales (credentials-script1.ts se
  // encarga del scroll/resaltado de la tarjeta concreta).
  const wantsCredentials = window.location.hash.startsWith("#cred");
  const hash = window.location.hash;
  const wantsSecurity = hash === "#security" || hash === "#seguridad";
  // Deep-link desde el selector de servidor del sidebar: /panel/settings#servers.
  const wantsServers = hash === "#servers" || hash === "#servidores";
  const savedTab = wantsCredentials
    ? ("credentials" as TabId)
    : wantsSecurity
      ? ("security" as TabId)
      : wantsServers
        ? ("servers" as TabId)
        : ((sessionStorage.getItem(SETTINGS_TAB_SESSION_KEY) as TabId | null) ?? "general");
  activateTab(savedTab);
  updateSettingsTabCounts();
  bindEvents();
  initCollapsibles();

  // Throttle SOLO los fetches.
  if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
  initLastAt = Date.now();
  void loadSettings();
  void loadBackupSection();
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();
