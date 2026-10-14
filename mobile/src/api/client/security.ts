// Seguridad de la cuenta: export de datos gateado por step-up, step-up
// multi-método (TOTP/passkey/recovery), preferencias de step-up, passkeys,
// códigos de recuperación y TOTP.
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
  // (emitido por verifyExportStepUp). Sin él responde 403 STEP_UP_REQUIRED.
  return request<PanelDataExport>("/portal/data-export", token, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: stepUpToken ? { "X-Step-Up-Token": stepUpToken } : undefined,
  });
}

/**
 * Re-verifica el código TOTP de un usuario ya autenticado y devuelve un token
 * step-up corto pinned al `scope`. Refleja POST /portal/auth/totp/step-up.
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

/** Alias retrocompatible para el flujo de export (ahora scope "export"). */
export function verifyExportStepUp(code: string, token: string) {
  return verifyStepUp(code, token, "export");
}

// ─── Step-up multi-método (TOTP / Passkey / Recovery) ─────────────────────
/** Qué métodos de step-up tiene ACTIVOS el usuario. */
export type StepUpMethods = { totp: boolean; passkey: boolean; recovery: boolean };

/**
 * Lista los métodos de step-up activos para el usuario. Refleja
 * GET /portal/auth/step-up/methods. Devuelve flags por método para que el modal
 * decida qué ofrecer (uno → directo; varios → selector).
 */
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

/**
 * Pide las opciones de aserción WebAuthn para un step-up por passkey.
 * Refleja POST /portal/auth/step-up/passkey/options. El payload se pasa tal cual
 * a react-native-passkey (igual que el login passkey).
 */
export async function stepUpPasskeyOptions(scope: string, token: string): Promise<any> {
  const res = await request<{ ok?: boolean; data?: unknown } & Record<string, unknown>>(
    "/portal/auth/step-up/passkey/options",
    token,
    { method: "POST", body: JSON.stringify({ scope }) },
  );
  // El backend puede envolver en { data } (como el login) o devolver plano.
  return (res as any).data ?? res;
}

/**
 * Verifica la aserción WebAuthn y devuelve el token step-up pinned al scope.
 * Refleja POST /portal/auth/step-up/passkey/verify.
 */
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
  if (!res.stepUpToken) {
    throw new Error(res.error ?? "No se pudo verificar la passkey");
  }
  return { stepUpToken: res.stepUpToken, expiresAt: res.expiresAt ?? 0 };
}

/**
 * Canjea un código de recuperación por un token step-up pinned al scope.
 * Refleja POST /portal/auth/step-up/recovery.
 */
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
  if (!res.stepUpToken) {
    throw new Error(res.error ?? "No se pudo verificar el código de recuperación");
  }
  return { stepUpToken: res.stepUpToken, expiresAt: res.expiresAt ?? 0 };
}

// ─── Preferencias granulares de step-up 2FA ──────────────────────────────
export type StepUpPrefs = {
  ok: boolean;
  /** Si el usuario tiene TOTP habilitado. Sin 2FA no se pide en ningún lado. */
  totpEnabled: boolean;
  /** Todos los scopes configurables (para pintar los toggles). */
  availableScopes: string[];
  /** Subconjunto ACTIVADO por el usuario. */
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
