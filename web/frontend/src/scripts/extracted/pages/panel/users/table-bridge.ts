// Users page — DataTable bridge. Publishes rows to the two DataTable islands
// (users-main-table / roles-main-table), keeps the tab count badges in sync and
// owns the READY handshake LISTENER + the ready/cached state (incl. the
// idempotent-bind guard). The REQUEST_READY emit stays in the entry.
//
// F-09: el cuerpo publish/cache/ready estaba DUPLICADO dentro de este mismo
// fichero (uno por tabla); ahora ambas tablas comparten un `createTableFeed`.
// Lo único propio del módulo es refrescar los badges de conteo al publicar.
import { createTableFeed } from "/scripts/extracted/lib/datatable-events.js";

const USERS_TABLE_ID = "users-main-table";
const ROLES_TABLE_ID = "roles-main-table";

const feed = createTableFeed([USERS_TABLE_ID, ROLES_TABLE_ID]);

// Seed both caches so a READY that lands BEFORE the first fetch still receives
// an (empty) SET_DATA — that is what the previous hand-rolled bridge did with
// its `usersTableCachedRows = []` / `rolesTableCachedRows = []` initializers.
feed.publish(USERS_TABLE_ID, []);
feed.publish(ROLES_TABLE_ID, []);

export function publishUsersRows(rows: any[]) {
  feed.publish(USERS_TABLE_ID, Array.isArray(rows) ? rows : []);
  updateUsersTabCounts();
}

export function publishRolesRows(rows: any[]) {
  feed.publish(ROLES_TABLE_ID, Array.isArray(rows) ? rows : []);
  updateUsersTabCounts();
}

export function updateUsersTabCounts() {
  const usersBadge = document.getElementById("tab-users-count");
  const rolesBadge = document.getElementById("tab-roles-count");
  if (usersBadge) usersBadge.textContent = String((feed.cache[USERS_TABLE_ID] ?? []).length);
  // NOTE (split-only, non-observable): the monolith read `groups.length` here.
  // Reading the roles feed cache is equivalent — publishRolesRows fills it 1:1
  // with `groups` BEFORE calling this — and avoids a table-bridge ↔ groups cycle.
  if (rolesBadge) rolesBadge.textContent = String((feed.cache[ROLES_TABLE_ID] ?? []).length);
}

export function bindUsersTableReadyEvent() {
  feed.bindReady();
}
