import type { IncomingMessage } from "node:http";
import { extractWsToken } from "./upgrade-auth.js";
import { tokenService, type TokenPayload } from "../../modules/auth/services/token.service.js";
import { resolveLiveAuthorization } from "../../modules/auth/services/live-authorization.service.js";
import { localExecutor } from "../executor/local-executor.js";
import { getDirectExecutorByBridgeSessionId } from "../executor/factory.js";
import { AuthError } from "../errors/index.js";
const authenticated = new WeakMap<IncomingMessage, TokenPayload>();
export async function verifyWsAuthorization(req: IncomingMessage, refresh = false): Promise<TokenPayload | null> {
  const existing = authenticated.get(req);
  if (existing && !refresh) return existing;
  const token = extractWsToken(req);
  const payload = token ? await tokenService.verify(token) : null;
  if (!payload || payload.mcpScope || payload.kind === "mfa_pending") return null;
  const executor = payload.direct && payload.bridgeSessionId ? await getDirectExecutorByBridgeSessionId(payload.bridgeSessionId) : localExecutor;
  if (!executor) throw new AuthError("Identity server session expired");
  const user = await resolveLiveAuthorization(tokenService.toSessionUser(payload), executor);
  if (user.hostingPolicy?.state === "pending") throw new AuthError("Hosting runtime update pending");
  const live = { ...payload, ...user } as TokenPayload;
  authenticated.set(req, live);
  return live;
}
