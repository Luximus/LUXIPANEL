/**
 * standalone-servers (desktop) — registro persistido de servidores LUXIPANEL
 * **standalone** gestionados por conexión DIRECTA (sin LP-LS de puente). Espejo
 * de `app/src/storage/standaloneServers.ts` adaptado a Electron/web.
 *
 * Reparto de almacenamiento:
 *  - **Metadatos** (id/name/baseUrl/username/savePassword) → `localStorage` en
 *    claro (no son secretos): clave de lista. Acceso SÍNCRONO.
 *  - **Sesión** (JWT + CSRF + exp) y **contraseña** (opt-in) → cifrados en reposo
 *    con `safeStorage` del SO (Keychain macOS / DPAPI Windows / libsecret Linux)
 *    vía el puente IPC `secure:encrypt|decrypt` (ver `electron/main.cjs`). El
 *    ciphertext (base64) se guarda igualmente en `localStorage` bajo su clave por
 *    `id`, con un prefijo `enc.v1:` que lo distingue del respaldo. Acceso ASÍNCRONO.
 *
 * Sin `safeStorage`, los secretos permanecen sólo en memoria durante esta
 * ejecución. Los valores `raw.v1:` de versiones anteriores se migran o borran.
 *
 * El `id` es un UUID local (no viene del box): identifica el servidor en el
 * registro directo de `serverApi` y en la UI.
 */

const LIST_KEY = "lxp.desktop.standaloneServers.v1";
const SESSION_KEY = (id: string) => `lxp.desktop.standalone.session.${id}`;
const PASSWORD_KEY = (id: string) => `lxp.desktop.standalone.pw.${id}`;

const ENC_PREFIX = "enc.v1:"; // ciphertext base64 de safeStorage
const RAW_PREFIX = "raw.v1:"; // respaldo en claro (safeStorage no disponible)
const sessionMemory = new Map<string, StoredSession>();
const passwordMemory = new Map<string, string>();

/** Metadato NO sensible de un servidor standalone (lo que se lista). */
export interface StandaloneServer {
  id: string;
  name: string;
  /** Origen normalizado (sin barra final ni `/api`). */
  baseUrl: string;
  username: string;
  /** ¿Guardar la contraseña para re-login silencioso? (ver RIESGO arriba). */
  savePassword: boolean;
}

/** Sesión persistida (espejo de las cookies del panel). */
export interface StoredSession {
  jwt: string;
  csrf: { name: string; value: string } | null;
  exp: number;
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* entorno sin WebCrypto — cae al respaldo */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Cifrado en reposo (safeStorage vía IPC) ─────────────────────────────────

/** Cifra `plaintext` con el keychain del SO; nunca persiste texto claro. */
async function encryptToStore(plaintext: string): Promise<string | null> {
  const api = window.electronApi;
  if (api?.secureEncrypt) {
    try {
      const r = await api.secureEncrypt({ plaintext });
      if (r.ok) return `${ENC_PREFIX}${r.ciphertext}`;
    } catch {
      /* main no disponible — sólo memoria */
    }
  }
  return null;
}

/** Descifra un blob de `localStorage`; entiende `enc.v1:`, `raw.v1:` y legado. */
async function decryptFromStore(stored: string | null): Promise<string | null> {
  if (stored == null) return null;
  if (stored.startsWith(RAW_PREFIX)) return stored.slice(RAW_PREFIX.length);
  if (stored.startsWith(ENC_PREFIX)) {
    const ciphertext = stored.slice(ENC_PREFIX.length);
    const api = window.electronApi;
    if (!api?.secureDecrypt) return null; // cifrado pero sin puente → ilegible
    try {
      const r = await api.secureDecrypt({ ciphertext });
      return r.ok ? r.plaintext : null;
    } catch {
      return null;
    }
  }
  // Sin prefijo: valor legado escrito en claro por una versión anterior.
  return stored;
}

// ── Metadatos (síncrono, sin secretos) ──────────────────────────────────────

function readAll(): StandaloneServer[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && Array.isArray(parsed.servers) ? (parsed.servers as StandaloneServer[]) : [];
  } catch {
    return [];
  }
}

function writeAll(servers: StandaloneServer[]): void {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify({ servers }));
  } catch {
    /* almacenamiento lleno / no disponible — best-effort */
  }
}

/** Lista los servidores standalone registrados (metadatos, sin secretos). */
export function listStandaloneServers(): StandaloneServer[] {
  return readAll().map((s) => ({ ...s }));
}

/** Añade un servidor; devuelve el registro creado (con su `id` nuevo). */
export async function addStandaloneServer(input: {
  name: string;
  baseUrl: string;
  username: string;
  savePassword: boolean;
  password?: string;
  session: StoredSession;
}): Promise<StandaloneServer> {
  const servers = readAll();
  const server: StandaloneServer = {
    id: `sa-${randomId()}`,
    name: input.name.trim() || input.baseUrl,
    baseUrl: input.baseUrl,
    username: input.username,
    savePassword: input.savePassword,
  };
  writeAll([...servers, server]);
  await setStandaloneSession(server.id, input.session);
  if (input.savePassword && input.password) await setStandalonePassword(server.id, input.password);
  return server;
}

/** Actualiza metadatos de un servidor (merge superficial). */
export function updateStandaloneServer(id: string, patch: Partial<Omit<StandaloneServer, "id">>): void {
  writeAll(readAll().map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

/** Elimina un servidor y purga su sesión y contraseña. */
export function removeStandaloneServer(id: string): void {
  sessionMemory.delete(id);
  passwordMemory.delete(id);
  writeAll(readAll().filter((s) => s.id !== id));
  try {
    localStorage.removeItem(SESSION_KEY(id));
    localStorage.removeItem(PASSWORD_KEY(id));
  } catch {
    /* ignore */
  }
}

// ── Sesión (cifrada en reposo) ──────────────────────────────────────────────

/** Lee la sesión guardada (o null si no hay / corrupta / ilegible). */
export async function getStandaloneSession(id: string): Promise<StoredSession | null> {
  const live = sessionMemory.get(id);
  if (live) return live;
  let stored: string | null;
  try {
    stored = localStorage.getItem(SESSION_KEY(id));
  } catch {
    return null;
  }
  const plain = await decryptFromStore(stored);
  if (!plain) return null;
  try {
    const parsed = JSON.parse(plain) as StoredSession;
    if (typeof parsed?.jwt !== "string") return null;
    if (stored?.startsWith(RAW_PREFIX) || (stored && !stored.startsWith(ENC_PREFIX))) {
      await setStandaloneSession(id, parsed);
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Guarda/actualiza la sesión de un servidor (cifrada si el SO lo permite). */
export async function setStandaloneSession(id: string, session: StoredSession): Promise<void> {
  sessionMemory.set(id, session);
  try {
    const blob = await encryptToStore(JSON.stringify(session));
    if (blob) localStorage.setItem(SESSION_KEY(id), blob);
    else localStorage.removeItem(SESSION_KEY(id));
  } catch {
    /* ignore */
  }
}

// ── Contraseña opt-in (cifrada en reposo) ───────────────────────────────────

/** Lee la contraseña guardada (opt-in) o null. */
export async function getStandalonePassword(id: string): Promise<string | null> {
  const live = passwordMemory.get(id);
  if (live) return live;
  let stored: string | null;
  try {
    stored = localStorage.getItem(PASSWORD_KEY(id));
  } catch {
    return null;
  }
  const plain = await decryptFromStore(stored);
  if (plain && (stored?.startsWith(RAW_PREFIX) || (stored && !stored.startsWith(ENC_PREFIX)))) {
    await setStandalonePassword(id, plain);
  }
  return plain;
}

/** Guarda (o borra, con `null`/`""`) la contraseña opt-in. */
export async function setStandalonePassword(id: string, password: string | null): Promise<void> {
  if (password) passwordMemory.set(id, password);
  else passwordMemory.delete(id);
  try {
    if (password == null || password === "") {
      localStorage.removeItem(PASSWORD_KEY(id));
      return;
    }
    const blob = await encryptToStore(password);
    if (blob) localStorage.setItem(PASSWORD_KEY(id), blob);
    else localStorage.removeItem(PASSWORD_KEY(id));
  } catch {
    /* ignore */
  }
}

/** Limpia secretos heredados de texto claro incluso si su servidor no se abre. */
export async function migrateLegacyStandaloneSecrets(): Promise<void> {
  for (const server of readAll()) {
    await getStandaloneSession(server.id);
    await getStandalonePassword(server.id);
  }
}

export function clearStandaloneSecretsFromMemory(): void {
  sessionMemory.clear();
  passwordMemory.clear();
}
