import { ENV } from "../../config/env";
import type { Panel, PanelInvitation } from "../../types/models";
import { type ElectronRequestResult, getStringField, request, requestRaw } from "./request";

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

export async function getPanelsData(token: string): Promise<{ panels: Panel[]; invitations: PanelInvitation[] }> {
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
  };
  layout?: Record<string, string>;
  general?: Record<string, string>;
};

export async function getPublicPanelBranding(host: string): Promise<PublicPanelBranding | null> {
  const url = `${ENV.apiUrl}/public/panel-branding?host=${encodeURIComponent(host)}`;
  const headers = { "Cache-Control": "no-cache", Pragma: "no-cache" } as Record<string, string>;
  if (window.electronApi?.request) {
    const result = (await window.electronApi.request({ url, method: "GET", headers })) as ElectronRequestResult;
    return result.ok ? (result.data as PublicPanelBranding) : null;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) return null;
  return response.json() as Promise<PublicPanelBranding>;
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
  // `panelCredential`: token de conexión por-panel (lxp_live_) en claro; solo
  // viene UNA vez, al crear. Se muestra al usuario para pegarlo en el .env.
  return request<{ ok: boolean; panel?: Panel; panelCredential?: string | null }>("/portal/panels", token, {
    method: "POST",
    body: JSON.stringify(payload),
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

export async function configurePanelSsh(panelId: string, payload: { ip: string; port?: number; sshUsername?: string; sshKeyId?: string | null; sshKeyIds?: string[]; saveCredentials: boolean; sshKey?: string | null }, token: string) {
  const formData = new FormData();
  formData.set("ip", payload.ip);
  if (typeof payload.port === "number" && Number.isFinite(payload.port)) {
    formData.set("port", String(payload.port));
  }
  // El backend rechaza sshUsername vacío (min(1)); solo enviarlo si hay valor.
  if (payload.sshUsername) formData.set("sshUsername", payload.sshUsername);
  formData.set("saveCredentials", payload.saveCredentials ? "true" : "false");
  if (payload.sshKeyId) formData.set("sshKeyId", payload.sshKeyId);
  if (payload.sshKey) formData.set("sshKey", payload.sshKey);
  if (payload.sshKeyIds && payload.sshKeyIds.length > 0) formData.set("sshKeyIds", payload.sshKeyIds.join(","));

  const url = `${ENV.apiUrl}/portal/panels/${panelId}/ssh`;
  const headers = {
    Authorization: `Bearer ${token}`,
  } as Record<string, string>;

  if (window.electronApi?.request) {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });
    const data: unknown = await response.json();
    if (!response.ok) throw new Error(getStringField(data, "error") ?? "Request failed");
    return data as { ok: boolean; data?: unknown };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(getStringField(data, "error") ?? "Request failed");
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
    serverId?: string;
  };
};

/**
 * Connect using a registered/saved SSH key. El TOFU del gateway de panel
 * (409 HOST_FINGERPRINT_PENDING_APPROVAL + `/api/agents/servers/:id/fingerprint/
 * approve`) fue RETIRADO junto con el puente de panel managed; ya no se maneja.
 * `onApprove` se conserva por compatibilidad de firma pero ya no se invoca.
 */
export async function connectPanel(
  panelId: string,
  token: string,
  payload?: { sshKeyId?: string; passphrase?: string },
  onApprove?: (fingerprint: string) => boolean | Promise<boolean>,
): Promise<ConnectPanelResponse> {
  void onApprove;
  const result = await requestRaw(`/portal/panels/${panelId}/connect`, token, {
    method: "POST",
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!result.ok) {
    throw new Error(getStringField(result.data, "error") ?? `HTTP ${result.status}`);
  }
  return result.data as ConnectPanelResponse;
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
  try {
    const payload: Record<string, string | number> = { panelId, ip };
    if (typeof port === "number" && Number.isFinite(port)) payload.port = port;
    const result = await requestRaw(`/portal/ssh/test-connection`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!result.ok) return false;
    const data = result.data as { connected?: boolean } | null;
    return data?.connected !== false;
  } catch {
    return false;
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
