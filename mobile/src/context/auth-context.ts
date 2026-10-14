import { createContext } from "react";
import type { SavedAccount } from "../storage/savedAccounts";

export type LoginPrimaryResult = { mfaPending: false } | { mfaPending: true; mfaToken: string };

export type AuthContextValue = {
  /** Portal session JWT, or null when signed out. */
  token: string | null;
  loading: boolean;
  userEmail: string | null;
  licenseError: string | null;
  /** True when react-native-passkey is available on this build/device. */
  passkeySupported: boolean;
  /** True when Sign in with Apple is available (iOS 13+ native build). */
  appleSupported: boolean;
  /** True when GitHub sign-in is configured (EXPO_PUBLIC_GITHUB_CLIENT_ID set). */
  githubSupported: boolean;
  /** True when Microsoft sign-in is configured (EXPO_PUBLIC_MICROSOFT_CLIENT_ID set). */
  microsoftSupported: boolean;
  /** Primary auth via Google Firebase. */
  loginWithGoogle: (loginHint?: string) => Promise<void>;
  /** Primary auth via Sign in with Apple (native, iOS). (Apple exposes no account hint.) */
  loginWithApple: () => Promise<void>;
  /** Primary auth via GitHub (expo-auth-session + backend token exchange).
   *  `login` (a saved account's GitHub username) pre-selects that account. */
  loginWithGithub: (login?: string) => Promise<void>;
  /** Primary auth via Microsoft (expo-auth-session PKCE, client-side).
   *  `loginHint` (a saved account's email) pre-selects it in Entra. */
  loginWithMicrosoft: (loginHint?: string) => Promise<void>;
  /** Primary auth via passkey assertion (requires a native dev client). */
  loginWithPasskey: (email: string) => Promise<LoginPrimaryResult>;
  /** Primary auth via single-use recovery code. */
  loginWithRecovery: (email: string, code: string) => Promise<LoginPrimaryResult>;
  /** Sign in to a saved account by redeeming its own stored refresh token (no
   *  provider re-auth). Resolves true on success, false if the account has no
   *  usable refresh token left — the caller should then re-auth its provider. */
  loginWithSavedAccount: (account: SavedAccount) => Promise<boolean>;
  /** Verify TOTP after a primary auth that returned mfaPending=true. */
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  switchAccount: () => Promise<void>;
  logout: () => Promise<void>;
  updateCurrentAccountProfile: (patch: {
    displayName?: string | null;
    company?: string | null;
    country?: string | null;
    phone?: string | null;
    locale?: string | null;
    /** Avatar propio (URL absoluta de R2) o null para volver a iniciales. */
    photoURL?: string | null;
  }) => Promise<void>;
  savedAccounts: SavedAccount[];
  removeAccount: (email: string) => Promise<void>;
  reorderAccounts: (emailsInOrder: string[]) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
