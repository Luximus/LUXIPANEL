// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * search-catalog.ts — Catálogo ÚNICO (SSOT) del super buscador del navbar.
 *
 * Cada entrada describe algo a lo que el usuario puede "ir": una VISTA
 * (módulo), una SUBPÁGINA, un TAB de una vista, una SECCIÓN de un drawer o
 * una ACCIÓN global. El ranking (`scripts/extracted/layouts/super-search.ts`)
 * puntúa `label`/`keywords`/`path` contra la consulta en lenguaje natural y
 * ejecuta `target` (navegar + click/evento/acción tras cargar la página).
 *
 * REGLAS para añadir una entrada (ver frontend/ARCHITECTURE.md §Super buscador):
 *  - `id` único y estable (se guarda en "recientes").
 *  - `module` = id del ítem de sidebar que gobierna el permiso (users, mail,
 *    dns, settings, …). `permission` lo sobreescribe si difiere.
 *  - `label`: texto por locale con `en` obligatorio (fallback). Si el módulo ya
 *    tiene clave en `panelLayout.nav.*`, indícalo en `navKey` y el script usa la
 *    traducción real del locale activo.
 *  - `keywords`: sinónimos ES/EN en minúsculas SIN acentos (el ranking normaliza
 *    la consulta). Incluye verbos típicos del usuario ("crear", "editar"…).
 *  - `intents`: qué verbos de intención encajan (create/edit/configure/view/
 *    delete). Sube la puntuación cuando la consulta lleva ese verbo.
 *  - `target`: `href` (forma `/panel/...`), `query` (p.ej. `{tab:"dns"}` si la
 *    página soporta deep-link), `click` (selector CSS a clicar cuando el DOM
 *    exista; `clickSeq` para varios pasos), `event` (CustomEvent global) o
 *    `action` (acción del layout: tema, logout, selector de servidor…).
 *
 * Este fichero es STANDALONE (sin imports): se compila como lib runtime a
 * `/scripts/extracted/lib/search-catalog.js` (ver scripts/build-extracted.mjs)
 * y lo importa por URL el script extraído del layout.
 */

export type SearchKind = "view" | "subview" | "tab" | "drawer-section" | "action";
export type SearchIntent = "create" | "edit" | "configure" | "view" | "delete";
export type SearchAction =
  | "theme-dark"
  | "theme-light"
  | "theme-toggle"
  | "logout"
  | "server-switcher"
  | "language"
  | "sidebar-toggle";

export type LocaleText = { en: string; es?: string } & Record<string, string | undefined>;

export interface SearchTarget {
  /** Página destino en forma interna `/panel/...` (o `/panel` para la home). */
  href?: string;
  /** Query-string a añadir (para páginas con deep-link `?tab=`). */
  query?: Record<string, string>;
  /** Hash a añadir (`#modules`). */
  hash?: string;
  /** Selector CSS a clicar cuando exista en el DOM (tab, botón "nuevo"…). */
  click?: string;
  /** Secuencia de selectores a clicar en orden (abrir modal → tab). Un paso
   *  condicional `?<sel>:open|<toggle>` clica `<toggle>` SOLO si `<sel>` no está
   *  desplegado (`data-collapsed="true"`/`hidden`/sin tamaño) — p.ej. abrir la
   *  lista de chats colapsada antes de pulsar "Nueva conversación". */
  clickSeq?: string[];
  /** CustomEvent global a despachar en `window` tras cargar la página. */
  event?: { name: string; detail?: Record<string, unknown> };
  /** Acción del layout (sin navegación). */
  action?: SearchAction;
}

export interface SearchEntry {
  id: string;
  kind: SearchKind;
  /** Ítem de sidebar que gobierna la visibilidad (permiso). */
  module: string;
  /** Permiso alternativo si difiere de `module`. `"*"` = siempre visible. */
  permission?: string;
  /** Clave de `panelLayout.nav` para usar la etiqueta traducida del módulo. */
  navKey?: string;
  label: LocaleText;
  /** Ruta visual ("Correo › Cuentas"). Si falta, el script la compone con el módulo padre. */
  parent?: string;
  icon: string;
  keywords: string[];
  intents?: SearchIntent[];
  target: SearchTarget;
}

const T = (en: string, es: string): LocaleText => ({ en, es });

/* ───────────────────────── Vistas (módulos) ───────────────────────── */
const VIEWS: SearchEntry[] = [
  { id: "view.assistant", kind: "view", module: "assistant", permission: "*", navKey: "assistant", label: T("AI Agents", "Agentes IA"), icon: "ti-robot",
    keywords: ["agentes", "agents", "ia", "ai", "asistente", "assistant", "chat", "inicio", "home", "principal", "inteligencia artificial", "claude", "codex", "gpt"],
    intents: ["view"], target: { href: "/panel" } },
  { id: "view.users", kind: "view", module: "users", navKey: "users", label: T("Users", "Usuarios"), icon: "ti-users",
    keywords: ["usuarios", "users", "cuentas", "accounts", "personas", "people", "grupos", "groups", "permisos", "permissions", "linux", "ssh"],
    intents: ["edit", "view"], target: { href: "/panel/users" } },
  { id: "view.monitor", kind: "view", module: "monitor", navKey: "monitor", label: T("Monitor", "Monitor"), icon: "ti-activity",
    keywords: ["monitor", "monitoreo", "cpu", "ram", "memoria", "memory", "disco", "disk", "procesos", "processes", "servicios", "services", "carga", "load", "uptime", "recursos", "resources", "rendimiento", "performance", "red", "network"],
    intents: ["view"], target: { href: "/panel/monitor" } },
  { id: "view.files", kind: "view", module: "files", navKey: "files", label: T("Files", "Archivos"), icon: "ti-folder",
    keywords: ["archivos", "files", "ficheros", "carpetas", "folders", "directorios", "explorador", "explorer", "editor", "subir", "upload", "descargar", "download", "sftp", "ftp"],
    intents: ["view", "edit"], target: { href: "/panel/files" } },
  { id: "view.firewall", kind: "view", module: "firewall", navKey: "firewall", label: T("Firewall", "Firewall"), icon: "ti-shield-lock",
    keywords: ["firewall", "cortafuegos", "ufw", "reglas", "rules", "puertos", "ports", "fail2ban", "seguridad", "security"],
    intents: ["view"], target: { href: "/panel/firewall" } },
  { id: "view.bitninja", kind: "view", module: "bitninja", navKey: "bitninja", label: T("BitNinja", "BitNinja"), icon: "ti-shield-check",
    keywords: ["bitninja", "seguridad", "security", "waf", "malware", "antivirus", "proteccion"],
    intents: ["view"], target: { href: "/panel/bitninja" } },
  { id: "view.mail", kind: "view", module: "mail", navKey: "mail", label: T("Mail", "Correo"), icon: "ti-mail",
    keywords: ["correo", "mail", "email", "e-mail", "buzon", "mailbox", "cuentas de correo", "smtp", "imap", "dovecot", "postfix", "mensajes"],
    intents: ["view", "edit"], target: { href: "/panel/mail" } },
  { id: "view.nginx", kind: "view", module: "dns", navKey: "dns", label: T("NGINX", "NGINX"), icon: "ti-server",
    keywords: ["nginx", "sitios", "sites", "vhost", "virtual host", "dominio", "domain", "proxy", "reverse proxy", "web", "servidor web", "ssl", "https", "certificado", "certificate", "lets encrypt", "certbot", "balanceador", "load balancer"],
    intents: ["view", "edit"], target: { href: "/panel/nginx" } },
  { id: "view.backups", kind: "view", module: "backups", navKey: "backups", label: T("Backups", "Backups"), icon: "ti-archive",
    keywords: ["backups", "copias", "copia de seguridad", "respaldo", "respaldos", "restore", "restaurar", "snapshot", "programar", "schedule", "almacenamiento", "storage", "s3"],
    intents: ["view", "create"], target: { href: "/panel/backups" } },
  { id: "view.cron", kind: "view", module: "cron", navKey: "cron", label: T("Cron", "Cron"), icon: "ti-clock",
    keywords: ["cron", "crontab", "tareas programadas", "scheduled tasks", "jobs", "programar", "schedule", "automatizacion", "automation", "temporizador", "timer"],
    intents: ["view", "create"], target: { href: "/panel/cron" } },
  { id: "view.databases", kind: "view", module: "databases", navKey: "databases", label: T("Databases", "Bases de datos"), icon: "ti-database",
    keywords: ["bases de datos", "base de datos", "databases", "database", "db", "mysql", "mariadb", "postgres", "postgresql", "sql", "tablas", "tables", "consulta", "query"],
    intents: ["view", "edit"], target: { href: "/panel/databases" } },
  { id: "view.obsidian", kind: "view", module: "obsidian", navKey: "obsidian", label: T("Obsidian", "Obsidian"), icon: "ti-notebook",
    keywords: ["obsidian", "notas", "notes", "vault", "markdown", "contexto", "context", "documentacion", "docs", "wiki"],
    intents: ["view"], target: { href: "/panel/obsidian" } },
  { id: "view.cloudflare", kind: "view", module: "cloudflare", navKey: "cloudflare", label: T("Cloudflare", "Cloudflare"), icon: "ti-brand-cloudflare",
    keywords: ["cloudflare", "cdn", "dns", "zona", "zone", "registros", "records", "cache", "waf", "proxy", "edge"],
    intents: ["view", "configure"], target: { href: "/panel/cloudflare" } },
  { id: "view.server-alerts", kind: "view", module: "server-alerts", navKey: "serverAlerts", label: T("Notifications", "Notificaciones"), icon: "ti-bell-ringing",
    keywords: ["alertas", "alerts", "notificaciones", "notifications", "avisos", "push", "telegram", "whatsapp", "email alerts", "reglas de alerta"],
    intents: ["view", "configure"], target: { href: "/panel/server-alerts" } },
  { id: "view.expo", kind: "view", module: "expo", navKey: "expo", label: T("Expo", "Expo"), icon: "ti-brand-expo",
    keywords: ["expo", "react native", "app movil", "mobile app", "eas", "build", "android", "ios"],
    intents: ["view"], target: { href: "/panel/expo" } },
  { id: "view.module-dev", kind: "view", module: "module-dev", navKey: "moduleDev", label: T("My modules", "Mis módulos"), icon: "ti-packages",
    keywords: ["dev de modulos", "module dev", "desarrollo", "development", "sdk", "crear modulo", "plugin"],
    intents: ["view", "create"], target: { href: "/panel/module-dev" } },
  { id: "view.module-dev.logs", kind: "view", module: "module-dev", navKey: "moduleDev", label: T("LOG", "LOG"), icon: "ti-report-analytics", keywords: ["log", "logs", "errores", "errors", "advertencias", "warnings", "reparar", "repair"], intents: ["view"], target: { href: "/panel/module-dev/logs" } },
  { id: "view.project-map", kind: "view", module: "module-dev", navKey: "moduleDev", label: T("Project map", "Mapa proyecto"), icon: "ti-sitemap",
    keywords: ["mapa", "proyecto", "infraestructura", "architecture", "structure", "folders", "archivos"],
    intents: ["view"], target: { href: "/panel/project-map" } },
  { id: "view.terminal", kind: "view", module: "terminal", navKey: "terminal", label: T("Terminal", "Terminal"), icon: "ti-terminal-2",
    keywords: ["terminal", "consola", "console", "shell", "bash", "ssh", "comandos", "commands", "cli"],
    intents: ["view"], target: { href: "/panel/terminal" } },
  { id: "view.repository-store", kind: "view", module: "repository-store", navKey: "githubStore", label: T("GitHub", "GitHub"), icon: "ti-brand-github",
    keywords: ["github", "repositorios", "repositories", "repos", "git", "store", "tienda", "desplegar", "deploy", "clonar", "clone"],
    intents: ["view"], target: { href: "/panel/repository-store" } },
  { id: "view.webhooks", kind: "view", module: "webhooks", navKey: "webhooks", label: T("Webhooks", "Webhooks"), icon: "ti-webhook",
    keywords: ["webhooks", "webhook", "hooks", "integraciones", "integrations", "api keys", "claves api", "endpoints", "eventos", "events"],
    intents: ["view", "create"], target: { href: "/panel/webhooks" } },
  { id: "view.openclaw", kind: "view", module: "openclaw", navKey: "openclaw", label: T("OpenClaw", "OpenClaw"), icon: "ti-brain",
    keywords: ["openclaw", "agente", "automatizacion", "automation", "bot"],
    intents: ["view"], target: { href: "/panel/openclaw" } },
  { id: "view.hosting", kind: "view", module: "hosting", navKey: "hosting", label: T("Hosting", "Hosting"), icon: "ti-building",
    keywords: ["hosting", "alojamiento", "cuentas de hosting", "tenants", "clientes", "clients", "paquetes", "plans", "dominios", "domains"],
    intents: ["view", "create"], target: { href: "/panel/hosting" } },
  { id: "view.codebase-graph", kind: "view", module: "codebase-graph", navKey: "codebaseGraph", label: T("Code graph", "Grafo del Código"), icon: "ti-binary-tree",
    keywords: ["grafo", "graph", "codigo", "code", "codebase", "dependencias", "dependencies", "arquitectura", "architecture"],
    intents: ["view"], target: { href: "/panel/codebase-graph" } },
  { id: "view.chat", kind: "view", module: "chat", permission: "*", label: T("Internal chat", "Chat interno"), icon: "ti-messages",
    keywords: ["chat", "mensajes", "messages", "mensajeria", "messaging", "equipo", "team", "conversacion", "dm"],
    intents: ["view"], target: { href: "/panel/chat" } },
  { id: "chat.action.new-conversation", kind: "action", module: "chat", permission: "*", parent: "view.chat", label: T("New conversation", "Nueva conversación"), icon: "ti-pencil-plus",
    keywords: ["nueva conversacion", "new conversation", "nuevo mensaje", "new message", "escribir a", "write to", "chatear con", "mensaje directo", "direct message", "dm"],
    intents: ["create"], target: { href: "/panel/chat", query: { new: "1" } } },
  { id: "chat.media", kind: "drawer-section", module: "chat", permission: "*", parent: "view.chat", label: T("Conversation media", "Multimedia del chat"), icon: "ti-photo",
    keywords: ["multimedia", "media", "archivos del chat", "chat files", "adjuntos", "attachments", "imagenes", "images", "fotos", "photos", "videos", "audio", "pdf", "documentos", "documents"],
    intents: ["view"], target: { href: "/panel/chat", event: { name: "luxipanel:chat-media-open" } } },
  { id: "chat.call", kind: "action", module: "chat", permission: "*", parent: "view.chat", label: T("Start a call", "Llamar"), icon: "ti-phone",
    keywords: ["llamar", "call", "llamada", "audiollamada", "audio call", "voz", "voice", "hablar", "telefono", "phone", "traduccion en tiempo real", "real-time translation"],
    intents: ["create"], target: { href: "/panel/chat", click: '[data-search-target="chat-call"]' } },
  { id: "chat.settings", kind: "drawer-section", module: "chat", permission: "*", parent: "view.chat", label: T("Messaging settings", "Ajustes de mensajería"), icon: "ti-settings",
    keywords: ["ajustes de mensajeria", "messaging settings", "ajustes del chat", "chat settings", "configuracion del chat", "preferencias de chat"],
    intents: ["configure"], target: { href: "/panel/chat", event: { name: "luxipanel:chat-settings-open", detail: { section: "general" } } } },
  { id: "chat.settings.general", kind: "drawer-section", module: "chat", permission: "*", parent: "view.chat", label: T("Chat · General", "Chat · General"), icon: "ti-adjustments-horizontal",
    keywords: ["sonido de mensajes", "message sound", "notificaciones de escritorio", "desktop notifications", "vista previa", "preview", "enter envia", "enter sends"],
    intents: ["configure"], target: { href: "/panel/chat", event: { name: "luxipanel:chat-settings-open", detail: { section: "general" } } } },
  { id: "chat.settings.presence", kind: "drawer-section", module: "chat", permission: "*", parent: "view.chat", label: T("Chat · Presence", "Chat · Presencia"), icon: "ti-user-check",
    keywords: ["presencia", "presence", "en linea", "online", "estado", "status", "mensaje de estado", "status message", "invisible", "ocultar conexion"],
    intents: ["configure"], target: { href: "/panel/chat", event: { name: "luxipanel:chat-settings-open", detail: { section: "presence" } } } },
  { id: "chat.settings.calls", kind: "drawer-section", module: "chat", permission: "*", parent: "view.chat", label: T("Chat · Calls", "Chat · Llamadas"), icon: "ti-phone",
    keywords: ["llamadas", "calls", "audiollamada", "audio call", "traduccion", "translation", "idioma de traduccion", "translation language", "no molestar", "do not disturb", "micro", "microphone", "tono", "ringtone", "elevenlabs", "openai realtime"],
    intents: ["configure"], target: { href: "/panel/chat", event: { name: "luxipanel:chat-settings-open", detail: { section: "calls" } } } },
  { id: "chat.settings.appearance", kind: "drawer-section", module: "chat", permission: "*", parent: "view.chat", label: T("Chat · Appearance", "Chat · Apariencia"), icon: "ti-palette",
    keywords: ["apariencia del chat", "chat appearance", "densidad", "density", "compacto", "compact", "tamano del texto", "text size", "fuente", "font"],
    intents: ["configure"], target: { href: "/panel/chat", event: { name: "luxipanel:chat-settings-open", detail: { section: "appearance" } } } },
  { id: "chat.settings.groups", kind: "drawer-section", module: "chat", permission: "*", parent: "view.chat", label: T("Chat · Groups", "Chat · Grupos"), icon: "ti-users-group",
    keywords: ["grupos del chat", "chat groups", "grupos linux", "linux groups", "conversaciones por pagina", "conversations per page", "plegar grupos", "collapse groups"],
    intents: ["configure"], target: { href: "/panel/chat", event: { name: "luxipanel:chat-settings-open", detail: { section: "groups" } } } },
  { id: "view.modules", kind: "view", module: "modules", navKey: "modules", label: T("Modules", "Módulos"), icon: "ti-puzzle",
    keywords: ["modulos", "modules", "instalar", "install", "activar", "enable", "desactivar", "disable", "marketplace", "extensiones", "extensions", "plugins", "catalogo", "catalog"],
    intents: ["view", "configure"], target: { href: "/panel/modules" } },
  { id: "view.settings", kind: "view", module: "settings", navKey: "settings", label: T("Settings", "Ajustes"), icon: "ti-settings",
    keywords: ["ajustes", "settings", "configuracion", "configuration", "config", "panel", "opciones", "options", "administracion", "admin"],
    intents: ["configure", "view"], target: { href: "/panel/settings" } },
  { id: "view.preferences", kind: "view", module: "preferences", permission: "*", navKey: "preferences", label: T("My preferences", "Mis preferencias"), icon: "ti-user-circle",
    keywords: ["preferencias", "preferences", "mi cuenta", "my account", "perfil", "profile", "cuenta", "account"],
    intents: ["configure", "view"], target: { href: "/panel/preferences" } },
];

/* ─────────────────────── Tabs / subvistas por página ─────────────────────── */
const TABS: SearchEntry[] = [
  // Usuarios
  { id: "users.tab.users", kind: "tab", module: "users", parent: "view.users", label: T("Users", "Usuarios"), icon: "ti-users",
    keywords: ["usuarios", "users", "editar usuario", "edit user", "listado de usuarios", "cuentas linux"],
    intents: ["edit", "view"], target: { href: "/panel/users", click: '#tab-users' } },
  { id: "users.tab.roles", kind: "tab", module: "users", parent: "view.users", label: T("Roles", "Roles"), icon: "ti-shield",
    keywords: ["roles", "rol", "role", "grupos", "groups", "permisos", "permissions", "perfiles", "profiles", "acceso", "access"],
    intents: ["edit", "view", "configure"], target: { href: "/panel/users", click: '#tab-roles' } },
  { id: "users.action.new-user", kind: "action", module: "users", parent: "view.users", label: T("New user", "Nuevo usuario"), icon: "ti-user-plus",
    keywords: ["nuevo usuario", "crear usuario", "registrar usuario", "add user", "new user", "create user", "alta usuario", "agregar usuario"],
    intents: ["create"], target: { href: "/panel/users", clickSeq: ["#tab-users", "#btn-new-user"] } },
  { id: "users.action.new-role", kind: "action", module: "users", parent: "view.users", label: T("New role", "Nuevo rol"), icon: "ti-shield-plus",
    keywords: ["nuevo rol", "crear rol", "new role", "create role", "nuevo grupo", "crear grupo", "new group"],
    intents: ["create"], target: { href: "/panel/users", clickSeq: ["#tab-roles", "#btn-new-role"] } },

  // Correo
  { id: "mail.tab.emails", kind: "tab", module: "mail", parent: "view.mail", label: T("Accounts", "Cuentas"), icon: "ti-mail",
    keywords: ["cuentas de correo", "cuentas", "mail accounts", "emails", "buzones", "mailboxes", "direcciones", "addresses"],
    intents: ["view", "edit"], target: { href: "/panel/mail", click: '[data-mail-main-tab="emails"]' } },
  { id: "mail.action.new-account", kind: "action", module: "mail", parent: "view.mail", label: T("New mail account", "Nueva cuenta de correo"), icon: "ti-mail-plus",
    keywords: ["crear cuenta de correo", "nueva cuenta de correo", "nuevo correo", "new mail account", "create email", "add mailbox", "alta correo", "crear email"],
    intents: ["create"], target: { href: "/panel/mail", clickSeq: ['[data-mail-main-tab="emails"]', "#btn-new-account"] } },
  { id: "mail.tab.spam", kind: "tab", module: "mail", parent: "view.mail", label: T("Spam filters", "Filtros de spam"), icon: "ti-mail-off",
    keywords: ["spam", "filtros de spam", "spam filters", "spamassassin", "lista blanca", "whitelist", "lista negra", "blacklist", "correo basura", "junk"],
    intents: ["configure", "view"], target: { href: "/panel/mail", click: '[data-mail-main-tab="spam-filters"]' } },
  { id: "mail.tab.track", kind: "tab", module: "mail", parent: "view.mail", label: T("Delivery tracking", "Seguimiento de entregas"), icon: "ti-truck-delivery",
    keywords: ["seguimiento", "entregas", "delivery", "tracking", "rastrear correo", "log de correo", "mail log", "cola", "queue", "rebotes", "bounces"],
    intents: ["view"], target: { href: "/panel/mail", click: '[data-mail-main-tab="track-delivery"]' } },
  { id: "mail.tab.global-filters", kind: "tab", module: "mail", parent: "view.mail", label: T("Global filters", "Filtros globales"), icon: "ti-filter",
    keywords: ["filtros globales", "global filters", "filtros de correo", "sieve", "reglas de correo", "mail rules"],
    intents: ["configure", "view"], target: { href: "/panel/mail", click: '[data-mail-main-tab="global-filters"]' } },
  { id: "mail.settings.routing", kind: "drawer-section", module: "mail", parent: "view.mail", label: T("Mail routing", "Enrutamiento de correo"), icon: "ti-route",
    keywords: ["enrutamiento", "routing", "mx", "ruta de correo", "correo local", "remoto", "remote mail exchanger"],
    intents: ["configure"], target: { href: "/panel/mail", clickSeq: ["#mail-settings-modal-trigger", '[data-mail-settings-open="routing"]'] } },
  { id: "mail.settings.domain-redirect", kind: "drawer-section", module: "mail", parent: "view.mail", label: T("Domain forwarders", "Reenvío de dominio"), icon: "ti-arrow-forward",
    keywords: ["reenvio de dominio", "domain forwarder", "redirigir dominio", "forward domain", "alias de dominio"],
    intents: ["configure"], target: { href: "/panel/mail", clickSeq: ["#mail-settings-modal-trigger", '[data-mail-settings-open="domain-redirect"]'] } },
  { id: "mail.settings.default-address", kind: "drawer-section", module: "mail", parent: "view.mail", label: T("Default address", "Dirección por defecto"), icon: "ti-at",
    keywords: ["direccion por defecto", "default address", "catch-all", "catch all", "correo no entregado"],
    intents: ["configure"], target: { href: "/panel/mail", clickSeq: ["#mail-settings-modal-trigger", '[data-mail-settings-open="default-address"]'] } },
  { id: "mail.settings.archive", kind: "drawer-section", module: "mail", parent: "view.mail", label: T("Mail archive", "Archivado de correo"), icon: "ti-archive",
    keywords: ["archivado", "archive", "archivar correo", "retencion", "retention"],
    intents: ["configure"], target: { href: "/panel/mail", clickSeq: ["#mail-settings-modal-trigger", '[data-mail-settings-open="archive"]'] } },
  { id: "mail.settings.encryption", kind: "drawer-section", module: "mail", parent: "view.mail", label: T("Encryption", "Cifrado"), icon: "ti-lock",
    keywords: ["cifrado", "encryption", "gpg", "pgp", "claves", "keys", "encriptar correo"],
    intents: ["configure"], target: { href: "/panel/mail", clickSeq: ["#mail-settings-modal-trigger", '[data-mail-settings-open="encryption"]'] } },
  { id: "mail.settings.outbound", kind: "drawer-section", module: "mail", parent: "view.mail", label: T("Outbound mail", "Correo saliente"), icon: "ti-send",
    keywords: ["correo saliente", "outbound", "smtp relay", "relay", "envio", "sending", "dkim", "spf", "dmarc"],
    intents: ["configure"], target: { href: "/panel/mail", clickSeq: ["#mail-settings-modal-trigger", '[data-mail-settings-open="outbound"]'] } },
  { id: "mail.subview.compose", kind: "subview", module: "mail", parent: "view.mail", label: T("Compose email", "Redactar correo"), icon: "ti-pencil",
    keywords: ["redactar", "compose", "escribir correo", "enviar correo", "send email", "write email", "nuevo mensaje"],
    intents: ["create"], target: { href: "/panel/mail/compose" } },

  // NGINX
  { id: "nginx.action.new-site", kind: "action", module: "dns", parent: "view.nginx", label: T("New site", "Nuevo sitio"), icon: "ti-world-plus",
    keywords: ["nuevo sitio", "crear sitio", "new site", "add site", "crear dominio", "nuevo vhost", "add domain", "alta dominio"],
    intents: ["create"], target: { href: "/panel/nginx", click: "#btn-new-site" } },
  { id: "nginx.action.https", kind: "action", module: "dns", parent: "view.nginx", label: T("Enable HTTPS / SSL certificate", "Activar HTTPS / certificado SSL"), icon: "ti-lock",
    keywords: ["ssl", "https", "certificado", "certificate", "lets encrypt", "letsencrypt", "certbot", "tls", "activar https", "enable https", "renovar certificado"],
    intents: ["configure", "create"], target: { href: "/panel/nginx", click: "#btn-enable-https" } },
  { id: "nginx.action.proxy", kind: "action", module: "dns", parent: "view.nginx", label: T("Reverse proxy upstream", "Upstream de proxy inverso"), icon: "ti-arrows-right-left",
    keywords: ["proxy", "reverse proxy", "proxy inverso", "upstream", "backend", "puerto", "port"],
    intents: ["configure", "create"], target: { href: "/panel/nginx", click: "#proxy-add-upstream" } },
  { id: "nginx.action.edit-conf", kind: "action", module: "dns", parent: "view.nginx", label: T("Edit nginx.conf", "Editar nginx.conf"), icon: "ti-file-code",
    keywords: ["nginx.conf", "editar configuracion nginx", "edit nginx config", "conf"],
    intents: ["edit", "configure"], target: { href: "/panel/nginx", click: "#btn-edit-conf" } },

  // Firewall
  { id: "firewall.action.new-rule", kind: "action", module: "firewall", parent: "view.firewall", label: T("New rule", "Nueva regla"), icon: "ti-plus",
    keywords: ["firewall", "nueva regla", "crear regla", "new rule", "add rule", "abrir puerto", "open port", "permitir puerto", "allow port", "puerto", "port"],
    intents: ["create"], target: { href: "/panel/firewall", click: "#btn-new-rule" } },
  { id: "firewall.action.ban-ip", kind: "action", module: "firewall", parent: "view.firewall", label: T("Block IP", "Bloquear IP"), icon: "ti-ban",
    keywords: ["firewall", "bloquear ip", "block ip", "ban ip", "banear", "denegar ip", "deny ip", "bloquear direccion", "ip", "direccion ip"],
    intents: ["create", "configure"], target: { href: "/panel/firewall", click: "#btn-ban-ip" } },
  { id: "firewall.action.audit", kind: "action", module: "firewall", parent: "view.firewall", label: T("Security audit", "Auditoría de seguridad"), icon: "ti-shield-search",
    keywords: ["auditoria", "audit", "auditar", "escaneo", "scan", "seguridad", "security check"],
    intents: ["view"], target: { href: "/panel/firewall", click: "#btn-start-audit" } },

  // Backups
  { id: "backups.action.now", kind: "action", module: "backups", parent: "view.backups", label: T("Backup now", "Hacer backup ahora"), icon: "ti-player-play",
    keywords: ["backup ahora", "backup now", "copia ahora", "ejecutar backup", "run backup", "respaldar ahora"],
    intents: ["create"], target: { href: "/panel/backups", click: "#btn-backup-now" } },
  { id: "backups.action.new-storage", kind: "action", module: "backups", parent: "view.backups", label: T("New storage", "Nuevo almacenamiento"), icon: "ti-cloud-plus",
    keywords: ["almacenamiento", "storage", "destino de backup", "s3", "ftp", "sftp", "nuevo almacenamiento", "add storage"],
    intents: ["create", "configure"], target: { href: "/panel/backups", click: "#btn-new-storage" } },
  { id: "backups.action.new-schedule", kind: "action", module: "backups", parent: "view.backups", label: T("New schedule", "Nueva programación"), icon: "ti-calendar-plus",
    keywords: ["programar backup", "schedule backup", "nueva programacion", "backup automatico", "automatic backup", "periodico"],
    intents: ["create"], target: { href: "/panel/backups", click: "#btn-new-schedule" } },

  // Cron
  { id: "cron.action.new-agent", kind: "action", module: "cron", parent: "view.cron", label: T("New AI job", "Nueva tarea IA"), icon: "ti-robot",
    keywords: ["tarea ia", "ai job", "agente programado", "scheduled agent", "nueva tarea", "new job", "cron ia"],
    intents: ["create"], target: { href: "/panel/cron", click: "#btn-new-agent" } },

  // Bases de datos
  { id: "databases.tab.rows", kind: "tab", module: "databases", parent: "view.databases", label: T("Rows", "Filas"), icon: "ti-table",
    keywords: ["filas", "rows", "registros", "records", "datos", "data", "ver tabla"],
    intents: ["view", "edit"], target: { href: "/panel/databases", click: '.db-tab[data-tab="rows"]' } },
  { id: "databases.tab.structure", kind: "tab", module: "databases", parent: "view.databases", label: T("Structure", "Estructura"), icon: "ti-columns",
    keywords: ["estructura", "structure", "columnas", "columns", "esquema", "schema", "indices", "indexes"],
    intents: ["view", "edit"], target: { href: "/panel/databases", click: '.db-tab[data-tab="structure"]' } },
  { id: "databases.tab.console", kind: "tab", module: "databases", parent: "view.databases", label: T("SQL console", "Consola SQL"), icon: "ti-terminal",
    keywords: ["consola sql", "sql console", "query", "consulta", "ejecutar sql", "run sql", "select"],
    intents: ["view"], target: { href: "/panel/databases", click: '.db-tab[data-tab="console"]' } },

  // Cloudflare (soporta ?tab= deep-link)
  { id: "cloudflare.tab.dns", kind: "tab", module: "cloudflare", parent: "view.cloudflare", label: T("DNS", "DNS"), icon: "ti-world",
    keywords: ["dns", "registros dns", "dns records", "a record", "cname", "mx", "txt", "zona dns"],
    intents: ["view", "edit", "create"], target: { href: "/panel/cloudflare", query: { tab: "dns" }, click: '[data-tab="dns"]' } },
  { id: "cloudflare.tab.cache", kind: "tab", module: "cloudflare", parent: "view.cloudflare", label: T("Cache", "Caché"), icon: "ti-refresh",
    keywords: ["cache", "purgar cache", "purge cache", "limpiar cache", "cdn cache"],
    intents: ["configure", "delete"], target: { href: "/panel/cloudflare", query: { tab: "cache" }, click: '[data-tab="cache"]' } },
  { id: "cloudflare.tab.security", kind: "tab", module: "cloudflare", parent: "view.cloudflare", label: T("Security", "Seguridad"), icon: "ti-shield",
    keywords: ["seguridad cloudflare", "waf", "under attack", "bot", "ddos", "nivel de seguridad", "security level"],
    intents: ["configure"], target: { href: "/panel/cloudflare", query: { tab: "security" }, click: '[data-tab="security"]' } },
  { id: "cloudflare.tab.access", kind: "tab", module: "cloudflare", parent: "view.cloudflare", label: T("Access", "Acceso"), icon: "ti-lock-access",
    keywords: ["acceso", "access", "ip access", "bloquear ip cloudflare", "allow ip", "firewall cloudflare", "reglas ip"],
    intents: ["configure"], target: { href: "/panel/cloudflare", query: { tab: "access" }, click: '[data-tab="access"]' } },
  { id: "cloudflare.tab.config", kind: "tab", module: "cloudflare", parent: "view.cloudflare", label: T("Configuration", "Configuración"), icon: "ti-settings",
    keywords: ["configuracion cloudflare", "token cloudflare", "api token", "cuenta cloudflare", "conectar cloudflare"],
    intents: ["configure"], target: { href: "/panel/cloudflare", query: { tab: "config" }, click: '[data-tab="config"]' } },

  // Webhooks
  { id: "webhooks.tab.receive", kind: "tab", module: "webhooks", parent: "view.webhooks", label: T("Receive", "Recibir"), icon: "ti-download",
    keywords: ["recibir webhooks", "receive", "entrantes", "incoming", "endpoint entrante"],
    intents: ["view", "configure"], target: { href: "/panel/webhooks", click: '[data-tab="receive"]' } },
  { id: "webhooks.tab.mailhook", kind: "tab", module: "webhooks", parent: "view.webhooks", label: T("Mailhook", "Mailhook"), icon: "ti-mail-forward",
    keywords: ["mailhook", "correo a webhook", "email to webhook", "parsear correo"],
    intents: ["view", "configure"], target: { href: "/panel/webhooks", click: '[data-tab="mailhook"]' } },
  { id: "webhooks.tab.response", kind: "tab", module: "webhooks", parent: "view.webhooks", label: T("Responses", "Respuestas"), icon: "ti-message-reply",
    keywords: ["respuestas", "responses", "reply", "respuesta automatica"],
    intents: ["view", "configure"], target: { href: "/panel/webhooks", click: '[data-tab="response"]' } },
  { id: "webhooks.tab.webhooks", kind: "tab", module: "webhooks", parent: "view.webhooks", label: T("Outgoing webhooks", "Webhooks salientes"), icon: "ti-webhook",
    keywords: ["webhooks salientes", "outgoing", "enviar webhook", "send webhook", "notificar url", "crear webhook", "new webhook"],
    intents: ["view", "create", "configure"], target: { href: "/panel/webhooks", click: '[data-tab="webhooks"]' } },
  { id: "webhooks.tab.keys", kind: "tab", module: "webhooks", parent: "view.webhooks", label: T("API keys", "Claves API"), icon: "ti-key",
    keywords: ["api keys", "claves api", "api key", "token", "tokens", "clave de api", "crear api key"],
    intents: ["view", "create", "configure"], target: { href: "/panel/webhooks", click: '[data-tab="keys"]' } },
  { id: "webhooks.tab.discovered", kind: "tab", module: "webhooks", parent: "view.webhooks", label: T("Discovered", "Descubiertos"), icon: "ti-radar",
    keywords: ["descubiertos", "discovered", "autodetectados", "detected"],
    intents: ["view"], target: { href: "/panel/webhooks", click: '[data-tab="discovered"]' } },

  // Notificaciones / alertas
  { id: "server-alerts.tab.prefs", kind: "tab", module: "server-alerts", parent: "view.server-alerts", label: T("Preferences", "Preferencias"), icon: "ti-adjustments",
    keywords: ["preferencias de alertas", "canales", "channels", "telegram", "whatsapp", "email", "push", "configurar alertas", "alert settings"],
    intents: ["configure"], target: { href: "/panel/server-alerts", click: '[data-tab="prefs"]' } },
  { id: "server-alerts.tab.send", kind: "tab", module: "server-alerts", parent: "view.server-alerts", label: T("Send", "Enviar"), icon: "ti-send",
    keywords: ["enviar notificacion", "send notification", "enviar alerta", "mensaje manual", "broadcast"],
    intents: ["create"], target: { href: "/panel/server-alerts", click: '[data-tab="send"]' } },
  { id: "server-alerts.tab.scheduled", kind: "tab", module: "server-alerts", parent: "view.server-alerts", label: T("Scheduled", "Programadas"), icon: "ti-calendar-time",
    keywords: ["programadas", "scheduled", "notificaciones programadas", "recordatorios", "reminders"],
    intents: ["view", "create"], target: { href: "/panel/server-alerts", click: '[data-tab="scheduled"]' } },
  { id: "server-alerts.tab.rules", kind: "tab", module: "server-alerts", parent: "view.server-alerts", label: T("Alert rules", "Reglas de alerta"), icon: "ti-list-check",
    keywords: ["reglas de alerta", "alert rules", "umbral", "threshold", "cpu alta", "disco lleno", "disk full", "caida", "downtime"],
    intents: ["configure", "create"], target: { href: "/panel/server-alerts", click: '[data-tab="rules"]' } },

  // GitHub store
  { id: "repository-store.tab.saved", kind: "tab", module: "repository-store", parent: "view.repository-store", label: T("Saved", "Guardados"), icon: "ti-bookmark",
    keywords: ["guardados", "saved", "favoritos", "bookmarks"],
    intents: ["view"], target: { href: "/panel/repository-store", click: '[data-tab="saved"]' } },
  { id: "repository-store.tab.cloned", kind: "tab", module: "repository-store", parent: "view.repository-store", label: T("Cloned", "Clonados"), icon: "ti-git-fork",
    keywords: ["clonados", "cloned", "repositorios en servidor"],
    intents: ["view"], target: { href: "/panel/repository-store", click: '[data-tab="cloned"]' } },
  { id: "repository-store.tab.update", kind: "tab", module: "repository-store", parent: "view.repository-store", label: T("Updates", "Actualizaciones"), icon: "ti-refresh",
    keywords: ["actualizaciones", "updates", "actualizar repo", "update repository", "pull"],
    intents: ["view", "edit"], target: { href: "/panel/repository-store", click: '[data-tab="update"]' } },

  // Módulos
  { id: "modules.tab.installed", kind: "tab", module: "modules", parent: "view.modules", label: T("Installed", "Instalados"), icon: "ti-check",
    keywords: ["modulos instalados", "installed modules", "activos", "enabled"],
    intents: ["view", "configure"], target: { href: "/panel/modules", click: "#tab-installed" } },
  { id: "modules.tab.integrations", kind: "tab", module: "modules", parent: "view.modules", label: T("Integrations", "Integraciones"), icon: "ti-plug",
    keywords: ["integraciones", "integrations", "mcp", "servidores mcp", "conectores", "connectors"],
    intents: ["view", "configure"], target: { href: "/panel/modules", click: "#tab-integrations" } },

  // Ajustes (tabs .tab-btn[data-tab=…])
  { id: "settings.tab.general", kind: "tab", module: "settings", parent: "view.settings", label: T("General", "General"), icon: "ti-settings",
    keywords: ["general", "nombre del panel", "panel name", "zona horaria", "timezone", "idioma por defecto", "default language", "url"],
    intents: ["configure"], target: { href: "/panel/settings", click: '.tab-btn[data-tab="general"]' } },
  { id: "settings.tab.layout", kind: "tab", module: "settings", parent: "view.settings", label: T("Design & branding", "Diseño y marca"), icon: "ti-palette",
    keywords: ["diseno", "design", "marca", "branding", "logo", "colores", "colors", "tema", "theme", "apariencia", "appearance", "fondo", "background", "login", "layout", "favicon"],
    intents: ["configure"], target: { href: "/panel/settings", click: '.tab-btn[data-tab="layout"]' } },
  { id: "settings.tab.security", kind: "tab", module: "settings", parent: "view.settings", label: T("Security", "Seguridad"), icon: "ti-shield-lock",
    keywords: ["seguridad", "security", "2fa", "dos factores", "two factor", "sesion", "session", "lockout", "bloqueo de login", "politica de contrasenas", "password policy", "metodos de login"],
    intents: ["configure"], target: { href: "/panel/settings", click: '.tab-btn[data-tab="security"]' } },
  { id: "settings.tab.credentials", kind: "tab", module: "settings", parent: "view.settings", label: T("Credentials", "Credenciales"), icon: "ti-key",
    keywords: ["credenciales", "credentials", "claves", "keys", "api keys", "tokens", "secretos", "secrets", "boveda", "vault", "cloudflare token", "github token"],
    intents: ["configure"], target: { href: "/panel/settings", hash: "#cred", click: '.tab-btn[data-tab="credentials"]' } },
  { id: "settings.credentials.elevenlabs", kind: "subview", module: "settings", parent: "settings.tab.credentials", label: T("ElevenLabs credential", "Credencial de ElevenLabs"), icon: "ti-microphone",
    keywords: ["elevenlabs", "eleven labs", "api key elevenlabs", "voz", "voice", "voice id", "tts", "texto a voz", "text to speech", "traduccion en tiempo real", "real time translation", "audiollamadas", "audio calls", "llamadas"],
    intents: ["configure"], target: { href: "/panel/settings", hash: "#cred-elevenlabs", click: '.tab-btn[data-tab="credentials"]' } },
  { id: "settings.credentials.tolqia", kind: "subview", module: "settings", parent: "settings.tab.credentials", label: T("Tolqia API token", "Token de API de Tolqia"), icon: "ti-phone-call",
    keywords: ["tolqia", "token tolqia", "api token", "tq_live", "plan plus", "plan premium", "suscripcion", "subscription", "llamadas con traduccion", "translated calls", "audiollamadas", "audio calls", "traduccion en tiempo real", "real time translation", "cuenta tolqia", "tolqia account"],
    intents: ["configure"], target: { href: "/panel/settings", hash: "#cred-tolqia", click: '.tab-btn[data-tab="credentials"]' } },
  { id: "settings.tab.servers", kind: "tab", module: "settings", parent: "view.settings", label: T("Servers", "Servidores"), icon: "ti-server-2",
    keywords: ["servidores", "servers", "conectar servidor", "connect server", "agregar servidor", "add server", "ssh", "targets", "nodos", "nodes", "remoto", "remote"],
    intents: ["configure", "create", "edit"], target: { href: "/panel/settings", click: '.tab-btn[data-tab="servers"]' } },
  { id: "settings.tab.modules", kind: "tab", module: "settings", parent: "view.settings", label: T("Modules & cache", "Módulos y caché"), icon: "ti-puzzle",
    keywords: ["cache de modulos", "modules cache", "redis", "cache", "refrescar cache", "limpiar cache"],
    intents: ["configure"], target: { href: "/panel/settings", hash: "#modules", click: '.tab-btn[data-tab="modules"]' } },
  { id: "settings.tab.system", kind: "tab", module: "settings", parent: "view.settings", label: T("System", "Sistema"), icon: "ti-cpu",
    keywords: ["sistema", "system", "version", "actualizar panel", "update panel", "reiniciar", "restart", "logs", "dependencias", "dependencies", "mantenimiento", "maintenance"],
    intents: ["view", "configure"], target: { href: "/panel/settings", click: '.tab-btn[data-tab="system"]' } },

  // Preferencias (secciones en la misma página → scroll por hash)
  { id: "preferences.section.profile", kind: "subview", module: "preferences", permission: "*", parent: "view.preferences", label: T("Profile", "Perfil"), icon: "ti-user",
    keywords: ["perfil", "profile", "nombre", "display name", "telefono", "phone", "avatar", "mis datos"],
    intents: ["edit", "configure"], target: { href: "/panel/preferences", hash: "#pref-profile", click: "#pref-display-name" } },
  { id: "preferences.section.password", kind: "subview", module: "preferences", permission: "*", parent: "view.preferences", label: T("Change password", "Cambiar contraseña"), icon: "ti-password",
    keywords: ["cambiar contrasena", "contrasena", "password", "change password", "clave", "nueva contrasena", "reset password"],
    intents: ["edit", "configure"], target: { href: "/panel/preferences", hash: "#pref-password" } },
  { id: "preferences.section.passkeys", kind: "subview", module: "preferences", permission: "*", parent: "view.preferences", label: T("Passkeys", "Passkeys"), icon: "ti-fingerprint",
    keywords: ["passkeys", "passkey", "webauthn", "huella", "fingerprint", "llave de seguridad", "security key", "biometria"],
    intents: ["configure", "create"], target: { href: "/panel/preferences", hash: "#pref-passkeys" } },
  { id: "preferences.section.2fa", kind: "subview", module: "preferences", permission: "*", parent: "view.preferences", label: T("Two-factor (2FA)", "Doble factor (2FA)"), icon: "ti-shield-lock",
    keywords: ["2fa", "dos factores", "two factor", "totp", "autenticador", "authenticator", "google authenticator", "codigo", "otp", "codigos de recuperacion", "recovery codes"],
    intents: ["configure"], target: { href: "/panel/preferences", hash: "#pref-2fa" } },
  { id: "preferences.section.audit", kind: "subview", module: "preferences", permission: "*", parent: "view.preferences", label: T("Activity log", "Registro de actividad"), icon: "ti-history",
    keywords: ["actividad", "activity", "auditoria", "audit log", "historial", "history", "inicios de sesion", "logins"],
    intents: ["view"], target: { href: "/panel/preferences", hash: "#pref-audit" } },
];

/* ─────────────── Drawer de Configuración de Agentes IA (home `/`) ─────────────── */
const ASSISTANT_SECTIONS: SearchEntry[] = [
  { id: "assistant.market", kind: "subview", module: "assistant", permission: "*", parent: "view.assistant", label: T("Market", "Market"), icon: "ti-building-store",
    keywords: ["market", "catalogo", "catalog", "agentes", "agents", "especialidad", "specialty", "tecnologias", "technologies"],
    intents: ["view", "configure"], target: { href: "/panel/assistant/market" } },
  { id: "assistant.settings.general", kind: "drawer-section", module: "assistant", permission: "*", parent: "view.assistant", label: T("General", "General"), icon: "ti-settings",
    keywords: ["configuracion del asistente", "assistant settings", "ajustes ia", "ai settings", "general", "modelo", "model", "audio", "voz", "voice", "seleccion automatica", "terminal en vivo"],
    intents: ["configure"], target: { href: "/panel", event: { name: "luxipanel:assistant-settings-open", detail: { section: "general" } } } },
  { id: "assistant.settings.agentes", kind: "drawer-section", module: "assistant", permission: "*", parent: "view.assistant", label: T("Agents", "Agentes"), icon: "ti-robot",
    keywords: ["agentes", "agents", "crear agente", "create agent", "nuevo agente", "new agent", "editar agente", "edit agent", "equipos", "teams", "roles de agente", "subagentes", "avatar", "system prompt"],
    intents: ["create", "edit", "configure", "view"], target: { href: "/panel", event: { name: "luxipanel:assistant-settings-open", detail: { section: "agentes" } } } },
  { id: "assistant.settings.providers", kind: "subview", module: "settings", parent: "settings.tab.credentials", label: T("AI providers and API keys", "Proveedores IA y claves API"), icon: "ti-plug-connected",
    keywords: ["proveedores", "providers", "proveedor ia", "ai provider", "api key", "clave api", "claude", "openai", "codex", "gemini", "grok", "minimax", "anthropic", "cli", "login cli"],
    intents: ["configure", "edit"], target: { href: "/panel/settings", hash: "#cred-assistant", click: '.tab-btn[data-tab="credentials"]' } },
  { id: "assistant.settings.modules", kind: "drawer-section", module: "assistant", permission: "*", parent: "view.assistant", label: T("Modules & tools", "Módulos y herramientas"), icon: "ti-tool",
    keywords: ["herramientas", "tools", "modulos del asistente", "mcp", "capacidades", "capabilities", "permisos de herramientas", "tool permissions"],
    intents: ["configure"], target: { href: "/panel", event: { name: "luxipanel:assistant-settings-open", detail: { section: "modules" } } } },
  { id: "assistant.settings.stats", kind: "drawer-section", module: "assistant", permission: "*", parent: "view.assistant", label: T("Usage & costs", "Uso y costos"), icon: "ti-chart-bar",
    keywords: ["estadisticas", "stats", "uso", "usage", "costos", "costs", "tokens", "consumo", "gasto", "spend", "cuota", "quota", "facturacion"],
    intents: ["view"], target: { href: "/panel", event: { name: "luxipanel:assistant-settings-open", detail: { section: "stats" } } } },
  { id: "assistant.settings.access", kind: "drawer-section", module: "assistant", permission: "*", parent: "view.assistant", label: T("Access & approvals", "Acceso y aprobaciones"), icon: "ti-lock-access",
    keywords: ["acceso", "access", "aprobaciones", "approvals", "modo de aprobacion", "approval mode", "permisos del asistente", "sandbox", "seguridad ia", "quien puede usar"],
    intents: ["configure"], target: { href: "/panel", event: { name: "luxipanel:assistant-settings-open", detail: { section: "access" } } } },
  { id: "assistant.action.new-conversation", kind: "action", module: "assistant", permission: "*", parent: "view.assistant", label: T("New AI conversation", "Nueva conversación IA"), icon: "ti-message-plus",
    keywords: ["nueva conversacion", "new conversation", "nuevo chat", "new chat", "hablar con la ia", "preguntar a la ia", "ask ai", "chatear"],
    intents: ["create"], target: { href: "/panel", event: { name: "luxipanel:assistant-new-conversation" } } },
  { id: "assistant.action.new-project", kind: "action", module: "assistant", permission: "*", parent: "view.assistant", label: T("New project", "Nuevo proyecto"), icon: "ti-folder-plus",
    keywords: ["nuevo proyecto", "new project", "crear proyecto", "create project", "proyectos", "projects", "contexto de proyecto"],
    intents: ["create"], target: { href: "/panel", clickSeq: ['[data-search-target="chat-prompt-plus"]', '[data-search-target="new-project"]'] } },
];

/* ───────────────────────── Acciones globales ───────────────────────── */
const ACTIONS: SearchEntry[] = [
  { id: "action.theme-dark", kind: "action", module: "layout", permission: "*", label: T("Switch to dark mode", "Cambiar a modo oscuro"), icon: "ti-moon",
    keywords: ["modo oscuro", "dark mode", "tema oscuro", "dark theme", "oscuro", "dark", "noche", "night"],
    intents: ["configure"], target: { action: "theme-dark" } },
  { id: "action.theme-light", kind: "action", module: "layout", permission: "*", label: T("Switch to light mode", "Cambiar a modo claro"), icon: "ti-sun",
    keywords: ["modo claro", "light mode", "tema claro", "light theme", "claro", "light", "dia"],
    intents: ["configure"], target: { action: "theme-light" } },
  { id: "action.language", kind: "action", module: "layout", permission: "*", label: T("Change language", "Cambiar idioma"), icon: "ti-language",
    keywords: ["idioma", "language", "cambiar idioma", "change language", "espanol", "ingles", "english", "spanish", "traducir panel"],
    intents: ["configure"], target: { action: "language" } },
  { id: "action.server-switcher", kind: "action", module: "server-switcher", label: T("Switch server", "Cambiar de servidor"), icon: "ti-server-2",
    keywords: ["cambiar servidor", "switch server", "conectar servidor", "connect server", "otro servidor", "seleccionar servidor", "select server", "target", "nodo"],
    intents: ["configure", "view"], target: { action: "server-switcher" } },
  { id: "action.sidebar-toggle", kind: "action", module: "layout", permission: "*", label: T("Collapse / expand menu", "Colapsar / expandir menú"), icon: "ti-layout-sidebar",
    keywords: ["menu lateral", "sidebar", "colapsar menu", "collapse menu", "ocultar menu", "hide menu", "expandir menu"],
    intents: ["configure"], target: { action: "sidebar-toggle" } },
  { id: "action.logout", kind: "action", module: "layout", permission: "*", label: T("Sign out", "Cerrar sesión"), icon: "ti-logout",
    keywords: ["cerrar sesion", "logout", "log out", "sign out", "salir", "exit", "desconectar"],
    intents: ["view"], target: { action: "logout" } },
];

export const SEARCH_CATALOG: readonly SearchEntry[] = [...VIEWS, ...TABS, ...ASSISTANT_SECTIONS, ...ACTIONS];

/** Índice por id (para "recientes" y sugerencias de la IA). */
export function findSearchEntry(id: string): SearchEntry | undefined {
  return SEARCH_CATALOG.find((e) => e.id === id);
}
