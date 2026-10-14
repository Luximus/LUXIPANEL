/**
 * Play Integrity (Android) client module — barrel.
 *
 * Public surface:
 *   - requestWithPlayIntegrity / IntegrityRequestError: wrap a sensitive call
 *     so it carries an integrity token (no-op on iOS/web/disabled).
 *   - warmUpIntegrity: fire-and-forget provider warm-up at app start.
 *   - isIntegrityActive: gate for callers that want to branch on the layer.
 *   - computeRequestHash / buildCanonicalRequestString: canonical hashing
 *     (kept in lockstep with the backend).
 */
export {
  requestWithPlayIntegrity,
  IntegrityRequestError,
  type IntegrityHeaders,
  type RequestWithPlayIntegrityOptions,
} from "./requestWithPlayIntegrity";
export {
  warmUpIntegrity,
  isIntegrityActive,
  getIntegrityToken,
  prepareProvider,
  type IntegrityTokenResult,
  type IntegrityErrorCode,
} from "./playIntegrity";
export {
  computeRequestHash,
  buildCanonicalRequestString,
  type CanonicalRequest,
} from "./canonical-request-hash";
