// ─── Catálogo multi-proveedor de integraciones ───────────────────────────
// Camino genérico (/portal/integrations/*) que sirve los 8 proveedores del
// provider-registry del backend. Los campos `secret` nunca vuelven al cliente.
// Extraído de client.ts.
import { request } from "./request";

export type ProviderCredentialField = {
  key: string;
  /** Clave i18n (p.ej. "gcpClientEmailLabel"); se traduce en el cliente. */
  label: string;
  type: string;
  required: boolean;
  secret: boolean;
  placeholder: string | null;
};

export type ProviderCatalogEntry = {
  id: string;
  name: string;
  hasScopes: boolean;
  scopeLabel: string | null;
  implemented: boolean;
  credentialFields: ProviderCredentialField[];
  connected: boolean;
  status: string | null;
  label: string | null;
  lastVerifiedAt: string | null;
  help: { docUrl: string; intro: string; steps: string[] } | null;
};

export type ProviderScope = { id: string; name: string };

export type ProviderResource = {
  id: string;
  name: string;
  region?: string | null;
  status?: string | null;
  size?: string | null;
  ip?: string | null;
  privateIp?: string | null;
};

export async function getProviderCatalog(token: string, lang?: string): Promise<ProviderCatalogEntry[]> {
  const data = await request<{ ok: boolean; catalog?: ProviderCatalogEntry[] }>(
    `/portal/integrations/catalog${lang ? `?lang=${encodeURIComponent(lang)}` : ""}`,
    token,
  );
  return Array.isArray(data.catalog) ? data.catalog : [];
}

export async function getProviderIntegration(
  provider: string,
  token: string,
): Promise<{ configured: boolean; values?: Record<string, string> }> {
  const data = await request<{ ok: boolean; integration?: { configured: boolean; values?: Record<string, string> } }>(
    `/portal/integrations/${encodeURIComponent(provider)}`,
    token,
  );
  return data.integration ?? { configured: false };
}

export async function saveProviderIntegration(
  provider: string,
  credentials: Record<string, string>,
  token: string,
) {
  return request<{ ok: boolean }>(`/portal/integrations/${encodeURIComponent(provider)}`, token, {
    method: "PUT",
    body: JSON.stringify({ credentials }),
  });
}

export async function deleteProviderIntegration(provider: string, token: string) {
  return request<{ ok: boolean }>(`/portal/integrations/${encodeURIComponent(provider)}`, token, {
    method: "DELETE",
  });
}

export async function listProviderScopes(provider: string, token: string): Promise<ProviderScope[]> {
  const data = await request<{ ok: boolean; scopes?: ProviderScope[] }>(
    `/portal/integrations/${encodeURIComponent(provider)}/scopes`,
    token,
  );
  return Array.isArray(data.scopes) ? data.scopes : [];
}

export async function listProviderResources(
  provider: string,
  scopeId: string | null,
  token: string,
): Promise<ProviderResource[]> {
  const qs = scopeId ? `?scopeId=${encodeURIComponent(scopeId)}` : "";
  const data = await request<{ ok: boolean; resources?: ProviderResource[] }>(
    `/portal/integrations/${encodeURIComponent(provider)}/resources${qs}`,
    token,
  );
  return Array.isArray(data.resources) ? data.resources : [];
}

export async function registerProviderResources(
  provider: string,
  payload: { scopeId: string | null; resources: ProviderResource[] },
  token: string,
): Promise<{ ok: boolean; createdCount?: number }> {
  return request<{ ok: boolean; createdCount?: number }>(
    `/portal/integrations/${encodeURIComponent(provider)}/register`,
    token,
    { method: "POST", body: JSON.stringify(payload) },
  );
}
