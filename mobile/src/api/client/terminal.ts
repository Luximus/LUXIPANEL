import { getPublicPanelBranding } from "./panels";
import { callServerApi, getDirect, unwrap } from "../serverApi";

/** Autoriza cada conexión contra el box y usa un token WS de corta duración.
 * Nunca enviar el token del portal ni el JWT de sesión en la URL. */
export async function buildTerminalWsUrl(
  panelId: string,
  token: string,
  size?: { cols: number; rows: number },
  sessionId?: string,
): Promise<string> {
  const target = getDirect(panelId);
  if (!target) throw new Error("connect_required");
  const auth = await callServerApi(panelId, token, "GET", "/api/auth/ws-token");
  const ticket = unwrap<{ token?: string }>(auth)?.token;
  if (!ticket) throw new Error(auth.error ?? "auth_required");
  // No abrir una conexión tardía después de olvidar/cambiar el servidor.
  const current = getDirect(panelId);
  if (!current || current.baseUrl !== target.baseUrl || current.jwt !== target.jwt || current.bridgeSessionId !== target.bridgeSessionId) throw new Error("connect_required");
  const base = current.baseUrl.replace(/\/$/, "").replace(/^http/, "ws");
  const q = new URLSearchParams({ token: ticket });
  if (current.bridgeSessionId) q.set("bridge", current.bridgeSessionId);
  if (size) { q.set("cols", String(size.cols)); q.set("rows", String(size.rows)); }
  // sessionId estable por consola → el backend envuelve la sesión en tmux y la
  // reconexión re-adjunta la MISMA sesión (sobrevive al background del móvil).
  if (sessionId) q.set("sessionId", sessionId);
  return `${base}/api/terminal/ws?${q.toString()}`;
}

/** Cierra el PTY activo de la consola en el box (best-effort). */
export async function killTerminalSession(panelId: string, token: string, sessionId: string): Promise<void> {
  try {
    await callServerApi(panelId, token, "DELETE", `/api/terminal/sessions/${encodeURIComponent(sessionId)}`);
  } catch {
    /* best-effort: si falla, el reaper/limpieza server-side lo recogerá */
  }
}

export type TerminalTmuxStatus = {
  installed: boolean;
  canInstall: boolean;
  packageManager: string | null;
  reason?: string;
};

/** Preflight del terminal nativo: ¿tmux está instalado en el servidor del panel?
 *  tmux es lo que permite RE-ADJUNTAR la sesión tras un corte del WS (background).
 *  NO bloquea: ante cualquier fallo devuelve installed:true (abrir igual). */
export async function getTerminalTmuxStatus(panelId: string, token: string): Promise<TerminalTmuxStatus> {
  try {
    const res = await callServerApi(panelId, token, "GET", "/api/terminal/tmux-status");
    const d = unwrap<TerminalTmuxStatus>(res);
    if (res.ok && d && typeof d.installed === "boolean") return d;
  } catch {
    /* no bloquear */
  }
  return { installed: true, canInstall: false, packageManager: null, reason: "unreachable" };
}

/** Instala tmux en el servidor del panel (root vía sudo). Devuelve { installed, error? }. */
export async function installTerminalTmux(panelId: string, token: string): Promise<{ installed: boolean; error?: string }> {
  try {
    const res = await callServerApi(panelId, token, "POST", "/api/terminal/tmux-install", undefined, { timeoutMs: 0 });
    const d = unwrap<{ installed?: boolean; error?: string }>(res);
    if (d && typeof d.installed === "boolean") return { installed: d.installed, error: d.error };
    return { installed: false, error: res.error ?? "Respuesta inesperada del servidor." };
  } catch (e) {
    return { installed: false, error: e instanceof Error ? e.message : "Error de red." };
  }
}

/** ¿El panel tiene habilitado el módulo Terminal? Lee el mapa `modules` del
 *  branding público. Ausente → habilitado (igual que LUXIPANEL); solo "false"/"0"
 *  lo deshabilita. Devuelve null si no se pudo resolver el branding. */
export async function getPanelTerminalEnabled(host: string): Promise<boolean | null> {
  const b = await getPublicPanelBranding(host).catch(() => null);
  if (!b) return null;
  const modules = b.modules ?? b.data?.modules;
  if (!modules) return true;
  const v = modules["module.terminal.enabled"];
  return v !== "false" && v !== "0";
}
