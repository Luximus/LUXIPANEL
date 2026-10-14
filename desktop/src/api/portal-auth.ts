/**
 * Email-based portal authentication for the desktop app: passkey, recovery
 * code, and the 2FA verification step. Returns a portal session JWT (issued
 * by LP-LICENSE-SERVER) that subsequent API calls must use as Bearer.
 */
import { getAdditionalUserInfo, type UserCredential } from "firebase/auth";
import { ENV } from "../config/env";
import { signInWithGoogle, signInWithApple, signInWithGithub, signInWithMicrosoft } from "../lib/firebase";
import { startAuthentication } from "./webauthn";

type ElectronRequestResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

export interface PortalCustomerSummary {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  photoUrl?: string | null;
  /** MB efectivos de subida para el rol (avatar + adjuntos). Fallback: 5. */
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

function randomBase64Url(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Provider login in the OS browser. The custom link contains only a single-use
 * code; the session is returned over HTTPS after a PKCE proof. */
async function loginInSystemBrowser(provider: "google" | "apple" | "github" | "microsoft" | "passkey", hint?: string): Promise<PortalAuthResult> {
  const api = window.electronApi;
  if (!api?.onDeeplink || !api.openExternal) throw new Error("system_browser_unavailable");
  const verifier = randomBase64Url();
  const state = randomBase64Url();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const browserUrl = new URL("/desktop-auth", ENV.luxipanelUrl);
  browserUrl.searchParams.set("provider", provider);
  browserUrl.searchParams.set("state", state);
  browserUrl.searchParams.set("challenge", challenge);
  if (hint) browserUrl.searchParams.set("hint", hint);
  return new Promise<PortalAuthResult>((resolve, reject) => {
    let settled = false;
    let unsubscribe = () => {};
    const timer = setTimeout(() => finish(new Error("desktop_auth_timeout")), 5 * 60_000);
    function finish(error?: Error, value?: PortalAuthResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      if (error) reject(error); else resolve(value!);
    }
    unsubscribe = api.onDeeplink((raw) => {
      let link: URL;
      try { link = new URL(raw); } catch { return; }
      if (link.protocol !== "luxipanel:" || link.hostname !== "auth" || link.searchParams.get("state") !== state) return;
      const code = link.searchParams.get("code");
      if (!code || !/^[A-Za-z0-9_-]{43}$/.test(code)) { finish(new Error("desktop_auth_invalid_code")); return; }
      void postJson<PortalAuthResult>("/portal/auth/desktop/redeem", { code, verifier, state })
        .then((result) => finish(undefined, result), (error) => finish(error instanceof Error ? error : new Error("desktop_auth_failed")));
    });
    void api.openExternal(browserUrl.toString()).then((opened) => { if (!opened) finish(new Error("system_browser_unavailable")); }, (error) => finish(error instanceof Error ? error : new Error("system_browser_unavailable")));
  });
}

async function postJson<T>(path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const url = `${ENV.apiUrl}${path}`;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client-platform": "desktop",
    ...headers,
  };
  if (window.electronApi?.request) {
    const result = (await window.electronApi.request({
      url,
      method: "POST",
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })) as ElectronRequestResult;
    if (!result.ok) {
      throw new Error(getStringField(result.data, "error") ?? `HTTP ${result.status}`);
    }
    return result.data as T;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    throw new Error((data.error as string) ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export async function requestPasskey(email: string): Promise<PortalAuthResult> {
  if (window.electronApi?.onDeeplink) return loginInSystemBrowser("passkey", email);
  // En el shell Electron (origen file://) navigator.credentials.get() no puede
  // correr contra el rp.id del portal. Delegamos la ceremonia a la ventana puente
  // https (passkey:authenticate), que devuelve el PortalAuthResult ya verificado.
  const bridge = window.electronApi?.authenticatePasskey;
  if (bridge) {
    const res = await bridge({ email, lang: "es" });
    if (!res.ok) {
      if (res.cancelled) throw new Error("passkey_cancelled");
      throw new Error((res.error as string) ?? "passkey_failed");
    }
    return (res.result ?? {}) as PortalAuthResult;
  }
  // Fallback (dev en navegador real): ceremonia directa.
  const opts = await postJson<{ ok: boolean; data: any }>("/portal/auth/passkeys/auth-options", { email });
  const credential = await startAuthentication(opts.data);
  return await postJson<PortalAuthResult>("/portal/auth/passkeys/auth-verify", credential);
}

async function exchangeFirebaseCredential(credential: UserCredential): Promise<PortalAuthResult> {
  const token = await credential.user.getIdToken(true);
  const result = await postJson<PortalAuthResult>("/portal/firebase-auth", { token }, { Authorization: `Bearer ${token}` });
  // GitHub exposes the account handle here (`username`); other providers leave
  // it null. We persist it so a later saved-account click can hint that account.
  const providerUsername = getAdditionalUserInfo(credential)?.username;
  return providerUsername ? { ...result, providerUsername } : result;
}

export async function loginWithGoogleFirebase(loginHint?: string): Promise<PortalAuthResult> {
  if (window.electronApi?.onDeeplink) return loginInSystemBrowser("google", loginHint);
  return await exchangeFirebaseCredential(await signInWithGoogle(loginHint));
}

export async function loginWithAppleFirebase(): Promise<PortalAuthResult> {
  if (window.electronApi?.onDeeplink) return loginInSystemBrowser("apple");
  return await exchangeFirebaseCredential(await signInWithApple());
}

export async function loginWithGithubFirebase(login?: string): Promise<PortalAuthResult> {
  if (window.electronApi?.onDeeplink) return loginInSystemBrowser("github", login);
  return await exchangeFirebaseCredential(await signInWithGithub(login));
}

export async function loginWithMicrosoftFirebase(loginHint?: string): Promise<PortalAuthResult> {
  if (window.electronApi?.onDeeplink) return loginInSystemBrowser("microsoft", loginHint);
  return await exchangeFirebaseCredential(await signInWithMicrosoft(loginHint));
}

export async function loginWithRecoveryCode(email: string, code: string): Promise<PortalAuthResult> {
  return await postJson<PortalAuthResult>("/portal/auth/recovery/verify", { email, code });
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
