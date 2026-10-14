export type View = "splash" | "login" | "loading-panel" | "dashboard" | "support" | "security" | "ssh" | "blogfeed" | "jobs" | "publicaciones";
export type ThemeMode = "light" | "dark";

export type AppTab = {
  id: string;
  autoLabel: string;
  customLabel?: string;
  autoConnect?: boolean;
  restoreView?: View;
  restoreSshUrl?: string;
  restorePanelId?: string;
  /** Pantalla `Chat` apilada al persistir (B3): panel cuyo chat estaba abierto
   *  en esta pestaña. Al restaurar (muerte de proceso incluida) la pestaña
   *  reabre esa pantalla en cuanto hay token y navigator listos. */
  restoreChatPanelId?: string;
  /** Pestaña fija "Servers": siempre primera, no se puede renombrar ni cerrar,
   *  y al seleccionarla navega a la pantalla de servidores. */
  fixed?: boolean;
};
