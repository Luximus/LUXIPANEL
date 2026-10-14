// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tipado del stack de navegación POR PESTAÑA (fases B1+B2, transicional).
 *
 * Rutas de VISTA (B1): son EXACTAMENTE las vistas actuales de `ctrl.view`
 * (`src/features/app/types.ts` → `View`): la fuente de verdad sigue siendo el
 * controller (`useMainTabController`) y el stack solo la refleja.
 *
 * Rutas de SESIÓN (B2): `Terminal` y `ModuleWebView` son pantallas-cáscara que
 * se APILAN sobre la ruta de vista actual cuando hay una consola tmux o un
 * webview de módulo activos. No tienen equivalente en `ctrl.view` (hoy son
 * overlays sobre el dashboard); la sesión viva en sí se renderiza en el
 * `SessionHost` global (src/sessions/) y la pantalla solo publica el rect
 * donde debe verse (`SessionSurfaceTarget`). Params: SOLO ids serializables;
 * los datos viven en `console-sessions-store` / `module-sessions-store`.
 *
 * NOTA de tipado: NO usamos `declare global { namespace ReactNavigation {
 * interface RootParamList … } }` porque hay N árboles INDEPENDIENTES (uno por
 * MainTab, ver NavigationIndependentTree); el tipado es explícito vía
 * `RootStackScreenProps` y los refs tipados de `navigationRef.ts`.
 */
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { View } from "../features/app/types";

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  LoadingPanel: undefined;
  Dashboard: undefined;
  Support: undefined;
  Security: undefined;
  Ssh: undefined;
  BlogFeed: undefined;
  Jobs: undefined;
  Publicaciones: undefined;
  /** Consola tmux nativa (B2). `consoleId` = sessionId del reattach tmux. */
  Terminal: { panelId: string; consoleId: string };
  /** Webview de módulo de LUXIPANEL (B2). Id de la sesión en su store. */
  ModuleWebView: { moduleSessionId: string };
  /** Chat del asistente IA de un servidor (A5). El estado vive en el
   *  `chat-store` module-level; el param es solo el id del panel. */
  Chat: { panelId: string };
};

export type RootRouteName = keyof RootStackParamList;

/** Rutas apiladas sobre la vista actual: sesiones (B2) + chat del asistente (A5). */
export type SessionRouteName = "Terminal" | "ModuleWebView" | "Chat";
/** Rutas espejo de `ctrl.view` (B1). */
export type ViewRouteName = Exclude<RootRouteName, SessionRouteName>;

/** Helper de tipado estándar: props de una screen del stack por pestaña. */
export type RootStackScreenProps<T extends RootRouteName> = NativeStackScreenProps<RootStackParamList, T>;

/** Mapeo `ctrl.view` (fuente de verdad) → ruta del stack. */
export const VIEW_TO_ROUTE: Record<View, ViewRouteName> = {
  splash: "Splash",
  login: "Login",
  "loading-panel": "LoadingPanel",
  dashboard: "Dashboard",
  support: "Support",
  security: "Security",
  ssh: "Ssh",
  blogfeed: "BlogFeed",
  jobs: "Jobs",
  publicaciones: "Publicaciones",
};

/** Mapeo inverso ruta de vista → vista (para mapear goBack/estado en B3). */
export const ROUTE_TO_VIEW: Record<ViewRouteName, View> = {
  Splash: "splash",
  Login: "login",
  LoadingPanel: "loading-panel",
  Dashboard: "dashboard",
  Support: "support",
  Security: "security",
  Ssh: "ssh",
  BlogFeed: "blogfeed",
  Jobs: "jobs",
  Publicaciones: "publicaciones",
};

/** Orden determinista de registro de las screens de VISTA. */
export const ROUTE_NAMES = Object.keys(ROUTE_TO_VIEW) as ViewRouteName[];

/** Orden determinista de registro de las screens de SESIÓN (B2) + chat (A5). */
export const SESSION_ROUTE_NAMES: SessionRouteName[] = ["Terminal", "ModuleWebView", "Chat"];

/** Todas las rutas registradas en el stack, en orden estable. */
export const ALL_ROUTE_NAMES: RootRouteName[] = [...ROUTE_NAMES, ...SESSION_ROUTE_NAMES];
