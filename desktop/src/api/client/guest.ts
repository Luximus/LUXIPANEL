// Sesión de invitado (enlaces de acceso compartibles) — extraído de client.ts.
import { ENV } from "../../config/env";
import { type ElectronRequestResult, getStringField } from "./request";

/**
 * Exchange guest invitation links (access-link tokens and/or panel hosts) for an
 * account-less guest session JWT. No auth header — the link IS the credential.
 * Expired/unknown links → 404 (thrown). The `guestToken` is then used as the
 * Bearer for the normal /portal/* endpoints (licenses, metrics, modules).
 */
export async function exchangeGuestSession(input: { tokens?: string[]; hosts?: string[] }): Promise<{
  guestToken: string;
  expiresAt: number;
  panels: { panelId: string; name: string; accessKind: string }[];
}> {
  const url = `${ENV.apiUrl}/public/guest/exchange`;
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-cache" } as Record<string, string>;
  const body = JSON.stringify({ tokens: input.tokens ?? [], hosts: input.hosts ?? [] });
  let ok: boolean;
  let data: unknown;
  if (window.electronApi?.request) {
    const result = (await window.electronApi.request({ url, method: "POST", headers, body })) as ElectronRequestResult;
    ok = result.ok;
    data = result.data;
  } else {
    const response = await fetch(url, { method: "POST", headers, body });
    data = await response.json().catch(() => ({}));
    ok = response.ok;
  }
  if (!ok) throw new Error(getStringField(data, "error") ?? "Request failed");
  const rec = (data ?? {}) as Record<string, unknown>;
  return {
    guestToken: typeof rec.token === "string" ? rec.token : "",
    expiresAt: typeof rec.expiresAt === "number" ? rec.expiresAt : 0,
    panels: Array.isArray(rec.panels) ? (rec.panels as { panelId: string; name: string; accessKind: string }[]) : [],
  };
}
