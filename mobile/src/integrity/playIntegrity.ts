/**
 * Play Integrity Standard-request provider manager (Android-only).
 *
 * Wraps @expo/app-integrity's Android Standard-request API:
 *   - prepareIntegrityTokenProviderAsync(cloudProjectNumber): warms a token
 *     provider tied to the GCP project. Expensive; do it ONCE and reuse.
 *   - requestIntegrityCheckAsync(requestHash): mints a short-lived integrity
 *     token bound to the given request hash.
 *
 * Gating (all must hold or this layer is a complete no-op):
 *   - Platform.OS === "android"
 *   - ENV.playIntegrityEnabled
 *
 * Dev bypass: only when __DEV__ === true AND ENV.playIntegrityDevBypass. It can
 * NEVER silently fire in a production build (__DEV__ is false there).
 *
 * Security: integrity tokens are opaque secrets — they are NEVER logged in full
 * (only short, redacted markers). Errors are returned as a discriminated
 * `{ code, message }` union so the UI can show a generic failure without
 * leaking internals.
 */
import { Platform } from "react-native";
import { ENV } from "../config/env";

export type IntegrityErrorCode =
  | "DISABLED" // layer not active for this platform/config (caller proceeds without a token)
  | "DEV_BYPASS" // dev-only explicit bypass active (caller proceeds without a token)
  | "NOT_CONFIGURED" // enabled on Android but no GCP project number set
  | "PREPARE_FAILED" // provider could not be prepared
  | "TOKEN_FAILED"; // token request failed after retries

export type IntegrityTokenResult =
  | { ok: true; token: string }
  | { ok: false; code: IntegrityErrorCode; message: string };

const MAX_TOKEN_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 250;

/** Shared in-flight prepare promise so concurrent callers init the provider
 *  exactly once (no duplicate concurrent inits). Reset on failure / invalidation. */
let prepareInFlight: Promise<void> | null = null;
/** True once a prepare has resolved successfully. */
let providerReady = false;

/** True when the integrity layer is active for the current platform + config. */
export function isIntegrityActive(): boolean {
  return Platform.OS === "android" && ENV.playIntegrityEnabled;
}

/** True when the explicit, dev-only bypass should short-circuit token minting.
 *  Requires BOTH __DEV__ and the env flag — inert in any production build. */
function isDevBypass(): boolean {
  return __DEV__ === true && ENV.playIntegrityDevBypass === true;
}

function redactToken(token: string): string {
  // Never log the full token. Length + a tiny prefix is enough for debugging.
  return `len=${token.length} prefix=${token.slice(0, 6)}…`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Prepare the integrity token provider exactly once, sharing the in-flight
 * promise across concurrent callers. Resolves quickly if already prepared.
 */
export async function prepareProvider(): Promise<void> {
  if (providerReady) return;
  if (prepareInFlight) return prepareInFlight;

  const projectNumber = ENV.googleCloudProjectNumber;
  prepareInFlight = (async () => {
    // Disabled integrity must not require a native module at app startup.
    // When enabled, a missing module remains a hard failure for protected calls.
    const integrity = await import("@expo/app-integrity");
    await integrity.prepareIntegrityTokenProviderAsync(projectNumber);
    providerReady = true;
  })();

  try {
    await prepareInFlight;
  } catch (error) {
    // Allow a later attempt to re-prepare after a transient failure.
    prepareInFlight = null;
    providerReady = false;
    throw error;
  }
}

/** Force the next getIntegrityToken to re-prepare the provider (used when the
 *  provider becomes invalid mid-session). */
function invalidateProvider(): void {
  providerReady = false;
  prepareInFlight = null;
}

/**
 * Fire-and-forget warm-up to call early at app start. Reduces first-token
 * latency by preparing the provider ahead of the first sensitive operation.
 * Swallows all errors and never throws — must not block startup. No-op unless
 * the layer is active and a project number is configured.
 */
export function warmUpIntegrity(): void {
  if (!isIntegrityActive() || isDevBypass()) return;
  if (!ENV.googleCloudProjectNumber) return;
  void prepareProvider().catch(() => {
    // Latency optimization only; the real request will surface a hard failure.
  });
}

/**
 * Mint a Standard-request integrity token bound to `requestHash`.
 *
 * Behavior:
 *   - returns { ok:false, code:"DISABLED" } when the layer is inactive
 *   - returns { ok:false, code:"DEV_BYPASS" } when the dev bypass is active
 *   - returns { ok:false, code:"NOT_CONFIGURED" } when no project number is set
 *   - prepares the provider lazily (once); if the provider became invalid it
 *     re-prepares and retries the token request EXACTLY once
 *   - for transient token errors, retries with capped backoff (no infinite loop)
 */
export async function getIntegrityToken(requestHash: string): Promise<IntegrityTokenResult> {
  if (!isIntegrityActive()) {
    return { ok: false, code: "DISABLED", message: "Integrity layer inactive." };
  }
  if (isDevBypass()) {
    return { ok: false, code: "DEV_BYPASS", message: "Dev bypass active." };
  }
  if (!ENV.googleCloudProjectNumber) {
    return { ok: false, code: "NOT_CONFIGURED", message: "Missing GCP project number." };
  }

  // Ensure the provider is prepared before requesting a token.
  try {
    await prepareProvider();
  } catch (error) {
    return {
      ok: false,
      code: "PREPARE_FAILED",
      message: error instanceof Error ? error.message : "Provider prepare failed.",
    };
  }

  let reprepared = false;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_TOKEN_ATTEMPTS; attempt++) {
    try {
      const integrity = await import("@expo/app-integrity");
      const token = await integrity.requestIntegrityCheckAsync(requestHash);
      if (token && typeof token === "string") {
        if (__DEV__) {
          // Redacted marker only — never the full token.
          console.log(`[play-integrity] token minted (${redactToken(token)})`);
        }
        return { ok: true, token };
      }
      lastError = new Error("Empty integrity token.");
    } catch (error) {
      lastError = error;
      // The provider may have become invalid (e.g. expired). Re-prepare and
      // retry EXACTLY once outside the normal transient-backoff budget.
      if (!reprepared) {
        reprepared = true;
        invalidateProvider();
        try {
          await prepareProvider();
          continue; // retry immediately with a fresh provider
        } catch {
          // fall through to backoff/retry budget below
        }
      }
    }

    if (attempt < MAX_TOKEN_ATTEMPTS) {
      await delay(BASE_BACKOFF_MS * attempt);
    }
  }

  return {
    ok: false,
    code: "TOKEN_FAILED",
    message: lastError instanceof Error ? lastError.message : "Integrity token request failed.",
  };
}
