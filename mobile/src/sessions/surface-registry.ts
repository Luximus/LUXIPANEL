// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Registro de SUPERFICIES de sesión (fase B2).
 *
 * Una "superficie" es el hueco visual donde debe verse una sesión viva
 * (consola tmux o webview de módulo) que renderiza SIEMPRE el `SessionHost`
 * global. La pantalla-cáscara (`TerminalScreen` / `ModuleWebViewScreen`) monta
 * un `SessionSurfaceTarget` que publica aquí su rect EN COORDENADAS DE VENTANA
 * (`bound`) mientras está enfocada, y lo retira (`hidden`) al blur/desmontar.
 *
 * Clave: `tabId:sessionId` (helper `surfaceKey`). Patrón module-store +
 * `useSyncExternalStore` (igual que el resto del repo): estado inmutable por
 * clave + listeners por clave, sin dependencias de React Native (testeable en
 * node).
 */
import { useCallback, useSyncExternalStore } from "react";

export type SurfaceRect = { x: number; y: number; width: number; height: number };

export type SurfaceState =
  | { status: "hidden" }
  | { status: "bound"; rect: SurfaceRect };

const HIDDEN: SurfaceState = Object.freeze({ status: "hidden" as const });

const surfaces = new Map<string, SurfaceState>();
const keyListeners = new Map<string, Set<() => void>>();
// Señal global de re-medición: el `SessionHost` la dispara cuando SU layout
// cambia (p. ej. el navbar aparece/desaparece) para que los targets vuelvan a
// medirse en ventana aunque su layout local no haya cambiado.
const measureListeners = new Set<() => void>();

/** Clave canónica de la superficie de una sesión. */
export function surfaceKey(tabId: string, sessionId: string): string {
  return `${tabId}:${sessionId}`;
}

function emit(key: string): void {
  keyListeners.get(key)?.forEach((l) => l());
}

/** ¿Mismo rect a efectos visuales? Tolerancia sub-píxel para no re-emitir por
 *  ruido de `measureInWindow` (fracciones que bailan sin cambio real). */
function sameRect(a: SurfaceRect, b: SurfaceRect): boolean {
  const eps = 0.5;
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps
    && Math.abs(a.width - b.width) < eps && Math.abs(a.height - b.height) < eps;
}

/** Publica (o actualiza) el rect visible de la superficie. */
export function bindSurface(key: string, rect: SurfaceRect): void {
  if (!(rect.width > 0) || !(rect.height > 0)) return; // medición inválida (oculto/aún sin layout)
  const cur = surfaces.get(key);
  if (cur?.status === "bound" && sameRect(cur.rect, rect)) return;
  surfaces.set(key, { status: "bound", rect });
  emit(key);
}

/** Retira la superficie (blur/desmontar/tab inactiva): la sesión pasa a oculta. */
export function unbindSurface(key: string): void {
  if (!surfaces.has(key)) return;
  surfaces.delete(key);
  emit(key);
}

export function getSurface(key: string): SurfaceState {
  return surfaces.get(key) ?? HIDDEN;
}

export function subscribeSurface(key: string, listener: () => void): () => void {
  let set = keyListeners.get(key);
  if (!set) {
    set = new Set();
    keyListeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) keyListeners.delete(key);
  };
}

/** Estado reactivo de una superficie (para las capas del `SessionHost`). */
export function useSurface(key: string): SurfaceState {
  const subscribe = useCallback((cb: () => void) => subscribeSurface(key, cb), [key]);
  const getSnapshot = useCallback(() => getSurface(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Pide a TODOS los targets montados que vuelvan a medirse (ver doc arriba). */
export function requestSurfaceMeasure(): void {
  measureListeners.forEach((l) => l());
}

export function subscribeSurfaceMeasure(listener: () => void): () => void {
  measureListeners.add(listener);
  return () => {
    measureListeners.delete(listener);
  };
}
