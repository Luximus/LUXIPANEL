import { connectionMessages } from "../i18n/connections";
import {
  callServerApi,
  getDirect,
  registerDirectServer,
  unregisterDirectServer,
  unwrap,
  type DirectTarget,
} from "./serverApi";
import { ensureDirectPanelSession } from "./terminalSession";

export const workspaceContextId = (account: string, panel: string, target = "local") =>
  `workspace:${JSON.stringify([account, panel, target])}`;
/** Opaque context IDs partition every existing module/chat cache by account, panel and SSH target. */
export async function connectWorkspaceContext(
  account: string,
  panelId: string,
  token: string,
  targetId = "local",
  current = () => true,
): Promise<string> {
  const id = workspaceContextId(account, panelId, targetId);
  if (!current()) throw new Error("connect_required");
  if (targetId === "local" && getDirect(id)) return id;
  // An explicit remote selection renews its bridge, including an expired one.
  if (!(await ensureDirectPanelSession(panelId, token, current)))
    throw new Error("No se pudo conectar con las credenciales guardadas.");
  let parent = getDirect(panelId)!;
  let bridgeSessionId: string | undefined;
  if (targetId !== "local") {
    const nativeContext = panelId.startsWith("sa-");
    if (nativeContext) {
      // Probe before mutating: older servers rotate/revoke the parent on switch.
      const capabilities = await callServerApi(panelId, token, "GET", "/api/auth/native/capabilities");
      if (!current()) throw new Error("connect_required");
      if (!capabilities.ok || !unwrap<{workspaceContext?: boolean}>(capabilities)?.workspaceContext)
        throw new Error(connectionMessages().updateRequired);
    }
    // Legacy portal callers retain their previous renewal; native contexts keep the bearer.
    const result = await callServerApi(
      panelId,
      token,
      "POST",
      `/api/servers/${encodeURIComponent(targetId)}/switch`,
      nativeContext ? {sessionMode:"context"} : undefined,
    );
    if (!current()) throw new Error("connect_required");
    const switched = unwrap<{ bridgeSessionId?: string; sessionMode?: string }>(result);
    if (!result.ok || !switched?.bridgeSessionId)
      throw new Error(result.error ?? "No se pudo cambiar de servidor.");
    bridgeSessionId = switched.bridgeSessionId;
    if (switched.sessionMode !== "context") {
      const fresh = await parent.relogin?.();
      if (!current() || !fresh) throw new Error(connectionMessages().updateRequired);
      parent = fresh;
    }
  }
  const relogin = async (): Promise<DirectTarget | null> => {
    if (!getDirect(id)) return null;
    const fresh = await getDirect(panelId)?.relogin?.();
    if (!fresh || !getDirect(id)) return null;
    return getDirect(id) ?? null;
  };
  if (!current()) throw new Error("connect_required");
  registerDirectServer(id, {
    ...parent,
    parentPanelId: panelId,
    targetId,
    bridgeSessionId,
    relogin,
  });
  return id;
}
const owners = new Map<string, Set<symbol>>();
export function retainWorkspaceContext(id: string, owner: symbol) {
  const entries = owners.get(id) ?? new Set<symbol>();
  entries.add(owner);
  owners.set(id, entries);
}
export function disposeWorkspaceContext(id: string, owner?: symbol) {
  const entries = owners.get(id);
  if (owner && entries) {
    entries.delete(owner);
    if (entries.size) return;
  }
  owners.delete(id);
  unregisterDirectServer(id);
}

/** Authoritative escape route works even when the previous remote has expired. */
export async function returnWorkspaceToLocal(panelId: string, token: string): Promise<void> {
  const parent = getDirect(panelId);
  if (panelId.startsWith("sa-") && parent) return; // Switching visibility back to local never disposes other native terminals.
  if (!parent?.relogin) throw new Error("No se pudo renovar la sesión del panel.");
  const result = await callServerApi(panelId, token, "POST", "/api/servers/local/switch");
  if (!result.ok) throw new Error(result.error ?? "No se pudo volver al servidor local.");
  if (!(await parent.relogin())) throw new Error("No se pudo renovar la sesión del panel.");
}
