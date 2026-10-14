// SPDX-License-Identifier: AGPL-3.0-only
import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { getRedis } from "../../../shared/redis/index.js";
import { AuthError } from "../../../shared/errors/index.js";
import { authConfig } from "../../../config/auth.js";
import { aesGcmEncryptFields, aesGcmDecryptFields, aesKeyFromSha256 } from "../../../shared/utils/aes-gcm.js";
import { tokenService } from "./token.service.js";
import { sshCredentialsCache } from "./ssh-credentials-cache.service.js";
export const NATIVE_CALLBACK = "luxipanel://auth/callback";
const random = () => randomBytes(32).toString("base64url");
const key = (kind: string, value: string) => `auth:native:${kind}:${createHash("sha256").update(value).digest("hex")}`;
const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const sealKey = () => aesKeyFromSha256(`native-auth:${authConfig.jwt.secret}`);
interface Grant { origin: string; state: string; challenge: string; expiresAt: number; }
export const nativeAuthService = {
  async start(origin: string, state: string, challenge: string, language: string) {
    const requestId = random();
    const grant: Grant = { origin, state, challenge, expiresAt: Date.now() + 300000 };
    await getRedis().setex(key("request", requestId), 300, JSON.stringify(grant));
    return { requestId, authorizationUrl: `${origin}/login?nativeRequest=${requestId}&lang=${encodeURIComponent(language)}`, expiresAt: grant.expiresAt };
  },
  async authorize(requestId: string, origin: string, token: string) {
    const payload = await tokenService.verify(token);
    if (!payload || payload.kind === "mfa_pending" || payload.role === "mfa_pending" || payload.mcpScope || payload.kind === "external-guest") throw new AuthError("Full panel authentication required.");
    const raw = await getRedis().get(key("request", requestId));
    if (!raw) throw new AuthError("Native login expired or already used.");
    const grant = JSON.parse(raw) as Grant;
    if (grant.origin !== origin || grant.expiresAt <= Date.now()) throw new AuthError("Invalid native login origin.");
    // Claim once atomically; concurrent authorizations cannot issue two codes.
    if (!await getRedis().getdel(key("request", requestId))) throw new AuthError("Native login already used.");
    const code = random();
    await getRedis().setex(key("code", code), 60, JSON.stringify({ ...grant, expiresAt: Date.now() + 60000, token: aesGcmEncryptFields(token, sealKey()) }));
    return { callbackUrl: `${NATIVE_CALLBACK}?code=${code}&state=${grant.state}` };
  },
  async redeem(code: string, origin: string, state: string, verifier: string) {
    // Even an incorrect proof consumes the code; retries must start a new ceremony.
    const raw = await getRedis().getdel(key("code", code));
    if (!raw) throw new AuthError("Native code expired or already used.");
    const grant = JSON.parse(raw) as Grant & { token: ReturnType<typeof aesGcmEncryptFields> };
    const proof = createHash("sha256").update(verifier).digest("base64url");
    if (grant.origin !== origin || grant.expiresAt <= Date.now() || !equal(grant.state, state) || !equal(grant.challenge, proof)) throw new AuthError("Invalid native login proof.");
    const source = await tokenService.verify(aesGcmDecryptFields(grant.token, sealKey()));
    if (!source || source.kind === "mfa_pending" || source.role === "mfa_pending" || source.mcpScope || source.kind === "external-guest") throw new AuthError("Browser session expired.");
    const expiresAt = (source.exp ?? 0) * 1000;
    if (expiresAt <= Date.now()) throw new AuthError("Browser session expired.");
    // Independent JTI and bridge: logging out in the browser never destroys the app's bridge.
    const payload = { ...source };
    if (source.bridgeSessionId) {
      const bridge = randomUUID();
      if (source.direct) {
        const material = await sshCredentialsCache.get(source.bridgeSessionId);
        if (!material) throw new AuthError("Server session expired.");
        await sshCredentialsCache.put(bridge, material, Math.ceil((expiresAt - Date.now()) / 1000));
      }
      payload.bridgeSessionId = bridge;
    }
    return tokenService.signWithExpiry(payload, expiresAt);
  },
};
