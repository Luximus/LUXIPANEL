import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext, type AuthContextValue, type LoginPrimaryResult } from "./auth-context";
import {
  loginWithGoogleFirebase,
  loginWithAppleFirebase,
  loginWithGithubFirebase,
  loginWithMicrosoftFirebase,
  loginWithRecoveryCode,
  refreshPortalSession,
  requestPasskey,
  revokePortalSession,
  verifyMfaCode,
  type PortalAuthResult,
  type PortalCustomerSummary,
} from "../api/portal-auth";
import {
  clearPortalSession,
  clearRefreshToken,
  loadPortalSession,
  loadRefreshToken,
  savePortalSession,
  saveRefreshToken,
  saveAccountRefreshToken,
  loadAccountRefreshToken,
  removeAccountRefreshToken,
  type PortalSessionRecord,
} from "../storage/portalSession";
import {
  loadSavedAccounts,
  removeSavedAccount,
  reorderSavedAccounts,
  updateSavedAccountPhoto,
  upsertSavedAccount,
  type AccountProvider,
  type SavedAccount,
} from "../storage/savedAccounts";
import { signOutGoogle } from "../lib/firebase";
import { isLoginCancelled } from "../lib/error-localization";
import { setSessionRefreshHandler } from "../api/auth-bridge";

function fromCustomer(customer: PortalCustomerSummary, provider: AccountProvider | null, providerUsername?: string | null): SavedAccount {
  return {
    uid: customer.id,
    email: customer.email,
    displayName: customer.name ?? null,
    photoURL: customer.photoUrl ?? null,
    provider,
    providerUsername: providerUsername ?? null,
    lastLogin: Date.now(),
  };
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "No se pudo iniciar sesión";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => loadSavedAccounts());

  // A single in-flight refresh shared by every caller (cold-start restore AND
  // the 401 retry bridge). Refresh tokens are SINGLE-USE and rotate on the
  // server: two concurrent refreshes would POST the same token, the second
  // arriving after the first already rotated it — tripping server-side reuse
  // detection, which burns the whole token family and forces a spurious
  // re-login on the next launch. Coalescing into one rotation prevents that.
  const refreshInflightRef = useRef<Promise<string | null> | null>(null);

  // Mint a fresh access JWT from the stored refresh token (no provider re-auth).
  // Returns the new token, or null if there's no usable refresh token (in which
  // case any stale local session is cleared). Shared by cold-start restore and
  // the 401 retry bridge.
  const refreshSession = useCallback((): Promise<string | null> => {
    if (refreshInflightRef.current) return refreshInflightRef.current;
    const run = (async (): Promise<string | null> => {
      const refresh = loadRefreshToken();
      if (!refresh) return null;
      try {
        const result = await refreshPortalSession(refresh.token);
        if (result.sessionToken && result.expiresAt && result.customer) {
          savePortalSession({ token: result.sessionToken, expiresAt: result.expiresAt, customer: result.customer });
          if (result.refreshToken && result.refreshExpiresAt) {
            const rec = { token: result.refreshToken, expiresAt: result.refreshExpiresAt };
            saveRefreshToken(rec);
            saveAccountRefreshToken(result.customer.id, rec);
          }
          setToken(result.sessionToken);
          setUserEmail(result.customer.email);
          return result.sessionToken;
        }
        return null;
      } catch {
        // Expired / revoked / reused → drop everything; the login screen takes over.
        clearRefreshToken();
        clearPortalSession();
        setToken(null);
        setUserEmail(null);
        return null;
      }
    })();
    refreshInflightRef.current = run;
    void run.finally(() => { refreshInflightRef.current = null; });
    return run;
  }, []);

  // Restore the previous session on cold start. If the short-lived access JWT
  // has lapsed but a refresh token survives, silently mint a fresh access JWT
  // (no provider re-auth) before falling back to the login screen.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const restored = loadPortalSession();
      if (restored) {
        setToken(restored.token);
        setUserEmail(restored.customer.email ?? null);
      } else {
        await refreshSession();
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshSession]);

  // Let the API layer recover from a mid-session 401 (access JWT expired while
  // the app stayed open) by refreshing + retrying, without bouncing to login.
  useEffect(() => {
    setSessionRefreshHandler(() => refreshSession());
    return () => setSessionRefreshHandler(null);
  }, [refreshSession]);

  // Provider of the in-flight primary auth, so a session completed through the
  // 2FA step (verifyMfa) is still tagged with the right provider.
  const pendingProviderRef = useRef<AccountProvider | null>(null);

  const persistSession = useCallback((result: PortalAuthResult, provider: AccountProvider | null): void => {
    if (!result.sessionToken || !result.expiresAt || !result.customer) return;
    const record: PortalSessionRecord = {
      token: result.sessionToken,
      expiresAt: result.expiresAt,
      customer: result.customer,
    };
    savePortalSession(record);
    console.log("[diag persistSession]", provider, "uid:", result.customer.id, "refreshToken?", !!(result.refreshToken && result.refreshExpiresAt));
    if (result.refreshToken && result.refreshExpiresAt) {
      const rec = { token: result.refreshToken, expiresAt: result.refreshExpiresAt };
      saveRefreshToken(rec);
      saveAccountRefreshToken(result.customer.id, rec);
    }
    setToken(result.sessionToken);
    setUserEmail(result.customer.email);
    setSavedAccounts(upsertSavedAccount(fromCustomer(result.customer, provider, result.providerUsername)));
  }, []);

  // Sign in to a SAVED ACCOUNT without re-running its provider: redeem that
  // account's own refresh token for a fresh session. Returns true on success;
  // false (and forgets the dead token) when the account has no usable refresh
  // token, so the caller falls back to a full provider re-auth.
  const loginWithSavedAccount = useCallback(async (account: SavedAccount): Promise<boolean> => {
    const stored = loadAccountRefreshToken(account.uid);
    console.log("[diag savedAccount] select", account.provider, "uid:", account.uid, "hasToken:", !!stored);
    if (!stored) return false;
    setLicenseError(null);
    try {
      const result = await refreshPortalSession(stored.token);
      const ok = !!(result.sessionToken && result.expiresAt && result.customer);
      console.log("[diag savedAccount] refresh ok:", ok);
      if (ok) {
        // Preserve the provider/username already on the saved account (the
        // refresh response doesn't carry them) so the chip keeps its hint.
        persistSession({ ...result, providerUsername: account.providerUsername ?? undefined }, account.provider ?? null);
        return true;
      }
      return false;
    } catch (e) {
      console.log("[diag savedAccount] refresh FAILED:", (e as Error)?.message ?? e);
      // Expired / revoked / reused → forget this account's token so the next
      // click goes straight to the provider instead of retrying a dead token.
      removeAccountRefreshToken(account.uid);
      return false;
    }
  }, [persistSession]);

  const loginWithPasskey = useCallback(async (email: string): Promise<LoginPrimaryResult> => {
    setLicenseError(null);
    pendingProviderRef.current = "passkey";
    try {
      const result = await requestPasskey(email);
      if (result.mfaPending && result.mfaToken) {
        return { mfaPending: true, mfaToken: result.mfaToken };
      }
      persistSession(result, "passkey");
      return { mfaPending: false };
    } catch (err) {
      setLicenseError(describeError(err));
      throw err;
    }
  }, [persistSession]);

  const loginWithFirebaseProvider = useCallback(async (run: () => Promise<PortalAuthResult>, provider: AccountProvider): Promise<void> => {
    setLicenseError(null);
    try {
      const result = await run();
      if (!result.sessionToken || !result.expiresAt || !result.customer) {
        throw new Error("El backend no devolvio una sesion.");
      }
      persistSession(result, provider);
    } catch (err) {
      // Cerrar el popup del proveedor es una cancelación, no un fallo: no fijamos
      // error (ya se limpió arriba) para que la pantalla vuelva limpia y se pueda
      // reintentar. Re-lanzamos igual para que el handler resetee `busy`.
      if (!isLoginCancelled(err)) setLicenseError(describeError(err));
      throw err;
    }
  }, [persistSession]);

  const loginWithGoogle = useCallback((loginHint?: string) => loginWithFirebaseProvider(() => loginWithGoogleFirebase(loginHint), "google"), [loginWithFirebaseProvider]);
  const loginWithApple = useCallback(() => loginWithFirebaseProvider(loginWithAppleFirebase, "apple"), [loginWithFirebaseProvider]);
  const loginWithGithub = useCallback((login?: string) => loginWithFirebaseProvider(() => loginWithGithubFirebase(login), "github"), [loginWithFirebaseProvider]);
  const loginWithMicrosoft = useCallback((loginHint?: string) => loginWithFirebaseProvider(() => loginWithMicrosoftFirebase(loginHint), "microsoft"), [loginWithFirebaseProvider]);

  const loginWithRecovery = useCallback(async (email: string, code: string): Promise<LoginPrimaryResult> => {
    setLicenseError(null);
    pendingProviderRef.current = "recovery";
    try {
      const result = await loginWithRecoveryCode(email, code);
      if (result.mfaPending && result.mfaToken) {
        return { mfaPending: true, mfaToken: result.mfaToken };
      }
      persistSession(result, "recovery");
      return { mfaPending: false };
    } catch (err) {
      setLicenseError(describeError(err));
      throw err;
    }
  }, [persistSession]);

  const verifyMfa = useCallback(async (mfaToken: string, code: string): Promise<void> => {
    setLicenseError(null);
    try {
      const result = await verifyMfaCode(mfaToken, code);
      persistSession(result, pendingProviderRef.current);
    } catch (err) {
      setLicenseError(describeError(err));
      throw err;
    }
  }, [persistSession]);

  const logout = useCallback(async () => {
    const refresh = loadRefreshToken();
    if (refresh) await revokePortalSession(refresh.token);
    // Forget the active account's remembered session too (it was just revoked
    // server-side); its saved-account chip will need a full login next time.
    const active = loadPortalSession();
    if (active?.customer?.id) removeAccountRefreshToken(active.customer.id);
    await signOutGoogle().catch(() => undefined);
    clearPortalSession();
    clearRefreshToken();
    setToken(null);
    setUserEmail(null);
  }, []);

  // Switching accounts is NOT a logout: keep every saved account "remembered"
  // (its per-account refresh token stays, un-revoked) so re-selecting one logs
  // in silently via /portal/auth/refresh — crucial for Apple, which has no
  // silent IdP re-auth and would otherwise show its full sign-in sheet every
  // time. Only the ACTIVE session is cleared so the account switcher reappears.
  // (Mirrors the web's handleSwitchAccount in components/navbar/AccountView.tsx.)
  const switchAccount = useCallback(async () => {
    console.log("[diag switchAccount] NUEVO: limpia sesión activa, CONSERVA tokens por-cuenta (sin revocar)");
    await signOutGoogle().catch(() => undefined);
    clearPortalSession();
    clearRefreshToken();
    setToken(null);
    setUserEmail(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      loading,
      userEmail,
      licenseError,
      loginWithGoogle,
      loginWithApple,
      loginWithGithub,
      loginWithMicrosoft,
      loginWithPasskey,
      loginWithRecovery,
      loginWithSavedAccount,
      verifyMfa,
      switchAccount,
      logout,
      savedAccounts,
      updateAccountPhoto: (uid: string, photoURL: string | null) => {
        setSavedAccounts(updateSavedAccountPhoto(uid, photoURL));
      },
      removeAccount: (email: string) => {
        const gone = savedAccounts.find((a) => a.email === email);
        if (gone) removeAccountRefreshToken(gone.uid);
        setSavedAccounts(removeSavedAccount(email));
      },
      reorderAccounts: (emailsInOrder: string[]) => setSavedAccounts(reorderSavedAccounts(emailsInOrder)),
    }),
    [licenseError, loading, token, userEmail, savedAccounts, loginWithGoogle, loginWithApple, loginWithGithub, loginWithMicrosoft, loginWithPasskey, loginWithRecovery, loginWithSavedAccount, verifyMfa, switchAccount, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
