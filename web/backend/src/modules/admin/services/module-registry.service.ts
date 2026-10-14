// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { notifyModulesChanged } from "../../../shared/module-state/lifecycle.js";
/**
 * Module Registry Service
 *
 * Modules in LUXIPANEL are preinstalled core features. They ship with each
 * panel release and are not installed/uninstalled at runtime. The registry is
 * a static, in-process catalog — there is no remote fetch and no install /
 * uninstall flow.
 *
 * Per-module visibility lives in panel_settings under the "modules" category
 * with keys like `module.<id>.enabled`. The /panel/modules UI is just a
 * toggle that flips that boolean.
 */

import { settingsRepository } from "../repositories/index.js";
import { communityCatalog } from "../../../shared/community-catalog.js";
import { getContextExecutor } from "../../../shared/executor/context.js";
import { mailConfig } from "../../../config/mail.js";
import type { CatalogEntry, ModuleDefinition } from "../models/module.model.js";

// Re-export the catalog domain types from their `models/` home so existing
// importers of `module-registry.service.js` keep resolving them unchanged.
export type { ConfigField, ModuleDefinition, CatalogEntry } from "../models/module.model.js";

/**
 * Modules treated as enabled on fresh installs (no setup wizard exists).
 * Once the admin toggles anything in /panel/modules, the explicit rows win.
 *
 * INVARIANT: every id here MUST exist as a catalog row below. Enforced at load
 * by {@link assertDefaultsAreCatalogued} so a typo / removed module surfaces
 * immediately instead of silently defaulting a phantom module to "enabled".
 */
const DEFAULT_ENABLED_MODULES = new Set<string>([
  "users",
  "monitor",
  "files",
  "firewall",
  "backups",
  "cron",
  "webhooks",
  "assistant",
  // Compañero del asistente (implies). El asistente nace activo por defecto, así
  // que obsidian también, para mantener el invariante "asistente on ⇒ obsidian
  // on" desde el arranque. La entitlement por panel sigue filtrando su acceso.
  "obsidian",
  "dns",
  "mail",
  "hosting",
  "openclaw",
  "repository-store",
  "terminal",
  // Herramienta de dev gratuita en instalaciones nuevas. OJO: en instalaciones
  // existentes con filas explícitas de módulos nace deshabilitado — el admin
  // lo activa en /panel/modules (no escribir filas en settings a mano).
  "module-dev",
  // Visor del grafo del codebase (codebase-memory-mcp). Gratuito; en instalaciones
  // con filas explícitas nace deshabilitado hasta activarlo en /panel/modules.
  "codebase-graph",
]);

// ── Static catalog ────────────────────────────────────────────────────────
// Single source of truth for the panel's preinstalled modules.

// NOTE: there is no `dashboard` row any more — the panel home (`/`) IS the
// `assistant` module (Agentes IA) since 2026-08-25. The `dashboard` permission
// ids survive only as the universal "home" ids in role-permissions.service.
const CATALOG: Record<string, CatalogEntry> = {
  users: {
    name: "Usuarios",
    description: "Gestión de usuarios del panel, roles y permisos.",
    tag: "free",
    icon: "users",
    color: "blue",
    category: "security",
    features: ["Lista de usuarios", "Roles y permisos", "Invitaciones", "Auditoría de acceso"],
  },
  mail: {
    name: "Mail",
    description: "SMTP / IMAP, dominios y buzones de usuario.",
    tag: "premium",
    icon: "mail",
    color: "sky",
    category: "communication",
    features: ["SMTP / IMAP", "Filtros Sieve", "Gestión de dominios", "Buzones de usuario"],
    dependencies: ["dns"],
    configFields: [
      {
        key: "mailDomain",
        label: "Dominio o subdominio",
        type: "select",
        required: true,
        hint: "Se toma desde Nginx -> Sitios. Elige el dominio que tendrá su servicio de correo.",
        optionsSource: "dns-domains",
      },
    ],
  },
  monitor: {
    name: "Monitor",
    description: "Métricas en vivo de CPU, RAM, disco y procesos.",
    tag: "premium",
    icon: "activity",
    color: "emerald",
    category: "infrastructure",
    features: ["CPU / RAM / Disco", "Alertas en vivo", "Historial de métricas", "Vista resumida"],
  },
  files: {
    name: "Files",
    description: "Explorador de archivos remoto con editor integrado.",
    tag: "premium",
    icon: "folder",
    color: "amber",
    category: "infrastructure",
    features: ["Explorador de directorios", "Editor integrado", "Subidas", "Acciones rápidas"],
    // Git credentials (clone/push auth) are managed from the GitHub module.
    dependencies: ["repository-store"],
  },
  firewall: {
    name: "Firewall",
    description: "Gestión de reglas UFW y bloqueo de IPs.",
    tag: "premium",
    icon: "shield-lock",
    color: "red",
    category: "security",
    features: ["Reglas UFW", "Bloqueo IP", "Control centralizado", "Protección básica"],
  },
  bitninja: {
    name: "BitNinja",
    description: "Agente de seguridad integral: WAF, anti-DoS, detección de malware y reputación de IP.",
    tag: "premium",
    icon: "shield-check",
    color: "violet",
    category: "security",
    features: [
      "Instalación con la license key del cliente",
      "Estado del agente y de sus componentes",
      "Control del servicio (iniciar / detener / reiniciar)",
      "Activar / desactivar componentes de protección",
    ],
  },
  assistant: {
    name: "Assistant",
    description: "Asistente con IA para diagnóstico y automatización.",
    tag: "premium",
    icon: "robot",
    color: "violet",
    category: "developer",
    features: [
      "Diagnóstico guiado",
      "Ayuda contextual",
      "Automatización",
      "Respuestas en lenguaje natural",
    ],
    // Activar el asistente activa también Obsidian: cada repo / proyecto / chat
    // recibe un vault de contexto (decisiones, comandos, errores, reglas) que el
    // asistente consulta. Ver context-container.service en el módulo obsidian.
    implies: ["obsidian"],
    // Puede vivir como entrada del sidebar Y como FAB flotante — los dos son
    // independientes y se controlan por separado desde /panel/modules.
    supportsSidebar: true,
    supportsFloatingButton: true,
  },
  "repository-store": {
    name: "GitHub",
    description: "Catálogo de repositorios e instalación guiada.",
    tag: "free",
    icon: "brand-github",
    color: "slate",
    category: "developer",
    features: [
      "Búsqueda de repos",
      "Instalación guiada",
      "Gestión de actualizaciones",
      "Vista de mercado",
    ],
  },
  // Slug interno "dns" conservado por compatibilidad de permisos/licencia.
  // El módulo es la gestión de Nginx (sitios, proxy, SSL, logs, estado).
  dns: {
    name: "Nginx",
    description: "Gestión de Nginx: sitios, reverse proxy, SSL, logs y estado.",
    tag: "premium",
    icon: "nginx",
    color: "emerald",
    category: "infrastructure",
    features: [
      "Sitios / server blocks (modo guiado y avanzado)",
      "Reverse proxy y upstreams",
      "SSL/TLS (Let's Encrypt)",
      "Logs y control del servicio",
    ],
  },
  backups: {
    name: "Backups",
    description: "Backups programados con cifrado y múltiples destinos.",
    tag: "premium",
    icon: "backup",
    color: "amber",
    category: "infrastructure",
    features: [
      "Programación Cron",
      "Almacenamiento S3 / SFTP / local",
      "Cifrado AES-256",
      "Restauración guiada",
    ],
  },
  cron: {
    name: "Cron",
    description: "Tareas programadas con editor visual.",
    tag: "premium",
    icon: "calendar-event",
    color: "cyan",
    category: "infrastructure",
    features: [
      "Tareas programadas",
      "Editor visual de cron",
      "Automatización del sistema",
      "Ejecución periódica",
    ],
  },
  databases: {
    name: "Databases",
    description: "Gestor de bases de datos (MySQL/MariaDB y PostgreSQL): explorar esquemas y consola SQL.",
    tag: "premium",
    icon: "database",
    color: "indigo",
    category: "infrastructure",
    features: [
      "Detección automática de motores (MySQL/MariaDB, PostgreSQL)",
      "Explorador de bases de datos, tablas y columnas",
      "Navegador de filas paginado",
      "Consola SQL con separación lectura/escritura",
    ],
  },
  obsidian: {
    name: "Obsidian",
    description:
      "Vaults de notas Obsidian en tu servidor: editor markdown, wikilinks y notas operadas por los agentes IA del asistente.",
    tag: "premium",
    icon: "notebook",
    color: "purple",
    category: "developer",
    features: [
      "Gestión de vaults (crear o registrar carpetas existentes)",
      "Editor markdown con wikilinks [[...]]",
      "Búsqueda en notas y backlinks",
      "Integración total con el asistente IA — todos los proveedores (CLAUDE.md, AGENTS.md, GEMINI.md)",
    ],
  },
  cloudflare: {
    name: "Cloudflare",
    description:
      "Gestión de Cloudflare para el servidor: DNS, caché, SSL/TLS, modo desarrollo y reglas de acceso IP.",
    tag: "premium",
    icon: "brand-cloudflare",
    color: "orange",
    category: "infrastructure",
    features: [
      "Zonas y registros DNS con marcado de los que apuntan al servidor",
      "Purga de caché y modo desarrollo",
      "Modo SSL/TLS, Siempre HTTPS y nivel de seguridad",
      "Reglas de acceso IP (bloquear/permitir/challenge)",
    ],
  },
  "server-alerts": {
    name: "Notificaciones",
    description:
      "Notificaciones del servidor para el dueño del panel: preferencias de alertas, avisos inmediatos, programados/recurrentes y reglas por métricas (CPU/RAM/disco/carga/servicio caído), entregados a sus dispositivos vía LP.",
    tag: "free",
    icon: "bell-ringing",
    color: "amber",
    category: "communication",
    features: [
      "Preferencias de alertas por servidor (CPU/RAM/disco, estado, accesos)",
      "Notificaciones inmediatas a web / desktop / app",
      "Programadas y recurrentes (fecha o cron)",
      "Reglas por métricas con umbral y cooldown anti-spam",
    ],
  },
  expo: {
    name: "Expo",
    description:
      "Gestiona apps Expo/React Native: builds EAS, envíos a tiendas, OTA updates, QR de dev-client y cuotas, con un access token del cliente.",
    tag: "premium",
    icon: "brand-expo",
    color: "slate",
    category: "developer",
    features: [
      "Builds EAS dev/prod por plataforma (Android/iOS) con id y URL del panel",
      "Envíos a App Store / Play Store + credenciales de tienda",
      "QR de dev-client (exp://) para pruebas en tiempo real",
      "OTA updates, variables EAS y cuota de builds",
    ],
    implies: ["files", "repository-store", "assistant"],
  },
  webhooks: {
    name: "Webhooks",
    description: "Notificaciones HTTP de eventos del panel.",
    tag: "premium",
    icon: "link",
    color: "blue",
    category: "communication",
    features: [
      "Eventos del panel",
      "Notificaciones HTTP",
      "Integración con servicios externos",
      "Reintentos controlados",
    ],
  },
  openclaw: {
    name: "OpenClaw",
    description: "Conexión a OpenClaw AI con selector de modelo.",
    tag: "premium",
    icon: "robot",
    color: "violet",
    category: "developer",
    features: [
      "Conexión a OpenClaw AI",
      "API key cifrada en panel_settings",
      "Selector de modelo por defecto",
      "Prueba de conectividad integrada",
    ],
  },
  hosting: {
    name: "Hosting",
    description: "Sitios, vhosts y despliegues asistidos.",
    tag: "premium",
    icon: "building",
    color: "indigo",
    category: "infrastructure",
    features: ["Vhosts Nginx", "Despliegues", "Usuarios SFTP", "Estadísticas por sitio"],
  },
  terminal: {
    name: "Terminal",
    description:
      "Terminal flotante accesible desde cualquier vista del panel. Activa o desactiva el botón flotante.",
    tag: "free",
    icon: "terminal-2",
    color: "slate",
    category: "infrastructure",
    features: [
      "Botón flotante en todas las vistas",
      "Sesiones persistentes entre navegaciones",
      "Snippets y atajos de comandos",
      "Soporte multi-CLI (Claude, Codex, shell)",
    ],
    // Puede vivir como entrada del sidebar Y como FAB flotante — los dos son
    // independientes y se controlan por separado desde /panel/modules.
    supportsSidebar: true,
    supportsFloatingButton: true,
  },

  "module-dev": {
    name: "Mis módulos",
    description:
      "Ciclo de vida de tus módulos del marketplace: estado de revisión, envíos, tests y preview privada.",
    tag: "free",
    icon: "packages",
    color: "teal",
    category: "developer",
    features: [
      "Estado y eventos de revisión de tus módulos",
      "Enviar / reenviar a revisión (alta guiada por el asistente IA)",
      "Despublicar y reactivar módulos publicados",
      "Runner de tests y preview privada (Modo B) en tu servidor",
    ],
    permissions: { sidebar: ["module-dev"], views: ["panel.module-dev"] },
  },

  // ── Local MCPs (kind=mcp_server) ────────────────────────────────────────
  "filesystem-mcp": {
    name: "Filesystem MCP",
    description: "MCP para operaciones de filesystem.",
    tag: "premium",
    icon: "folder",
    color: "amber",
    category: "developer",
    kind: "mcp_server",
    features: ["Listar directorios", "Leer archivos", "Escribir archivos", "Eliminar archivos"],
    configFields: [
      {
        key: "rootPath",
        label: "Ruta raíz permitida",
        type: "text",
        placeholder: "/home/user",
        required: true,
        hint: "Directorio base para operaciones (ej: /home/user para limitar acceso)",
      },
    ],
  },
  "github-mcp": {
    name: "GitHub MCP",
    description: "MCP para operaciones contra la API de GitHub.",
    tag: "premium",
    icon: "brand-github",
    color: "slate",
    category: "developer",
    kind: "mcp_server",
    features: ["Listar repos", "Crear issues", "Ver PRs", "Ejecutar workflows"],
    configFields: [
      {
        key: "githubToken",
        label: "Token de GitHub",
        type: "password",
        placeholder: "ghp_xxxxxxxxxxxxxx",
        required: true,
        hint: "Token personal de acceso (Settings > Developer settings > Personal access tokens)",
      },
      {
        key: "owner",
        label: "Owner de repositorio",
        type: "text",
        placeholder: "Luxisoft",
        required: true,
        hint: "Usuario u organización dueña del repositorio",
      },
    ],
  },

  // ── Office-tool connectors (kind=mcp_server) ────────────────────────────
  // External MCP servers the assistant can browse from the chat. Same enable/
  // disable protocol as any module; credentials are saved locally and the MCP
  // is launched by the office-connectors runtime.
  "google-drive": {
    name: "Google Drive",
    description: "Busca y adjunta documentos de tu Google Drive desde el chat del asistente.",
    tag: "free",
    icon: "brand-google-drive",
    color: "amber",
    category: "developer",
    kind: "mcp_server",
    features: ["Buscar documentos", "Adjuntar archivos al chat"],
    configFields: [
      {
        key: "GDRIVE_CREDENTIALS",
        label: "Credenciales OAuth (JSON)",
        type: "textarea",
        placeholder: '{"client_id":"…","client_secret":"…","refresh_token":"…"}',
        required: true,
        hint: "Pega el JSON de credenciales OAuth con un refresh_token de Google Drive.",
        helpUrl: "https://developers.google.com/oauthplayground/",
        helpUrlLabel: "Generar refresh_token con OAuth Playground",
      },
    ],
  },
  "onedrive": {
    name: "OneDrive",
    description: "Accede a archivos de Microsoft OneDrive / SharePoint desde el chat.",
    tag: "free",
    icon: "brand-onedrive",
    color: "blue",
    category: "developer",
    kind: "mcp_server",
    features: ["Buscar archivos", "Adjuntar al chat"],
    configFields: [
      { key: "ONEDRIVE_CLIENT_ID", label: "Client ID", type: "text", required: true },
      { key: "ONEDRIVE_CLIENT_SECRET", label: "Client Secret", type: "password", required: true },
      { key: "ONEDRIVE_REFRESH_TOKEN", label: "Refresh token", type: "password", required: true },
    ],
  },
  "dropbox": {
    name: "Dropbox",
    description: "Busca y adjunta archivos de Dropbox desde el chat.",
    tag: "free",
    icon: "brand-dropbox",
    color: "blue",
    category: "developer",
    kind: "mcp_server",
    features: ["Buscar archivos", "Adjuntar al chat"],
    configFields: [
      { key: "DROPBOX_ACCESS_TOKEN", label: "Access token", type: "password", required: true },
    ],
  },
  "notion": {
    name: "Notion",
    description: "Consulta páginas y bases de datos de Notion desde el chat.",
    tag: "free",
    icon: "brand-notion",
    color: "slate",
    category: "developer",
    kind: "mcp_server",
    features: ["Buscar páginas", "Adjuntar al chat"],
    configFields: [
      { key: "NOTION_API_KEY", label: "Integration token", type: "password", required: true },
    ],
  },
  "codebase-graph": {
    name: "Codebase Graph",
    description:
      "Grafo de conocimiento del repo del servidor: arquitectura, rutas, imports, funciones/clases, rutas de llamada y vista interactiva.",
    tag: "free",
    icon: "binary-tree",
    color: "violet",
    category: "developer",
    features: [
      "Arquitectura: nodos, aristas, rutas, funciones, clases, imports",
      "Buscar símbolos y trazar cadenas de llamada",
      "Vista interactiva del grafo (proxy autenticado /cgraph)",
    ],
  },
};

const CATALOG_LIST: ModuleDefinition[] = Object.entries(CATALOG)
  .map(([id, entry]) => ({
    id,
    name: entry.name,
    description: entry.description,
    tag: entry.tag,
    icon: entry.icon,
    color: entry.color,
    category: entry.category,
    features: entry.features,
    configFields: entry.configFields ?? [],
    dependencies: entry.dependencies ?? [],
    implies: entry.implies ?? [],
    kind: entry.kind ?? "module",
    ...(entry.permissions ? { permissions: entry.permissions } : {}),
    ...(entry.supportsSidebar ? { supportsSidebar: true } : {}),
    ...(entry.supportsFloatingButton ? { supportsFloatingButton: true } : {}),
  }));

/**
 * SSOT guard: every default-enabled id must resolve to a catalog row. Runs once
 * at module load; throws (fail-fast) if `DEFAULT_ENABLED_MODULES` drifts from
 * `CATALOG`, so a rename/removal can never leave a phantom module defaulting to
 * "enabled" for every fresh install. Also exposed as {@link defaultEnabledModuleIds}
 * so tests / seed paths can consume the same single source.
 */
function assertDefaultsAreCatalogued(): void {
  const catalogIds = new Set(allModules().map((m) => m.id));
  const orphans = [...DEFAULT_ENABLED_MODULES].filter((id) => !catalogIds.has(id));
  if (orphans.length > 0) {
    throw new Error(
      `DEFAULT_ENABLED_MODULES contains ids absent from the catalog: ${orphans.join(", ")}`,
    );
  }
}
assertDefaultsAreCatalogued();

/** Catalog ids that are enabled by default on a fresh install (no settings
 *  rows yet). Frozen snapshot of the canonical `DEFAULT_ENABLED_MODULES`. */
export const defaultEnabledModuleIds: readonly string[] = Object.freeze([
  ...DEFAULT_ENABLED_MODULES,
]);

const KEY = (id: string) => `module.${id}.enabled`;
const KEY_SIDEBAR = (id: string) => `module.${id}.showInSidebar`;
const KEY_FAB = (id: string) => `module.${id}.showFloatingButton`;
const ORDER_KEY = "modules.order";

function unique(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.trim().length > 0))];
}

/** Catálogo = estático (core) ⊕ comunidad (módulos de terceros cargados). */
function allModules(): ModuleDefinition[] {
  const community = communityCatalog.list();
  return community.length ? [...CATALOG_LIST, ...community] : CATALOG_LIST;
}

export const moduleRegistryService = {
  getAll(): ModuleDefinition[] {
    return allModules();
  },

  getById(id: string): ModuleDefinition | undefined {
    return allModules().find((m) => m.id === id);
  },

  /** Resolve dependency order for a module, with dependencies before the target. */
  resolveInstallOrder(id: string): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const path = new Set<string>();

    const visit = (moduleId: string): void => {
      if (visited.has(moduleId)) return;
      if (path.has(moduleId)) {
        throw new Error(`Cyclic module dependency detected: ${[...path, moduleId].join(" -> ")}`);
      }

      const def = this.getById(moduleId);
      if (!def) {
        throw new Error(`Unknown module dependency: ${moduleId}`);
      }

      path.add(moduleId);
      for (const dependency of unique(def.dependencies ?? [])) {
        visit(dependency);
      }
      path.delete(moduleId);
      visited.add(moduleId);
      order.push(moduleId);
    };

    visit(id);
    return order;
  },

  /**
   * Full set of modules to write "true" for when enabling `id`: its own
   * dependency order, plus the same closure for every module it `implies`
   * (transitively). Dependencies come before the modules that need them.
   * Implied modules are companions — enabling them never pulls `id` back in.
   */
  enableClosure(id: string): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    const queuedImplies = new Set<string>([id]);
    const queue: string[] = [id];

    while (queue.length > 0) {
      const moduleId = queue.shift()!;
      for (const dep of this.resolveInstallOrder(moduleId)) {
        if (!seen.has(dep)) {
          seen.add(dep);
          result.push(dep);
        }
      }
      for (const implied of unique(this.getById(moduleId)?.implies ?? [])) {
        // Skip unknown implied ids defensively (catalog drift) and avoid loops.
        if (!this.getById(implied) || queuedImplies.has(implied)) continue;
        queuedImplies.add(implied);
        queue.push(implied);
      }
    }
    return result;
  },

  async isEnabled(id: string): Promise<boolean> {
    const v = await settingsRepository.get(KEY(id));
    if (v !== null) return v === "true";
    return DEFAULT_ENABLED_MODULES.has(id);
  },

  async getEnabledMap(): Promise<Record<string, boolean>> {
    const rows = await settingsRepository.getByCategory("modules");
    const map: Record<string, boolean> = {};

    const hasExplicit = rows.some((row) => /^module\.(.+)\.enabled$/.test(row.key));
    for (const m of allModules()) {
      map[m.id] = hasExplicit ? false : DEFAULT_ENABLED_MODULES.has(m.id);
    }

    for (const row of rows) {
      const match = row.key.match(/^module\.(.+)\.enabled$/);
      if (match && match[1]) map[match[1]] = row.value === "true";
    }

    const mailEnabled = rows.some((row) =>
      /^module\.mail\.service\..+\.enabled$/.test(row.key) && row.value === "true",
    );
    let mailConfiguredOnDisk = false;
    if (!mailEnabled) {
      // Per-server signal: read the CONNECTED server's Postfix domain map
      // (`mailConfig.postfix.virtualDomains`, the file the mail module actually
      // writes) through the context executor — NEVER the panel host's local fs.
      // The old `fs.readFile("/etc/postfix/vdomains", ...)` always read the
      // panel host, so one server's mail state leaked into every server's map.
      // Fail-closed: no context executor (e.g. boot under runOnPanelHost with no
      // connected server) ⇒ treat mail as not-configured; never fall back to the
      // panel host's own fs. Never throws → boot is unaffected.
      const executor = getContextExecutor();
      if (executor) {
        try {
          const raw = await executor.readFile(mailConfig.postfix.virtualDomains, "utf8");
          const content = typeof raw === "string" ? raw : raw.toString("utf8");
          mailConfiguredOnDisk = content.split(/\r?\n/).some((line) => line.trim().length > 0);
        } catch {
          mailConfiguredOnDisk = false;
        }
      }
    }
    if (mailEnabled || mailConfiguredOnDisk) map.mail = true;

    return map;
  },

  /**
   * Per-module display flags consumed by the sidebar renderer and the
   * floating-button (FAB) stack. Two flags per module:
   *   - `showInSidebar`     → render the module as a top-level left-sidebar entry.
   *   - `showFloatingButton` → render the FAB overlay on top of every view.
   *
   * Default policy: when a module is `enabled` AND the catalog flags it as
   * capable (`supportsSidebar` / `supportsFloatingButton`), the flag is true.
   * The user can flip it independently in `/panel/modules` and the explicit
   * row sticks across toggles. Disabled modules always report both flags as
   * false regardless of stored prefs — the master `enabled` switch wins.
   */
  async getDisplayMap(): Promise<Record<string, { showInSidebar: boolean; showFloatingButton: boolean }>> {
    const enabledMap = await this.getEnabledMap();
    const rows = await settingsRepository.getByCategory("modules");
    const explicitSidebar = new Map<string, boolean>();
    const explicitFab = new Map<string, boolean>();
    for (const row of rows) {
      const sidebarMatch = row.key.match(/^module\.(.+)\.showInSidebar$/);
      if (sidebarMatch && sidebarMatch[1]) {
        explicitSidebar.set(sidebarMatch[1], row.value === "true");
        continue;
      }
      const fabMatch = row.key.match(/^module\.(.+)\.showFloatingButton$/);
      if (fabMatch && fabMatch[1]) {
        explicitFab.set(fabMatch[1], row.value === "true");
      }
    }

    const map: Record<string, { showInSidebar: boolean; showFloatingButton: boolean }> = {};
    for (const def of allModules()) {
      const isOn = Boolean(enabledMap[def.id]);
      // `supportsSidebar` default = true: todo módulo nacido "habilitado" puede
      // aparecer en el sidebar izquierdo salvo que el admin lo oculte. Sólo el
      // FAB es opt-in (assistant y terminal hoy).
      const supportsSidebar = def.supportsSidebar !== false;
      const supportsFab = Boolean(def.supportsFloatingButton);
      map[def.id] = {
        showInSidebar: isOn && supportsSidebar && (explicitSidebar.has(def.id) ? explicitSidebar.get(def.id)! : true),
        showFloatingButton: isOn && supportsFab && (explicitFab.has(def.id) ? explicitFab.get(def.id)! : true),
      };
    }
    return map;
  },

  /**
   * Persist a single display flag for one module. Throws if the module does
   * not support the requested flag (e.g. trying to set `showFloatingButton`
   * on a module without a FAB). No-op when `value` equals the current stored
   * value — keeps settings rows from accumulating on no-op toggles.
   */
  async setDisplayFlag(id: string, flag: "showInSidebar" | "showFloatingButton", value: boolean): Promise<void> {
    const def = this.getById(id);
    if (!def) throw new Error(`Unknown module: ${id}`);
    if (flag === "showInSidebar" && !def.supportsSidebar) {
      throw new Error(`Module ${id} does not support showInSidebar`);
    }
    if (flag === "showFloatingButton" && !def.supportsFloatingButton) {
      throw new Error(`Module ${id} does not support showFloatingButton`);
    }
    const key = flag === "showInSidebar" ? KEY_SIDEBAR(id) : KEY_FAB(id);
    const existing = await settingsRepository.get(key);
    if (existing === (value ? "true" : "false")) return;
    await settingsRepository.set(
      key,
      value ? "true" : "false",
      "modules",
      `Module ${id} ${flag} = ${value}`,
    );
    notifyModulesChanged(id);
  },

  async enable(id: string): Promise<void> {
    if (!this.getById(id)) throw new Error(`Unknown module: ${id}`);
    // Enable dependencies first AND any implied companion modules
    // (enableClosure returns [dep…, id, …implied closure]).
    const order = this.enableClosure(id);
    for (const depId of order) {
      await settingsRepository.set(KEY(depId), "true", "modules", `Module ${depId} enabled`);
      notifyModulesChanged(depId);
    }
  },

  async disable(id: string): Promise<void> {
    if (!this.getById(id)) throw new Error(`Unknown module: ${id}`);
    if (id === "mail") {
      const rows = await settingsRepository.getByCategory("modules");
      const serviceKeys = rows
        .filter((row) => /^module\.mail\.service\..+\.enabled$/.test(row.key))
        .map((row) => row.key);
      for (const key of serviceKeys) {
        await settingsRepository.delete(key);
      }
    }
    await settingsRepository.set(KEY(id), "false", "modules", `Module ${id} disabled`);
    notifyModulesChanged(id);
  },

  /**
   * Read the saved display order. Unknown ids are filtered out, missing
   * known ids are appended in catalog order so the result always covers
   * every catalog module exactly once.
   */
  async getOrder(): Promise<string[]> {
    const raw = await settingsRepository.get(ORDER_KEY);
    let saved: string[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) saved = parsed.filter((v): v is string => typeof v === "string");
      } catch {
        saved = [];
      }
    }
    const known = new Set(allModules().map((m) => m.id));
    const result: string[] = [];
    const seen = new Set<string>();
    for (const id of saved) {
      if (known.has(id) && !seen.has(id)) {
        result.push(id);
        seen.add(id);
      }
    }
    for (const m of allModules()) {
      if (!seen.has(m.id)) {
        result.push(m.id);
        seen.add(m.id);
      }
    }
    return result;
  },

  /** Persist the display order. */
  async setOrder(order: string[]): Promise<void> {
    const known = new Set(allModules().map((m) => m.id));
    const cleaned = unique(order).filter((id) => known.has(id));
    await settingsRepository.set(
      ORDER_KEY,
      JSON.stringify(cleaned),
      "modules",
      "Display order for sidebar / modules page",
    );
    notifyModulesChanged();
  },
};
