import { initializeApp, getApps, FirebaseError } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signOut as firebaseSignOut,
  type Auth,
  type AuthProvider,
  type AuthCredential,
  type UserCredential,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;

export const firebaseAuth: Auth = getAuth(app);

/** Maps a Firebase sign-in method id to a provider instance we can re-trigger. */
function providerForMethod(method: string): AuthProvider | null {
  switch (method) {
    case GoogleAuthProvider.PROVIDER_ID:
    case "google.com":
      return new GoogleAuthProvider();
    case GithubAuthProvider.PROVIDER_ID:
    case "github.com":
      return new GithubAuthProvider();
    case "apple.com":
      return new OAuthProvider("apple.com");
    case "microsoft.com":
      return new OAuthProvider("microsoft.com");
    default:
      return null;
  }
}

// Cross-provider account linking — see frontend/src/lib/firebase.ts for the
// full rationale. If the email already belongs to another provider, sign in
// with the existing one and link the new credential so both resolve to the
// SAME account.
/** Provider IDs the conflicting email is already verified with. Firebase embeds
 *  these in the account-exists error's `_tokenResponse`, which still resolves
 *  when Email Enumeration Protection makes `fetchSignInMethodsForEmail` return
 *  `[]` (its default on new projects). GitHub is the usual trigger: its email
 *  is treated as unverified, so Firebase never auto-links and we must do it. */
function verifiedProvidersFromError(err: any): string[] {
  const tr = err?.customData?._tokenResponse;
  const list = tr?.verifiedProvider ?? tr?.allProviders;
  return Array.isArray(list) ? list : [];
}

async function linkPendingCredential(err: any, pending: AuthCredential | null): Promise<UserCredential> {
  const email: string | undefined = err?.customData?.email;
  if (!email) throw err;
  let methods: string[] = [];
  try {
    methods = await fetchSignInMethodsForEmail(firebaseAuth, email);
  } catch {
    /* enumeration protection / network — fall back to the error payload */
  }
  if (methods.length === 0) methods = verifiedProvidersFromError(err);
  const existing = methods.map(providerForMethod).find((p): p is AuthProvider => p != null);
  if (!existing) throw err;
  const result = await signInWithPopup(firebaseAuth, existing);
  if (pending) {
    await linkWithCredential(result.user, pending).catch(() => undefined);
  }
  return result;
}

async function signInWithProvider(
  provider: AuthProvider,
  credentialFromError: (err: any) => AuthCredential | null,
): Promise<UserCredential> {
  try {
    return await signInWithPopup(firebaseAuth, provider);
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/account-exists-with-different-credential") {
      return await linkPendingCredential(err, credentialFromError(err));
    }
    // En Electron, signInWithPopup envuelve muchos fallos del flujo OAuth como
    // `auth/internal-error` y oculta la causa real (queda en customData /
    // _serverResponse). La volcamos en consola — DevTools está abierto en dev —
    // para poder diagnosticar con precisión si el fix de User-Agent (ver
    // electron/main.cjs) no bastara. El error se re-lanza intacto.
    if (err instanceof FirebaseError) {
      const serverResponse = (err.customData as { _serverResponse?: unknown } | undefined)?._serverResponse;
      console.error("[oauth-signin] code:", err.code, "| serverResponse:", serverResponse, "| customData:", err.customData, "| error:", err);
    } else {
      console.error("[oauth-signin] error no-Firebase:", err);
    }
    throw err;
  }
}

export async function signInWithGoogle(loginHint?: string): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  // Saved account → hint the email so Google can sign in silently (or skip the
  // chooser) when a session already exists; forcing `select_account` here made
  // every saved-account click re-prompt. Without a hint (generic "add account")
  // we still force the picker so the user can choose a different account.
  provider.setCustomParameters(loginHint ? { login_hint: loginHint } : { prompt: "select_account" });
  return await signInWithProvider(provider, GoogleAuthProvider.credentialFromError);
}

export async function signInWithApple(): Promise<UserCredential> {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return await signInWithProvider(provider, OAuthProvider.credentialFromError);
}

export async function signInWithGithub(login?: string): Promise<UserCredential> {
  const provider = new GithubAuthProvider();
  provider.addScope("read:user");
  provider.addScope("user:email");
  // Saved account → suggest the GitHub username so its authorize screen
  // pre-selects that account. Best-effort: GitHub honours `login`; Firebase may
  // drop it for some providers, in which case it's a harmless no-op.
  if (login) provider.setCustomParameters({ login });
  return await signInWithProvider(provider, GithubAuthProvider.credentialFromError);
}

export async function signInWithMicrosoft(loginHint?: string): Promise<UserCredential> {
  const provider = new OAuthProvider("microsoft.com");
  provider.addScope("email");
  provider.addScope("openid");
  provider.addScope("profile");
  // Saved account → hint the email so Entra pre-selects it (silent re-auth).
  // No hint = generic "add account": force the account picker so it doesn't
  // silently reuse the existing Entra/SSO session and "pass straight through"
  // with the already-signed-in account (mirrors Google's select_account above).
  provider.setCustomParameters(loginHint ? { login_hint: loginHint } : { prompt: "select_account" });
  return await signInWithProvider(provider, OAuthProvider.credentialFromError);
}

export async function signOutGoogle(): Promise<void> {
  await firebaseSignOut(firebaseAuth);
}
