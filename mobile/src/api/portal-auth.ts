/**
 * Email-based portal authentication for the React Native app.
 *
 * Note on passkey support: WebAuthn is not natively available in
 * React Native. Until we wire up `react-native-passkey` or a WebView-based
 * fallback, the app supports recovery-code login + 2FA only. The backend
 * still issues passkey-based session tokens for users coming in from the
 * web/desktop, and the `verifyMfaCode` flow below works for any of them.
 */
import { ENV } from "../config/env";
import { requestWithPlayIntegrity, type IntegrityHeaders } from "../integrity";

export interface PortalCustomerSummary {
  id: string;
  email: string;
  name?: string | null;
  company?: string | null;
  country?: string | null;
  phone?: string | null;
  locale?: string | null;
  role?: string | null;
  photoUrl?: string | null;
  /** MB efectivos permitidos por subida (avatar + adjuntos de soporte),
   *  resueltos y acotados server-side por rol (rango 1–50). Fallback 5 si falta. */
  maxUploadMb?: number | null;
}

export interface PortalAuthResult {
  mfaPending: boolean;
  mfaToken?: string;
  sessionToken?: string;
  expiresAt?: number;
  customer?: PortalCustomerSummary;
  /** Provider-side handle (GitHub `login`/username) captured from the federated
   *  credential, persisted to hint a future re-auth. Absent for most providers. */
  providerUsername?: string;
  /** Opaque refresh token for "keep me signed in" (rotates on each use). */
  refreshToken?: string;
  /** Refresh token expiry, epoch ms. */
  refreshExpiresAt?: number;
}

function getStringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== "object") return null;
  const v = (value as Record<string, unknown>)[field];
  return typeof v === "string" ? v : null;
}

async function postJson<T>(path: string, body?: unknown, extraHeaders?: IntegrityHeaders): Promise<T> {
  const url = `${ENV.apiUrl}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-platform": "app",
      ...(extraHeaders ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    throw new Error(getStringField(data, "error") ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export async function loginWithRecoveryCode(email: string, code: string): Promise<PortalAuthResult> {
  return await postJson<PortalAuthResult>("/portal/auth/recovery/verify", { email, code });
}

export async function loginWithFirebaseToken(token: string): Promise<PortalAuthResult> {
  // Protected action: auth.login.firebase (POST /portal/firebase-auth).
  // payloadRelevantForHash = {} — the Firebase id token is an auth credential
  // (volatile, re-minted per attempt), so it is intentionally EXCLUDED from the
  // integrity hash; the action name alone binds the token to "login".
  return await requestWithPlayIntegrity<PortalAuthResult>({
    action: "auth.login.firebase",
    payloadRelevantForHash: {},
    run: (headers) =>
      postJson<PortalAuthResult>("/portal/firebase-auth", { token }, headers),
  });
}

/**
 * Cambia el `code` de GitHub (obtenido con expo-auth-session) por un access
 * token. El intercambio ocurre en el backend porque GitHub exige client_secret
 * y no soporta PKCE; el secret nunca llega al dispositivo. Con el access token
 * la app crea la credencial Firebase de GitHub.
 */
export async function exchangeGithubCode(code: string, redirectUri: string): Promise<string> {
  const data = await postJson<{ accessToken: string }>("/portal/auth/github/exchange", { code, redirectUri });
  if (!data.accessToken) throw new Error("GitHub no devolvio un access token.");
  return data.accessToken;
}

export async function verifyMfaCode(mfaToken: string, code: string): Promise<PortalAuthResult> {
  return await postJson<PortalAuthResult>("/portal/auth/2fa/verify", { mfaToken, code });
}

/**
 * Exchange a refresh token for a fresh access JWT (and a rotated refresh token)
 * WITHOUT re-running the identity provider. Throws on an expired/invalid/reused
 * refresh token (the caller should then fall back to the login screen).
 */
export async function refreshPortalSession(refreshToken: string): Promise<PortalAuthResult> {
  return await postJson<PortalAuthResult>("/portal/auth/refresh", { refreshToken });
}

/** Revoke a refresh token server-side (logout). Best-effort. */
export async function revokePortalSession(refreshToken: string): Promise<void> {
  try {
    await postJson("/portal/auth/logout", { refreshToken });
  } catch {
    /* best-effort: local state is cleared regardless */
  }
}
