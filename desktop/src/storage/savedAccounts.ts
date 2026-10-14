const KEY = "lp.desktop.saved.accounts";

/** Identity provider the account last signed in with. Social providers render a
 *  brand badge in the account selector; `passkey`/`recovery` are email-based. */
export type AccountProvider = "google" | "apple" | "github" | "microsoft" | "passkey" | "recovery";

export type SavedAccount = {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  provider?: AccountProvider | null;
  /** Provider-side handle used to hint re-auth (GitHub `login`/username). Only
   *  populated for providers that expose one; absent for the rest. */
  providerUsername?: string | null;
  lastLogin: number;
};

export function loadSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedAccount[]) : [];
  } catch {
    return [];
  }
}

function persist(accounts: SavedAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(accounts));
  } catch {
    /* ignore */
  }
}

export function upsertSavedAccount(account: SavedAccount): SavedAccount[] {
  const current = loadSavedAccounts();
  const filtered = current.filter((entry) => entry.uid !== account.uid && entry.email !== account.email);
  const next = [account, ...filtered];
  persist(next);
  return next;
}

/**
 * Actualiza la foto (`photoURL`) de la cuenta guardada con ese `uid` y persiste.
 * Se usa tras subir/quitar el avatar desde el panel de cuenta para que el avatar
 * mostrado (chip + modal + selector de cuentas) se refresque sin reiniciar. Si
 * el `uid` no está guardado, devuelve la lista sin cambios.
 */
export function updateSavedAccountPhoto(uid: string, photoURL: string | null): SavedAccount[] {
  const current = loadSavedAccounts();
  let changed = false;
  const next = current.map((entry) => {
    if (entry.uid !== uid) return entry;
    changed = true;
    return { ...entry, photoURL };
  });
  if (changed) persist(next);
  return next;
}

export function removeSavedAccount(email: string): SavedAccount[] {
  const next = loadSavedAccounts().filter((entry) => entry.email !== email);
  persist(next);
  return next;
}

export function reorderSavedAccounts(emailsInOrder: string[]): SavedAccount[] {
  const current = loadSavedAccounts();
  const byEmail = new Map(current.map((entry) => [entry.email, entry]));
  const ordered: SavedAccount[] = [];
  for (const email of emailsInOrder) {
    const entry = byEmail.get(email);
    if (entry) {
      ordered.push(entry);
      byEmail.delete(email);
    }
  }
  for (const remaining of byEmail.values()) ordered.push(remaining);
  persist(ordered);
  return ordered;
}
