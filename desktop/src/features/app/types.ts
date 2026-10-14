import type { ReactNode } from "react";

export type View = "splash" | "login" | "loading-panel" | "dashboard" | "support" | "ssh" | "admin" | "notifications" | "jobs" | "publicaciones" | "dev-portal" | "module-store" | "blog";
export type ThemeMode = "light" | "dark";

/**
 * Acción contextual que una vista publica al navbar superior (reemplaza a los
 * antiguos FABs flotantes por pantalla). Cada pantalla con acciones reporta su
 * lista vía el registrador de `MainScreen`; el navbar muestra las de la vista
 * activa de la pestaña activa.
 */
export type NavAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger";
  disabled?: boolean;
  /** Muestra un spinner en lugar del icono (p. ej. "Actualizar" en curso). */
  busy?: boolean;
  /** Realce de atención (p. ej. saldo de datos bajo → ámbar). */
  alert?: boolean;
  title?: string;
};

export type AppTab = {
  id: string;
  autoLabel: string;
  customLabel?: string;
  // When true, the tab is allowed to auto-connect to the last used panel on
  // mount. New tabs opened by the user should land directly on Servers.
  autoConnect?: boolean;
  // Persisted per-tab session, used to reopen the tab where it was left:
  // which view was active and (for ssh) which panel/url was being used.
  restoreView?: View;
  restoreSshUrl?: string;
  restorePanelId?: string;
};
