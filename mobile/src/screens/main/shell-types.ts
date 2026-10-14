// Tipos del shell de MainScreen/MainTab (Wave D1: extraídos de MainScreen.tsx
// sin cambios de semántica).
import type { BlogDrawerTab, DrawerData } from "../../components/BlogDrawerContent";

/** Destinos aceptados por `openBlogDrawer`. Además de los tabs de primer nivel,
 *  acepta los antiguos destinos Bitácora/Seguridad/Pagos (ahora sub-tabs de
 *  "Perfil"): los mapea a `tab="profile"` con el sub-tab correspondiente. */
export type BlogDrawerTarget = BlogDrawerTab | "worklog" | "security" | "payments";

/** Datos del controlador (por pestaña) que necesitan los paneles del drawer de
 *  Bitácora (Tienda/Perfil/Seguridad/Pagos), reportados por la pestaña activa a
 *  `MainScreen` (que monta el drawer global). */
export type ProfileBundle = DrawerData;

/** Controles que `MainTab` sube al navbar inferior (`TitleBarTabs`) por pestaña.
 *  `mode` decide el modo del navbar: búsqueda (dashboard/soporte) o composer de
 *  ticket. (El composer del chat murió en A5: vive dentro de `ChatScreen`.) */
export type BottomControls = {
  mode?: "search" | "ticket-detail";
  view: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onOpenFilters: () => void;
  filterCount: number;
  placeholder: string;
  show: boolean;
  // ── ticket-detail ──
  onAttach?: () => void;
  onSend?: () => void;
  attachDisabled?: boolean;
  sendDisabled?: boolean;
  onBack?: () => void;
  counterLabel?: string;
};

/** Estado del drawer izquierdo (Servidor) que `MainTab` sube a `MainScreen` para
 *  que el `DrawerTopBar` del navbar muestre su cromo (título + tabs + cerrar)
 *  mientras está abierto. */
export type ServerDrawerNav = {
  open: boolean;
  title: string;
  items: { key: string; label: string; accent?: boolean }[];
  value: string;
  onChange: (key: string) => void;
  onClose: () => void;
};

/** Igual que `ServerDrawerNav` pero para el sheet central: sus tabs se pintan en
 *  el `DrawerTopBar` de la barra superior mientras el sheet está abierto. */
export type ActionsSheetNav = {
  open: boolean;
  items: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
};

// Módulos oficiales con pantalla React Native. El selector sólo anuncia estos.
export const NATIVE_MODULE_IDS = new Set<string>([
  "chat", "preferences", "assistant", "terminal", "users", "monitor", "files", "server-alerts", "cron", "expo", "obsidian", "mail", "modules", "settings",
  "firewall", "bitninja", "dns", "backups", "databases", "cloudflare", "repository-store", "webhooks",
  "openclaw", "hosting", "module-dev", "project-map", "codebase-graph",
]);
export type NativeModuleSession = { panelId: string; moduleId: string; selectedView?: string; viewRevision?: number };

/** Props de `MainTab` (movidas verbatim desde la firma inline del componente). */
export type MainTabProps = {
  tabId: string;
  isActiveTab: boolean;
  onAutoLabelChange: (tabId: string, label: string) => void;
  registerGoServers: (tabId: string, handler: (() => void) | null) => void;
  registerGoSupport: (tabId: string, handler: (() => void) | null) => void;
  registerGoSecurity: (tabId: string, handler: (() => void) | null) => void;
  registerGoPayments: (tabId: string, handler: (() => void) | null) => void;
  registerGoJobs: (tabId: string, handler: (() => void) | null) => void;
  registerOpenAccount: (tabId: string, handler: (() => void) | null) => void;
  registerOpenNotifications: (tabId: string, handler: (() => void) | null) => void;
  registerShareLinkHandler: (tabId: string, handler: ((url: string) => void) | null) => void;
  registerWebViewInjector: (tabId: string, inject: ((js: string) => void) | null) => void;
  autoConnect: boolean;
  initialView?: import("../../features/app/types").View;
  initialSshUrl?: string;
  initialPanelId?: string;
  /** Pantalla `Chat` persistida de esta pestaña (B3): se reabre al restaurar. */
  initialChatPanelId?: string;
  initialGuestMode?: boolean;
  onLanguageChange: (language: string) => void;
  /** Idioma GLOBAL de la app (MainScreen). El idioma es global, no por-tab: este valor
   *  sincroniza el controller de ESTE tab para que todos queden en el mismo idioma. */
  globalLanguage: string;
  onSessionChange: (tabId: string, session: { view: import("../../features/app/types").View; sshUrl: string; panelId: string | null }) => void;
  onViewChange: (tabId: string, view: string) => void;
  onGuestModeChange: (tabId: string, guest: boolean) => void;
  /** Ruta `Chat` de la pestaña hacia el store (B3): panel abierto o null. */
  onChatOpenChange: (tabId: string, panelId: string | null) => void;
  keyboardShift: import("react-native").Animated.Value;
  onRequestOpenTabMenu: () => void;
  registerServerDrawerNav: (tabId: string, nav: ServerDrawerNav | null) => void;
  registerActionsSheetNav: (tabId: string, nav: ActionsSheetNav | null) => void;
  /** Reporta si un terminal (consola nativa abierta desde el chat) TAPA el cuerpo:
   *  el navbar superior (CLI/header del chat) y el navbar inferior (composer) del
   *  chat no son parte del terminal, así que `MainScreen` los oculta cuando es
   *  `true`. El terminal de MÓDULO (vista "ssh") ya se gestiona por `activeView`. */
  registerTerminalOverlay: (tabId: string, visible: boolean) => void;
  registerBottomControls: (tabId: string, controls: BottomControls) => void;
  registerProfile: (tabId: string, bundle: ProfileBundle) => void;
  blogDrawerOpen: boolean;
  onOpenBlogDrawer: (tab?: BlogDrawerTarget) => void;
  onCloseBlogDrawer: () => void;
  supportDrawerOpen: boolean;
  onOpenSupportDrawer: () => void;
  onCloseSupportDrawer: () => void;
};
