// Users page — shared module-level state (capabilities + session/tab).
// Leaf module: imports nothing from the other users submodules. Each mutable
// `let` lives here WITH its setter so importers read a live binding but never
// reassign it. `capabilities` is a const object: its fields are mutated in
// place (loadCapabilities / loadUsers), never reassigned, so it is imported
// directly.

export const capabilities = {
  usersView: false,
  usersCreate: false,
  usersEdit: false,
  usersDelete: false,
  rolesView: false,
  rolesCreate: false,
  rolesEdit: false,
  rolesDelete: false,
  /** Only members of the Linux `sudo`/`wheel` group may change another user's
   *  password (server-gated too). Derived from the caller's own row groups. */
  canChangePw: false,
};

/** Linux username of the current session (to locate the caller's own row). */
export let currentUsername = "";
export function setCurrentUsername(value: string) { currentUsername = value; }

/** Pestaña activa del módulo (Users | Roles). La visibilidad de los botones
 *  "register" del row de tabs depende de este valor + capabilities. */
export let activeUsersTab: "users" | "roles" = "users";
export function setActiveUsersTab(value: "users" | "roles") { activeUsersTab = value; }
