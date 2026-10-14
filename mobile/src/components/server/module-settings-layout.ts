/** Navigation and body order audited against the workspace web drawers.
 * Stable IDs are independent of translations and of the order tables mount.
 */
export type SettingsLayoutSection = { key: string; es: string; en: string; sources: string[] };
export const moduleSettingsLayouts: Record<string, SettingsLayoutSection[]> = {
  mail: [
    {key:"table",es:"Tabla",en:"Table",sources:["table:accounts"]},
    {key:"routing",es:"Enrutamiento",en:"Routing",sources:["routing"]},
    {key:"forwards",es:"Reenvíos de dominio",en:"Domain redirects",sources:["forwards"]},
    {key:"encryption",es:"Cifrado",en:"Encryption",sources:["encryption"]},
    {key:"archive",es:"Archivado",en:"Archive",sources:["archive"]},
    {key:"default",es:"Dirección predeterminada",en:"Default address",sources:["default"]},
    {key:"outbound",es:"Correo saliente",en:"Outbound",sources:["outbound"]},
  ],
  users: [
    { key: "users", es: "Usuarios", en: "Users", sources: ["table:users"] },
    { key: "roles", es: "Roles", en: "Roles", sources: ["table:roles"] },
    { key: "summary", es: "Resumen", en: "Summary", sources: ["summary"] },
    { key: "access", es: "Accesos", en: "Access", sources: ["access"] },
  ],
  cron: [
    { key: "cats", es: "Categorías / etiquetas", en: "Categories / tags", sources: ["cats"] },
    { key: "rules", es: "Reglas", en: "Rules", sources: ["rules"] },
    { key: "service", es: "Servicio", en: "Service", sources: ["service"] },
  ],
  databases: [
    { key: "table", es: "Tabla", en: "Table", sources: ["table"] },
    { key: "console", es: "Consola", en: "Console", sources: ["console"] },
  ],
  files: [
    { key: "general", es: "General", en: "General", sources: ["general"] },
    { key: "roots", es: "Raíces", en: "Roots", sources: ["roots"] },
    { key: "shortcuts", es: "Atajos", en: "Shortcuts", sources: ["shortcuts"] },
    { key: "operation", es: "Operación", en: "Operation", sources: ["operation"] },
  ],
  backups: [
    { key: "local", es: "Local", en: "Local", sources: ["local"] },
    { key: "cloud", es: "Nube", en: "Cloud", sources: ["cloud"] },
    { key: "table", es: "Tablas", en: "Tables", sources: ["table:storages", "table:history"] },
  ],
  hosting: [
    { key: "table", es: "Tabla", en: "Table", sources: ["table:accounts"] },
    { key: "providers", es: "Proveedores", en: "Providers", sources: ["Proveedores de hosting"] },
  ],
  monitor: [
    { key: "table", es: "Vista", en: "View", sources: ["table:processes", "view"] },
    { key: "history", es: "Historial", en: "History", sources: ["history"] },
    { key: "alerts", es: "Alertas", en: "Alerts", sources: ["alerts"] },
    { key: "watchdog", es: "Watchdog", en: "Watchdog", sources: ["watchdog"] },
    { key: "diagnostics", es: "Diagnóstico", en: "Diagnostics", sources: ["diagnostics"] },
  ],
  "module-dev": [
    { key: "table", es: "Tabla", en: "Table", sources: ["table:modules"] },
    { key: "logs", es: "Diagnósticos y reparaciones", en: "Diagnostics and repairs", sources: ["logs"] },
  ],
  expo: [{ key: "table", es: "Tablas", en: "Tables", sources: ["table:builds", "related", "table:stores"] }],
  firewall: [
    { key: "rules", es: "Reglas", en: "Rules", sources: ["rules"] },
    { key: "logging", es: "Registro", en: "Logging", sources: ["logging"] },
    { key: "related", es: "Relacionados", en: "Related", sources: ["related"] },
  ],
  cloudflare: [
    { key: "dns", es: "DNS", en: "DNS", sources: ["table:dns"] },
    { key: "access", es: "Acceso", en: "Access", sources: ["table:access"] },
  ],
  dns: [
    { key: "sites", es: "Sitios", en: "Sites", sources: ["table:sites"] },
    { key: "upstreams", es: "Upstreams", en: "Upstreams", sources: ["table:upstreams"] },
    { key: "ai", es: "IA", en: "AI", sources: ["ai"] },
  ],
  webhooks: [
    { key: "receive", es: "Recepción", en: "Receive", sources: ["table:receive"] },
    { key: "webhooks", es: "Webhooks", en: "Webhooks", sources: ["table:webhooks"] },
    { key: "keys", es: "Claves API", en: "API keys", sources: ["table:keys"] },
    { key: "discovered", es: "Descubiertos", en: "Discovered", sources: ["table:discovered"] },
  ],
  "server-alerts": [
    { key: "prefs", es: "Mis alertas", en: "My alerts", sources: ["prefs"] },
    { key: "channels", es: "Canales", en: "Channels", sources: ["channels"] },
    { key: "table", es: "Tabla", en: "Table", sources: ["table:scheduled", "table:rules"] },
  ],
};
moduleSettingsLayouts.backup = moduleSettingsLayouts.backups;
moduleSettingsLayouts.nginx = moduleSettingsLayouts.dns;

export function settingsSections(moduleId: string, pageKeys: string[]) {
  const layout = moduleSettingsLayouts[moduleId];
  return layout?.map(section => ({ ...section, sources: section.sources.filter(key => pageKeys.includes(key)) }))
    .filter(section => section.sources.length);
}
