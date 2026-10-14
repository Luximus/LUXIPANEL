import { createContext } from "react";
import type { SavedAccount } from "../storage/savedAccounts";

export type AuthMethod = "passkey" | "recovery";

export type LoginPrimaryResult = { mfaPending: false } | { mfaPending: true; mfaToken: string };

export type AuthContextValue = {
  /** Current portal session JWT. Null when not signed in. */
  token: string | null;
  loading: boolean;
  userEmail: string | null;
  licenseError: string | null;
  /** Primary auth via Google Firebase. `loginHint` (a saved account's email)
   *  lets Google skip the account chooser / silent-auth instead of re-prompting. */
  loginWithGoogle: (loginHint?: string) => Promise<void>;
  /** Primary auth via Apple Firebase popup. (Apple exposes no account hint.) */
  loginWithApple: () => Promise<void>;
  /** Primary auth via GitHub Firebase popup. `login` (a saved account's GitHub
   *  username) pre-selects that account on the authorize screen. */
  loginWithGithub: (login?: string) => Promise<void>;
  /** Primary auth via Microsoft Firebase popup. `loginHint` (a saved account's
   *  email) pre-selects it instead of showing the account picker. */
  loginWithMicrosoft: (loginHint?: string) => Promise<void>;
  /** Primary auth via passkey for the given email. */
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
  savedAccounts: SavedAccount[];
  /** Refresca la foto (`photoURL`) de la cuenta guardada con ese `uid` tras
   *  subir/quitar el avatar, para que el chip/modal/selector se vean al día. */
  updateAccountPhoto: (uid: string, photoURL: string | null) => void;
  removeAccount: (email: string) => void;
  reorderAccounts: (emailsInOrder: string[]) => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
