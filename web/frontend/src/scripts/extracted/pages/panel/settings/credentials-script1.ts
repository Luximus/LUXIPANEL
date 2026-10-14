// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Ajustes → Credenciales — hub unificado de Access Tokens / API keys.
 *
 * El .astro renderiza TODAS las tarjetas en SSR; este script oculta en cliente
 * las de módulos no habilitados (consultando `/api/admin/modules`, con fallback
 * a `/api/modules/installed`; el JWT `user.modules` es el catálogo del ROL, NO
 * los módulos habilitados del panel) y cablea el comportamiento genérico
 * reusando los endpoints propios de cada módulo:
 *   - Cloudflare        GET/PUT/DELETE /api/cloudflare/config  (+ POST /test)
 *   - Expo              GET/PUT/DELETE /api/expo/config
 *   - OpenClaw          GET/PUT/DELETE /api/openclaw/config     (+ POST /test)
 *   - GitHub (repo)     GET/PUT/DELETE /api/admin/repository-store/config
 * Cada tarjeta declara su contrato vía data-attributes (base/test/putKey/…),
 * así que NO hay lógica por-módulo aquí.
 *
 * Asistente IA monta aquí sus editores de proveedores, traducción y acceso de
 * agentes. Git y GitHub comparten tarjeta y conservan sus APIs. Backups y
 * conectores mantienen sus formularios centrales y permisos propios.
 *
 * Carga perezosa: el contenido se hidrata la primera vez que el tab
 * "credentials" pasa a visible (evento `lxp:settings-tab:activated`) o si la
 * página llega con un deep-link `#cred-<módulo>` / `#credentials`.
 *
 * Este archivo es el ENTRY: reparte la lógica en submódulos cohesivos
 * (cred-state/cred-dom/cred-*-cards/cred-bindings/cred-gating/cred-git*) y cablea
 * el ciclo init() + carga perezosa. Los imports registran sus bindings como
 * efecto colateral (mismo timing byte-a-byte que el monolito original).
 */
import { loadI18n } from "./cred-dom";
import { bindCards } from "./cred-bindings";
import { loadAll, highlightDeepLink } from "./cred-gating";
import { SETTINGS_TAB_EVENT } from "./tabs";
import { bindGitCreds, loadGitCreds, loadGitDetected } from "./cred-git";
import { bindGitSsh } from "./cred-git-ssh";

// Guard de carga: una sola `loadAll` en vuelo a la vez (evita GETs duplicadas
// cuando init() corre dos veces en el mismo load: module-eval + astro:page-load).
// Tras terminar, `loadPromise` vuelve a null → una nav SPA posterior recarga.
let loadPromise: Promise<void> | null = null;
function ensureLoaded() {
  if (!document.getElementById("panel-credentials")) return;
  bindCards();
  bindGitCreds();
  bindGitSsh();
  void loadGitCreds();
  void loadGitDetected();
  if (loadPromise) {
    void loadPromise.then(highlightDeepLink);
    return;
  }
  loadPromise = loadAll().finally(() => { loadPromise = null; });
  void loadPromise.then(highlightDeepLink);
}

function onTabActivated(ev: Event) {
  const detail = (ev as CustomEvent<{ tabId?: string }>).detail;
  if (detail?.tabId === "credentials") ensureLoaded();
}

function init() {
  loadI18n();
  const panel = document.getElementById("panel-credentials");
  if (!panel) return;
  bindCards();
  // Si el tab ya está visible al cargar (deep-link o restauración), hidrata.
  const visible = !panel.classList.contains("hidden");
  if (visible || window.location.hash.startsWith("#cred")) ensureLoaded();
  window.removeEventListener(SETTINGS_TAB_EVENT, onTabActivated);
  window.addEventListener(SETTINGS_TAB_EVENT, onTabActivated);
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();
