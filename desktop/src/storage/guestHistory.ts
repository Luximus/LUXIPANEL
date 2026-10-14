const KEY = "lp.desktop.guest.history";
const MAX_ENTRIES = 12;

/**
 * Guest history entry — access-link invitations only.
 *  - "access": an invitation access-link token (luxipanel://panel-share?token=…),
 *    which may carry an expiry — expired ones are pruned ("solo vigentes").
 * La entrada por SUBDOMINIO del modo invitado fue RETIRADA (gateway managed
 * *.luxipanel.com fuera): solo quedan enlaces de acceso compartibles.
 */
export type GuestAccessEntry = {
  kind: "access";
  token: string;
  mode: string;
  label: string | null;
  subdomain: string | null;
  expiresAt: number | null;
  lastUsed: number;
};
export type GuestEntry = GuestAccessEntry;

/** Stable key for a guest entry (the access-link token). */
export function guestEntryKey(entry: GuestEntry): string {
  return entry.token;
}

function migrate(parsed: unknown): GuestEntry[] {
  if (!Array.isArray(parsed)) return [];
  const out: GuestEntry[] = [];
  for (const e of parsed) {
    if (!e || typeof e !== "object") continue;
    const rec = e as Record<string, unknown>;
    // Solo se conservan enlaces de acceso; entradas legadas por subdominio se descartan.
    if (rec.kind === "access" && typeof rec.token === "string") {
      out.push({
        kind: "access",
        token: rec.token,
        mode: typeof rec.mode === "string" ? rec.mode : "guest",
        label: typeof rec.label === "string" ? rec.label : null,
        subdomain: typeof rec.subdomain === "string" ? rec.subdomain : null,
        expiresAt: typeof rec.expiresAt === "number" ? rec.expiresAt : null,
        lastUsed: typeof rec.lastUsed === "number" ? rec.lastUsed : Date.now(),
      });
    }
  }
  return out;
}

/** Drop expired access links — guest history only surfaces "vigentes". */
function pruneExpired(entries: GuestEntry[]): GuestEntry[] {
  const now = Date.now();
  return entries.filter((e) => e.expiresAt === null || e.expiresAt > now);
}

export function loadGuestHistory(): GuestEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return pruneExpired(migrate(JSON.parse(raw))).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function persist(entries: GuestEntry[]): GuestEntry[] {
  const pruned = pruneExpired(entries).slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(pruned));
  } catch {
    // ignore storage errors
  }
  return pruned;
}

export function pushGuestAccessLink(input: {
  token: string;
  mode?: string;
  label?: string | null;
  subdomain?: string | null;
  expiresAt?: number | null;
}): GuestEntry[] {
  const token = input.token.trim();
  if (!token) return loadGuestHistory();
  const current = loadGuestHistory();
  const filtered = current.filter((e) => e.token !== token);
  return persist([
    {
      kind: "access",
      token,
      mode: input.mode ?? "guest",
      label: input.label ?? null,
      subdomain: input.subdomain ?? null,
      expiresAt: input.expiresAt ?? null,
      lastUsed: Date.now(),
    },
    ...filtered,
  ]);
}

/** Remove any entry by its key (the access-link token). */
export function removeGuestEntry(key: string): GuestEntry[] {
  return persist(loadGuestHistory().filter((e) => guestEntryKey(e) !== key));
}
