/**
 * Bridge between the stateless API layer (client.ts) and the AuthProvider's
 * refresh logic. The API client receives the access token as a per-call
 * argument and has no React context, so on a 401 it asks this bridge to mint a
 * fresh access JWT (from the stored refresh token) and then retries once.
 *
 * AuthProvider registers the handler on mount; concurrent 401s are coalesced
 * into a single in-flight refresh so a burst of expired requests rotates the
 * refresh token only once.
 */
type RefreshHandler = () => Promise<string | null>;

let handler: RefreshHandler | null = null;
let inflight: Promise<string | null> | null = null;

export function setSessionRefreshHandler(fn: RefreshHandler | null): void {
  handler = fn;
}

/** Mint a fresh access token via the registered handler. Returns null if no
 *  handler is set or the refresh failed (caller should surface the 401). */
export function refreshAccessToken(): Promise<string | null> {
  if (!handler) return Promise.resolve(null);
  if (!inflight) {
    inflight = handler().finally(() => { inflight = null; });
  }
  return inflight;
}
