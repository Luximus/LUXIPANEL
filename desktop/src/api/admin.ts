/**
 * Capa de API de las superficies de ADMINISTRACIÓN (espejo del portal web):
 * Usuarios, Roles, Productos (Wompi) y Módulos premium. Todos los endpoints
 * viven bajo `/portal/admin/*`, `/portal/wompi-products/*` y
 * `/portal/premium-modules/*` y se consumen con la sesión de portal vigente,
 * reusando el helper `request` de `./client`. Visibles solo para admins.
 */
import { ENV } from "../config/env";
import { request } from "./client";

// ─── Usuarios ──────────────────────────────────────────────────────────────
export type AdminUser = {
  id: string;
  email: string;
  name: string;
  company: string | null;
  country: string | null;
  phone: string | null;
  role: "admin" | "user" | string;
  roleId: string | null;
  blocked: boolean;
  firebaseUid: string | null;
  createdAt: string;
  updatedAt: string;
  activePaymentsCount: number;
  activeProductNames: string[];
  lastActiveProductName: string | null;
  lastActiveProductTier: string | null;
  lastPaymentCreatedAt: string | null;
  lastPaymentExpiresAt: string | null;
  sshConnectionsCount: number;
};

/** Rol básico (id/key/name/isSystem) tal como lo devuelve el endpoint de
 *  usuarios para poblar el select de roles. */
export type AdminRoleSummary = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
};

export async function getAdminUsers(token: string): Promise<AdminUser[]> {
  const data = await request<{ ok: boolean; users?: AdminUser[] }>("/portal/admin/users", token);
  return Array.isArray(data.users) ? data.users : [];
}

export async function getAdminRolesSummary(token: string): Promise<AdminRoleSummary[]> {
  const data = await request<{ ok: boolean; roles?: AdminRoleSummary[] }>("/portal/admin/roles", token);
  return Array.isArray(data.roles) ? data.roles : [];
}

export type UpdateAdminUserPayload = {
  name?: string;
  email?: string;
  roleId?: string | null;
  role?: "admin" | "user";
  company?: string | null;
  country?: string | null;
  phone?: string | null;
};

export async function updateAdminUser(id: string, payload: UpdateAdminUserPayload, token: string): Promise<void> {
  await request(`/portal/admin/users/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function setAdminUserBlocked(id: string, blocked: boolean, token: string): Promise<void> {
  await request(`/portal/admin/users/${id}/blocked`, token, {
    method: "PUT",
    body: JSON.stringify({ blocked }),
  });
}

export async function deleteAdminUser(id: string, token: string): Promise<void> {
  await request(`/portal/admin/users/${id}`, token, { method: "DELETE" });
}

// ─── Roles ─────────────────────────────────────────────────────────────────
export type PermissionDef = {
  key: string;
  label: string;
  description?: string;
  category: "Pantallas" | "Acciones" | string;
  route?: string;
};

export type AdminRole = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function getAdminRoles(
  token: string,
): Promise<{ roles: AdminRole[]; permissions: PermissionDef[] }> {
  const data = await request<{ ok: boolean; roles?: AdminRole[]; permissions?: PermissionDef[] }>(
    "/portal/admin/roles",
    token,
  );
  return {
    roles: Array.isArray(data.roles) ? data.roles : [],
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  };
}

export type CreateRolePayload = { key: string; name: string; description: string | null; permissions: string[] };
export type UpdateRolePayload = { name: string; description: string | null; permissions: string[] };

export async function createAdminRole(payload: CreateRolePayload, token: string): Promise<void> {
  await request("/portal/admin/roles", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminRole(id: string, payload: UpdateRolePayload, token: string): Promise<void> {
  await request(`/portal/admin/roles/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminRole(id: string, token: string): Promise<void> {
  await request(`/portal/admin/roles/${id}`, token, { method: "DELETE" });
}

// ─── Productos (Wompi) ───────────────────────────────────────────────────────
export type WompiProduct = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  amountCop: number;
  amountUsd?: number | null;
  numKeys: number;
  validityMonths: number;
  isActive: boolean;
  showInPlans: boolean;
  showInApp: boolean;
  showInDesktop: boolean;
  autoPurchaseOnSignup: boolean;
  purchaseLimit?: number | null;
  purchaseCount?: number | null;
  discountPercent?: number | null;
  trialDays?: number | null;
  productKind: "tokens" | "license";
  tokenAmount: number;
  billingCycle?: string | null;
  redirectUrl?: string | null;
  publicUrl?: string;
};

export type WompiProductPayload = {
  name: string | undefined;
  description: string | null;
  logoUrl: string | null;
  amountCop: number;
  amountUsd: number | null;
  productKind: "tokens" | "license";
  tokenAmount: number;
  validityMonths: number;
  isActive: boolean;
  showInPlans: boolean;
  showInApp: boolean;
  showInDesktop: boolean;
  autoPurchaseOnSignup: boolean;
  purchaseLimit: number | null;
  discountPercent: number;
  trialDays: number;
};

export async function getWompiProducts(token: string): Promise<WompiProduct[]> {
  const data = await request<{ ok: boolean; products?: WompiProduct[] }>("/portal/wompi-products", token);
  return Array.isArray(data.products) ? data.products : [];
}

export async function createWompiProduct(payload: WompiProductPayload, token: string): Promise<WompiProduct | null> {
  const data = await request<{ ok: boolean; product?: WompiProduct }>("/portal/wompi-products", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.product ?? null;
}

export async function updateWompiProduct(
  id: string,
  payload: Partial<WompiProductPayload>,
  token: string,
): Promise<void> {
  await request(`/portal/wompi-products/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteWompiProduct(id: string, token: string): Promise<void> {
  await request(`/portal/wompi-products/${id}`, token, { method: "DELETE" });
}

export type ProductLogo = { url: string; name: string };

export async function getWompiProductLogos(token: string): Promise<ProductLogo[]> {
  const data = await request<{ ok: boolean; logos?: ProductLogo[] }>("/portal/wompi-products/logos", token);
  return Array.isArray(data.logos) ? data.logos : [];
}

/** Sube un logo (multipart). El backend pone el boundary; no fijamos
 *  Content-Type. Devuelve la URL pública del recurso subido. */
export async function uploadWompiProductLogo(file: File, token: string): Promise<string> {
  const url = `${ENV.apiUrl}/portal/wompi-products/logos`;
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = (await response.json()) as { ok?: boolean; url?: string; error?: string };
  if (!response.ok || !data.ok || !data.url) {
    throw new Error(data.error ?? "No se pudo subir la imagen");
  }
  return data.url;
}

/** Tasa de cambio COP por 1 USD (público). 0 si no disponible. */
export async function getExchangeRate(token: string): Promise<number> {
  try {
    const data = await request<{ ok?: boolean; rate?: number }>("/public/exchange-rate", token);
    return data?.ok && typeof data.rate === "number" && data.rate > 0 ? data.rate : 0;
  } catch {
    return 0;
  }
}

// ─── Módulos premium ─────────────────────────────────────────────────────────
export type PremiumModule = {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  tag: "free" | "premium" | string;
  kind: "module" | "mcp_server" | string;
  version: string | null;
  rating: number;
  downloads: number;
  views: number;
  createdBy: string;
  scriptPath: string | null;
  scriptHash: string | null;
  features: string[];
  configSchema: unknown;
  creatorCustomerId: string | null;
  status: "active" | "disabled" | string;
  createdAt: string;
  updatedAt: string;
};

export type PremiumModulePayload = {
  code?: string;
  name: string | undefined;
  description: string;
  category: string | undefined;
  tag: string;
  kind: string;
  version: string;
  rating: number;
  createdBy: string;
  scriptPath: string | null;
  scriptHash: string | null;
  features: string[];
  configSchema: unknown;
  status: "active" | "disabled";
};

export async function getPremiumModules(token: string): Promise<PremiumModule[]> {
  const data = await request<{ ok: boolean; modules?: PremiumModule[] }>("/portal/premium-modules", token);
  return Array.isArray(data.modules) ? data.modules : [];
}

export async function createPremiumModule(payload: PremiumModulePayload, token: string): Promise<void> {
  await request("/portal/premium-modules", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePremiumModule(
  id: string,
  payload: Omit<PremiumModulePayload, "code">,
  token: string,
): Promise<void> {
  await request(`/portal/premium-modules/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deletePremiumModule(id: string, token: string): Promise<void> {
  await request(`/portal/premium-modules/${id}`, token, { method: "DELETE" });
}
