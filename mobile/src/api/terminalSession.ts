import { getPanelsData } from "./client/panels";
import { normalizeBaseUrl, reloginStandalone, type DirectSession } from "./directAuth";
import { connectWithSavedPanelCredentials } from "./panelHandoff";
import { getDirect, getDirectSessionRevision, registerDirectServer, type DirectTarget } from "./serverApi";
import { getDirectPanelSession, getDirectPanelUsername, getDirectPanelPassword, setDirectPanelSession } from "../storage/directPanelSession";
import { registerStoreReset } from "../lib/store-reset";

type Connection = { current: Set<() => boolean>; promise: Promise<boolean> };
const pending = new Map<string, Connection>();
let accountRevision = 0;
registerStoreReset(() => { accountRevision++; pending.clear(); });

/** Autentica dentro de la terminal, sin abrir pantallas de conexión.
 * Varias consolas del mismo servidor comparten el handoff en curso. */
export async function ensureDirectPanelSession(panelId: string, token: string, isCurrent: () => boolean = () => true): Promise<boolean> {
  if (!isCurrent()) return false;
  if (getDirect(panelId)) return true;
  // Local profiles never call the LP portal, even if a native bearer was passed as the UI token.
  if (panelId.startsWith("sa-") || panelId.startsWith("workspace:")) return false;
  if (!token) return false;
  const key = JSON.stringify([panelId, token]);
  const existing = pending.get(key);
  if (existing && [...existing.current].some(check => check())) {
    existing.current.add(isCurrent);
    return existing.promise;
  }
  const revision = getDirectSessionRevision(panelId);
  const account = accountRevision;
  const current = new Set([isCurrent]);
  const active = () => accountRevision === account && getDirectSessionRevision(panelId) === revision && [...current].some(check => check());
  const connection: Connection = { current, promise: Promise.resolve(false) };
  connection.promise = (async () => {
    try {
      const { panels } = await getPanelsData(token);
      if (!active()) return false;
      const panel = panels.find(item => item.id === panelId);
      const baseUrl = normalizeBaseUrl(panel?.customDomain ?? "");
      if (!panel || !baseUrl) return false;
      const saved = await getDirectPanelSession(panelId);
      if (!active()) return false;
      const authenticate = async (check: () => boolean): Promise<DirectSession | null> => {
        const session = await connectWithSavedPanelCredentials(panelId, token, baseUrl, panel.sshKeyId, check);
        if (session || !check()) return session;
        const [username, password] = await Promise.all([getDirectPanelUsername(panelId), getDirectPanelPassword(panelId)]);
        if (!check() || !username || !password) return null;
        return reloginStandalone(baseUrl, username, password);
      };
      const session = saved?.jwt && (saved.exp === 0 || saved.exp > Date.now() + 60_000) ? saved : await authenticate(active);
      if (!session?.jwt || !active()) return false;
      await setDirectPanelSession(panelId, session);
      if (!active()) return false;
      let refresh: Promise<DirectTarget | null> | null = null;
      const relogin = (): Promise<DirectTarget | null> => {
        if (refresh) return refresh;
        refresh = (async () => {
        const sessionRevision = getDirectSessionRevision(panelId);
        const check = () => accountRevision === account && getDirectSessionRevision(panelId) === sessionRevision;
        const fresh = await authenticate(check);
        if (!fresh?.jwt || !check()) return null;
        await setDirectPanelSession(panelId, fresh);
        if (!check()) return null;
        const target: DirectTarget = { baseUrl, ...fresh, relogin };
        registerDirectServer(panelId, target);
        return target;
        })().finally(() => { refresh = null; });
        return refresh;
      };
      registerDirectServer(panelId, { baseUrl, ...session, relogin });
      return true;
    } catch {
      return false;
    }
  })().finally(() => { if (pending.get(key) === connection) pending.delete(key); });
  pending.set(key, connection);
  return connection.promise;
}

/** Compatibilidad del host de consolas; todos los módulos comparten esta sesión. */
export const ensureTerminalSession = ensureDirectPanelSession;
