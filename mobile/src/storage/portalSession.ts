/**
 * Persisted portal session JWT issued by LP-LICENSE-SERVER after a successful
 * email-based login. Backed by SecureStore (iOS Keychain / Android Keystore)
 * because the JWT is a bearer credential and must not sit in plain-text
 * AsyncStorage. Persisted so the session survives restarts.
 */
import { secureGetItem, secureRemoveItem, secureSetItem } from "./secureStorage";

const KEY = "lp.app.portal.session";
// Refresh token lives under its own key: the access record is dropped the moment
// it expires, but the long-lived refresh token must survive that so we can mint a
// fresh access JWT without re-authenticating the provider.
const REFRESH_KEY = "lp.app.portal.refresh";

export interface PortalSessionRecord {
  token: string;
  expiresAt: number;
  customer: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    /** MB efectivos permitidos por subida; persistido para tenerlo disponible
     *  sin re-consultar /portal/me al restaurar la sesión. Fallback 5 si falta. */
    maxUploadMb?: number | null;
  };
}

let memory: PortalSessionRecord | null = null;

export function readPortalSessionSync(): PortalSessionRecord | null {
  if (!memory) return null;
  if (Date.now() >= memory.expiresAt - 5_000) {
    memory = null;
    return null;
  }
  return memory;
}

export async function loadPortalSession(): Promise<PortalSessionRecord | null> {
  try {
    const raw = await secureGetItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalSessionRecord;
    if (!parsed?.token || typeof parsed.expiresAt !== "number") return null;
    if (Date.now() >= parsed.expiresAt - 5_000) {
      await secureRemoveItem(KEY);
      return null;
    }
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export async function savePortalSession(record: PortalSessionRecord): Promise<void> {
  memory = record;
  try {
    await secureSetItem(KEY, JSON.stringify(record));
  } catch {
    /* ignore */
  }
}

export async function clearPortalSession(): Promise<void> {
  memory = null;
  try {
    await secureRemoveItem(KEY);
  } catch {
    /* ignore */
  }
}

export interface RefreshTokenRecord {
  token: string;
  expiresAt: number;
}

export async function loadRefreshToken(): Promise<RefreshTokenRecord | null> {
  try {
    const raw = await secureGetItem(REFRESH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RefreshTokenRecord;
    if (!parsed?.token || typeof parsed.expiresAt !== "number") return null;
    if (Date.now() >= parsed.expiresAt - 5_000) {
      await secureRemoveItem(REFRESH_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
  try {
    await secureSetItem(REFRESH_KEY, JSON.stringify(record));
  } catch {
    /* ignore */
  }
}

export async function clearRefreshToken(): Promise<void> {
  try {
    await secureRemoveItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Per-account refresh tokens, keyed by customer uid. This is what lets a tap on
 * a SAVED ACCOUNT sign in WITHOUT re-running the provider: each account keeps
 * its own rolling refresh token. The single REFRESH_KEY above still tracks the
 * ACTIVE account for cold-start/401 restore; this map covers the others. Stored
 * as one JSON blob in SecureStore (it holds bearer credentials).
 */
const REFRESH_MAP_KEY = "lp.app.portal.refresh.byuid";

async function loadRefreshMap(): Promise<Record<string, RefreshTokenRecord>> {
  try {
    const raw = await secureGetItem(REFRESH_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, RefreshTokenRecord>) : {};
  } catch {
    return {};
  }
}

async function persistRefreshMap(map: Record<string, RefreshTokenRecord>): Promise<void> {
  try {
    await secureSetItem(REFRESH_MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export async function saveAccountRefreshToken(uid: string, record: RefreshTokenRecord): Promise<void> {
  if (!uid) return;
  const map = await loadRefreshMap();
  map[uid] = record;
  await persistRefreshMap(map);
}

export async function loadAccountRefreshToken(uid: string): Promise<RefreshTokenRecord | null> {
  if (!uid) return null;
  const map = await loadRefreshMap();
  const rec = map[uid];
  if (!rec?.token || typeof rec.expiresAt !== "number") return null;
  if (Date.now() >= rec.expiresAt - 5_000) {
    delete map[uid];
    await persistRefreshMap(map);
    return null;
  }
  return rec;
}

export async function removeAccountRefreshToken(uid: string): Promise<void> {
  if (!uid) return;
  const map = await loadRefreshMap();
  if (uid in map) {
    delete map[uid];
    await persistRefreshMap(map);
  }
}
