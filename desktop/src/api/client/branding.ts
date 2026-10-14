// ── Configuración inicial del panel (branding) — extraído de client.ts ──────
import { request } from "./request";

export type PanelBrandingStatus = {
  configured: boolean;
  ownerCanConfigure: boolean;
  panelName: string | null;
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

export type PanelBrandingData = {
  layout?: Record<string, string>;
  general?: Record<string, string>;
  loginMethods?: Record<string, boolean>;
};

export async function getPanelBranding(panelId: string, token: string): Promise<PanelBrandingData> {
  const data = await request<{ data?: PanelBrandingData }>(
    `/portal/panels/${panelId}/branding`,
    token,
  );
  return data?.data ?? {};
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
