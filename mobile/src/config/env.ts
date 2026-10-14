export const ENV = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://api.luxisoft.com",
  luxipanelUrl: process.env.EXPO_PUBLIC_LUXIPANEL_URL ?? "https://luxipanel.com",
  firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
  googleWebClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ??
    "",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  // GitHub OAuth App client id. El `code` se intercambia por un access token
  // en el backend (POST /portal/auth/github/exchange), nunca en el cliente:
  // el client_secret de GitHub vive solo en el servidor (GitHub no soporta
  // PKCE para OAuth Apps). Sólo el client id (público) va aquí.
  githubClientId: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? "",
  // Azure AD / Microsoft Entra: client id de una app PÚBLICA (plataforma
  // "Mobile and desktop") con redirect de esquema propio. A diferencia de
  // GitHub, Microsoft SÍ soporta PKCE, así que el intercambio code→token se
  // hace en el cliente sin secret. Debe ser el MISMO client id configurado en
  // el proveedor de Microsoft de Firebase (para que el aud del id_token cuadre).
  microsoftClientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? "",
  microsoftTenant: process.env.EXPO_PUBLIC_MICROSOFT_TENANT ?? "common",
  /**
   * Relying-Party domain used by react-native-passkey. MUST match the rpId
   * the backend uses when generating WebAuthn options (it derives it from
   * the request Origin or, for the app, from PUBLIC_API_BASE_URL — which is
   * api.luxisoft.com). The same domain must serve a Digital Asset Links file
   * at https://<rpId>/.well-known/assetlinks.json (Android) and an
   * apple-app-site-association at /.well-known/apple-app-site-association
   * (iOS). The backend has a route that serves both — see backend public
   * routes.
   */
  passkeyRpId: process.env.EXPO_PUBLIC_PASSKEY_RP_ID ?? "api.luxisoft.com",
  /**
   * Play Integrity (Android-only hardening of sensitive operations). When
   * disabled the integrity layer is a complete no-op on every platform — iOS
   * and web keep working unchanged. Maps to the backend PLAY_INTEGRITY_ENABLED.
   */
  playIntegrityEnabled: process.env.EXPO_PUBLIC_PLAY_INTEGRITY_ENABLED === "true",
  /**
   * Numeric Google Cloud project number (NOT the project id string) required by
   * the Play Integrity Standard request provider. Must be the project number of
   * the GCP project linked to the Play Console app. Empty until configured.
   */
  googleCloudProjectNumber: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER ?? "",
  /**
   * Explicit, controlled local-dev bypass for the integrity token. It can NEVER
   * silently activate in production: the bypass only fires when BOTH __DEV__ is
   * true AND this flag is "true". In any release build it is inert.
   */
  playIntegrityDevBypass: process.env.EXPO_PUBLIC_PLAY_INTEGRITY_DEV_BYPASS === "true",
};
