/**
 * Generic abstraction to run a sensitive request with a Play Integrity token
 * attached (phase 5).
 *
 * The caller passes:
 *   - action: the exact action name from the shared contract (used for both the
 *     canonical hash and the X-Play-Integrity-Action header).
 *   - payloadRelevantForHash: ONLY the effect-changing body fields (exclude auth
 *     tokens and volatile/technical fields). The backend recomputes the hash
 *     from the real request, so this must match what the server will hash.
 *   - run(headers): the real request executor. It receives the integrity headers
 *     to attach and performs the call. On non-Android / disabled / dev-bypass it
 *     is called with EMPTY headers so other platforms keep working unchanged.
 *
 * The token (a secret) is never logged here; failures from the provider are
 * surfaced as a thrown IntegrityRequestError carrying only a generic message.
 */
import { computeRequestHash } from "./canonical-request-hash";
import { getIntegrityToken, isIntegrityActive } from "./playIntegrity";

export type IntegrityHeaders = Record<string, string>;

export type RequestWithPlayIntegrityOptions<T> = {
  /** Exact action name from the contract, e.g. "auth.login.firebase". */
  action: string;
  /** Effect-changing body fields only (no auth tokens / volatile fields). */
  payloadRelevantForHash: unknown;
  /** Executes the real request with the integrity headers attached. */
  run: (headers: IntegrityHeaders) => Promise<T>;
};

/** Generic error thrown when the integrity token could not be obtained. The UI
 *  should show a generic message; `code` is for local handling only. */
export class IntegrityRequestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "IntegrityRequestError";
    this.code = code;
  }
}

const GENERIC_FAILURE_MESSAGE =
  "No fue posible verificar la integridad de la aplicación. Inténtalo de nuevo.";

/**
 * Compute the canonical hash, fetch a Standard integrity token bound to it, and
 * run the protected request with the integrity headers attached. On
 * non-Android / disabled / dev-bypass it runs with empty headers (no-op).
 */
export async function requestWithPlayIntegrity<T>(
  options: RequestWithPlayIntegrityOptions<T>,
): Promise<T> {
  const { action, payloadRelevantForHash, run } = options;

  // Fast path: layer inactive (iOS/web/disabled) → run unchanged, no headers.
  if (!isIntegrityActive()) {
    return run({});
  }

  const requestHash = await computeRequestHash(action, payloadRelevantForHash);
  const result = await getIntegrityToken(requestHash);

  if (result.ok) {
    return run({
      "X-Play-Integrity-Token": result.token,
      "X-Play-Integrity-Action": action,
    });
  }

  // DISABLED / DEV_BYPASS are not real failures: proceed without a token so the
  // backend (in monitor mode, or off) handles the absence gracefully.
  if (result.code === "DISABLED" || result.code === "DEV_BYPASS") {
    return run({});
  }

  // Hard failure obtaining a token (PREPARE_FAILED / NOT_CONFIGURED /
  // TOKEN_FAILED). Surface a generic, non-leaky error for the UI.
  throw new IntegrityRequestError(result.code, GENERIC_FAILURE_MESSAGE);
}
