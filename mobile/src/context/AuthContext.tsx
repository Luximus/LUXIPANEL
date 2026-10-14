import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NativeModules, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as AuthSession from "expo-auth-session";
import { AuthContext, type AuthContextValue, type LoginPrimaryResult } from "./auth-context";
import {
  loginWithFirebaseToken,
  loginWithRecoveryCode,
  verifyMfaCode,
  exchangeGithubCode,
  refreshPortalSession,
  revokePortalSession,
  type PortalAuthResult,
  type PortalCustomerSummary,
} from "../api/portal-auth";
import { ENV } from "../config/env";

const GITHUB_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
};
import { isPasskeySupported, loginWithPasskey as runPasskey } from "../api/passkey";
import { registerForPushNotifications, unregisterForPushNotifications } from "../lib/notifications";
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
  loadSavedAccountsSync,
  patchSavedAccount,
  removeSavedAccount,
  reorderSavedAccounts,
  upsertSavedAccount,
  type AccountProvider,
  type SavedAccount,
} from "../storage/savedAccounts";
import { hydrateSessionState } from "../lib/session-state";
import { resetAllStores } from "../lib/store-reset";
import { LoginCancelledError, isLoginCancelled } from "../lib/error-localization";
import { setSessionRefreshHandler } from "../api/auth-bridge";

WebBrowser.maybeCompleteAuthSession();

type GoogleSigninModule = typeof import("@react-native-google-signin/google-signin");
type FirebaseAuthModule = typeof import("@react-native-firebase/auth").default;

let cachedGoogleSignin: GoogleSigninModule | null | undefined;
let cachedFirebaseAuth: FirebaseAuthModule | null | undefined;

function loadGoogleSigninModule(): GoogleSigninModule | null {
  if (cachedGoogleSignin !== undefined) return cachedGoogleSignin;
  if (!NativeModules?.RNGoogleSignin) {
    cachedGoogleSignin = null;
    return null;
  }
  try {
    cachedGoogleSignin = require("@react-native-google-signin/google-signin") as GoogleSigninModule;
  } catch {
    cachedGoogleSignin = null;
  }
  return cachedGoogleSignin;
}

function loadFirebaseAuthModule(): FirebaseAuthModule | null {
  if (cachedFirebaseAuth !== undefined) return cachedFirebaseAuth;
  if (!NativeModules?.RNFBAuthModule) {
    cachedFirebaseAuth = null;
    return null;
  }
  try {
    cachedFirebaseAuth = require("@react-native-firebase/auth").default as FirebaseAuthModule;
  } catch {
    cachedFirebaseAuth = null;
  }
  return cachedFirebaseAuth;
}

function fromCustomer(customer: PortalCustomerSummary, provider: AccountProvider | null, providerUsername?: string | null): SavedAccount {
  return {
    uid: customer.id,
    email: customer.email,
    displayName: customer.name ?? null,
    photoURL: customer.photoUrl ?? null,
    provider,
    providerUsername: providerUsername ?? null,
    company: customer.company ?? null,
    country: customer.country ?? null,
    phone: customer.phone ?? null,
    locale: customer.locale ?? null,
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
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => loadSavedAccountsSync());
  const [appleSupported, setAppleSupported] = useState(false);
  const githubSupported = ENV.githubClientId.length > 0;
  const microsoftSupported = ENV.microsoftClientId.length > 0;
  useEffect(() => {
    const google = loadGoogleSigninModule();
    if (!google) return;
    google.GoogleSignin.configure({
      webClientId: ENV.googleWebClientId || undefined,
      scopes: ["profile", "email"],
    });
  }, []);

  // Sign in with Apple solo está disponible en iOS 13+ (y no en Expo Go).
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => { if (active) setAppleSupported(ok); })
      .catch(() => { if (active) setAppleSupported(false); });
    return () => { active = false; };
  }, []);

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
      const refresh = await loadRefreshToken();
      if (!refresh) return null;
      try {
        const result = await refreshPortalSession(refresh.token);
        if (result.sessionToken && result.expiresAt && result.customer) {
          await savePortalSession({ token: result.sessionToken, expiresAt: result.expiresAt, customer: result.customer });
          if (result.refreshToken && result.refreshExpiresAt) {
            const rec = { token: result.refreshToken, expiresAt: result.refreshExpiresAt };
            await saveRefreshToken(rec);
            await saveAccountRefreshToken(result.customer.id, rec);
          }
          setToken(result.sessionToken);
          setUserEmail(result.customer.email);
          return result.sessionToken;
        }
        return null;
      } catch {
        // Expired / revoked / reused → drop everything; the login screen takes over.
        // Same hygiene as an explicit logout: the next login may be a different
        // account, so module-level stores must not survive this forced sign-out.
        await clearRefreshToken();
        await clearPortalSession();
        resetAllStores();
        setToken(null);
        setUserEmail(null);
        return null;
      }
    })();
    refreshInflightRef.current = run;
    void run.finally(() => { refreshInflightRef.current = null; });
    return run;
  }, []);

  useEffect(() => {
    void hydrateSessionState();
    void loadSavedAccounts().then(setSavedAccounts);
    // Restore the session on cold start. If the short-lived access JWT has
    // lapsed but a refresh token survives, silently mint a fresh access JWT
    // (no provider re-auth) before falling back to the login screen.
    void (async () => {
      const record = await loadPortalSession();
      let sessionToken: string | null = null;
      if (record) {
        setToken(record.token);
        setUserEmail(record.customer.email);
        sessionToken = record.token;
      } else {
        sessionToken = await refreshSession();
      }
      // Re-alta del push en CADA arranque con sesión viva: el token de Expo puede
      // rotar (reinstalación, restore, limpieza del SO) y la sesión restaurada de
      // disco no pasa por `persistSession`. El backend hace upsert por token, así
      // que repetirlo es inocuo. Antes NADIE llamaba a `registerForPushNotifications`
      // (solo se DABA DE BAJA en el logout): el dispositivo jamás se registraba y
      // ninguna push (alertas de servidor, respuestas de soporte) llegaba.
      if (sessionToken) void registerForPushNotifications(sessionToken);
      setLoading(false);
    })();
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

  const persistSession = useCallback(async (result: PortalAuthResult, provider: AccountProvider | null): Promise<void> => {
    if (!result.sessionToken || !result.expiresAt || !result.customer) return;
    const record: PortalSessionRecord = {
      token: result.sessionToken,
      expiresAt: result.expiresAt,
      customer: result.customer,
    };
    await savePortalSession(record);
    if (result.refreshToken && result.refreshExpiresAt) {
      const rec = { token: result.refreshToken, expiresAt: result.refreshExpiresAt };
      await saveRefreshToken(rec);
      await saveAccountRefreshToken(result.customer.id, rec);
    }
    setToken(result.sessionToken);
    setUserEmail(result.customer.email);
    // Alta de ESTE dispositivo en el push remoto con la sesión recién creada. El
    // backend hace upsert por token de dispositivo, así que reasigna el teléfono
    // a la cuenta que acaba de entrar (clave tras un cambio de cuenta: el logout
    // da de baja, pero `switchAccount` no, y sin este alta el teléfono se quedaba
    // apuntando a la cuenta saliente). Best-effort: nunca lanza.
    void registerForPushNotifications(result.sessionToken);
    const next = await upsertSavedAccount(fromCustomer(result.customer, provider, result.providerUsername));
    setSavedAccounts(next);
  }, []);

  // Sign in to a SAVED ACCOUNT without re-running its provider: redeem that
  // account's own refresh token for a fresh session. Resolves true on success;
  // false (and forgets the dead token) when the account has no usable refresh
  // token, so the caller falls back to a full provider re-auth.
  const loginWithSavedAccount = useCallback(async (account: SavedAccount): Promise<boolean> => {
    const stored = await loadAccountRefreshToken(account.uid);
    if (!stored) return false;
    setLicenseError(null);
    try {
      const result = await refreshPortalSession(stored.token);
      if (result.sessionToken && result.expiresAt && result.customer) {
        // Preserve the provider/username already on the saved account (the
        // refresh response doesn't carry them) so the chip keeps its hint.
        await persistSession({ ...result, providerUsername: account.providerUsername ?? undefined }, account.provider ?? null);
        return true;
      }
      return false;
    } catch {
      await removeAccountRefreshToken(account.uid);
      return false;
    }
  }, [persistSession]);

  const loginWithPasskey = useCallback(async (email: string): Promise<LoginPrimaryResult> => {
    setLicenseError(null);
    pendingProviderRef.current = "passkey";
    try {
      const result = await runPasskey(email);
      if (result.mfaPending && result.mfaToken) {
        return { mfaPending: true, mfaToken: result.mfaToken };
      }
      await persistSession(result, "passkey");
      return { mfaPending: false };
    } catch (err) {
      setLicenseError(describeError(err));
      throw err;
    }
  }, [persistSession]);

  const loginWithGoogle = useCallback(async (loginHint?: string): Promise<void> => {
    setLicenseError(null);
    let signInCancelledCode: string | undefined;
    try {
      const google = loadGoogleSigninModule();
      const rnfbAuth = loadFirebaseAuthModule();
      if (!google || !rnfbAuth) {
        throw new Error("Google Sign-In requiere una development build nativa. Para pruebas en Expo Go usa código de recuperación o modo invitado.");
      }
      const { GoogleSignin, statusCodes } = google;
      signInCancelledCode = statusCodes.SIGN_IN_CANCELLED;
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { data } = await GoogleSignin.signIn(loginHint ? { loginHint } : undefined);
      const idToken = data?.idToken;
      if (!idToken) {
        throw new Error("Google no devolvio id_token.");
      }
      const credential = rnfbAuth.GoogleAuthProvider.credential(idToken);
      const firebaseUser = await rnfbAuth().signInWithCredential(credential);
      const firebaseToken = await firebaseUser.user.getIdToken();
      const result = await loginWithFirebaseToken(firebaseToken);
      await persistSession(result, "google");
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === signInCancelledCode
      ) {
        // El usuario cerró la hoja de Google: cancelación, no fallo. Señalamos con
        // el sentinel para que la pantalla vuelva limpia (sin error) y reintente.
        throw new LoginCancelledError();
      }
      setLicenseError(describeError(err));
      throw err;
    }
  }, [persistSession]);

  const loginWithApple = useCallback(async (): Promise<void> => {
    setLicenseError(null);
    try {
      const rnfbAuth = loadFirebaseAuthModule();
      if (!rnfbAuth) {
        throw new Error("Sign in with Apple requiere una development build nativa (no funciona en Expo Go).");
      }
      // Nonce anti-replay: Apple firma el SHA-256 del nonce; pasamos el nonce
      // crudo a Firebase, que verifica que el hash del token coincida.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!appleCredential.identityToken) {
        throw new Error("Apple no devolvio identityToken.");
      }
      const credential = rnfbAuth.AppleAuthProvider.credential(appleCredential.identityToken, rawNonce);
      const firebaseUser = await rnfbAuth().signInWithCredential(credential);
      const firebaseToken = await firebaseUser.user.getIdToken();
      const result = await loginWithFirebaseToken(firebaseToken);
      await persistSession(result, "apple");
    } catch (err: unknown) {
      const code = typeof err === "object" && err !== null && "code" in err ? (err as { code: string }).code : "";
      if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") {
        throw new LoginCancelledError();
      }
      setLicenseError(describeError(err));
      throw err;
    }
  }, [persistSession]);

  const loginWithGithub = useCallback(async (login?: string): Promise<void> => {
    setLicenseError(null);
    try {
      const rnfbAuth = loadFirebaseAuthModule();
      if (!rnfbAuth) {
        throw new Error("GitHub Sign-In requiere una development build nativa (no funciona en Expo Go).");
      }
      if (!ENV.githubClientId) {
        throw new Error("GitHub no esta configurado en esta app.");
      }
      // PKCE no aplica: GitHub OAuth App exige client_secret, así que el `code`
      // se intercambia en el backend (ver exchangeGithubCode). El redirectUri
      // debe estar registrado en la GitHub OAuth App.
      const redirectUri = AuthSession.makeRedirectUri({ scheme: "luxipanel", path: "oauth/github" });
      const request = new AuthSession.AuthRequest({
        clientId: ENV.githubClientId,
        scopes: ["read:user", "user:email"],
        redirectUri,
        // GitHub OAuth Apps no implementan PKCE; el canje va por backend con
        // client_secret. Sin esto, expo-auth-session manda un code_challenge
        // que GitHub ignora (inofensivo), pero lo dejamos explícito.
        usePKCE: false,
        // Cuenta guardada → sugiere el username para que GitHub preseleccione
        // esa cuenta en su pantalla de autorización.
        extraParams: login ? { login } : undefined,
      });
      await request.makeAuthUrlAsync(GITHUB_DISCOVERY);
      const result = await request.promptAsync(GITHUB_DISCOVERY);
      if (result.type !== "success" || !result.params.code) {
        if (result.type === "cancel" || result.type === "dismiss") {
          // Cerró la pestaña de GitHub: cancelación, no fallo (ver catch).
          throw new LoginCancelledError();
        }
        throw new Error("No se pudo completar el inicio con GitHub.");
      }
      const accessToken = await exchangeGithubCode(result.params.code, redirectUri);
      const credential = rnfbAuth.GithubAuthProvider.credential(accessToken);
      const firebaseUser = await rnfbAuth().signInWithCredential(credential);
      const firebaseToken = await firebaseUser.user.getIdToken();
      const portalResult = await loginWithFirebaseToken(firebaseToken);
      // GitHub expone el handle de la cuenta (`username`) en additionalUserInfo;
      // lo guardamos para hintear esta cuenta en un futuro re-login.
      const providerUsername = firebaseUser.additionalUserInfo?.username ?? undefined;
      await persistSession(providerUsername ? { ...portalResult, providerUsername } : portalResult, "github");
    } catch (err: unknown) {
      // La cancelación (sentinel) no es un fallo: no fijamos error y la propagamos
      // intacta para que la pantalla resetee `busy` sin mostrar mensaje.
      if (!isLoginCancelled(err)) setLicenseError(describeError(err));
      throw err;
    }
  }, [persistSession]);

  const loginWithMicrosoft = useCallback(async (loginHint?: string): Promise<void> => {
    setLicenseError(null);
    try {
      const rnfbAuth = loadFirebaseAuthModule();
      if (!rnfbAuth) {
        throw new Error("Microsoft Sign-In requiere una development build nativa (no funciona en Expo Go).");
      }
      // RN Firebase NO soporta construir una credencial de Microsoft desde tokens:
      // el getCredentialForProvider nativo (Android/iOS) no tiene caso "microsoft.com"
      // en su switch → devuelve null → auth/invalid-credential. Por eso NO usamos
      // expo-auth-session + signInWithCredential aquí (a diferencia de GitHub, que sí
      // tiene caso "github.com"). En su lugar dejamos que Firebase haga el OAuth nativo
      // completo (Custom Tab / ASWebAuthenticationSession) vía su handler
      // (luxisoft.firebaseapp.com/__/auth/handler) como redirect — el MISMO flujo del
      // popup de escritorio. Firebase gestiona PKCE y nonce; no requiere el redirect de
      // esquema propio en Azure ni el client id en la app (la config de Microsoft vive
      // en el proveedor de Firebase).
      // OJO: `signInWithProvider` está en los TIPOS pero NO existe como método de
      // instancia en runtime (da "is not a function"). El método real en RN Firebase es
      // `signInWithPopup`/`signInWithRedirect`; en nativo ambos llaman a
      // native.signInWithProvider(provider.toObject()) — sin "popup" real, abren el tab.
      const provider = new rnfbAuth.OAuthProvider("microsoft.com");
      provider.addScope("email");
      provider.addScope("profile");
      // Cuenta guardada → preselecciona ese email (re-auth silencioso). Sin hint =
      // "añadir cuenta": fuerza el selector para no reutilizar la sesión SSO en
      // silencio (paridad con web/escritorio).
      provider.setCustomParameters(loginHint ? { login_hint: loginHint } : { prompt: "select_account" });
      const firebaseUser = await rnfbAuth().signInWithPopup(provider);
      const firebaseToken = await firebaseUser.user.getIdToken();
      const portalResult = await loginWithFirebaseToken(firebaseToken);
      await persistSession(portalResult, "microsoft");
    } catch (err: unknown) {
      const code = typeof err === "object" && err !== null && "code" in err ? (err as { code: string }).code : "";
      if (
        code === "auth/user-cancelled" ||
        code === "auth/web-context-cancelled" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/popup-closed-by-user"
      ) {
        throw new LoginCancelledError();
      }
      setLicenseError(describeError(err));
      throw err;
    }
  }, [persistSession]);

  const loginWithRecovery = useCallback(async (email: string, code: string): Promise<LoginPrimaryResult> => {
    setLicenseError(null);
    pendingProviderRef.current = "recovery";
    try {
      const result = await loginWithRecoveryCode(email, code);
      if (result.mfaPending && result.mfaToken) {
        return { mfaPending: true, mfaToken: result.mfaToken };
      }
      await persistSession(result, "recovery");
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
      await persistSession(result, pendingProviderRef.current);
    } catch (err) {
      setLicenseError(describeError(err));
      throw err;
    }
  }, [persistSession]);

  const logout = useCallback(async () => {
    // Desregistra el push token de ESTE dispositivo ANTES de revocar nada (el
    // access token aún es válido), para que tras cerrar sesión el teléfono deje
    // de recibir las push del servidor de esta cuenta.
    const active = await loadPortalSession();
    if (active?.token) await unregisterForPushNotifications(active.token);
    const refresh = await loadRefreshToken();
    if (refresh) await revokePortalSession(refresh.token);
    // Forget the active account's remembered session too (just revoked
    // server-side); its saved-account chip will need a full login next time.
    if (active?.customer?.id) await removeAccountRefreshToken(active.customer.id);
    await clearPortalSession();
    await clearRefreshToken();
    // Los stores module-level (tickets, llaves SSH, chats del asistente,
    // sesiones de consola/módulo…) sobreviven al desmontaje de las pantallas:
    // sin este reset el siguiente login vería los datos del usuario saliente.
    // También aborta los streams SSE/XHR del asistente aún en curso.
    resetAllStores();
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
    await clearPortalSession();
    await clearRefreshToken();
    // Cambiar de cuenta preserva los refresh tokens guardados, pero los stores
    // en memoria son de la sesión saliente: mismo reset que el logout para que
    // la cuenta entrante no vea datos (ni streams vivos) de la anterior.
    resetAllStores();
    setToken(null);
    setUserEmail(null);
  }, []);

  const passkeySupported = useMemo(() => isPasskeySupported(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      loading,
      userEmail,
      licenseError,
      passkeySupported,
      appleSupported,
      githubSupported,
      microsoftSupported,
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
      updateCurrentAccountProfile: async (patch) => {
        if (!userEmail) return;
        // Solo persiste las claves presentes en el patch (no pisa photoURL con
        // undefined cuando se edita el nombre, ni el nombre cuando se cambia la
        // foto). `photoURL: null` SÍ se propaga para volver a iniciales.
        const fields: Partial<SavedAccount> = {};
        if ("displayName" in patch) fields.displayName = patch.displayName;
        if ("company" in patch) fields.company = patch.company;
        if ("country" in patch) fields.country = patch.country;
        if ("phone" in patch) fields.phone = patch.phone;
        if ("locale" in patch) fields.locale = patch.locale;
        if ("photoURL" in patch) fields.photoURL = patch.photoURL ?? null;
        const next = await patchSavedAccount(userEmail, fields);
        setSavedAccounts(next);
      },
      savedAccounts,
      removeAccount: async (email: string) => {
        const gone = savedAccounts.find((a) => a.email === email);
        if (gone) await removeAccountRefreshToken(gone.uid);
        setSavedAccounts(await removeSavedAccount(email));
      },
      reorderAccounts: async (emailsInOrder: string[]) => setSavedAccounts(await reorderSavedAccounts(emailsInOrder)),
    }),
    [licenseError, loading, token, userEmail, savedAccounts, passkeySupported, appleSupported, githubSupported, microsoftSupported, loginWithGoogle, loginWithApple, loginWithGithub, loginWithMicrosoft, loginWithPasskey, loginWithRecovery, loginWithSavedAccount, verifyMfa, switchAccount, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
