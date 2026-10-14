import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lp.app.saved.accounts";

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
  country?: string | null;
  company?: string | null;
  phone?: string | null;
  locale?: string | null;
  lastLogin: number;
};

let memoryCache: SavedAccount[] | null = null;

export async function loadSavedAccounts(): Promise<SavedAccount[]> {
  if (memoryCache) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      memoryCache = [];
      return [];
    }
    const parsed = JSON.parse(raw);
    memoryCache = Array.isArray(parsed) ? (parsed as SavedAccount[]) : [];
    return memoryCache;
  } catch {
    memoryCache = [];
    return [];
  }
}

export function loadSavedAccountsSync(): SavedAccount[] {
  return memoryCache ?? [];
}

async function persist(accounts: SavedAccount[]) {
  memoryCache = accounts;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(accounts));
  } catch {
    /* ignore */
  }
}

export async function upsertSavedAccount(account: SavedAccount): Promise<SavedAccount[]> {
  const current = await loadSavedAccounts();
  const filtered = current.filter((entry) => entry.uid !== account.uid && entry.email !== account.email);
  const next = [account, ...filtered];
  await persist(next);
  return next;
}

export async function removeSavedAccount(email: string): Promise<SavedAccount[]> {
  const current = await loadSavedAccounts();
  const next = current.filter((entry) => entry.email !== email);
  await persist(next);
  return next;
}

export async function reorderSavedAccounts(emailsInOrder: string[]): Promise<SavedAccount[]> {
  const current = await loadSavedAccounts();
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
  await persist(ordered);
  return ordered;
}

export async function patchSavedAccount(email: string, patch: Partial<SavedAccount>): Promise<SavedAccount[]> {
  const current = await loadSavedAccounts();
  const next = current.map((entry) => (entry.email === email ? { ...entry, ...patch } : entry));
  await persist(next);
  return next;
}
