// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PanelRow } from "../features/app/viewModels";
import { buildModuleNextPath, buildToolNextPath } from "../features/app/luxipanel-modules";
import { buildSpaNavigateScript } from "./panel-webview-bridge";
import { minimizeConsoles } from "./console-sessions-store";
import { registerStoreReset } from "./store-reset";
import { NATIVE_MODULE_IDS } from "../screens/main/shell-types";

/**
 * Store de las SESIONES DE MÓDULO (webviews de LUXIPANEL) POR PESTAÑA (B2).
 *
 * Fuente de verdad del ciclo de vida de los webviews de módulo (antes vivía en
 * el estado del `MainTab`): UNA webview por panel, reutilizada por navegación
 * SPA; "atrás" la OCULTA (sigue viva/caliente), no la destruye; el pre-warm
 * del carousel la carga OCULTA; el tope blando (`MODULE_MOUNT_CAP`) desmonta
 * la menos reciente. Los webviews en sí los renderiza el `SessionHost` global.
 * Patrón module-store + `useSyncExternalStore`, como el resto del repo.
 *
 * Persistencia A DISCO (contrato previo): solo la IDENTIDAD de la sesión
 * ({id, panelId, panelName, moduleId, route, label}); NUNCA el `redirectUrl`
 * (token SSO efímero). Al relanzar se restaura la LISTA FRÍA y, al ACTIVAR,
 * se RE-ACUÑA el `redirectUrl` por SSO (TOFU ya aprobado) antes de montar.
 */

/** Sesión de MÓDULO de LUXIPANEL: una webview (`SshScreen`) independiente
 *  apuntada a `/panel/<route>` vía deep-link SSO. Modelo análogo a
 *  `ConsoleSession` pero para módulos. `redirectUrl` es efímero (token SSO):
 *  no se persiste, se re-acuña al activar una sesión restaurada de disco. */
export type ModuleSession = {
  id: string;
  panelId: string;
  panelName: string;
  moduleId: string;
  moduleName?: string;
  route: string;
  redirectUrl?: string;
  label?: string;
  autoOpen?: "assistant" | "terminal";
  prewarm?: boolean;
};

export type ModulesTabState = {
  sessions: ModuleSession[];
  /** Sesión visible. `null` = ocultas ("atrás": vivas/calientes en el host). */
  activeModuleId: string | null;
  /** Sesiones con webview MONTADA en el host (cargando/viva; acotado por el
   *  tope blando). La ACTIVA se ve; el resto carga con opacity 0. */
  mountedIds: string[];
  /** Activación DIFERIDA en curso: se muestra el indicador de carga y la
   *  webview se REVELA solo cuando la vista destino terminó de cargar. */
  activating: { id: string; label: string } | null;
  restored: boolean;
};

/** Dependencias que el store NO posee (siguen siendo del controller del tab):
 *  acuñar el redirectUrl SSO y generar ids (expo-crypto vive en la capa RN). */
export type ModuleSessionDeps = {
  resolveRedirectUrl: (
    source: PanelRow["source"],
    path?: string,
    opts?: { silent?: boolean },
  ) => Promise<string | null>;
  makeId: () => string;
};

const EMPTY_TAB: ModulesTabState = Object.freeze({
  sessions: [],
  activeModuleId: null,
  mountedIds: [],
  activating: null,
  restored: false,
});

// Tope blando de webviews montadas a la vez (las completas pesan más que
// xterm): al superarlo se DESMONTA la menos reciente (se conserva su fila;
// re-monta al activarla).
const MODULE_MOUNT_CAP = 5;

// ── Estado reactivo en memoria ────────────────────────────────────────────────
let byTab: Record<string, ModulesTabState> = {};
const listeners = new Set<() => void>();
const restoreRequested = new Set<string>();
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Recencia de montaje por pestaña (para elegir la víctima del tope blando).
const mountOrderByTab = new Map<string, string[]>();
// Inyector de JS por sesión (lo registra cada SshScreen del host) + navegación
// pendiente por sesión (cuando se reutiliza una webview aún sin cargar) +
// bandera de "página del panel cargada" por sesión (el inyector NO-OPea si el
// webview aún no está listo → solo inyectamos directo cuando la página cargó).
const injectors = new Map<string, (js: string) => void>();
const pendingNav = new Map<string, { route?: string; path?: string }>();
const loadedById = new Map<string, boolean>();
// Activación DIFERIDA: `route` es el slug a esperar; `timer` es el fallback
// que revela igual a los 20s si nunca se detecta la señal `lxp-page-ready`.
const pendingActivate = new Map<string, { tabId: string; route: string; timer: ReturnType<typeof setTimeout> }>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function getModulesTab(tabId: string): ModulesTabState {
  return byTab[tabId] ?? EMPTY_TAB;
}

function setTab(tabId: string, next: ModulesTabState): void {
  const prev = getModulesTab(tabId);
  byTab = { ...byTab, [tabId]: next };
  emit();
  if (next.restored && next.sessions !== prev.sessions) schedulePersist(tabId);
}

function schedulePersist(tabId: string): void {
  const prev = persistTimers.get(tabId);
  if (prev) clearTimeout(prev);
  persistTimers.set(tabId, setTimeout(() => {
    persistTimers.delete(tabId);
    void saveModuleSessions(tabId, getModulesTab(tabId).sessions);
  }, 1200));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useModulesTab(tabId: string): ModulesTabState {
  return useSyncExternalStore(subscribe, () => getModulesTab(tabId));
}

/** Mapa reactivo completo (lo consume el `SessionHost`). */
export function useModulesByTab(): Record<string, ModulesTabState> {
  return useSyncExternalStore(subscribe, () => byTab);
}

// ── Utilidades ───────────────────────────────────────────────────────────────

/** ¿La URL navegada en la webview ya es la VISTA destino (`route`)? El panel
 *  sirve los módulos en `/<route>` (el middleware quita el prefijo `/panel`),
 *  y las herramientas en `/assistant` · `/terminal`. Compara el último segmento. */
export function urlMatchesRoute(url: string, route: string): boolean {
  if (!route) return false;
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    return path === `/${route}` || path.endsWith(`/${route}`);
  } catch {
    return false;
  }
}

function clearPendingActivate(id: string): void {
  const pa = pendingActivate.get(id);
  if (!pa) return;
  clearTimeout(pa.timer);
  pendingActivate.delete(id);
}

function dropRuntime(id: string): void {
  injectors.delete(id);
  pendingNav.delete(id);
  loadedById.delete(id);
}

// ── Inyección ────────────────────────────────────────────────────────────────

export function registerModuleInjector(sessionId: string, inject: ((js: string) => void) | null): void {
  if (inject) injectors.set(sessionId, inject);
  else injectors.delete(sessionId);
}

/** Inyecta un script en la webview de una sesión (si su inyector está listo).
 *  Añade `; true;` (buena práctica de injectJavaScript). Devuelve true si pudo. */
export function injectModuleScript(sessionId: string, js: string): boolean {
  const inject = injectors.get(sessionId);
  if (!inject) return false;
  try {
    inject(`${js}; true;`);
    return true;
  } catch {
    return false;
  }
}

// ── Acciones de ciclo de vida ────────────────────────────────────────────────

/** Restaura (una sola vez por pestaña) las sesiones persistidas: FRÍAS (sin
 *  `redirectUrl` ni montar). */
export async function restoreModuleSessions(tabId: string): Promise<void> {
  if (restoreRequested.has(tabId)) return;
  restoreRequested.add(tabId);
  const restored = await loadModuleSessions(tabId);
  const cur = getModulesTab(tabId);
  setTab(tabId, {
    ...cur,
    sessions: cur.sessions.length ? cur.sessions : restored,
    restored: true,
  });
}

/** Marca una sesión como MONTADA (el host renderiza su webview) aplicando el
 *  tope blando. NO la activa (eso lo decide `activateModule`). Lo usa el
 *  pre-warm para cargar en segundo plano sin mostrarla. Nunca desmonta la activa. */
export function mountModule(tabId: string, id: string): void {
  const cur = getModulesTab(tabId);
  const order = mountOrderByTab.get(tabId) ?? [];
  const nextOrder = [...order.filter((x) => x !== id), id];
  let mounted = cur.mountedIds.includes(id) ? [...cur.mountedIds] : [...cur.mountedIds, id];
  while (mounted.length > MODULE_MOUNT_CAP) {
    const victim = nextOrder.find((x) => x !== id && x !== cur.activeModuleId && mounted.includes(x));
    if (!victim) break;
    mounted = mounted.filter((x) => x !== victim);
    nextOrder.splice(nextOrder.indexOf(victim), 1);
    dropRuntime(victim);
  }
  mountOrderByTab.set(tabId, nextOrder);
  setTab(tabId, { ...cur, mountedIds: mounted });
}

/** Activa (muestra) una sesión YA con redirectUrl y la marca montada. Oculta la
 *  consola visible (un solo overlay a la vez, consola vs módulo). */
export function activateModule(tabId: string, id: string): void {
  clearPendingActivate(id);
  minimizeConsoles(tabId); // un solo overlay a la vez (consola vs módulo)
  mountModule(tabId, id);
  const cur = getModulesTab(tabId);
  setTab(tabId, {
    ...cur,
    activeModuleId: id,
    activating: cur.activating?.id === id ? null : cur.activating,
  });
}

/** Difiere la activación: monta/carga la webview en segundo plano y la REVELA
 *  solo cuando la VISTA destino terminó de cargar (señal `lxp-page-ready`, ya
 *  pasó el callback "Cargando módulo"). Mientras tanto se muestra el indicador
 *  de carga. Un fallback la revela igual a los 20s para no dejar al usuario
 *  esperando si la detección falla. */
export function queueActivate(tabId: string, id: string, route: string, label: string): void {
  clearPendingActivate(id);
  // Monta YA la webview (idempotente) para que empiece a cargar en segundo
  // plano y dispare `lxp-page-ready` → se revela al estar lista. Sin esto, una
  // sesión NUEVA (sin pre-warm, p. ej. en invitado) no se montaba hasta el
  // fallback de 20s → tocar un módulo "no hacía nada".
  mountModule(tabId, id);
  const timer = setTimeout(() => {
    pendingActivate.delete(id);
    activateModule(tabId, id);
  }, 20000);
  pendingActivate.set(id, { tabId, route, timer });
  const cur = getModulesTab(tabId);
  setTab(tabId, { ...cur, activating: { id, label } });
}

/** Cancela una activación diferida en curso (tap sobre el indicador de carga). */
export function cancelModuleActivation(tabId: string, id: string): void {
  clearPendingActivate(id);
  const cur = getModulesTab(tabId);
  if (cur.activating?.id !== id) return;
  setTab(tabId, { ...cur, activating: null });
}

/** Atrás dentro de un módulo: OCULTA (la sesión sigue montada/caliente para
 *  reabrir instantáneo); no destruye ni gasta datos. */
export function hideModule(tabId: string): void {
  const cur = getModulesTab(tabId);
  if (cur.activeModuleId === null) return;
  setTab(tabId, { ...cur, activeModuleId: null });
}

/** Suelta (desmonta + quita la fila) una sesión SIN tocar el estado de la
 *  conexión principal del controlador. Lo usa el fallo de carga de un PRE-WARM
 *  (silencioso) y la sesión SSO caducada. */
export function dropModuleSession(tabId: string, id: string): void {
  dropRuntime(id);
  clearPendingActivate(id);
  const order = mountOrderByTab.get(tabId);
  if (order) mountOrderByTab.set(tabId, order.filter((x) => x !== id));
  const cur = getModulesTab(tabId);
  setTab(tabId, {
    ...cur,
    sessions: cur.sessions.filter((m) => m.id !== id),
    mountedIds: cur.mountedIds.filter((x) => x !== id),
    activeModuleId: cur.activeModuleId === id ? null : cur.activeModuleId,
    activating: cur.activating?.id === id ? null : cur.activating,
  });
}

/** Abre un MÓDULO (no nativo). Reutiliza la webview del panel si ya existe
 *  (navegación SPA); si no, acuña el redirectUrl SSO (next=/panel/<route>) y
 *  monta una nueva. `moduleName` = nombre del catálogo (rotula la sesión). */
export async function openModuleSession(
  tabId: string,
  panel: PanelRow,
  moduleId: string,
  route: string,
  moduleName: string | undefined,
  deps: ModuleSessionDeps,
): Promise<void> {
  if (NATIVE_MODULE_IDS.has(moduleId) || !/^[a-z][a-z0-9-]{1,63}$/.test(moduleId) || route !== `community/${moduleId}`) return;
  const path = buildModuleNextPath(route);
  const label = moduleName || route;
  const patch = (s: ModuleSession): ModuleSession => ({ ...s, moduleId, moduleName, route, autoOpen: undefined, prewarm: false });
  await openInPanelWebview(tabId, panel, { path, revealRoute: route, label, patch }, deps);
}

/** Abre una HERRAMIENTA (chat/terminal). Cada una tiene su VISTA PROPIA con
 *  ruta dedicada (`/assistant`, `/terminal`): se abre igual que un módulo. */
export async function openToolSession(
  tabId: string,
  panel: PanelRow,
  tool: "assistant" | "terminal",
  moduleName: string,
  deps: ModuleSessionDeps,
): Promise<void> {
  const path = buildToolNextPath(tool); // "/assistant" | "/terminal"
  const patch = (s: ModuleSession): ModuleSession => ({ ...s, moduleId: tool, moduleName, route: tool, autoOpen: undefined, prewarm: false });
  await openInPanelWebview(tabId, panel, { path, revealRoute: tool, label: moduleName, patch }, deps);
}

/** Núcleo compartido de módulo/herramienta (la lógica era idéntica salvo el
 *  path/route/patch): reutiliza la webview del panel (SPA / navegación
 *  pendiente / re-acuñado en frío) o crea una sesión nueva. */
async function openInPanelWebview(
  tabId: string,
  panel: PanelRow,
  target: {
    path: string;
    /** Slug de la vista a esperar para REVELAR (señal `lxp-page-ready`). */
    revealRoute: string;
    label: string;
    patch: (s: ModuleSession) => ModuleSession;
  },
  deps: ModuleSessionDeps,
): Promise<void> {
  const { path, revealRoute, label, patch } = target;
  const applyPatch = (id: string, extra?: Partial<ModuleSession>) => {
    const cur = getModulesTab(tabId);
    setTab(tabId, {
      ...cur,
      sessions: cur.sessions.map((s) => (s.id === id ? { ...patch(s), ...extra } : s)),
    });
  };
  const existing = getModulesTab(tabId).sessions.find((s) => s.panelId === panel.id);
  if (existing) {
    const isMounted = getModulesTab(tabId).mountedIds.includes(existing.id);
    const isReady = isMounted && loadedById.get(existing.id) === true;
    // Ya en ESTA vista y cargada (reabrir lo minimizado): revelar al instante.
    if (isReady && existing.route === revealRoute) {
      applyPatch(existing.id);
      activateModule(tabId, existing.id);
      return;
    }
    if (isReady && injectModuleScript(existing.id, buildSpaNavigateScript(path))) {
      // Webview viva y cargada → navegación SPA; REVELA solo cuando cargue la ruta.
      applyPatch(existing.id);
      queueActivate(tabId, existing.id, revealRoute, label);
      return;
    }
    if (isMounted) {
      // Montada pero aún cargando: navega en cuanto cargue la página (onUrlChange).
      pendingNav.set(existing.id, { path });
      applyPatch(existing.id);
      queueActivate(tabId, existing.id, revealRoute, label);
      return;
    }
    // Fría (restaurada / desmontada por el tope): re-acuña URL fresca con
    // next=ruta (el token SSO previo pudo expirar) y re-monta directo ahí.
    const freshUrl = await deps.resolveRedirectUrl(panel.source, path);
    if (!freshUrl) return;
    pendingNav.delete(existing.id);
    loadedById.set(existing.id, false); // recarga desde cero
    applyPatch(existing.id, { redirectUrl: freshUrl });
    queueActivate(tabId, existing.id, revealRoute, label);
    return;
  }
  const url = await deps.resolveRedirectUrl(panel.source, path);
  if (!url) return; // sin datos / sin host / error → resolveRedirectUrl ya avisó
  const id = deps.makeId();
  const cur = getModulesTab(tabId);
  setTab(tabId, {
    ...cur,
    sessions: [...cur.sessions, {
      ...patch({
        id,
        panelId: panel.id,
        panelName: panel.nameLabel || panel.source.licenseName || "",
        moduleId: "",
        route: "",
      }),
      redirectUrl: url,
    }],
  });
  queueActivate(tabId, id, revealRoute, label);
}

/** Pre-carga (oculta) la webview de un panel en su dashboard. Silencioso:
 *  respeta el bloqueo de 0 MB y no muestra TOFU ni errores. Si el panel ya
 *  tiene una sesión MONTADA (caliente) no hace nada; si tiene una FRÍA
 *  (restaurada del disco / evicta) la re-acuña y la monta OCULTA; si no hay
 *  ninguna, crea una nueva de pre-warm. Semántica intacta de MainTab. */
export async function prewarmPanel(tabId: string, panel: PanelRow, deps: ModuleSessionDeps): Promise<void> {
  const before = getModulesTab(tabId);
  const existing = before.sessions.find((s) => s.panelId === panel.id);
  if (existing && before.mountedIds.includes(existing.id)) return; // ya caliente
  const url = await deps.resolveRedirectUrl(panel.source, undefined, { silent: true });
  if (!url) return; // sin saldo / huella pendiente / error → no se pre-carga
  // Releer tras el await (pudo abrirse/cargarse mientras resolvíamos).
  const after = getModulesTab(tabId);
  const cur = after.sessions.find((s) => s.panelId === panel.id);
  if (cur && after.mountedIds.includes(cur.id)) return;
  if (cur) {
    // Sesión fría existente (p. ej. restaurada): re-acuña URL y monta OCULTA.
    loadedById.set(cur.id, false);
    setTab(tabId, {
      ...after,
      sessions: after.sessions.map((m) => (m.id === cur.id
        ? { ...m, moduleId: "dashboard", route: "", redirectUrl: url, autoOpen: undefined }
        : m)),
    });
    mountModule(tabId, cur.id);
    return;
  }
  const id = deps.makeId();
  setTab(tabId, {
    ...after,
    sessions: [...after.sessions, {
      id,
      panelId: panel.id,
      panelName: panel.nameLabel || panel.source.licenseName || "",
      moduleId: "dashboard",
      route: "",
      redirectUrl: url,
      prewarm: true,
    }],
  });
  mountModule(tabId, id); // monta OCULTA (no activa): carga en segundo plano
}

/** URL navegada dentro de la webview de una sesión: vacía la navegación
 *  pendiente una vez cargada la página real del panel (no el callback SSO).
 *  Permite reusar una webview recién creada/aún cargando: la navegación SPA se
 *  aplica en cuanto el DOM del panel está listo. */
export function handleModuleUrlChange(sessionId: string, url: string): void {
  if (!url || /\/sso\//.test(url)) return;
  // Página real del panel cargada: a partir de aquí la inyección directa funciona.
  loadedById.set(sessionId, true);
  const pending = pendingNav.get(sessionId);
  if (!pending) return;
  setTimeout(() => {
    if (pendingNav.get(sessionId) !== pending) return; // cambió mientras tanto
    // `path` (herramientas → ruta dedicada) o `route` (módulos → /panel/<route>).
    const targetPath = pending.path ?? (pending.route ? buildModuleNextPath(pending.route) : null);
    const js = targetPath ? buildSpaNavigateScript(targetPath) : null;
    if (js && injectModuleScript(sessionId, js)) pendingNav.delete(sessionId);
  }, 400);
}

/** La webview llegó a la VISTA REAL destino y terminó de cargar (señal
 *  `lxp-page-ready`). Si hay una activación diferida esperando esa ruta,
 *  REVELA ahora (con un respiro mínimo): el usuario nunca ve la pantalla
 *  intermedia de carga del panel. */
export function handleModulePageReady(tabId: string, sessionId: string, url: string): void {
  const pa = pendingActivate.get(sessionId);
  if (!pa || pa.tabId !== tabId || !urlMatchesRoute(url, pa.route)) return;
  clearTimeout(pa.timer);
  pendingActivate.delete(sessionId);
  setTimeout(() => activateModule(tabId, sessionId), 120);
}

/** ¿Está el webview de la sesión ya cargado (página real del panel)? */
export function isModuleLoaded(sessionId: string): boolean {
  return loadedById.get(sessionId) === true;
}

/** Libera el estado en memoria de una pestaña (al cerrarla / desmontar su tab). */
export function disposeModulesTab(tabId: string): void {
  const cur = byTab[tabId];
  if (cur) {
    for (const m of cur.sessions) {
      dropRuntime(m.id);
      clearPendingActivate(m.id);
    }
  }
  const timer = persistTimers.get(tabId);
  if (timer) {
    clearTimeout(timer);
    persistTimers.delete(tabId);
  }
  mountOrderByTab.delete(tabId);
  restoreRequested.delete(tabId);
  if (!(tabId in byTab)) return;
  const next = { ...byTab };
  delete next[tabId];
  byTab = next;
  emit();
}

// Logout / cambio de cuenta: las sesiones de módulo EN MEMORIA llevan el
// `redirectUrl` (URL SSO firmada del usuario saliente, potencialmente aún
// canjeable) además de nombres de panel/rutas → fuera, junto con todo el
// runtime (timers de activación diferida, inyectores, navegaciones pendientes).
// Lo persistido a disco queda intacto (contrato previo: restaura FRÍO sin
// redirectUrl y re-acuña el SSO con el token de la cuenta activa).
registerStoreReset(() => {
  for (const tabId of Object.keys(byTab)) disposeModulesTab(tabId);
  persistTimers.forEach((t) => clearTimeout(t));
  persistTimers.clear();
  pendingActivate.forEach((pa) => clearTimeout(pa.timer));
  pendingActivate.clear();
  injectors.clear();
  pendingNav.clear();
  loadedById.clear();
  mountOrderByTab.clear();
  restoreRequested.clear();
});

// ── Persistencia a disco (contrato previo, sin cambios) ─────────────────────

const KEY = "lp.app.moduleSessions.v1";

type Persisted = Omit<ModuleSession, "redirectUrl">;
type Store = Record<string, Persisted[]>;

let cache: Store | null = null;

async function readAll(): Promise<Store> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function writeAll(store: Store): Promise<void> {
  cache = store;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage lleno / no disponible — ignorar */
  }
}

export async function loadModuleSessions(tabId: string): Promise<ModuleSession[]> {
  const all = await readAll();
  const list = all[tabId];
  // Old app versions persisted WebView module sessions. The current server
  // screens are native and the community runtime has no working page route.
  if (Array.isArray(list) && list.length) await writeAll({ ...all, [tabId]: [] });
  return [];
}

export async function saveModuleSessions(tabId: string, sessions: ModuleSession[]): Promise<void> {
  const all = await readAll();
  // No persistir sesiones de PRE-WARM que el usuario nunca abrió (al activarlas se les
  // quita `prewarm`): así no se re-gastan datos pre-cargando al relanzar la app.
  const slim: Persisted[] = sessions
    .filter((s) => !s.prewarm)
    .map(({ redirectUrl: _drop, ...rest }) => rest);
  if (slim.length === 0 && !(tabId in all)) return;
  await writeAll({ ...all, [tabId]: slim });
}

/** Borra las sesiones de módulo persistidas de una pestaña (al cerrar la pestaña). */
export async function clearModuleSessions(tabId: string): Promise<void> {
  const all = await readAll();
  if (!(tabId in all)) return;
  const next = { ...all };
  delete next[tabId];
  await writeAll(next);
}
