import { getContextPermissionAction } from "../../../shared/executor/context.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import path from "node:path";
import { moduleActionIds, actionRequiresAdmin } from "../../../shared/auth/module-actions.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { FileAccessGrant, CommandGrant } from "../../../shared/auth/group-policy.types.js";
import { isPathUnder } from "../../../shared/utils/path-containment.js";
import { panelConfigDir } from "@config/paths.js";
import { moduleRegistryService } from "../../admin/services/module-registry.service.js";

/** The per-server LUXIPANEL config dir holds secrets/policy and is vital to the
 *  platform. It must NEVER be reachable through group file access, regardless
 *  of allowPaths/allowAll. */
function luxipanelConfigDir(): string {
  return panelConfigDir();
}

export const SIDEBAR_ITEMS = [
  "dashboard",
  "mail",
  "monitor",
  "files",
  "firewall",
  "bitninja",
  "assistant",
  "dns",
  "backups",
  "cron",
  "webhooks",
  "users",
  "modules",
  "settings",
  "preferences",
  "hosting",
  "openclaw",
  "repository-store",
  // Shell features (not modules) that are individually gatable per group.
  "notifications",
  "search",
  "server-switcher",
] as const;

export const VIEW_IDS = [
  "panel.dashboard",
  "panel.mail",
  "panel.monitor",
  "panel.files",
  "panel.firewall",
  "panel.bitninja",
  "panel.assistant",
  "panel.dns",
  "panel.backups",
  "panel.cron",
  "panel.webhooks",
  "panel.ssl",
  "panel.users",
  "panel.modules",
  "panel.settings",
  "panel.preferences",
  "panel.hosting",
  "panel.openclaw",
  "panel.repository-store",
  "panel.notifications",
  "panel.search",
  "panel.server-switcher",
] as const;

/** Every file-module action, in display order. Single source for the catalog
 *  surface, the module defaults, and the allowed-bases endpoint. */
export const FILE_ACTION_IDS: string[] = [
  "files.view", "files.read", "files.write", "files.create", "files.upload",
  "files.download", "files.copy", "files.delete", "files.rename", "files.compress",
  "files.chmod", "files.chown", "files.search", "files.git", "files.history",
  "files.compare", "files.share", "files.security", "files.images", "files.projects",
  "files.tags", "files.copypath", "files.editpath", "files.tabs", "files.config",
  "files.hidden",
  "files.col.type", "files.col.size", "files.col.owner", "files.col.group",
  "files.col.modified", "files.col.perms",
];

export const USER_ACTION_IDS = ["users.view", "users.create", "users.edit", "users.delete", "roles.view", "roles.create", "roles.edit", "roles.delete"];
export const TERMINAL_ACTION_IDS = ["terminal.view", "terminal.open", "terminal.manage"];
export const ACTION_IDS = [...FILE_ACTION_IDS, ...USER_ACTION_IDS, ...TERMINAL_ACTION_IDS];

export const COMMAND_GROUPS = [
  "filesystem",
  "process",
  "network",
  "services",
  "packages",
  "users",
  "archives",
  "development",
  "monitoring",
  "misc",
] as const;

const COMMAND_GROUP_SET = new Set<string>(COMMAND_GROUPS);

export interface RolePermissionsData {
  version?: 2;
  sidebar: string[];
  views: string[];
  actions: string[];
  fileAccess: {
    allowAll: boolean;
    allowPaths: string[];
    denyPaths: string[];
    readOnlyPaths: string[];
    /** Path the Files module opens to on entry. null → fall back to the first
     *  allowPath (or "/" when allowAll). Must be inside the granted scope. */
    defaultPath: string | null;
    grants?: FileAccessGrant[];
  };
  commandPolicy: {
    allowAll: boolean;
    groups: string[];
    allowCommands: string[];
    denyCommands: string[];
    grants?: CommandGrant[];
  };
}

const EMPTY_PERMISSIONS: RolePermissionsData = {
  sidebar: [],
  views: [],
  actions: [],
  fileAccess: {
    allowAll: false,
    allowPaths: [],
    denyPaths: [],
    readOnlyPaths: [],
    defaultPath: null,
  },
  commandPolicy: {
    allowAll: false,
    groups: [],
    allowCommands: [],
    denyCommands: [],
  },
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort();
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return uniqueSorted(input.map((item) => String(item)));
}

function sanitizePathList(input: unknown): string[] {
  return normalizeStringList(input)
    .map((path) => (path.startsWith("/") ? path : `/${path}`))
    .map((value) => path.posix.normalize(value).replace(/\/+$/, "") || "/");
}

function defaultPermissionsFromModules(modules: string[]): RolePermissionsData {
  // Universal navigation everyone gets. "modules" (management page) is NOT here
  // anymore — it's a per-group gatable permission now.
  const sidebar = ["dashboard", "preferences"];
  const views = ["panel.dashboard", "panel.preferences"];
  const actions = ["files.read"];
  const moduleSet = new Set(modules);

  // Registry modules and shell features share the same editable surface.
  // Module-only legacy grants must also work for recently installed modules.
  for (const surface of getRolePermissionsCatalog().modules) {
    if (!moduleSet.has(surface.module)) continue;
    sidebar.push(...surface.sidebar);
    views.push(...surface.views);
    actions.push(...surface.actions);
  }

  return {
    sidebar: uniqueSorted(sidebar),
    views: uniqueSorted(views),
    actions: uniqueSorted(actions),
    fileAccess: {
      allowAll: moduleSet.has("admin") || moduleSet.has("files"),
      allowPaths: [],
      denyPaths: [],
      readOnlyPaths: [],
      defaultPath: null,
    },
    commandPolicy: {
      allowAll: moduleSet.has("admin"),
      groups: moduleSet.has("admin") ? [...COMMAND_GROUPS] : [],
      allowCommands: [],
      denyCommands: [],
    },
  };
}

export function normalizeRolePermissions(raw: unknown): RolePermissionsData {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_PERMISSIONS };
  }

  const input = raw as Record<string, unknown>;
  const catalog = getRolePermissionsCatalog();
  const sidebarIds = new Set(catalog.sidebarItems);
  const viewIds = new Set(catalog.views);
  const actionIds = new Set(catalog.actions);
  const actionPrefixes = new Set(catalog.actions.map((action) => `${action.split(".")[0]}.*`));
  const sidebar = normalizeStringList(input["sidebar"]).filter((item) => sidebarIds.has(item));
  const views = normalizeStringList(input["views"]).filter((item) => viewIds.has(item));
  const actions = normalizeStringList(input["actions"]).filter((item) => actionIds.has(item) || actionPrefixes.has(item));

  const fileAccessInput = (input["fileAccess"] ?? {}) as Record<string, unknown>;
  const rawDefault = typeof fileAccessInput["defaultPath"] === "string" ? fileAccessInput["defaultPath"] : "";
  const defaultPath = rawDefault.trim() ? sanitizePathList([rawDefault])[0] ?? null : null;
  const fileAccess = {
    allowAll: Boolean(fileAccessInput["allowAll"]),
    allowPaths: sanitizePathList(fileAccessInput["allowPaths"]),
    denyPaths: sanitizePathList(fileAccessInput["denyPaths"]),
    readOnlyPaths: sanitizePathList(fileAccessInput["readOnlyPaths"]),
    defaultPath,
  };

  const commandInput = (input["commandPolicy"] ?? {}) as Record<string, unknown>;
  const commandPolicy = {
    allowAll: Boolean(commandInput["allowAll"]),
    groups: normalizeStringList(commandInput["groups"]).filter((group) => COMMAND_GROUP_SET.has(group)),
    allowCommands: normalizeStringList(commandInput["allowCommands"]),
    denyCommands: normalizeStringList(commandInput["denyCommands"]),
  };

  return {
    version: 2,
    sidebar: uniqueSorted(sidebar),
    views: uniqueSorted(views),
    actions: uniqueSorted(actions.flatMap(a => a.endsWith(".*") ? catalog.actions.filter(id => id.startsWith(a.slice(0, -1))) : [a])),
    fileAccess,
    commandPolicy,
  };
}

export function buildEffectivePermissions(params: {
  rolePermissions: unknown;
  modules: string[];
  isAdminKind: boolean;
}): RolePermissionsData {
  if (params.isAdminKind) {
    return {
      sidebar: getRolePermissionsCatalog().sidebarItems,
      views: getRolePermissionsCatalog().views,
      actions: [...getRolePermissionsCatalog().actions, "users.*", "roles.*", "files.*", "terminal.*"],
      fileAccess: {
        allowAll: true,
        allowPaths: ["/"],
        denyPaths: [],
        readOnlyPaths: [],
        defaultPath: null,
      },
      commandPolicy: {
        allowAll: true,
        groups: [...COMMAND_GROUPS],
        allowCommands: [],
        denyCommands: [],
      },
    };
  }

  const defaults = defaultPermissionsFromModules(params.modules);
  const normalizedRole = normalizeRolePermissions(params.rolePermissions);

  // Universal navigation every authenticated user must always see, regardless
  // of which Linux groups they belong to. An explicit group permission record
  // REPLACES the module-derived sidebar/views (intentional, to scope a group),
  // so without this the base (Dashboard / Módulos / Preferencias) would vanish
  // for any user whose groups carry an explicit list — leaving a broken menu.
  const baseSidebar = ["dashboard", "preferences"];
  const baseViews = ["panel.dashboard", "panel.preferences"];

  // fileAccess / commandPolicy: a group record only carries these when the
  // admin explicitly configured the "rutas"/"comandos" sections. When it
  // didn't, fall back to the module-derived defaults (e.g. the `files` module
  // grants allowAll) — otherwise a group with the files module but no explicit
  // path config would load the view yet be denied every path (the "carga vista
  // pero sin datos" bug). An explicit role config still narrows/overrides.
  const roleGrantsFileAccess =
    normalizedRole.fileAccess.allowAll ||
    normalizedRole.fileAccess.allowPaths.length > 0 ||
    normalizedRole.fileAccess.readOnlyPaths.length > 0 ||
    normalizedRole.fileAccess.denyPaths.length > 0;
  const roleGrantsCommands =
    normalizedRole.commandPolicy.allowAll ||
    normalizedRole.commandPolicy.groups.length > 0 ||
    normalizedRole.commandPolicy.allowCommands.length > 0 || normalizedRole.commandPolicy.denyCommands.length > 0;

  // "Configured" = the group made ANY explicit selection. When configured we
  // use EXACTLY what was selected (so unchecking actions actually removes them
  // — no silent fallback to the module's full default action set). The defaults
  // only apply to the UNCONFIGURED case: a module-level grant with an empty
  // matrix (e.g. the per-user `modules` override path), where there are no
  // checkboxes to honor.
  const isConfigured =
    (params.rolePermissions as { version?: number } | null)?.version === 2 ||
    normalizedRole.sidebar.length > 0 ||
    normalizedRole.views.length > 0 ||
    normalizedRole.actions.length > 0 ||
    roleGrantsFileAccess ||
    roleGrantsCommands;

  return {
    sidebar: uniqueSorted([
      ...baseSidebar,
      ...(isConfigured ? normalizedRole.sidebar : defaults.sidebar),
    ]),
    views: uniqueSorted([
      ...baseViews,
      ...(isConfigured ? normalizedRole.views : defaults.views),
    ]),
    actions: isConfigured ? uniqueSorted([...normalizedRole.actions,
      ...((params.rolePermissions as { version?: number } | null)?.version === 2 ? [] :
        getRolePermissionsCatalog().modules.filter(m => params.modules.includes(m.module) && m.views.some(v => normalizedRole.views.includes(v)))
          .flatMap(m => moduleActionIds(m.module)).filter(a => !actionRequiresAdmin(a)))]) : defaults.actions,
    fileAccess: roleGrantsFileAccess ? normalizedRole.fileAccess : (isConfigured ? { ...EMPTY_PERMISSIONS.fileAccess } : defaults.fileAccess),
    commandPolicy: roleGrantsCommands ? normalizedRole.commandPolicy : (isConfigured ? { ...EMPTY_PERMISSIONS.commandPolicy } : defaults.commandPolicy),
  };
}

/**
 * Merge a list of already-effective permission matrices into one, using the
 * MOST-PERMISSIVE union semantics (a user belonging to several Linux groups
 * gets the SUM of their capabilities):
 *   - allowAll flags        → OR (any group grants it → granted)
 *   - sidebar/views/actions
 *     allowPaths/readOnly
 *     command groups/allow   → UNION
 *   - denyPaths/denyCommands → INTERSECTION: a deny only sticks if EVERY
 *     contributing group denies it; otherwise another group's grant wins.
 *     (With a single group, intersection == that group, so behavior is
 *     unchanged for the common case.)
 * The flattened fields above summarize the matrix for UI/legacy consumers.
 * Atomic `grants` retain each group's restrictions for authorization: an
 * unrelated group cannot erase a deny, and a write grant only wins where it
 * covers the same path. Empty list → EMPTY_PERMISSIONS.
 */
export function mergeRolePermissions(list: RolePermissionsData[]): RolePermissionsData {
  if (list.length === 0) return { ...EMPTY_PERMISSIONS };
  if (list.length === 1) return list[0]!;

  const intersect = (lists: string[][]): string[] => {
    if (lists.length === 0) return [];
    return uniqueSorted(
      lists.reduce((acc, cur) => acc.filter((item) => cur.includes(item)), [...lists[0]!]),
    );
  };

  return {
    sidebar: uniqueSorted(list.flatMap((p) => p.sidebar)),
    views: uniqueSorted(list.flatMap((p) => p.views)),
    actions: uniqueSorted(list.flatMap((p) => p.actions)),
    fileAccess: {
      allowAll: list.some((p) => p.fileAccess.allowAll),
      allowPaths: uniqueSorted(list.flatMap((p) => p.fileAccess.allowPaths)),
      denyPaths: intersect(list.map((p) => p.fileAccess.denyPaths)),
      readOnlyPaths: uniqueSorted(list.flatMap((p) => p.fileAccess.readOnlyPaths)),
      defaultPath: list.map((p) => p.fileAccess.defaultPath).find((d) => !!d) ?? null,
      grants: list.flatMap((p) => p.fileAccess.grants ?? [{ ...p.fileAccess, actions: p.actions }]),
    },
    commandPolicy: {
      allowAll: list.some((p) => p.commandPolicy.allowAll),
      groups: uniqueSorted(list.flatMap((p) => p.commandPolicy.groups)),
      allowCommands: uniqueSorted(list.flatMap((p) => p.commandPolicy.allowCommands)),
      denyCommands: intersect(list.map((p) => p.commandPolicy.denyCommands)),
      grants: list.flatMap((p) => p.commandPolicy.grants ?? [{ ...p.commandPolicy, actions: p.actions }]),
    },
  };
}

/**
 * Shared grant check: admins always pass; otherwise the value must be listed
 * in `user.permissions[field]` or covered by a `"*"` wildcard. When
 * `withPrefix` is set, a `"<prefix>.*"` wildcard (prefix = text before the
 * first dot) also grants access — used for dotted action ids.
 */
function hasGrant(
  user: SessionUser,
  field: "sidebar" | "views" | "actions",
  value: string,
  withPrefix = false,
): boolean {
  if (user.kind === "admin") return true;
  const list = user.permissions?.[field] ?? [];
  if (list.includes(value) || list.includes("*")) return true;
  if (withPrefix) {
    const prefix = value.split(".")[0];
    return prefix ? list.includes(`${prefix}.*`) : false;
  }
  return false;
}

export function hasActionPermission(user: SessionUser, action: string): boolean {
  return hasGrant(user, "actions", action, true);
}

export function hasViewPermission(user: SessionUser, view: string): boolean {
  return hasGrant(user, "views", view);
}

export function hasSidebarPermission(user: SessionUser, sidebarItem: string): boolean {
  return hasGrant(user, "sidebar", sidebarItem);
}

function matchesPathPrefix(path: string, rule: string): boolean {
  if (rule === "/") return true;
  return isPathUnder(rule, path);
}

export function canAccessPath(user: SessionUser, targetPath: string, operation: "read" | "write", action = getContextPermissionAction()): boolean {
  if (user.kind === "admin") return true;
  const policy = user.permissions?.fileAccess;
  if (!policy) return false;
  // SECURITY: resolve `..`/`.` segments BEFORE the prefix-match. Without this a
  // user allowed `/var/www/site` could request `/var/www/site/../../etc/shadow`
  // — the raw string still starts with the allowed prefix yet escapes the jail.
  // path.posix.resolve collapses traversal against an absolute root so the
  // prefix comparison is done on the real target.
  const absolute = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  const normalizedPath = path.posix.resolve("/", absolute).replace(/\/+$/, "") || "/";

  // Hard guard: never expose the LUXIPANEL config dir to non-admin file access.
  if (matchesPathPrefix(normalizedPath, luxipanelConfigDir())) {
    return false;
  }

  // A different group only overrides a restriction when it actually grants
  // this path/operation. Unrelated groups must not erase another group's deny.
  return (policy.grants ?? [policy] as FileAccessGrant[]).some((grant) => {
    if (action && grant.actions && !grant.actions.includes(action)) return false;
    if (grant.denyPaths.some((rule) => matchesPathPrefix(normalizedPath, rule))) return false;
    if (operation === "write" && grant.readOnlyPaths.some((rule) => matchesPathPrefix(normalizedPath, rule))) return false;
    return grant.allowAll || grant.allowPaths.some((rule) => matchesPathPrefix(normalizedPath, rule));
  });
}

/**
 * Command → group taxonomy as a data table. Ordered list with first-match-wins
 * semantics (preserves the precedence of the former if-chain). The command sets
 * are disjoint, so order is not strictly load-bearing today, but keeping it
 * ordered guarantees identical results if a command is ever listed twice.
 */
const COMMAND_GROUP_TABLE: Array<{ group: string; commands: ReadonlySet<string> }> = [
  { group: "filesystem", commands: new Set(["ls", "cat", "less", "more", "head", "tail", "find", "locate", "pwd", "tree", "du", "df", "stat", "file", "touch", "mkdir", "rmdir", "cp", "mv", "rm", "chmod", "chown", "chgrp", "ln", "realpath", "basename", "dirname"]) },
  { group: "process", commands: new Set(["ps", "top", "htop", "kill", "killall", "pkill", "nice", "renice", "nohup", "jobs", "bg", "fg"]) },
  { group: "network", commands: new Set(["ip", "ifconfig", "ping", "traceroute", "ss", "netstat", "nc", "nmap", "curl", "wget", "dig", "nslookup", "host"]) },
  { group: "services", commands: new Set(["systemctl", "service", "journalctl", "dmesg", "loginctl"]) },
  { group: "packages", commands: new Set(["apt", "apt-get", "dpkg", "yum", "dnf", "rpm", "snap", "flatpak"]) },
  { group: "users", commands: new Set(["useradd", "usermod", "userdel", "passwd", "groupadd", "groupmod", "groupdel", "id", "su", "sudo", "chage"]) },
  { group: "archives", commands: new Set(["tar", "zip", "unzip", "gzip", "gunzip", "bzip2", "xz", "7z"]) },
  { group: "development", commands: new Set(["git", "node", "npm", "pnpm", "yarn", "python", "python3", "pip", "pip3", "go", "cargo", "make", "cmake", "docker", "docker-compose", "opencode", "codex", "claude"]) },
  { group: "monitoring", commands: new Set(["free", "vmstat", "iostat", "uptime", "sar", "lsof", "who", "w", "last"]) },
];

export function detectCommandGroup(command: string): string {
  const token = command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!token) return "misc";

  for (const { group, commands } of COMMAND_GROUP_TABLE) {
    if (commands.has(token)) return group;
  }
  return "misc";
}

function commandMatchesRule(command: string, rule: string): boolean {
  if (rule === "*") return true;
  if (rule.endsWith("*")) {
    const prefix = rule.slice(0, -1).toLowerCase();
    return command.toLowerCase().startsWith(prefix);
  }
  return command.toLowerCase() === rule.toLowerCase();
}

/**
 * Split a command line into the individual commands a shell would run, so a
 * deny rule can't be bypassed by chaining (`git; rm -rf /`, `ls && curl evil`,
 * `cat $(rm x)`). We split on shell metacharacters: `;`, `&&`, `||`, `|`,
 * newlines, command substitution `$(` / backticks. This is intentionally
 * over-inclusive (it may split inside quotes/strings); the effect is only to
 * surface MORE segments for the deny/allow check, which is the safe direction.
 */
function splitCommandSegments(command: string): string[] {
  return command
    .split(/[\n;&|`]|\$\(|\)/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

/** Evaluate ONE shell segment against the policy. */
function segmentAllowed(
  policy: NonNullable<SessionUser["permissions"]>["commandPolicy"],
  segment: string,
): boolean {
  if (policy.denyCommands.some((rule) => commandMatchesRule(segment, rule))) return false;
  if (policy.allowCommands.some((rule) => commandMatchesRule(segment, rule))) return true;
  if (policy.allowAll) return true;
  const group = detectCommandGroup(segment);
  return policy.groups.includes(group);
}

export function canExecuteCommand(user: SessionUser, command: string): boolean {
  if (user.kind === "admin") return true;
  const policy = user.permissions?.commandPolicy;
  if (!policy) return false;

  const normalized = command.trim().toLowerCase();
  if (!normalized) return true;

  // Evaluate EVERY chained segment: a single denied/unauthorized segment fails
  // the whole line (`git; rm -rf /` must not pass just because `git` is allowed).
  const segments = splitCommandSegments(normalized);
  if (segments.length === 0) return true;
  const action = getContextPermissionAction();
  return segments.every((segment) => (policy.grants ?? [policy] as CommandGrant[]).some((grant) => (!action || !grant.actions || grant.actions.includes(action)) && segmentAllowed(grant, segment)));
}

/**
 * Per-module breakdown of the panel permissions (menu / vistas-rutas /
 * acciones-forms). Powers the group dialog's per-module sub-tabs and the
 * reverse derivation of a group's `modules[]` from its selected permissions.
 * fileAccess + commandPolicy stay global (the dialog's "Servidor" tab).
 */
export interface ModuleCatalogEntry {
  module: string;
  label: string;
  sidebar: string[];
  views: string[];
  actions: string[];
}

/**
 * Per-module permission SURFACE, keyed by module id. This is the editable
 * "permission list of each module"; the LIST of modules shown in the group
 * dialog is sourced DYNAMICALLY from the module registry (so new/dynamic
 * modules appear automatically). A module id not listed here falls back to a
 * default derived from its id (sidebar=[id], view=panel.<id>, no actions) —
 * only valid ids survive (filtered against the SIDEBAR/VIEW/ACTION sets).
 */
const MODULE_SURFACES: Record<string, { sidebar: string[]; views: string[]; actions: string[] }> = {
  files: { sidebar: ["files"], views: ["panel.files"], actions: [...FILE_ACTION_IDS] },
  users: { sidebar: ["users"], views: ["panel.users"], actions: [...USER_ACTION_IDS] },
  // Terminal has no sidebar/view of its own (it's the global floating button);
  // it's gated purely by these actions, so a group can be granted it WITHOUT
  // becoming admin.
  terminal: { sidebar: [], views: [], actions: [...TERMINAL_ACTION_IDS] },
};

/** Ids NOT offered as assignable permission entries: `dashboard` is the
 *  universal "home" id (the home page is the Agentes IA view; there is no
 *  dashboard catalog row any more, kept here defensively). */
const CATALOG_HIDDEN_MODULES = new Set(["dashboard"]);

/** Gatable shell features / privilege bundles that are NOT module-registry
 *  entries (no catalog row of their own) but remain assignable per group. */
const SHELL_FEATURE_MODULES: ModuleCatalogEntry[] = [
  // NOTE: terminal.* is intentionally NOT in the admin bundle — terminal is its
  // own assignable permission (granting it must not make the group admin).
  { module: "admin", label: "Administración", sidebar: ["settings"], views: ["panel.settings"], actions: ["files.chmod", "files.chown"] },
  { module: "modules", label: "Módulos (gestión)", sidebar: ["modules"], views: ["panel.modules"], actions: [] },
  { module: "notifications", label: "Notificaciones", sidebar: ["notifications"], views: ["panel.notifications"], actions: [] },
  { module: "search", label: "Búsqueda", sidebar: ["search"], views: ["panel.search"], actions: [] },
  { module: "server-switcher", label: "Selección de panel/servidor", sidebar: ["server-switcher"], views: ["panel.server-switcher"], actions: [] },
];

interface RegistryModuleLike {
  id: string;
  name: string;
  kind?: string;
  /** Optional surface declared by the module itself (future dynamic modules). */
  permissions?: { sidebar?: string[]; views?: string[]; actions?: string[] };
}

function defaultSurface(id: string): { sidebar: string[]; views: string[]; actions: string[] } {
  return {
    sidebar: [id],
    views: [`panel.${id}`],
    actions: moduleActionIds(id),
  };
}

/** Human-readable description for every permission id (menus, views, actions,
 *  command groups), shown next to each checkbox in the group dialog. */
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  // ── Menús (sidebar) ──
  dashboard: "Menú: inicio (Agentes IA)",
  mail: "Menú: correo (dominios y buzones)",
  monitor: "Menú: monitor del servidor",
  files: "Menú: explorador de archivos",
  firewall: "Menú: firewall (reglas y bloqueos)",
  bitninja: "Menú: BitNinja (agente de seguridad)",
  assistant: "Menú: asistente IA",
  dns: "Menú: NGINX / sitios y dominios",
  backups: "Menú: copias de seguridad",
  cron: "Menú: tareas programadas (cron)",
  webhooks: "Menú: webhooks",
  ssl: "Menú: certificados SSL",
  users: "Menú: usuarios y grupos",
  modules: "Menú: gestión de módulos",
  settings: "Menú: ajustes del panel",
  preferences: "Menú: preferencias personales",
  hosting: "Menú: hosting",
  openclaw: "Menú: OpenClaw",
  "repository-store": "Menú: tienda de repositorios",
  notifications: "Menú: notificaciones",
  search: "Menú: búsqueda global",
  "server-switcher": "Menú: selector de servidor/panel",
  // ── Vistas (acceso a la página) ──
  "panel.dashboard": "Abrir la página de inicio (Agentes IA)",
  "panel.mail": "Abrir la página de correo",
  "panel.monitor": "Abrir la página de monitor",
  "panel.files": "Abrir la página de archivos",
  "panel.firewall": "Abrir la página de firewall",
  "panel.bitninja": "Abrir la página de BitNinja",
  "panel.assistant": "Abrir la página del asistente IA",
  "panel.dns": "Abrir la página de NGINX",
  "panel.backups": "Abrir la página de backups",
  "panel.cron": "Abrir la página de cron",
  "panel.webhooks": "Abrir la página de webhooks",
  "panel.ssl": "Abrir la página de SSL",
  "panel.users": "Abrir la página de usuarios",
  "panel.modules": "Abrir la página de módulos",
  "panel.settings": "Abrir la página de ajustes",
  "panel.preferences": "Abrir la página de preferencias",
  "panel.hosting": "Abrir la página de hosting",
  "panel.openclaw": "Abrir la página de OpenClaw",
  "panel.repository-store": "Abrir la tienda de repositorios",
  "panel.notifications": "Abrir la página de notificaciones",
  "panel.search": "Abrir la búsqueda global",
  "panel.server-switcher": "Abrir el selector de servidor",
  // ── Acciones: usuarios/grupos ──
  "users.view": "Ver la lista de usuarios",
  "users.create": "Crear usuarios",
  "users.edit": "Editar usuarios",
  "users.delete": "Eliminar usuarios",
  "roles.view": "Ver grupos y sus permisos",
  "roles.create": "Crear grupos",
  "roles.edit": "Editar permisos de grupos",
  "roles.delete": "Eliminar grupos",
  // ── Acciones: archivos ──
  "files.view": "Navegar archivos y carpetas",
  "files.read": "Leer / abrir el contenido de archivos",
  "files.write": "Editar y guardar archivos",
  "files.create": "Crear archivos y carpetas",
  "files.upload": "Subir archivos",
  "files.download": "Descargar archivos",
  "files.copy": "Copiar y pegar",
  "files.delete": "Eliminar archivos y carpetas",
  "files.rename": "Renombrar y mover",
  "files.compress": "Comprimir y extraer (ZIP)",
  "files.chmod": "Cambiar permisos (chmod)",
  "files.chown": "Cambiar propietario (chown)",
  "files.search": "Buscar por nombre y en contenido",
  "files.git": "Operaciones Git (commit, push, clone…)",
  "files.history": "Historial, versiones y snapshots",
  "files.compare": "Comparar carpetas",
  "files.share": "Crear enlaces para compartir",
  "files.security": "Escaneos de seguridad (malware, exposición, limpieza)",
  "files.images": "Optimización de imágenes",
  "files.projects": "Proyectos y mapa del proyecto",
  "files.tags": "Etiquetas y notas de archivos",
  "files.copypath": "Botón: copiar ruta",
  "files.editpath": "Editar la barra de ruta manualmente",
  "files.tabs": "Abrir varias pestañas de gestor",
  "files.config": "Botón de configuración (barra superior)",
  "files.hidden": "Ver carpetas y archivos ocultos",
  "files.col.type": "Columna: Tipo",
  "files.col.size": "Columna: Tamaño",
  "files.col.owner": "Columna: Propietario",
  "files.col.group": "Columna: Grupo",
  "files.col.modified": "Columna: Modificado",
  "files.col.perms": "Columna: Permisos",
  // ── Acciones: terminal ──
  "terminal.view": "Ver la terminal flotante",
  "terminal.open": "Abrir y ejecutar en la terminal",
  "terminal.manage": "Gestionar sesiones de terminal",
  // ── Grupos de comandos (terminal) ──
  filesystem: "Comandos de sistema de archivos",
  process: "Comandos de procesos",
  network: "Comandos de red",
  services: "Comandos de servicios",
  packages: "Comandos de paquetes",
  archives: "Comandos de compresión",
  development: "Comandos de desarrollo",
  monitoring: "Comandos de monitoreo",
  misc: "Otros comandos",
};

/** Build the panel permission catalog from the dynamic module registry list.
 *  modules = registry modules (minus mcp servers + hidden) mapped to their
 *  surface, plus the static shell-feature bundles. sidebar/views/actions are
 *  the union of all entries (filtered to known ids). */
export function buildRolePermissionsCatalog(registryModules: RegistryModuleLike[]) {
  const fromRegistry: ModuleCatalogEntry[] = registryModules
    .filter((m) => !CATALOG_HIDDEN_MODULES.has(m.id))
    .map((m) => {
      const base = MODULE_SURFACES[m.id] ?? defaultSurface(m.id);
      const surf = m.permissions
        ? {
            sidebar: m.permissions.sidebar ?? base.sidebar,
            views: m.permissions.views ?? base.views,
            actions: m.permissions.actions ?? base.actions,
          }
        : base;
      return { module: m.id, label: m.name, ...surf, actions: [...new Set([...surf.actions, ...moduleActionIds(m.id)])] };
    });

  const byId = new Map(fromRegistry.map(m => [m.module, m]));
  for (const m of SHELL_FEATURE_MODULES) if (!byId.has(m.module)) byId.set(m.module, { ...m, actions: [...new Set([...m.actions, ...moduleActionIds(m.module)])] });
  const modules = [...byId.values()];
  return {
    version: 2 as const,
    actionMetadata: Object.fromEntries(modules.flatMap(m => m.actions.map(id => [id, { module: m.module, adminOnly: actionRequiresAdmin(id) || registryModules.some(entry => entry.id === m.module && entry.kind === "mcp_server"), labelKey: `permissions.operations.${id.split(".").at(-1)}` }]))),
    sidebarItems: uniqueSorted([...SIDEBAR_ITEMS, ...modules.flatMap((m) => m.sidebar)]),
    views: uniqueSorted([...VIEW_IDS, ...modules.flatMap((m) => m.views)]),
    actions: uniqueSorted([...ACTION_IDS, ...modules.flatMap((m) => m.actions)]),
    commandGroups: [...COMMAND_GROUPS],
    modules,
    descriptions: PERMISSION_DESCRIPTIONS,
  };
}

/** Resolve the catalog from the live registry. */
export function getRolePermissionsCatalog() {
  return buildRolePermissionsCatalog(moduleRegistryService.getAll());
}

/**
 * Canonical set of every group-assignable module slug, sourced from the SAME
 * dynamic catalog that {@link deriveModulesFromPermissions} iterates (registry
 * modules ⊕ shell-feature bundles, minus hidden/mcp). This is the SSOT for
 * "all modules a group can hold": the `admin` group's `modules[]` and hosting's
 * allowed-module validation both derive from here so they can never drift from
 * the catalog again (previously a hand-maintained literal went stale). Includes
 * `admin` (the privilege marker) so an admin group stays admin kind.
 */
export function assignableModuleSlugs(): string[] {
  return uniqueSorted(getRolePermissionsCatalog().modules.map((m) => m.module));
}

/** A hidden menu is independent of the permission to use a module's view/API. */
export function canUseModule(user: SessionUser, module: string): boolean {
  if (user.kind === "admin") return true;
  if (!user.modules.includes(module)) return false;
  const views = getRolePermissionsCatalog().modules.find((entry) => entry.module === module)?.views ?? [];
  return views.length === 0 || views.some((view) => hasViewPermission(user, view));
}

/**
 * Derive a group's `modules[]` (which drive requireModule gating + admin
 * detection) from its selected panel permissions: a module is "on" if ANY of
 * its menu/view/action items is selected. Sourced from the dynamic catalog.
 */
export function deriveModulesFromPermissions(raw: unknown): string[] {
  const p = normalizeRolePermissions(raw);
  const sidebar = new Set(p.sidebar);
  const views = new Set(p.views);
  const actions = new Set(p.actions);
  const modules: string[] = [];
  for (const m of getRolePermissionsCatalog().modules) {
    // chmod/chown are file operations, not a grant of unrestricted admin.
    // Only an explicit administration menu/view selects that privilege bundle.
    const on =
      m.sidebar.some((s) => sidebar.has(s)) ||
      m.views.some((v) => views.has(v)) ||
      (m.module !== "admin" && m.actions.some((a) => actions.has(a) || actions.has(`${a.split(".")[0]}.*`)));
    if (on) modules.push(m.module);
  }
  return modules;
}

/** Strict write validation; legacy readers remain tolerant during migration. */
export function validateRolePermissions(raw: unknown): RolePermissionsData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid permission matrix");
  const input = raw as Record<string, unknown>, catalog = getRolePermissionsCatalog();
  for (const field of ["sidebar", "views", "actions"] as const) {
    const values = input[field];
    if (values === undefined) continue;
    const allowed = field === "sidebar" ? catalog.sidebarItems : catalog[field];
    if (!Array.isArray(values) || values.some(id => typeof id !== "string" || (!allowed.includes(id) && !(field === "actions" && id.endsWith(".*") && catalog.actions.some(a => a.startsWith(id.slice(0, -1))))))) throw new Error(`Unknown ${field} permission`);
  }
  const file = input.fileAccess as Record<string, unknown> | undefined;
  for (const field of ["allowPaths", "denyPaths", "readOnlyPaths"] as const) {
    if (file?.[field] === undefined) continue;
    if (!Array.isArray(file[field]) || (file[field] as unknown[]).some(p => typeof p !== "string" || !p.startsWith("/") || /[\x00-\x1f\x7f]/.test(p) || p.includes("\\"))) throw new Error("File rules require absolute Unix paths");
  }
  if (file?.defaultPath != null && (typeof file.defaultPath !== "string" || (file.defaultPath !== "" && (!file.defaultPath.startsWith("/") || /[\x00-\x1f\x7f\\]/.test(file.defaultPath))))) throw new Error("Default path requires an absolute Unix path");
  for (const section of ["fileAccess", "commandPolicy"]) {
    const value = input[section];
    if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) throw new Error("Invalid security policy");
    if (value && (value as Record<string, unknown>).allowAll !== undefined && typeof (value as Record<string, unknown>).allowAll !== "boolean") throw new Error("Invalid allowAll flag");
  }
  const result = normalizeRolePermissions(raw), start = result.fileAccess.defaultPath;
  if (start && (!result.fileAccess.allowAll && !result.fileAccess.allowPaths.some(root => matchesPathPrefix(start, root)) || result.fileAccess.denyPaths.some(root => matchesPathPrefix(start!, root)))) throw new Error("Default path is outside allowed paths");
  const command = input.commandPolicy as Record<string, unknown> | undefined;
  if (command?.groups !== undefined && (!Array.isArray(command.groups) || command.groups.some(g => typeof g !== "string" || !COMMAND_GROUP_SET.has(g)))) throw new Error("Unknown command group");
  for (const field of ["allowCommands", "denyCommands"]) {
    if (command?.[field] !== undefined && (!Array.isArray(command[field]) || (command[field] as unknown[]).some(c => typeof c !== "string" || !c.trim() || /[\x00-\x1f\x7f]/.test(c)))) throw new Error("Invalid command rule");
  }
  return result;
}
