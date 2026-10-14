// Seguridad de cuenta: export de datos (gateado 2FA), step-up multi-método,
// preferencias de step-up, API token, passkeys, códigos de recuperación y
// TOTP — extraído de client.ts.
import { request } from "./request";

export type PanelDataExport = {
  ok: boolean;
  exportedAt?: string;
  version?: number;
  includesSecrets?: boolean;
  panels?: Array<{
    licenseName?: string | null;
    serverIp?: string | null;
    panelCategory?: string | null;
    panelTags?: string[];
    accessSubdomain?: string | null;
    customDomain?: string | null;
    notes?: string | null;
    sshKeyIds?: string[];
  }>;
  sshKeys?: Array<{
    id?: string;
    linuxUsername?: string | null;
    fingerprint?: string | null;
    privateKey?: string | null;
  }>;
  taxonomy?: Array<{ name: string; tags: string[] }>;
};

export async function exportPanelData(
  payload: { includeSsh: boolean; includePanels: boolean; includeTaxonomy: boolean },
  token: string,
  stepUpToken?: string,
): Promise<PanelDataExport> {
  // El export está gateado por 2FA: el backend exige un token step-up reciente
  // (emitido por verifyStepUp con scope "export"). Sin él responde 403 STEP_UP_REQUIRED.
  return request<PanelDataExport>("/portal/data-export", token, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: stepUpToken ? { "X-Step-Up-Token": stepUpToken } : undefined,
  });
}

/**
 * Re-verifica el código TOTP de un usuario ya autenticado y devuelve un token
 * step-up corto pinned al `scope` indicado. Refleja POST /portal/auth/totp/step-up.
 * Reutilizable para cualquier operación sensible (export, gestión de llaves SSH…).
 */
export async function verifyStepUp(
  code: string,
  token: string,
  scope: string = "data-export",
): Promise<{ stepUpToken: string; expiresAt: number }> {
  const res = await request<{ ok: boolean; stepUpToken?: string; expiresAt?: number; error?: string }>(
    "/portal/auth/totp/step-up",
    token,
    { method: "POST", body: JSON.stringify({ code, scope }) },
  );
  if (!res.ok || !res.stepUpToken) {
    throw new Error(res.error ?? "No se pudo verificar el código");
  }
  return { stepUpToken: res.stepUpToken, expiresAt: res.expiresAt ?? 0 };
}

// ─── Step-up multi-método ────────────────────────────────────────────────
// El modal de step-up puede resolverse con cualquiera de los métodos que el
// usuario tenga ACTIVOS. El backend expone qué métodos hay disponibles y un
// endpoint por método; todos devuelven el mismo `stepUpToken` corto pinned al
// `scope`, que se consume igual que el de TOTP (header X-Step-Up-Token).

export type StepUpMethods = { totp: boolean; passkey: boolean; recovery: boolean };

/** Métodos de step-up activos para el usuario. GET /portal/auth/step-up/methods. */
export async function getStepUpMethods(token: string): Promise<StepUpMethods> {
  const res = await request<{ ok?: boolean; totp?: boolean; passkey?: boolean; recovery?: boolean }>(
    "/portal/auth/step-up/methods",
    token,
  );
  return {
    totp: Boolean(res.totp),
    passkey: Boolean(res.passkey),
    recovery: Boolean(res.recovery),
  };
}

/** Opciones de aserción WebAuthn para step-up. POST /portal/auth/step-up/passkey/options. */
export async function stepUpPasskeyOptions(scope: string, token: string): Promise<unknown> {
  const res = await request<{ ok?: boolean; data?: unknown; error?: string } & Record<string, unknown>>(
    "/portal/auth/step-up/passkey/options",
    token,
    { method: "POST", body: JSON.stringify({ scope }) },
  );
  // El backend puede envolver las opciones en `data` (igual que auth-options) o
  // devolverlas en la raíz; aceptamos ambas formas.
  return (res as { data?: unknown }).data ?? res;
}

/** Verifica la aserción WebAuthn de step-up. POST /portal/auth/step-up/passkey/verify. */
export async function stepUpPasskeyVerify(
  scope: string,
  assertion: unknown,
  token: string,
): Promise<{ stepUpToken: string; expiresAt: number }> {
  const res = await request<{ ok?: boolean; stepUpToken?: string; expiresAt?: number; error?: string }>(
    "/portal/auth/step-up/passkey/verify",
    token,
    { method: "POST", body: JSON.stringify({ scope, assertion }) },
  );
  if (!res.ok || !res.stepUpToken) {
    throw new Error(res.error ?? "No se pudo verificar la passkey");
  }
  return { stepUpToken: res.stepUpToken, expiresAt: res.expiresAt ?? 0 };
}

/** Canjea un código de recuperación por un step-up token. POST /portal/auth/step-up/recovery. */
export async function stepUpRecovery(
  scope: string,
  code: string,
  token: string,
): Promise<{ stepUpToken: string; expiresAt: number }> {
  const res = await request<{ ok?: boolean; stepUpToken?: string; expiresAt?: number; error?: string }>(
    "/portal/auth/step-up/recovery",
    token,
    { method: "POST", body: JSON.stringify({ scope, code }) },
  );
  if (!res.ok || !res.stepUpToken) {
    throw new Error(res.error ?? "No se pudo verificar el código de recuperación");
  }
  return { stepUpToken: res.stepUpToken, expiresAt: res.expiresAt ?? 0 };
}

// ─── Preferencias granulares de step-up 2FA ──────────────────────────────
export type StepUpPrefs = {
  ok: boolean;
  totpEnabled: boolean;
  availableScopes: string[];
  enabledScopes: string[];
};

export async function getStepUpPrefs(token: string): Promise<StepUpPrefs> {
  return request<StepUpPrefs>("/portal/auth/step-up-prefs", token);
}

export async function setStepUpPrefs(
  token: string,
  scopes: string[],
): Promise<{ ok: boolean; enabledScopes: string[] }> {
  return request<{ ok: boolean; enabledScopes: string[] }>("/portal/auth/step-up-prefs", token, {
    method: "PUT",
    body: JSON.stringify({ scopes }),
  });
}

// ─── API Token (acceso programático) ─────────────────────────────────────
export type ApiTokenInfo = {
  id: string;
  prefix: string;
  last4: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export type ApiTokenState = {
  ok: boolean;
  email: string | null;
  token: ApiTokenInfo | null;
  /** Plaintext only present right after auto-generation or rotation. */
  plaintext?: string | null;
};

export async function getApiToken(token: string): Promise<ApiTokenState> {
  return request<ApiTokenState>("/portal/api-token", token);
}

export async function rotateApiToken(token: string): Promise<{ ok: boolean; token: string }> {
  return request<{ ok: boolean; token: string }>("/portal/api-token/rotate", token, {
    method: "POST",
    body: JSON.stringify({ label: "" }),
  });
}

export async function revokeApiToken(token: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/portal/api-token", token, { method: "DELETE" });
}

export type SecurityPasskey = {
  id: string;
  label: string;
  platform: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export type TotpSetupData = {
  secret: string;
  otpauthUri: string;
  qrDataUrl: string;
};

export async function listSecurityPasskeys(token: string): Promise<SecurityPasskey[]> {
  const data = await request<{ data?: SecurityPasskey[] }>("/portal/auth/passkeys", token);
  return Array.isArray(data.data) ? data.data : [];
}

export async function registerSecurityPasskey(label: string, credential: unknown, token: string): Promise<void> {
  await request("/portal/auth/passkeys/register-verify", token, {
    method: "POST",
    body: JSON.stringify({ label, response: credential }),
  });
}

export async function getPasskeyRegistrationOptions(token: string): Promise<unknown> {
  const data = await request<{ data?: unknown }>("/portal/auth/passkeys/register-options", token, { method: "POST" });
  if (!data.data) throw new Error("Respuesta inválida del servidor");
  return data.data;
}

export async function revokeSecurityPasskey(id: string, token: string): Promise<void> {
  await request(`/portal/auth/passkeys/${id}`, token, { method: "DELETE" });
}

export async function getRecoveryCodeStatus(token: string): Promise<{ hasActiveCodes: boolean }> {
  return request<{ hasActiveCodes: boolean }>("/portal/auth/recovery/status", token);
}

export async function generateRecoveryCodes(token: string): Promise<string[]> {
  const data = await request<{ codes?: string[] }>("/portal/auth/recovery/generate", token, { method: "POST" });
  return Array.isArray(data.codes) ? data.codes : [];
}

export async function getTotpStatus(token: string): Promise<{ enabled: boolean; configured: boolean }> {
  return request<{ enabled: boolean; configured: boolean }>("/portal/auth/totp/status", token);
}

export async function setupTotp(token: string): Promise<TotpSetupData> {
  const data = await request<{ data?: TotpSetupData }>("/portal/auth/totp/setup", token);
  if (!data.data) throw new Error("Respuesta inválida del servidor");
  return data.data;
}

export async function enableTotp(code: string, token: string): Promise<void> {
  await request("/portal/auth/totp/enable", token, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function disableTotp(token: string): Promise<void> {
  await request("/portal/auth/totp/disable", token, { method: "PATCH" });
}
