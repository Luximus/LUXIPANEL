const KEY = "lp.desktop.guest.session";

/** A short-lived guest session JWT (from POST /public/guest/exchange). Persisted
 *  so the guest carousel survives relaunch; re-exchanged when it nears expiry. */
export type GuestSession = { guestToken: string; expiresAt: number };

export function loadGuestSession(): GuestSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestSession>;
    if (parsed && typeof parsed.guestToken === "string" && typeof parsed.expiresAt === "number") {
      return { guestToken: parsed.guestToken, expiresAt: parsed.expiresAt };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveGuestSession(session: GuestSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearGuestSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Valid if present, non-empty, and at least 60s from expiry. */
export function isGuestSessionValid(s: GuestSession | null): boolean {
  return !!s && s.guestToken.length > 0 && s.expiresAt > Date.now() + 60_000;
}
