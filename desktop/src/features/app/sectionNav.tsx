import type { ReactNode } from "react";
import { Bell, Briefcase, CreditCard, LifeBuoy, Newspaper, Server, Settings2 } from "lucide-react";
import type { Messages } from "../../i18n";

/**
 * Destinos de navegación de sección compartidos por el navbar superior
 * (`AppNavbar`) y por la localización de etiquetas de pestaña (`TitleBarTabs`).
 * Antes vivían como `fabItems` en `TitleBarTabs` (logo speed-dial + dock).
 */
export type SectionKey = "servers" | "support" | "payments" | "notifications" | "admin" | "jobs" | "publicaciones";

export type SectionNavItem = {
  key: SectionKey;
  icon: ReactNode;
  label: string;
  onSelect?: () => void;
  active: boolean;
};

/** Traduce el `autoLabel` interno de una pestaña a su etiqueta localizada. */
export function localizeAutoLabel(t: Messages, autoLabel: string): string {
  if (autoLabel === "Servers") return t.titleBar.fabServers;
  if (autoLabel === "Support") return t.titleBar.fabSupport;
  if (autoLabel === "Security") return t.titleBar.fabSecurity;
  return autoLabel;
}

export function buildSectionNav({
  t,
  activeView,
  onServers,
  onSupport,
  onPayments,
  onNotifications,
  onAdmin,
  onJobs,
  onPublicaciones,
  showAdmin = false,
  showSupport = true,
  showNotifications = true,
  paymentsActive = false,
}: {
  t: Messages;
  activeView?: string;
  onServers?: () => void;
  onSupport?: () => void;
  onPayments?: () => void;
  onNotifications?: () => void;
  onAdmin?: () => void;
  /** Sección "Empleos" (marketplace de requerimientos con escrow de tokens). */
  onJobs?: () => void;
  /** Sección "Publicaciones" (muro social: notas/encuestas con reacciones). */
  onPublicaciones?: () => void;
  /** Solo los admins ven la sección Administración. */
  showAdmin?: boolean;
  /**
   * Sección "Soporte" (consola de tickets). El flujo del CLIENTE se movió al
   * asistente (drawer), así que esta sección queda SOLO para staff/admin (la
   * consola de tickets). Los clientes no la ven en el navbar.
   */
  showSupport?: boolean;
  /** Sección "Notificaciones" (historial de toasts en background). */
  showNotifications?: boolean;
  /** Pagos ya no es una vista: su item se resalta cuando el modal está abierto. */
  paymentsActive?: boolean;
}): SectionNavItem[] {
  const items: SectionNavItem[] = [
    { key: "servers", icon: <Server size={16} />, label: t.titleBar.fabServers, onSelect: onServers, active: activeView === "dashboard" || activeView === "loading-panel" || activeView === "ssh" },
  ];
  // "Empleos": visible con sesión (no es admin-only). La etiqueta usa la clave
  // i18n `jobs.section` (la añade el agente i18n); cae a un literal si falta.
  const jobsLabel = (t as Record<string, { section?: string }>).jobs?.section ?? "Trabajos";
  items.push({ key: "jobs", icon: <Briefcase size={16} />, label: jobsLabel, onSelect: onJobs, active: activeView === "jobs" });
  // "Publicaciones": muro social (notas/encuestas). Visible con sesión real.
  const publicacionesLabel = (t as Record<string, { section?: string }>).publicaciones?.section ?? "Publicaciones";
  items.push({ key: "publicaciones", icon: <Newspaper size={16} />, label: publicacionesLabel, onSelect: onPublicaciones, active: activeView === "publicaciones" });
  if (showSupport) {
    items.push({ key: "support", icon: <LifeBuoy size={16} />, label: t.titleBar.fabSupport, onSelect: onSupport, active: activeView === "support" });
  }
  items.push({ key: "payments", icon: <CreditCard size={16} />, label: t.titleBar.fabPayments, onSelect: onPayments, active: paymentsActive });
  if (showNotifications) {
    // Etiqueta: usa la clave i18n `titleBar.fabNotifications` si existe; si no,
    // cae a un literal (las claves i18n las añadirá el agente de traducción).
    const notifLabel = (t.titleBar as Record<string, string>).fabNotifications ?? "Notificaciones";
    items.push({ key: "notifications", icon: <Bell size={16} />, label: notifLabel, onSelect: onNotifications, active: activeView === "notifications" });
  }
  if (showAdmin) {
    items.push({ key: "admin", icon: <Settings2 size={16} />, label: t.admin.section, onSelect: onAdmin, active: activeView === "admin" });
  }
  return items;
}
