/**
 * Persisted portal session JWT issued by LP-LICENSE-SERVER after a successful
 * email-based login (passkey or recovery code, optionally followed by 2FA).
 *
 * The short-lived access JWT lives under KEY; the long-lived refresh token lives
 * under REFRESH_KEY (separate key on purpose: the access record is dropped the
 * moment it expires, but the refresh token must survive that so we can mint a
 * fresh access JWT without re-authenticating the provider).
 */
const KEY = "lp.desktop.portal.session";
const REFRESH_KEY = "lp.desktop.portal.refresh";

export interface PortalSessionRecord {
  token: string;
  expiresAt: number;
  customer: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    /** MB efectivos de subida para el rol (avatar + adjuntos). Fallback: 5. */
    maxUploadMb?: number | null;
  };
}

export function loadPortalSession(): PortalSessionRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalSessionRecord;
    if (!parsed?.token || typeof parsed.expiresAt !== "number") return null;
    if (Date.now() >= parsed.expiresAt - 5_000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePortalSession(record: PortalSessionRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* ignore */
  }
}

export function clearPortalSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export interface RefreshTokenRecord {
  token: string;
  expiresAt: number;
}

export function loadRefreshToken(): RefreshTokenRecord | null {
  try {
    const raw = localStorage.getItem(REFRESH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RefreshTokenRecord;
    if (!parsed?.token || typeof parsed.expiresAt !== "number") return null;
    if (Date.now() >= parsed.expiresAt - 5_000) {
      localStorage.removeItem(REFRESH_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveRefreshToken(record: RefreshTokenRecord): void {
  try {
    localStorage.setItem(REFRESH_KEY, JSON.stringify(record));
  } catch {
    /* ignore */
  }
}

export function clearRefreshToken(): void {
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Per-account refresh tokens, keyed by customer uid. This is what lets a click
 * on a SAVED ACCOUNT sign in WITHOUT re-running the provider: each account keeps
 * its own rolling refresh token, so switching between remembered accounts mints
 * a fresh session silently. The single `REFRESH_KEY` above still tracks the
 * ACTIVE account for cold-start/401 restore; this map covers the others.
 */
const REFRESH_MAP_KEY = "lp.desktop.portal.refresh.byuid";

function loadRefreshMap(): Record<string, RefreshTokenRecord> {
  try {
    const raw = localStorage.getItem(REFRESH_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, RefreshTokenRecord>) : {};
  } catch {
    return {};
  }
}

function persistRefreshMap(map: Record<string, RefreshTokenRecord>): void {
  try {
    localStorage.setItem(REFRESH_MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function saveAccountRefreshToken(uid: string, record: RefreshTokenRecord): void {
  if (!uid) return;
  const map = loadRefreshMap();
  map[uid] = record;
  persistRefreshMap(map);
}

export function loadAccountRefreshToken(uid: string): RefreshTokenRecord | null {
  if (!uid) return null;
  const map = loadRefreshMap();
  const rec = map[uid];
  if (!rec?.token || typeof rec.expiresAt !== "number") return null;
  if (Date.now() >= rec.expiresAt - 5_000) {
    delete map[uid];
    persistRefreshMap(map);
    return null;
  }
  return rec;
}

export function removeAccountRefreshToken(uid: string): void {
  if (!uid) return;
  const map = loadRefreshMap();
  if (uid in map) {
    delete map[uid];
    persistRefreshMap(map);
  }
}
