/** Mobile menu order/subviews from the published LUXIPANEL workspace. */
export type WorkspaceModuleView = { id: string; es: string; en: string; tab?: string };
const v = (id: string, es: string, en: string, tab = id): WorkspaceModuleView => ({
  id,
  es,
  en,
  tab,
});
export const workspaceModuleViews: Record<string, WorkspaceModuleView[]> = {
  users: [v("users", "Usuarios", "Users"), v("roles", "Grupos", "Groups", "groups")],
  files: [v("browser", "Explorador", "Browser"), v("editor", "Editor", "Editor")],
  firewall: [
    v("audit", "Auditoría", "Audit"),
    v("rules", "Reglas UFW", "UFW rules"),
    v("fail2ban", "Fail2ban", "Fail2ban"),
  ],
  mail: [
    v("emails", "Correos", "Mail", "accounts"),
    v("spam-filters", "Antispam", "Spam filters", "settings"),
    v("track-delivery", "Entrega", "Delivery", "settings"),
    v("global-filters", "Filtros", "Filters", "settings"),
  ],
  dns: [
    v("overview", "Estado", "Overview"),
    v("sites", "Sitios y HTTPS", "Sites and HTTPS"),
    v("proxy", "Tráfico", "Traffic"),
    v("perf", "Rendimiento", "Performance"),
    v("logs", "Registros", "Logs"),
    v("status", "Servicio", "Service"),
  ],
  backups: [
    v("overview", "Estado", "Overview"),
    v("schedules", "Programaciones", "Schedules"),
    v("history", "Historial", "History"),
  ],
  cron: [v("jobs", "Tareas", "Jobs"), v("agents", "Agentes IA", "AI agents")],
  cloudflare: [
    v("dns", "DNS", "DNS"),
    v("cache", "Caché", "Cache"),
    v("security", "Seguridad", "Security"),
    v("access", "Acceso", "Access"),
    v("config", "Configuración", "Settings"),
  ],
  "server-alerts": [
    v("prefs", "Preferencias", "Preferences"),
    v("send", "Enviar", "Send"),
    v("scheduled", "Programadas", "Scheduled"),
    v("rules", "Reglas", "Rules"),
    v("history", "Historial", "History"),
  ],
  "module-dev": [
    v("my-modules", "Mis módulos", "My modules"),
    v("logs", "LOG", "LOG"),
    v("project-map", "Mapa proyecto", "Project map"),
  ],
  webhooks: [
    v("receive", "Recibir", "Receive"),
    v("webhooks", "Webhooks", "Webhooks"),
    v("keys", "Claves", "Keys"),
    v("discovered", "Detectados", "Discovered"),
  ],
  "codebase-graph": [
    v("graph", "Grafo visual", "Visual graph"),
    v("symbols", "Símbolos", "Symbols"),
  ],
  preferences: [
    v("profile", "Perfil", "Profile"),
    v("security", "Seguridad", "Security"),
    v("audit", "Actividad", "Activity"),
  ],
};
