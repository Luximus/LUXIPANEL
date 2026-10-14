// ── Credencial de conexión por-panel (lxp_live_) ──────────────────────────
// El usuario la pega en el .env de su caja LUXIPANEL para identificarse. El
// backend solo devuelve el secreto en claro al crear/rotar (`plaintext`); el
// GET entrega una vista enmascarada (prefix + last4).
import { request } from "./request";

export type PanelCredentialMasked = { prefix: string; last4: string } | null;

function normalizePanelCredentialMasked(raw: unknown): PanelCredentialMasked {
  const obj = raw as Record<string, unknown> | null | undefined;
  const c = (obj?.credential ?? obj?.panelCredential ?? obj) as Record<string, unknown> | null | undefined;
  if (!c || typeof c !== "object") return null;
  const prefix = typeof c.prefix === "string" ? c.prefix : "";
  const last4 = typeof c.last4 === "string" ? c.last4 : "";
  if (!prefix && !last4) return null;
  return { prefix, last4 };
}

function readPanelCredentialPlaintext(raw: unknown): string | null {
  const obj = raw as Record<string, any> | null | undefined;
  const candidates = [obj?.panelCredential, obj?.plaintext, obj?.secret, obj?.credential?.plaintext, obj?.credential?.secret];
  for (const value of candidates) if (typeof value === "string" && value.trim()) return value;
  return null;
}

export async function getPanelCredential(panelId: string, token: string): Promise<PanelCredentialMasked> {
  const data = await request<unknown>(`/portal/panels/${panelId}/credential`, token);
  return normalizePanelCredentialMasked(data);
}

export async function rotatePanelCredential(
  panelId: string,
  token: string,
): Promise<{ masked: PanelCredentialMasked; plaintext: string | null }> {
  const data = await request<unknown>(`/portal/panels/${panelId}/credential/rotate`, token, { method: "POST" });
  return { masked: normalizePanelCredentialMasked(data), plaintext: readPanelCredentialPlaintext(data) };
}

export async function revokePanelCredential(panelId: string, token: string): Promise<void> {
  await request<unknown>(`/portal/panels/${panelId}/credential`, token, { method: "DELETE" });
}
