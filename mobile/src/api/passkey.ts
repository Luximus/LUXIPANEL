/**
 * Passkey login flow for the React Native app, built on react-native-passkey
 * (which targets iOS 16+ AuthenticationServices and Android 14+ Credential
 * Manager). The backend still drives challenge generation and verification.
 *
 * Build requirements (NOT Expo Go):
 *   • iOS: an Associated Domains entitlement listing `webcredentials:<rpId>`
 *     plus a matching apple-app-site-association file at
 *     https://<rpId>/.well-known/apple-app-site-association.
 *   • Android: a Digital Asset Links file at
 *     https://<rpId>/.well-known/assetlinks.json mapping the package id and
 *     SHA-256 cert fingerprint of the app.
 *
 * Outside of a development client (e.g. Expo Go) the native module is absent —
 * `isPasskeySupported()` returns false and the app falls back to recovery
 * codes.
 */
import { NativeModules } from "react-native";
import { ENV } from "../config/env";
import { request } from "./client";
import type { PortalAuthResult } from "./portal-auth";

let cachedPasskey: typeof import("react-native-passkey") | null | undefined;

function loadPasskeyModule(): typeof import("react-native-passkey") | null {
  if (cachedPasskey !== undefined) return cachedPasskey;
  try {
    // require avoids crashing when the native module isn't bundled (Expo Go).
    cachedPasskey = require("react-native-passkey");
  } catch {
    cachedPasskey = null;
  }
  return cachedPasskey ?? null;
}

export function isPasskeySupported(): boolean {
  // The native module is absent in Expo Go (and any JS-only runtime).
  // Passkey.isSupported() only checks Platform.OS/Version, so without this
  // guard we'd advertise passkeys in Expo Go and fail at ceremony time.
  if (!NativeModules?.Passkey) return false;
  const mod = loadPasskeyModule();
  if (!mod) return false;
  const Passkey = (mod as any).Passkey;
  if (!Passkey) return false;
  try {
    return typeof Passkey.isSupported === "function" ? Boolean(Passkey.isSupported()) : true;
  } catch {
    return false;
  }
}

function getStringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== "object") return null;
  const v = (value as Record<string, unknown>)[field];
  return typeof v === "string" ? v : null;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${ENV.apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-platform": "app" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    throw new Error(getStringField(data, "error") ?? `HTTP ${res.status}`);
  }
  return data as T;
}

async function postAuthedJson<T>(path: string, token: string, body?: unknown): Promise<T> {
  return await request<T>(path, token, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Run a passkey assertion ceremony for the given email and exchange it
 * for a portal session JWT (or an MFA-pending token if 2FA is on).
 */
export async function loginWithPasskey(email: string): Promise<PortalAuthResult> {
  if (!NativeModules?.Passkey) {
    throw new Error("Passkeys requieren una build nativa de la app (no funcionan en Expo Go)");
  }
  const mod = loadPasskeyModule();
  if (!mod) throw new Error("Passkeys requieren una build nativa de la app");
  const Passkey = (mod as any).Passkey;
  // react-native-passkey v3 renamed authenticate() → get(). Keep a fallback
  // for the older API just in case the package gets pinned to v2 again.
  const assertion: ((req: unknown) => Promise<unknown>) | undefined =
    Passkey?.get?.bind(Passkey) ?? Passkey?.authenticate?.bind(Passkey);
  if (!assertion) throw new Error("Passkeys no disponibles en este dispositivo");

  const opts = await postJson<{ ok: boolean; data: any }>("/portal/auth/passkeys/auth-options", { email });

  // react-native-passkey expects the same JSON shape the backend already
  // emits; it returns a credential in the same shape the verify endpoint
  // expects, so we forward it as-is.
  const request = {
    ...opts.data,
    rpId: opts.data.rpId ?? ENV.passkeyRpId,
  };
  const credential = await assertion(request);

  return await postJson<PortalAuthResult>("/portal/auth/passkeys/auth-verify", credential);
}

/**
 * Run a passkey assertion ceremony for a step-up (re-auth) flow. Unlike
 * `loginWithPasskey`, the backend already issued the assertion options (pinned
 * to a step-up scope) and the verify endpoint differs, so this only drives the
 * native ceremony and hands the resulting credential back to the caller. Reuses
 * the exact same native module + request-shaping as the login passkey flow.
 */
export async function assertPasskeyForStepUp(options: any): Promise<unknown> {
  if (!NativeModules?.Passkey) {
    throw new Error("Passkeys requieren una build nativa de la app (no funcionan en Expo Go)");
  }
  const mod = loadPasskeyModule();
  if (!mod) throw new Error("Passkeys requieren una build nativa de la app");
  const Passkey = (mod as any).Passkey;
  const assertion: ((req: unknown) => Promise<unknown>) | undefined =
    Passkey?.get?.bind(Passkey) ?? Passkey?.authenticate?.bind(Passkey);
  if (!assertion) throw new Error("Passkeys no disponibles en este dispositivo");

  const request = {
    ...options,
    rpId: options?.rpId ?? ENV.passkeyRpId,
  };
  return await assertion(request);
}

export async function registerPasskey(label: string, token: string): Promise<void> {
  if (!NativeModules?.Passkey) {
    throw new Error("Passkeys requieren una build nativa de la app");
  }
  const mod = loadPasskeyModule();
  if (!mod) throw new Error("Passkeys requieren una build nativa de la app");
  const Passkey = (mod as any).Passkey;
  const createCredential: ((req: unknown) => Promise<unknown>) | undefined =
    Passkey?.create?.bind(Passkey) ?? Passkey?.register?.bind(Passkey);
  if (!createCredential) throw new Error("Registro de passkeys no disponible en este dispositivo");

  const opts = await postAuthedJson<{ ok: boolean; data: any }>("/portal/auth/passkeys/register-options", token);
  const request = {
    ...opts.data,
    rp: {
      ...opts.data.rp,
      id: opts.data.rp?.id ?? ENV.passkeyRpId,
    },
  };
  const credential = await createCredential(request);
  await postAuthedJson("/portal/auth/passkeys/register-verify", token, {
    label,
    response: credential,
  });
}
