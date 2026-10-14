// Users page — session capability resolution (which user/role actions the
// caller may perform) from GET /api/session.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { capabilities, setCurrentUsername } from "./state";
import { refreshTabActionButtons } from "./tabs";

export function hasAction(action: string, session: any): boolean {
  const user = session?.user;
  if (!user) return false;
  if (user.kind === "admin") return true;
  const actions = Array.isArray(user.permissions?.actions) ? user.permissions.actions as string[] : [];
  if (actions.includes(action) || actions.includes("*")) return true;
  const prefix = action.split(".")[0];
  return Boolean(prefix && actions.includes(`${prefix}.*`));
}

export async function loadCapabilities() {
  const res = await api.get<any>("/api/session");
  const session = res.ok ? res.data ?? res : null;

  capabilities.usersView = hasAction("users.view", session);
  capabilities.usersCreate = hasAction("users.create", session);
  capabilities.usersEdit = hasAction("users.edit", session);
  capabilities.usersDelete = hasAction("users.delete", session);
  capabilities.rolesView = hasAction("roles.view", session);
  capabilities.rolesCreate = hasAction("roles.create", session);
  capabilities.rolesEdit = hasAction("roles.edit", session);
  capabilities.rolesDelete = hasAction("roles.delete", session);
  setCurrentUsername(session?.user?.username ?? "");

  // Re-aplicar visibilidad de los botones del row de tabs respetando la
  // pestaña activa (loadCapabilities puede correr DESPUÉS de bindTabs, así
  // que si solo usamos capability aquí, ambos botones quedan visibles cuando
  // el usuario tiene ambos permisos).
  refreshTabActionButtons();
}
