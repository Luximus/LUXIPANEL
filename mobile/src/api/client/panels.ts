import { ENV } from "../../config/env";
import { requestWithPlayIntegrity } from "../../integrity";
import type { Panel, PanelInvitation } from "../../types/models";
import {
  type ReadOptions,
  getStringField,
  invalidatePanelCache,
  invalidatePanelsCache,
  readCache,
  request,
  requestRaw,
  TTL,
} from "./request";

type PanelsResponse = {
  licenses?: Panel[];
  panels?: Panel[];
  invitations?: PanelInvitation[];
  data?: {
    licenses?: Panel[];
    panels?: Panel[];
    invitations?: PanelInvitation[];
  };
};

export async function getPanels(token: string): Promise<Panel[]> {
  const data = await request<PanelsResponse>("/portal/licenses", token);
  if (Array.isArray(data?.licenses)) return data.licenses;
  if (Array.isArray(data?.panels)) return data.panels;
  if (Array.isArray(data?.data?.licenses)) return data.data.licenses;
  if (Array.isArray(data?.data?.panels)) return data.data.panels;
  return [];
}

export function getPanelsData(
  token: string,
  opts?: ReadOptions,
): Promise<{ panels: Panel[]; invitations: PanelInvitation[] }> {
  return readCache.fetch(`panels|${token}`, () => fetchPanelsData(token), { ttlMs: TTL.panels, force: opts?.force });
}

async function fetchPanelsData(token: string): Promise<{ panels: Panel[]; invitations: PanelInvitation[] }> {
  const data = await request<PanelsResponse>("/portal/licenses", token);
  const panelsList = Array.isArray(data?.panels)
    ? data.panels
    : Array.isArray(data?.licenses)
      ? data.licenses
      : Array.isArray(data?.data?.panels)
        ? data.data.panels
        : Array.isArray(data?.data?.licenses)
          ? data.data.licenses
          : [];
  const invitations = Array.isArray(data?.invitations)
    ? data.invitations
    : Array.isArray(data?.data?.invitations)
      ? data.data.invitations
      : [];
  return { panels: panelsList, invitations };
}

export type PublicPanelBranding = {
  matched?: boolean;
  configured?: boolean;
  data?: {
    layout?: Record<string, string>;
    general?: Record<string, string>;
    modules?: Record<string, string>;
  };
  layout?: Record<string, string>;
  general?: Record<string, string>;
  /** Mapa de módulos del panel (p. ej. "module.terminal.enabled": "true"). */
  modules?: Record<string, string>;
};

export function getPublicPanelBranding(host: string): Promise<PublicPanelBranding | null> {
  // Branding público del panel (gatea el módulo Terminal): mismo host consultado
  // por cada consola/webview que se abre. TTL + single-flight.
  return readCache.fetch(`publicBranding|${host}|`, async () => {
    const response = await fetch(`${ENV.apiUrl}/public/panel-branding?host=${encodeURIComponent(host)}`, {
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache", "x-client-platform": "app" },
    });
    if (!response.ok) return null;
    return response.json() as Promise<PublicPanelBranding>;
  }, { ttlMs: TTL.branding });
}

export type CreatePanelPayload = {
  serverIp?: string;
  serverPort?: number;
  category?: string;
  tags?: string;
  /** URL COMPLETA de acceso al LUXIPANEL del usuario (esquema/puerto
   *  opcionales). Reemplaza al subdominio managed retirado. */
  customDomain?: string | null;
};

export async function createPanel(payload: CreatePanelPayload, token: string) {
  // Protected action: panel.create (POST /portal/panels).
  // payloadRelevantForHash = the full create payload — every field changes the
  // effect (server, category, tags, subdomain). No auth/volatile
  // fields are present in this body, so it is hashed as-is.
  // `panelCredential`: token de conexión por-panel (lxp_live_) en claro; solo
  // viene UNA vez, al crear. Se muestra al usuario para pegarlo en el .env.
  return requestWithPlayIntegrity<{ ok: boolean; panel?: Panel; panelCredential?: string | null }>({
    action: "panel.create",
    payloadRelevantForHash: payload,
    run: (headers) =>
      request<{ ok: boolean; panel?: Panel; panelCredential?: string | null }>("/portal/panels", token, {
        method: "POST",
        body: JSON.stringify(payload),
        headers,
      }),
  });
}

export type UpdatePanelPayload = {
  category?: string | null;
  tags?: string | null;
  /** URL COMPLETA de acceso al LUXIPANEL del usuario (esquema/puerto
   *  opcionales); `null` la borra. Reemplaza al subdominio managed retirado. */
  customDomain?: string | null;
};

export async function updatePanel(panelId: string, payload: UpdatePanelPayload, token: string) {
  return request<{ ok: boolean; panel?: Panel }>(`/portal/panels/${panelId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function configurePanelSsh(
  panelId: string,
  payload: {
    ip: string;
    port?: number;
    sshUsername?: string;
    sshKeyId?: string | null;
    sshKeyIds?: string[];
    saveCredentials: boolean;
    sshKey?: string | null;
  },
  token: string,
) {
  const formData = new FormData();
  formData.append("ip", payload.ip);
  if (typeof payload.port === "number" && Number.isFinite(payload.port)) {
    formData.append("port", String(payload.port));
  }
  // El backend rechaza sshUsername vacío (min(1)); solo enviarlo si hay valor.
  if (payload.sshUsername) formData.append("sshUsername", payload.sshUsername);
  formData.append("saveCredentials", payload.saveCredentials ? "true" : "false");
  if (payload.sshKeyId) formData.append("sshKeyId", payload.sshKeyId);
  if (payload.sshKey) formData.append("sshKey", payload.sshKey);
  if (payload.sshKeyIds && payload.sshKeyIds.length > 0) {
    formData.append("sshKeyIds", payload.sshKeyIds.join(","));
  }

  const response = await fetch(`${ENV.apiUrl}/portal/panels/${panelId}/ssh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-client-platform": "app",
    },
    body: formData as unknown as BodyInit,
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(getStringField(data, "error") ?? "Request failed");
  // Multipart con `fetch` directo: no pasa por el funnel de `request`, así que
  // invalida a mano (la ficha SSH del panel y sus permisos de módulo cambiaron).
  invalidatePanelsCache();
  invalidatePanelCache(panelId);
  return data as { ok: boolean; data?: unknown };
}

export async function deletePanel(panelId: string, token: string) {
  return request<{ ok: boolean }>(`/portal/panels/${panelId}`, token, {
    method: "DELETE",
  });
}

export type ConnectPanelResponse = {
  ok: boolean;
  data?: {
    sessionId?: string;
    sessionToken?: string;
    expiresAt?: number;
    redirectUrl?: string;
    handoff?: { url: string; ticket: string };
    authenticated?: boolean;
    direct?: boolean;
    serverId?: string;
  };
};

/**
 * Conecta un panel con credenciales guardadas y devuelve el `redirectUrl`.
 * El TOFU del gateway SSH de panel (409 HOST_FINGERPRINT_PENDING_APPROVAL +
 * `/api/agents/servers/:id/fingerprint/approve`) fue RETIRADO junto con el
 * puente de panel managed; ya no se maneja aquí. El parámetro `onApprove` se
 * conserva por compatibilidad de firma pero ya no se invoca.
 */
export async function connectPanel(
  panelId: string,
  token: string,
  payload?: { sshKeyId?: string; passphrase?: string },
  onApprove?: (fingerprint: string) => boolean | Promise<boolean>,
): Promise<ConnectPanelResponse> {
  void onApprove;
  // Reusa el refresh de la sesión de cuenta: un access-token caducado no debe
  // convertir una credencial guardada válida en un segundo formulario de login.
  const result = await request<ConnectPanelResponse & { error?: string }>(`/portal/panels/${panelId}/connect`, token, {
    method: "POST",
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!result.ok) {
    throw new Error(result.error ?? "Connection failed");
  }
  return result;
}

/**
 * Sondea (ping) un servidor reusando el endpoint de prueba SSH del portal.
 * Con `panelId` el backend resuelve la llave adjunta al panel, así que basta
 * la IP. Devuelve `true` solo si el servidor respondió y autenticó (estado
 * "activo respondiendo"); cualquier fallo/timeout => `false`. Nunca lanza:
 * un panel sin IP/credenciales o compartido simplemente no es sondeable.
 */
export async function testPanelSshConnection(
  panelId: string,
  ip: string,
  token: string,
  port?: number,
): Promise<boolean> {
  if (!ip) return false;
  // Timeout de cliente: el sondeo de estado no debe quedar colgado si el backend
  // tarda (cada test-connection abre una conexión SSH real, hasta ~12s, y si el
  // usuario configurado falla prueba varios candidatos más). Acota la "rueda de
  // carga" del listado de servidores y libera la request rápido.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const payload: Record<string, string | number> = { panelId, ip };
    if (typeof port === "number" && Number.isFinite(port)) payload.port = port;
    const result = await requestRaw(`/portal/ssh/test-connection`, token, {
      method: "POST",
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!result.ok) return false;
    const data = result.data as { connected?: boolean } | null;
    return data?.connected !== false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Prueba de conexión SSH REAL con credenciales EN VIVO del editor (sin guardar):
 * IP/puerto + usuario + (llave privada cruda con passphrase) o (sshKeyId guardada)
 * o `panelId` para que el backend resuelva la llave del panel. El backend abre una
 * conexión SSH y detecta el usuario que funciona. Devuelve el usuario validado o el
 * mensaje de error (ya localizado por el backend). No lanza.
 */
export async function testServerSshConnection(
  params: {
    panelId?: string;
    ip: string;
    port?: number;
    sshUsername?: string;
    sshKey?: string;
    sshKeyId?: string;
    passphrase?: string;
  },
  token: string,
): Promise<{ connected: boolean; username?: string; error?: string }> {
  if (!params.ip) return { connected: false, error: "" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const body: Record<string, string | number> = { ip: params.ip };
    if (params.panelId) body.panelId = params.panelId;
    if (typeof params.port === "number" && Number.isFinite(params.port)) body.port = params.port;
    if (params.sshUsername) body.sshUsername = params.sshUsername;
    if (params.sshKey) body.sshKey = params.sshKey;
    if (params.sshKeyId) body.sshKeyId = params.sshKeyId;
    if (params.passphrase) body.passphrase = params.passphrase;
    const result = await requestRaw(`/portal/ssh/test-connection`, token, {
      method: "POST",
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = result.data as { connected?: boolean; username?: string; error?: string } | null;
    if (result.ok && data?.connected) return { connected: true, username: data.username };
    return { connected: false, error: data?.error ?? "" };
  } catch {
    return { connected: false, error: "" };
  } finally {
    clearTimeout(timer);
  }
}

export type EphemeralConnectPayload = {
  /** Llave privada "local": NUNCA se persiste ni se guarda en el
   *  dispositivo. Solo viaja para abrir esta sesión. */
  localSshKey: string;
  localSshUsername: string;
  passphrase?: string;
};

/**
 * Connect using a local (never-persisted) SSH key. El TOFU del gateway de panel
 * (409 + `/api/agents/servers/:id/fingerprint/approve`) fue RETIRADO; ya no se
 * maneja. `onApprove` se conserva por compatibilidad de firma, sin invocarse.
 */
export async function connectPanelWithLocalKey(
  panelId: string,
  payload: EphemeralConnectPayload,
  token: string,
  onApprove: (fingerprint: string) => boolean | Promise<boolean>,
): Promise<ConnectPanelResponse> {
  void onApprove;
  const body: Record<string, string> = {
    localSshKey: payload.localSshKey,
    localSshUsername: payload.localSshUsername,
  };
  if (payload.passphrase) body.passphrase = payload.passphrase;

  const result = await requestRaw(`/portal/panels/${panelId}/connect`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    throw new Error(getStringField(result.data, "error") ?? `HTTP ${result.status}`);
  }
  return result.data as ConnectPanelResponse;
}
