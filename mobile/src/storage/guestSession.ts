import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lp.app.guest.session";

/** A short-lived guest session JWT (from POST /public/guest/exchange). Persisted
 *  so the guest carousel survives backgrounding/relaunch; re-exchanged when it
 *  nears expiry. */
export type GuestSession = { guestToken: string; expiresAt: number };

let memoryCache: GuestSession | null = null;

export async function loadGuestSession(): Promise<GuestSession | null> {
  if (memoryCache) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestSession>;
    if (parsed && typeof parsed.guestToken === "string" && typeof parsed.expiresAt === "number") {
      memoryCache = { guestToken: parsed.guestToken, expiresAt: parsed.expiresAt };
      return memoryCache;
    }
    return null;
  } catch {
    return null;
  }
}

export function loadGuestSessionSync(): GuestSession | null {
  return memoryCache;
}

export async function saveGuestSession(session: GuestSession): Promise<void> {
  memoryCache = session;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export async function clearGuestSession(): Promise<void> {
  memoryCache = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Valid if present, non-empty, and at least 60s from expiry. */
export function isGuestSessionValid(s: GuestSession | null): boolean {
  return !!s && s.guestToken.length > 0 && s.expiresAt > Date.now() + 60_000;
}
