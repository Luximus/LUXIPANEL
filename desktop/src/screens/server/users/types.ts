/** Formas (defensivas) de los datos del módulo Usuarios devueltos por el panel
 *  a través del gateway / conexión directa. Copiado 1:1 de
 *  `app/src/screens/server/users/types.ts`. Campos opcionales: el backend varía
 *  según colector. */
export type ServerUser = {
  id: string | number;
  username: string;
  displayName?: string | null;
  email?: string | null;
  uid?: number;
  gid?: number;
  systemUid?: number;
  homeDir?: string;
  groups?: string[];
  modules?: string[];
  enabled?: boolean;
  lastLogin?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ServerRole = {
  name: string;
  kind?: "system" | "user" | string;
  members?: string[];
  modules?: string[];
  description?: string | null;
  /** Permission matrix attached to the group (when it has a record). Shape mirrors
   *  `RolePermissionsPayload`; typed loose because the backend may evolve it. */
  permissions?: RolePermissionsPayload | Record<string, unknown> | null;
  hasPermissions?: boolean;
};

export type UserFormPayload = {
  username: string;
  displayName?: string;
  email?: string;
  password?: string;
  groups: string[];
  enabled: boolean;
};

/** Per-group file-access policy (the "Servidor" tab → rutas). */
export type RoleFileAccess = {
  allowAll: boolean;
  allowPaths: string[];
  denyPaths: string[];
  readOnlyPaths: string[];
  /** Path the Files module opens to; null → first allowPath (or "/" when allowAll). */
  defaultPath: string | null;
};

/** Per-group command policy (the "Servidor" tab → comandos). */
export type RoleCommandPolicy = {
  allowAll: boolean;
  groups: string[];
  allowCommands: string[];
  denyCommands: string[];
};

/** The full permission matrix sent under `permissions` (replicates the web payload
 *  built by `collectRolePermissions` in LUXIPANEL's users index-script1.ts). */
export type RolePermissionsPayload = {
  sidebar: string[];
  views: string[];
  actions: string[];
  fileAccess: RoleFileAccess;
  commandPolicy: RoleCommandPolicy;
};

export type RoleFormPayload = {
  name: string;
  description?: string;
  /** Set only when renaming a user-created (non-system) group on edit. */
  newName?: string;
  /** Derived from the selected permissions (the backend re-derives too). */
  modules?: string[];
  /** Full permission matrix (Panel + Servidor tabs). */
  permissions?: RolePermissionsPayload;
};
