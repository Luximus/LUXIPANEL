// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Store MODULE-LEVEL de las pestañas del shell (fase B3).
 *
 * Posee la lista de pestañas (`AppTab[]`) y la pestaña activa, fuera del árbol
 * de React (sustituye al hook con estado local `useTabs`): la fuente de verdad
 * sobrevive a montajes/desmontajes y es consultable de forma imperativa desde
 * cualquier módulo (controllers, stores de sesión, fases B4/B5).
 *
 * Persistencia: `lib/tabs-state` (clave v2, con migración v1→v2). Se hidrata
 * UNA vez (`hydrateTabSessions`) y persiste cada mutación posterior. Además de
 * la sesión restaurable por pestaña (vista/ssh/panel), guarda la pantalla
 * `Chat` apilada (`restoreChatPanelId`) para reabrirla al restaurar — el
 * "persistedRoute" del plan B3; las rutas `Terminal`/`ModuleWebView` no lo
 * necesitan: se re-apilan solas desde sus stores de sesión.
 *
 * Patrón module-store + `useSyncExternalStore`, como el resto del repo.
 */
import { useSyncExternalStore } from "react";
import type { AppTab } from "../features/app/types";
import { registerStoreReset } from "../lib/store-reset";
import { loadPersistedTabs, persistTabs, type TabSession } from "../lib/tabs-state";

export type TabSessionsState = {
  tabs: AppTab[];
  activeTabId: string;
  /** `true` cuando ya se intentó cargar el estado persistido (haya o no). */
  hydrated: boolean;
};

// La pestaña fija arranca SIEMPRE en la pantalla de servidores: sin autoConnect
// (no abre el servidor por defecto al iniciar) y sin restaurar sesión SSH.
const DEFAULT_TABS: AppTab[] = [{ id: "tab-1", autoLabel: "Servers", autoConnect: false, fixed: true }];

function initialState(): TabSessionsState {
  return { tabs: [...DEFAULT_TABS], activeTabId: DEFAULT_TABS[0].id, hydrated: false };
}

let state: TabSessionsState = initialState();
let hydrationStarted = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Aplica una mutación y persiste (best-effort) si ya hubo hidratación. */
function setState(next: TabSessionsState): void {
  if (next === state) return;
  state = next;
  emit();
  if (state.hydrated) void persistTabs({ tabs: state.tabs, activeTabId: state.activeTabId });
}

/**
 * Garantiza que exista UNA pestaña fija "Servers" y que sea SIEMPRE la primera.
 * Repara datos persistidos antiguos (sin la bandera `fixed`) marcando la primera
 * como fija. La fija se puede renombrar (`customLabel`) pero no cerrar, y siempre
 * arranca en la pantalla de servidores (se le limpia el estado de restauración
 * SSH). Se conserva su `customLabel` para no perder el nombre al reparar/recargar.
 */
function ensureFixedTab(tabs: AppTab[]): AppTab[] {
  if (tabs.length === 0) return [...DEFAULT_TABS];
  const fixed = tabs.find((tab) => tab.fixed) ?? tabs[0];
  const rest = tabs.filter((tab) => tab.id !== fixed.id).map((tab) => ({ ...tab, fixed: false }));
  return [{ id: fixed.id, autoLabel: "Servers", autoConnect: false, fixed: true, customLabel: fixed.customLabel }, ...rest];
}

/** Carga el estado persistido (v2, migrando v1). Idempotente: solo la primera
 *  llamada hidrata; las demás no hacen nada (las mutaciones ya mandan). */
export async function hydrateTabSessions(): Promise<void> {
  if (hydrationStarted) return;
  hydrationStarted = true;
  const persisted = await loadPersistedTabs();
  if (persisted) {
    setState({ tabs: ensureFixedTab(persisted.tabs), activeTabId: persisted.activeTabId, hydrated: true });
    return;
  }
  setState({ ...state, hydrated: true });
}

export function getTabSessions(): TabSessionsState {
  return state;
}

export function setActiveTab(tabId: string): void {
  if (state.activeTabId === tabId || !state.tabs.some((tab) => tab.id === tabId)) return;
  setState({ ...state, activeTabId: tabId });
}

/** Abre una pestaña nueva (y la activa). Devuelve su id. */
export function openNewTab(): string {
  const nextId = `tab-${Date.now()}`;
  setState({
    ...state,
    tabs: [...state.tabs, { id: nextId, autoLabel: "Servers", autoConnect: false }],
    activeTabId: nextId,
  });
  return nextId;
}

export function closeTab(tabId: string): void {
  const target = state.tabs.find((tab) => tab.id === tabId);
  if (!target || target.fixed) return; // la pestaña fija no se cierra
  if (state.tabs.length === 1) return;
  const tabs = state.tabs.filter((tab) => tab.id !== tabId);
  const activeTabId = state.activeTabId === tabId
    ? (tabs[tabs.length - 1]?.id ?? tabs[0].id)
    : state.activeTabId;
  setState({ ...state, tabs, activeTabId });
}

// La pestaña fija SÍ se puede renombrar (su `customLabel`); lo que no se puede
// es cerrarla (ver closeTab) ni cambiar su `autoLabel`/vista (sigue siendo la
// de servidores). Por eso aquí no se excluye `tab.fixed`.
export function renameTab(tabId: string, customLabel: string): void {
  setState({
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, customLabel: customLabel.trim() || undefined } : tab)),
  });
}

export function setTabAutoLabel(tabId: string, autoLabel: string): void {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    // También la fija sigue el panel activo: si el usuario entró al panel o
    // inició conversación, su `autoLabel` pasa a ser el nombre del panel; el
    // controlador la devuelve a "Servers" cuando no hay contexto.
    if (tab.id !== tabId || tab.autoLabel === autoLabel) return tab;
    changed = true;
    return { ...tab, autoLabel };
  });
  if (changed) setState({ ...state, tabs });
}

/** Estado de sesión restaurable de la pestaña (vista / URL SSH / panel). */
export function updateTabSession(tabId: string, session: TabSession): void {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    if (tab.id !== tabId) return tab;
    const view = session.view;
    const sshUrl = session.sshUrl || undefined;
    const panelId = session.panelId || undefined;
    if (tab.restoreView === view && tab.restoreSshUrl === sshUrl && tab.restorePanelId === panelId) return tab;
    changed = true;
    return { ...tab, restoreView: view, restoreSshUrl: sshUrl, restorePanelId: panelId };
  });
  if (changed) setState({ ...state, tabs });
}

/** Pantalla `Chat` apilada de la pestaña (persistedRoute de B3): panel del chat
 *  abierto, o `null` al salir de la ruta. */
export function updateTabChatRoute(tabId: string, panelId: string | null): void {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    if (tab.id !== tabId) return tab;
    const next = panelId || undefined;
    if (tab.restoreChatPanelId === next) return tab;
    changed = true;
    return { ...tab, restoreChatPanelId: next };
  });
  if (changed) setState({ ...state, tabs });
}

/** Estado reactivo del store (lo consume MainScreen). */
export function useTabSessions(): TabSessionsState {
  return useSyncExternalStore(subscribe, () => state);
}

/** SOLO tests: resetea el estado en memoria (no toca disco). */
export function __resetTabSessionsForTests(): void {
  state = initialState();
  hydrationStarted = false;
}

// Logout / cambio de cuenta: el estado EN MEMORIA (rótulos por panel, rutas de
// restauración ssh/panel/chat del usuario saliente) vuelve a la pestaña fija.
// El disco no se toca (contrato previo al module-store: las pestañas persistidas
// se re-hidratan en el próximo login y sus restauraciones por panel fallan
// benignas si la cuenta entrante no posee esos paneles).
registerStoreReset(() => {
  state = initialState();
  hydrationStarted = false;
  emit();
});
