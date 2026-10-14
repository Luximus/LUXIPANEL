import { request } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Superficies de administración portadas del portal web (solo admins).
// Replica campos, validaciones y endpoints exactos de:
//   frontend/src/lib/portal-users.ts · portal-roles.ts
//   frontend/src/lib/portal-wompi-products.ts · portal-premium-modules.ts
// Reutiliza el helper `request` (auth Bearer + 2FA step-up) de api/client.ts.
// El backend responde `{ ok, ... }`; las funciones devuelven los arrays/objetos
// ya desempaquetados o lanzan vía `request` cuando `response.ok` es false.
// ─────────────────────────────────────────────────────────────────────────────

// ── Usuarios ────────────────────────────────────────────────────────────────
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

export type UpdateAdminUserPayload = {
  name?: string;
  email?: string;
  roleId: string | null;
  /** Solo se envía para los roles de sistema admin/user (enum legacy). */
  role?: "admin" | "user";
  company: string | null;
  country: string | null;
  phone: string | null;
};

export async function updateAdminUser(
  id: string,
  payload: UpdateAdminUserPayload,
  token: string,
): Promise<AdminUser | null> {
  const data = await request<{ ok: boolean; user?: AdminUser }>(`/portal/admin/users/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.user ?? null;
}

export async function setAdminUserBlocked(id: string, blocked: boolean, token: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/admin/users/${id}/blocked`, token, {
    method: "PUT",
    body: JSON.stringify({ blocked }),
  });
}

export async function deleteAdminUser(id: string, token: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/admin/users/${id}`, token, { method: "DELETE" });
}

// ── Roles ─────────────────────────────────────────────────────────────────
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

export async function createAdminRole(
  payload: { key: string; name: string; description: string | null; permissions: string[] },
  token: string,
): Promise<AdminRole | null> {
  const data = await request<{ ok: boolean; role?: AdminRole }>("/portal/admin/roles", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.role ?? null;
}

export async function updateAdminRole(
  id: string,
  payload: { name: string; description: string | null; permissions: string[] },
  token: string,
): Promise<AdminRole | null> {
  const data = await request<{ ok: boolean; role?: AdminRole }>(`/portal/admin/roles/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.role ?? null;
}

export async function deleteAdminRole(id: string, token: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/admin/roles/${id}`, token, { method: "DELETE" });
}

// ── Productos Wompi ─────────────────────────────────────────────────────────
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

/** Payload de creación/edición de producto Wompi (espejo de products.astro). */
export type WompiProductPayload = {
  name?: string;
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

export async function createWompiProduct(
  payload: WompiProductPayload,
  token: string,
): Promise<WompiProduct | null> {
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
): Promise<WompiProduct | null> {
  const data = await request<{ ok: boolean; product?: WompiProduct }>(`/portal/wompi-products/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.product ?? null;
}

/** El DELETE de un producto lo DESACTIVA (no lo borra), igual que el web. */
export async function deleteWompiProduct(id: string, token: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/wompi-products/${id}`, token, { method: "DELETE" });
}

/** Tasa de cambio pública (COP por 1 USD) para derivar el precio COP. */
export async function getExchangeRate(): Promise<number> {
  const { ENV } = await import("../config/env");
  try {
    const res = await fetch(`${ENV.apiUrl}/public/exchange-rate`, {
      headers: { "x-client-platform": "app" },
    });
    const data = (await res.json()) as { ok?: boolean; rate?: number };
    return data?.ok && typeof data.rate === "number" && data.rate > 0 ? data.rate : 0;
  } catch {
    return 0;
  }
}

// ── Módulos premium ─────────────────────────────────────────────────────────
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

/** Payload de creación/edición de módulo premium (espejo de modules.astro). */
export type PremiumModulePayload = {
  code?: string;
  name?: string;
  description: string;
  category?: string;
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

export async function createPremiumModule(
  payload: PremiumModulePayload,
  token: string,
): Promise<PremiumModule | null> {
  const data = await request<{ ok: boolean; module?: PremiumModule }>("/portal/premium-modules", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.module ?? null;
}

export async function updatePremiumModule(
  id: string,
  payload: Omit<PremiumModulePayload, "code">,
  token: string,
): Promise<PremiumModule | null> {
  const data = await request<{ ok: boolean; module?: PremiumModule }>(`/portal/premium-modules/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.module ?? null;
}

export async function deletePremiumModule(id: string, token: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/premium-modules/${id}`, token, { method: "DELETE" });
}
