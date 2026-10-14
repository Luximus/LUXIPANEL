import type { ComponentType } from "react";
// Iconos Tabler inline (mismos `ti-*` que el sidebar de LUXIPANEL), vía
// react-native-svg — ver `tabler-icons.tsx` (sin depender de
// @tabler/icons-react-native: Metro no resolvía sus subpaths y el barrel metía
// ~12k iconos).
import {
  TablerActivity,
  TablerBellRinging,
  TablerBrandGithub,
  TablerBuilding,
  TablerClock,
  TablerDatabase,
  TablerBrain,
  TablerLayoutDashboard,
  TablerFolder,
  TablerMail,
  TablerPackages,
  TablerPuzzle,
  TablerSettings,
  TablerShieldCheck,
  TablerShieldLock,
  TablerSparkles,
  TablerTerminal2,
  TablerUsers,
  TablerWebhook,
  // Iconos de marca (logos) — mismos que el sidebar del panel para módulos branded.
  BrandBackups,
  BrandCloudflare,
  BrandDns,
  BrandExpo,
  BrandObsidian,
  BrandOpenclaw,
} from "./tabler-icons";

/**
 * Registro de módulos de LUXIPANEL para el modal "Más herramientas".
 * Espejo del `MODULE_META` del panel
 * (frontend/src/scripts/extracted/layouts/PanelLayout-define-vars-script1.ts):
 * cada módulo se abre como su PROPIA webview apuntando a `/panel/<route>` vía el
 * deep-link SSO `next=`. Se usan los MISMOS iconos Tabler (`ti-*`) que el sidebar
 * del panel, vía `./tabler-icons` (SVG inline con react-native-svg).
 *
 * OJO: `dns` enruta a `/panel/nginx` (no `/panel/dns`). El `labelKey` indexa
 * `t.modules.labels[...]`; el `name` que devuelve el backend (catálogo de
 * módulos) es el fallback cuando un id no está en este registro.
 */
export type ModuleIcon = ComponentType<{ size?: number; color?: string }>;

export type LuxModule = {
  /** Código de módulo (coincide con el `id` que devuelve /api/me/modules). */
  id: string;
  /** Slug dentro de `/panel/<route>` (p. ej. dns → "nginx"). */
  route: string;
  /** Icono Tabler (mismo que el sidebar de LUXIPANEL). */
  icon: ModuleIcon;
  /** Clave en `t.modules.labels`. */
  labelKey: string;
};

export const LUX_MODULES: LuxModule[] = [
  { id: "users", route: "users", icon: TablerUsers, labelKey: "users" },                        // ti-users
  { id: "monitor", route: "monitor", icon: TablerActivity, labelKey: "monitor" },               // ti-activity
  { id: "files", route: "files", icon: TablerFolder, labelKey: "files" },                        // ti-folder
  { id: "firewall", route: "firewall", icon: TablerShieldLock, labelKey: "firewall" },           // ti-shield-lock
  { id: "bitninja", route: "bitninja", icon: TablerShieldCheck, labelKey: "bitninja" },          // ti-shield-check
  { id: "mail", route: "mail", icon: TablerMail, labelKey: "mail" },                             // ti-mail
  { id: "dns", route: "nginx", icon: BrandDns, labelKey: "dns" },                                // logo nginx (ruta /panel/nginx)
  { id: "backups", route: "backups", icon: BrandBackups, labelKey: "backups" },                  // logo backups
  { id: "cron", route: "cron", icon: TablerClock, labelKey: "cron" },                            // ti-clock
  { id: "databases", route: "databases", icon: TablerDatabase, labelKey: "databases" },          // ti-database
  { id: "obsidian", route: "obsidian", icon: BrandObsidian, labelKey: "obsidian" },              // logo Obsidian
  { id: "cloudflare", route: "cloudflare", icon: BrandCloudflare, labelKey: "cloudflare" },      // logo Cloudflare
  { id: "expo", route: "expo", icon: BrandExpo, labelKey: "expo" },                              // logo Expo
  { id: "repository-store", route: "repository-store", icon: TablerBrandGithub, labelKey: "repositoryStore" }, // ti-brand-github
  { id: "webhooks", route: "webhooks", icon: TablerWebhook, labelKey: "webhooks" },              // ti-webhook
  { id: "openclaw", route: "openclaw", icon: BrandOpenclaw, labelKey: "openclaw" },              // logo OpenClaw
  { id: "hosting", route: "hosting", icon: TablerBuilding, labelKey: "hosting" },
  { id: "project-map", route: "project-map", icon: TablerLayoutDashboard, labelKey: "projectMap" },
  { id: "codebase-graph", route: "codebase-graph", icon: TablerBrain, labelKey: "codebaseGraph" },                // ti-building
];

/**
 * Módulos CORE de LUXIPANEL que NO vienen en `available` (no son premium) pero el
 * panel siempre muestra: Notificaciones (server-alerts), Módulos, Mis módulos
 * (module-dev, creación/marketplace de módulos del developer) y Ajustes. Se añaden
 * SIEMPRE al final del selector. El `labelKey` resuelve `t.modules.labels`. El gating
 * fino (p. ej. `panel.module-dev`) lo aplica LUXIPANEL al navegar a la página.
 */
export const CORE_MODULES: LuxModule[] = [
  {id:"chat",route:"chat",icon:TablerMail,labelKey:"chat"},
  {id:"preferences",route:"preferences",icon:TablerSettings,labelKey:"preferences"},
  { id: "server-alerts", route: "server-alerts", icon: TablerBellRinging, labelKey: "serverAlerts" }, // ti-bell-ringing
  { id: "modules", route: "modules", icon: TablerPuzzle, labelKey: "modules" },                       // ti-puzzle
  { id: "module-dev", route: "module-dev", icon: TablerPackages, labelKey: "moduleDev" },             // ti-packages (Mis módulos)
  { id: "settings", route: "settings", icon: TablerSettings, labelKey: "settings" },                  // ti-settings
];

/**
 * Herramientas SSH de LUXIPANEL (Asistente IA + Terminal). Tienen VISTAS PROPIAS
 * con ruta dedicada FUERA de `/panel/` (`/assistant`, `/terminal`); el selector
 * "Más opciones" del app las ofrece como accesos que abren esa vista en su webview
 * (`openToolSession`, vía `next=`/nav SPA — ver `buildToolNextPath`). Se muestran
 * SOLO si el usuario SSH las tiene permitidas (flags `assistant`/`terminal` de
 * `ServerModulePermissions`, la misma condición que gatea sus botones en la portada
 * del servidor). El `route` es el id de la herramienta (= su slug de ruta).
 * Encabezan el selector, antes de los módulos.
 */
export const TOOL_MODULES: LuxModule[] = [
  { id: "assistant", route: "assistant", icon: TablerSparkles, labelKey: "assistant" }, // ti-sparkles
  { id: "terminal", route: "terminal", icon: TablerTerminal2, labelKey: "terminal" },    // ti-terminal-2
];

/** Icono por defecto para módulos no presentes en el registro (ti-puzzle, como
 *  el item "Módulos" del sidebar de LUXIPANEL). */
export const FALLBACK_MODULE_ICON: ModuleIcon = TablerPuzzle;

const MODULE_BY_ID = new Map([...TOOL_MODULES, ...LUX_MODULES, ...CORE_MODULES].map((m) => [m.id, m] as const));

export function moduleById(id: string): LuxModule | null {
  return MODULE_BY_ID.get(id) ?? null;
}

/** `/panel/<route>` para el deep-link SSO. */
export function buildModuleNextPath(route: string): string {
  return `/panel/${route}`;
}

/**
 * Ruta dedicada de una herramienta (Asistente IA / Terminal): su VISTA PROPIA vive
 * FUERA de `/panel/` (`/assistant`, `/terminal`). El SSO aterriza ahí con `next=` y
 * la navegación SPA dentro de una webview ya cargada la reutiliza.
 */
export function buildToolNextPath(tool: string): string {
  return `/${tool}`;
}

/**
 * Añade (o reemplaza) `next=<nextPath>` en la URL de redirect del SSO para que el
 * callback aterrice directamente en el módulo. Preserva el resto de la query
 * (p. ej. `session=`); `SshScreen.decorateLuxiUrl` añade luego `lxp_source=app`.
 */
export function appendNextParam(redirectUrl: string, nextPath: string): string {
  try {
    const u = new URL(redirectUrl);
    u.searchParams.set("next", nextPath);
    return u.toString();
  } catch {
    const sep = redirectUrl.includes("?") ? "&" : "?";
    return `${redirectUrl}${sep}next=${encodeURIComponent(nextPath)}`;
  }
}
