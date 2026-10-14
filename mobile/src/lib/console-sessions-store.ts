// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerStoreReset } from "./store-reset";

/**
 * Store de las CONSOLAS (terminal nativo) POR PESTAÑA (fase B2).
 *
 * Fuente de verdad del ciclo de vida de las consolas (antes vivía en el estado
 * del `MainTab`): lista, consola activa (visible) y consolas MONTADAS (con la
 * conexión viva en el `SessionHost` global). Patrón module-store +
 * `useSyncExternalStore`, como el resto del repo.
 *
 * Persistencia A DISCO (se conserva el contrato previo): si el SO MATA la app,
 * al relanzar se restaura la LISTA de consolas (nombre + `sessionId`) y, al
 * activar una, se RE-ADJUNTA su sesión tmux server-side por ese `sessionId`.
 * Se restauran FRÍAS (sin montar/conectar) hasta que el usuario las abre → no
 * gastan datos al iniciar. Todo en una sola clave (mapa tabId → consolas[]).
 */

/** Una consola del terminal nativo: conexión/WebSocket independiente, viva
 *  mientras exista (aunque no sea la activa). La lista la gestiona el tab
 *  "Consolas" del drawer. Nombre mostrado = `label` (custom editable) ??
 *  `autoLabel` (derivado de la actividad: "Codex"/"Claude" en conversación, o
 *  el último comando) ?? nombre del panel + índice. `convMode` marca que está
 *  dentro de una conversación CLI para no pisar el título con cada línea
 *  tecleada en el TUI. */
export type ConsoleSession = {
  id: string;
  panelId: string;
  panelName: string;
  label?: string;
  autoLabel?: string;
  convMode?: "Codex" | "Claude";
};

export type ConsolesTabState = {
  consoles: ConsoleSession[];
  /** Consola visible. `null` = minimizadas (vivas pero se ve la vista actual). */
  activeConsoleId: string | null;
  /** Consolas con la sesión MONTADA (conectada/viva) en el SessionHost. Las
   *  restauradas de disco arrancan FUERA: solo se montan (y reattachan tmux)
   *  al activarlas → no gastan datos al abrir la app. */
  mountedIds: string[];
  /** Ya se intentó restaurar la lista persistida (gate de persistencia). */
  restored: boolean;
};

const EMPTY_TAB: ConsolesTabState = Object.freeze({
  consoles: [],
  activeConsoleId: null,
  mountedIds: [],
  restored: false,
});

// ── Estado reactivo en memoria ────────────────────────────────────────────────
let byTab: Record<string, ConsolesTabState> = {};
const listeners = new Set<() => void>();
const restoreRequested = new Set<string>();
// Inyectores de JS por consola (los registra cada NativeTerminalSession del
// host). El tab "Terminal" del drawer ejecuta snippets contra la ACTIVA.
const injectors = new Map<string, (js: string) => void>();
// Debounce de persistencia por pestaña: el auto-rótulo cambia con cada comando
// → coalescemos escrituras (mismo criterio que antes en MainTab).
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function getConsolesTab(tabId: string): ConsolesTabState {
  return byTab[tabId] ?? EMPTY_TAB;
}

function setTab(tabId: string, next: ConsolesTabState): void {
  const prev = getConsolesTab(tabId);
  byTab = { ...byTab, [tabId]: next };
  emit();
  // Persistir SOLO cambios de la lista tras la restauración inicial (no pisar
  // lo guardado con el [] inicial).
  if (next.restored && next.consoles !== prev.consoles) schedulePersist(tabId);
}

function schedulePersist(tabId: string): void {
  const prev = persistTimers.get(tabId);
  if (prev) clearTimeout(prev);
  persistTimers.set(tabId, setTimeout(() => {
    persistTimers.delete(tabId);
    void saveConsoles(tabId, getConsolesTab(tabId).consoles);
  }, 1200));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Estado reactivo de las consolas de una pestaña. */
export function useConsolesTab(tabId: string): ConsolesTabState {
  return useSyncExternalStore(subscribe, () => getConsolesTab(tabId));
}

/** Mapa reactivo completo (lo consume el `SessionHost`). */
export function useConsolesByTab(): Record<string, ConsolesTabState> {
  return useSyncExternalStore(subscribe, () => byTab);
}

// ── Acciones ─────────────────────────────────────────────────────────────────

/** Restaura (una sola vez por pestaña) las consolas persistidas: FRÍAS, sin
 *  activar ni montar. */
export async function restoreConsoles(tabId: string): Promise<void> {
  if (restoreRequested.has(tabId)) return;
  restoreRequested.add(tabId);
  const restored = await loadConsoles(tabId);
  const cur = getConsolesTab(tabId);
  // No pisar consolas abiertas mientras se leía el disco (carrera improbable).
  setTab(tabId, {
    ...cur,
    consoles: cur.consoles.length ? cur.consoles : restored,
    restored: true,
  });
}

/** Abre una consola NUEVA y la activa (montada = conecta ya). El id lo genera
 *  el llamador (UUID no-adivinable: es el `sessionId` del reattach tmux). */
export function openConsole(tabId: string, session: ConsoleSession): void {
  const cur = getConsolesTab(tabId);
  setTab(tabId, {
    ...cur,
    consoles: [...cur.consoles, session],
    mountedIds: cur.mountedIds.includes(session.id) ? cur.mountedIds : [...cur.mountedIds, session.id],
    activeConsoleId: session.id,
  });
}

/** Activa (muestra) una consola y la marca montada (la conecta si estaba fría). */
export function activateConsole(tabId: string, id: string): void {
  const cur = getConsolesTab(tabId);
  if (!cur.consoles.some((c) => c.id === id)) return;
  setTab(tabId, {
    ...cur,
    mountedIds: cur.mountedIds.includes(id) ? cur.mountedIds : [...cur.mountedIds, id],
    activeConsoleId: id,
  });
}

/** Minimiza el terminal (ninguna consola visible; todas siguen vivas). */
export function minimizeConsoles(tabId: string): void {
  const cur = getConsolesTab(tabId);
  if (cur.activeConsoleId === null) return;
  setTab(tabId, { ...cur, activeConsoleId: null });
}

/** Renombrado MANUAL: fija `label`; vacío lo borra (vuelve al auto-rótulo). */
export function renameConsole(tabId: string, id: string, label: string): void {
  const cur = getConsolesTab(tabId);
  setTab(tabId, {
    ...cur,
    consoles: cur.consoles.map((c) => (c.id === id ? { ...c, label: label.trim() || undefined } : c)),
  });
}

/** Clasifica un comando ejecutado para el auto-rótulo de la consola: lanzar
 *  `codex`/`claude` = entra en conversación; `exit`/`quit`/`logout` = sale; lo
 *  demás = comando normal (su texto pasa a ser el título). Tolera `cd <x> && cmd`. */
export function classifyConsoleCommand(cmd: string): { kind: "conv"; label: "Codex" | "Claude" } | { kind: "exit" } | { kind: "cmd" } {
  const c = cmd.replace(/^cd\s+.+?&&\s*/i, "").trim();
  if (/^codex(\s|$)/i.test(c)) return { kind: "conv", label: "Codex" };
  if (/^claude(\s|$)/i.test(c)) return { kind: "conv", label: "Claude" };
  if (/^\/?(exit|quit|logout)$/i.test(c)) return { kind: "exit" };
  return { kind: "cmd" };
}

/** Auto-rótulo por actividad (solo si el usuario NO editó `label`): "Codex"/
 *  "Claude" en conversación, o el último comando ejecutado. Dentro de una
 *  conversación CLI (`convMode`) NO se pisa el título con cada línea tecleada. */
export function noteConsoleCommand(tabId: string, id: string, cmd: string): void {
  const trimmed = cmd.trim();
  if (!trimmed) return;
  const cur = getConsolesTab(tabId);
  let changed = false;
  const next = cur.consoles.map((c) => {
    if (c.id !== id) return c;
    const cls = classifyConsoleCommand(trimmed);
    let updated = c;
    if (cls.kind === "conv") updated = { ...c, convMode: cls.label, autoLabel: cls.label };
    else if (cls.kind === "exit") updated = { ...c, convMode: undefined, autoLabel: trimmed };
    else if (!c.convMode) updated = { ...c, autoLabel: trimmed }; // dentro del TUI: no pisar
    if (updated !== c) changed = true;
    return updated;
  });
  if (!changed) return; // sin cambios (p. ej. tecleo dentro del TUI) → no re-render
  setTab(tabId, { ...cur, consoles: next });
}

/** Cierra (destruye) una consola. Matar la sesión tmux server-side es del
 *  llamador (usa `src/api`, con token). Si se cierra la activa, salta a otra
 *  viva; si no queda ninguna, minimiza. */
export function closeConsole(tabId: string, id: string): void {
  injectors.delete(id);
  const cur = getConsolesTab(tabId);
  const remaining = cur.consoles.filter((c) => c.id !== id);
  setTab(tabId, {
    ...cur,
    consoles: remaining,
    mountedIds: cur.mountedIds.filter((x) => x !== id),
    activeConsoleId: cur.activeConsoleId === id
      ? (remaining.length ? remaining[remaining.length - 1].id : null)
      : cur.activeConsoleId,
  });
}

/** Libera el estado en memoria de una pestaña (al cerrarla / desmontar su tab).
 *  Las sesiones del host se desmontan al desaparecer del estado. */
export function disposeConsolesTab(tabId: string): void {
  const cur = byTab[tabId];
  if (cur) for (const c of cur.consoles) injectors.delete(c.id);
  const timer = persistTimers.get(tabId);
  if (timer) {
    clearTimeout(timer);
    persistTimers.delete(tabId);
  }
  restoreRequested.delete(tabId);
  if (!(tabId in byTab)) return;
  const next = { ...byTab };
  delete next[tabId];
  byTab = next;
  emit();
}

// Logout / cambio de cuenta: las consolas EN MEMORIA (nombres de panel, ids de
// sesión tmux, inyectores del host) son datos del usuario saliente → fuera.
// Lo persistido a disco queda intacto (contrato previo: restaura FRÍO y el
// re-attach tmux exige el token de la cuenta dueña, así que no cruza cuentas).
registerStoreReset(() => {
  for (const tabId of Object.keys(byTab)) disposeConsolesTab(tabId);
  persistTimers.forEach((t) => clearTimeout(t));
  persistTimers.clear();
  restoreRequested.clear();
  injectors.clear();
});

// ── Inyección de snippets ────────────────────────────────────────────────────

export function registerConsoleInjector(consoleId: string, inject: ((js: string) => void) | null): void {
  if (inject) injectors.set(consoleId, inject);
  else injectors.delete(consoleId);
}

/** Inyecta un snippet (`lxp-terminal:inject-command`) en la consola indicada. */
export function injectIntoConsole(consoleId: string, js: string): void {
  injectors.get(consoleId)?.(js);
}

// ── Persistencia a disco (contrato previo, sin cambios) ─────────────────────

const KEY = "lp.app.consoleSessions.v1";

type Store = Record<string, ConsoleSession[]>;

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

export async function loadConsoles(tabId: string): Promise<ConsoleSession[]> {
  const all = await readAll();
  const list = all[tabId];
  return Array.isArray(list) ? list : [];
}

export async function saveConsoles(tabId: string, consoles: ConsoleSession[]): Promise<void> {
  const all = await readAll();
  if (consoles.length === 0 && !(tabId in all)) return;
  await writeAll({ ...all, [tabId]: consoles });
}

/** Borra las consolas persistidas de una pestaña (al cerrar la pestaña entera). */
export async function clearConsoles(tabId: string): Promise<void> {
  const all = await readAll();
  if (!(tabId in all)) return;
  const next = { ...all };
  delete next[tabId];
  await writeAll(next);
}
