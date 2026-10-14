// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Entorno POR PESTAÑA para el `SessionHost` (fase B2).
 *
 * Las sesiones vivas (consolas tmux y webviews de módulo) se renderizan en el
 * host GLOBAL, pero sus props/callbacks siguen siendo del dominio de cada
 * `MainTab` (token, idioma, tema, handlers del controller, drawers…). Cada
 * MainTab publica aquí su entorno (`setSessionTabEnv`) y el host lo lee de
 * forma reactiva. Es un puente transicional: en B4, cuando el god-hook se
 * trocee en stores por dominio, la mayoría de estos campos pasarán a leerse
 * directo de esos stores.
 *
 * Patrón module-store + `useSyncExternalStore`, como el resto del repo.
 */
import { useSyncExternalStore } from "react";
import type { PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import type { ThemeMode } from "../features/app/types";
import type { FloatingButtonsConfig } from "../lib/module-floating-buttons-store";
import { registerStoreReset } from "../lib/store-reset";

/** Entorno de las CONSOLAS (terminal nativo) de una pestaña. */
export type ConsoleHostEnv = {
  token: string;
  language: string;
  guestMode: boolean;
  /** Tabs del servidor (Terminal / Chat / Ajustes) pintados arriba del terminal. */
  topTabs: { key: string; label: string; accent?: boolean }[];
  onSelectTopTab: (key: string) => void;
  /** Comando ejecutado en una consola (historial + auto-rótulo). */
  onCommand: (consoleId: string, command: string, injected: boolean) => void;
  /** Swipe lateral sobre el terminal (abre drawers), como el shell del tab. */
  onSwipe?: (event: PanGestureHandlerStateChangeEvent) => void;
};

/** Entorno de los WEBVIEWS DE MÓDULO de una pestaña. */
export type ModuleHostEnv = {
  theme: ThemeMode;
  language: string;
  repaintSignal: number;
  /** Config de botones flotantes por servidor (panelId). */
  floatingByPanel: Record<string, FloatingButtonsConfig>;
  onLoadFailed: (sessionId: string, errorCode: number, errorDescription: string) => void;
  onConnected: () => void;
  onSessionExpired: (sessionId: string) => void;
  onRequestBack: () => void;
  onRequestOpenTabs: () => void;
  onMoreOptions: (sessionId: string) => void;
  onOpenModuleShortcut: (sessionId: string, moduleId: string) => void;
  onRequestSetTheme: (theme: ThemeMode) => void;
  onRequestSetLanguage: (language: string) => void;
};

export type SessionTabEnv = {
  /** Pestaña ACTIVA de MainScreen: las sesiones de pestañas inactivas quedan
   *  ocultas (paridad con el `display:none` del MainTab inactivo). */
  isActiveTab: boolean;
  /** Réplica del gate `shellVisible` del MainTab: en splash/carga/login/ssh los
   *  overlays no se montaban → el host no renderiza sesiones de esa pestaña. */
  shellVisible: boolean;
  /** Hay un overlay del MainTab que HOY se pinta POR ENCIMA de las sesiones
   *  (ver `computeSessionsSuppressed`). Como el host vive por encima del árbol
   *  del tab, esas capas se emulan OCULTANDO temporalmente las sesiones
   *  visibles. */
  suppressed: boolean;
  consoles: ConsoleHostEnv;
  modules: ModuleHostEnv;
};

/** Overlays del MainTab que se pintan POR ENCIMA de las sesiones vivas. Son las
 *  capas que el árbol del tab monta como Views absolutos (NO RN Modal: el
 *  drawer del servidor sobre una sesión ya usa Modal y no participa aquí). */
export type SessionOverlayFlags = {
  /** Pantalla de módulo NATIVA a pantalla completa. */
  nativeModuleOpen: boolean;
  /** Gestor de servidores standalone abierto. */
  standaloneOpen: boolean;
  /** Conexión NATIVA directa de un panel del directorio abierta (overlay que
   *  monta el selector de módulos nativo tras autenticar contra el box). */
  directConnectOpen: boolean;
  /** Indicador de activación diferida de una webview de módulo. */
  activating: boolean;
  /** Picker "Más opciones" del panel (usa su estado *Visible*: cubre también
   *  la animación de cierre, no solo el estado lógico abierto). */
  modulePickerVisible: boolean;
  /** Sheet central de acciones (ídem: *Visible* incluye el slide de cierre;
   *  sin él, las sesiones se pintaban ENCIMA del sheet abierto). */
  actionsSheetVisible: boolean;
  /** Drawer de soporte. */
  supportDrawerOpen: boolean;
};

/** Predicado PURO de supresión: mientras cualquiera de estos overlays esté
 *  visible, el `SessionHost` oculta las sesiones del tab (siguen vivas). */
export function computeSessionsSuppressed(flags: SessionOverlayFlags): boolean {
  return flags.nativeModuleOpen
    || flags.standaloneOpen
    || flags.directConnectOpen
    || flags.activating
    || flags.modulePickerVisible
    || flags.actionsSheetVisible
    || flags.supportDrawerOpen;
}

let envs: Record<string, SessionTabEnv> = {};
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function setSessionTabEnv(tabId: string, env: SessionTabEnv): void {
  envs = { ...envs, [tabId]: env };
  emit();
}

export function clearSessionTabEnv(tabId: string): void {
  if (!(tabId in envs)) return;
  const next = { ...envs };
  delete next[tabId];
  envs = next;
  emit();
}

export function getSessionTabEnv(tabId: string): SessionTabEnv | undefined {
  return envs[tabId];
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Mapa reactivo tabId → entorno (lo consume el `SessionHost`). */
export function useSessionEnvs(): Record<string, SessionTabEnv> {
  return useSyncExternalStore(subscribe, () => envs);
}

// Logout / cambio de cuenta: los entornos llevan el TOKEN del usuario saliente
// y handlers de tabs que ya no existen → fuera (los MainTab del próximo login
// vuelven a publicar el suyo).
registerStoreReset(() => {
  if (Object.keys(envs).length === 0) return;
  envs = {};
  emit();
});
