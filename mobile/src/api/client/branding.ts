// Branding del panel (estado, valores del wizard y guardado).
import { type ReadOptions, readCache, request, TTL } from "./request";

export type PanelBrandingStatus = {
  configured: boolean;
  ownerCanConfigure: boolean;
  panelName?: string | null;
};

export async function getPanelBrandingStatus(panelId: string, token: string): Promise<PanelBrandingStatus> {
  const data = await request<{
    data?: { configured?: boolean; ownerCanConfigure?: boolean; panelName?: string | null };
  }>(`/portal/panels/${panelId}/branding-status`, token);
  return {
    configured: Boolean(data?.data?.configured),
    ownerCanConfigure: Boolean(data?.data?.ownerCanConfigure),
    panelName: typeof data?.data?.panelName === "string" ? data.data.panelName : null,
  };
}

export type PanelBrandingValues = {
  panelName: string;
  siteName: string;
  logoUrl: string;
  loginPassword: boolean;
  loginPasskey: boolean;
  loginRecovery: boolean;
};

export async function getPanelBranding(panelId: string, token: string): Promise<Partial<PanelBrandingValues>> {
  const data = await request<{
    data?: {
      layout?: Record<string, string>;
      general?: Record<string, string>;
      loginMethods?: Record<string, boolean>;
    };
  }>(`/portal/panels/${panelId}/branding`, token);
  const layout = data?.data?.layout ?? {};
  const general = data?.data?.general ?? {};
  const loginMethods = data?.data?.loginMethods ?? {};
  return {
    panelName: String(general.panel_name ?? ""),
    siteName: String(general.site_name ?? ""),
    logoUrl: String(layout.layout_logo_login ?? layout.layout_logo_primary ?? general.layout_favicon ?? ""),
    loginPassword: loginMethods.password !== false,
    loginPasskey: Boolean(loginMethods.passkey),
    loginRecovery: Boolean(loginMethods.recovery),
  };
}

export type PanelBrandingData = {
  layout?: Record<string, string>;
  general?: Record<string, string>;
  loginMethods?: Record<string, boolean>;
};

/** Payload crudo de branding (para el wizard completo de 6 pestañas). También lo
 *  usa la PALETA del panel (`theme/panel-palette`), que se resuelve al hacer
 *  swipe por el carousel: TTL + single-flight evitan repetirlo por cada slide
 *  visitado y por cada pestaña abierta. Se invalida al guardar branding. */
export function getPanelBrandingRaw(panelId: string, token: string, opts?: ReadOptions): Promise<PanelBrandingData> {
  return readCache.fetch(`branding|${panelId}|${token}`, async () => {
    const data = await request<{ data?: PanelBrandingData }>(
      `/portal/panels/${panelId}/branding`,
      token,
    );
    return data?.data ?? {};
  }, { ttlMs: TTL.branding, force: opts?.force });
}

export async function savePanelBrandingEntries(
  panelId: string,
  entries: Array<{ key: string; value: string; category: string }>,
  token: string,
): Promise<void> {
  await request(`/portal/panels/${panelId}/branding`, token, {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
}

export async function savePanelBranding(panelId: string, values: PanelBrandingValues, token: string): Promise<void> {
  const entries = [
    { key: "panel_name", value: values.panelName.trim(), category: "general" },
    { key: "site_name", value: values.siteName.trim(), category: "general" },
    { key: "layout_logo_login", value: values.logoUrl.trim(), category: "layout" },
    { key: "password", value: values.loginPassword ? "true" : "false", category: "login_methods" },
    { key: "passkey", value: values.loginPasskey ? "true" : "false", category: "login_methods" },
    { key: "recovery", value: values.loginRecovery ? "true" : "false", category: "login_methods" },
  ];
  await request(`/portal/panels/${panelId}/branding`, token, {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
}
