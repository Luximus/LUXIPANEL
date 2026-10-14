// SPDX-License-Identifier: AGPL-3.0-only
import { randomBytes, createHash } from "node:crypto";
import { getRedis } from "../../../shared/redis/index.js";
import {
  getContextExecutor,
  runWithExecutor,
} from "../../../shared/executor/context.js";
import type { Executor } from "../../../shared/executor/types.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { AuthError, ValidationError } from "../../../shared/errors/index.js";
import { getPanelOrigin } from "../../../shared/panel-url/index.js";
import { authConfig } from "../../../config/auth.js";
import { panelUserRepository } from "../repositories/index.js";
import { passkeyService } from "./passkey.service.js";
import { normalizeRegistrationResponse } from "./passkey-registration.js";
const random = () => randomBytes(32).toString("base64url");
const key = (kind: string, token: string) =>
  `passkey:enroll:${kind}:${createHash("sha256").update(token).digest("hex")}`;
type Binding = {
  executor: Executor;
  user: SessionUser;
  origin: string;
  label: string;
  expires: number;
  scope: string;
};
const bindings = new Map<string, Binding>();
const scope = (user: SessionUser, executor: Executor) =>
  `${executor.target.id}:${user.userId}:${user.username}:${user.bridgeSessionId ?? user.targetId ?? "local"}`;
function binding(id: string): Binding {
  const value = bindings.get(id);
  if (!value || value.expires < Date.now()) {
    bindings.delete(id);
    throw new AuthError("Passkey registration expired.");
  }
  return value;
}
async function scoped<T>(
  id: string,
  action: (value: Binding) => Promise<T>,
): Promise<T> {
  const value = binding(id);
  return runWithExecutor(
    value.executor,
    () => action(value),
    value.user.userId,
    value.user,
  );
}
function checkOrigin(expected: string, actual: string | undefined) {
  if (actual !== expected) throw new AuthError("Invalid registration origin.");
}
export const passkeyEnrollmentService = {
  async issue(user: SessionUser, label: string, language = "en") {
    const executor = getContextExecutor();
    if (!executor) throw new AuthError("Server session required.");
    const origin = new URL(
      (await getPanelOrigin()) ?? authConfig.webauthn.origin,
    ).origin;
    if (!origin.startsWith("https://"))
      throw new ValidationError("Passkeys require HTTPS.");
    for (const [id, value] of bindings)
      if (value.expires < Date.now()) bindings.delete(id);
    if (bindings.size >= 1000)
      throw new ValidationError("Too many pending registrations.");
    const grant = random(),
      id = random();
    bindings.set(id, {
      executor,
      user,
      origin,
      label,
      expires: Date.now() + 300000,
      scope: scope(user, executor),
    });
    const timer = setTimeout(() => bindings.delete(id), 300000);
    timer.unref();
    try {
      await getRedis().setex(key("grant", grant), 60, id);
      await getRedis().setex(
        key("result", id),
        300,
        JSON.stringify({ status: "pending", scope: scope(user, executor) }),
      );
    } catch (error) {
      bindings.delete(id);
      clearTimeout(timer);
      throw error;
    }
    return {
      id,
      url: `${origin}/passkey-enroll?lang=${encodeURIComponent(language)}#grant=${grant}`,
      expiresAt: Date.now() + 60000,
    };
  },
  async options(grant: string, origin: string | undefined) {
    const id = await getRedis().getdel(key("grant", grant));
    if (typeof id !== "string")
      throw new AuthError("Registration grant expired or already used.");
    return scoped(id, async (value) => {
      checkOrigin(value.origin, origin);
      const user = await panelUserRepository.findById(value.user.userId);
      if (!user?.enabled) throw new AuthError("Account unavailable.");
      const options = await passkeyService.getRegistrationOptions(
        user,
        value.origin,
        id,
      );
      const ceremony = random();
      await getRedis().setex(key("ceremony", ceremony), 120, id);
      return {
        ceremony,
        options,
        displayName: user.displayName || user.username,
        label: value.label,
      };
    });
  },
  async verify(
    ceremony: string,
    response: Record<string, unknown>,
    origin: string | undefined,
  ) {
    const id = await getRedis().getdel(key("ceremony", ceremony));
    if (typeof id !== "string")
      throw new AuthError("Registration ceremony expired or already used.");
    return scoped(id, async (value) => {
      checkOrigin(value.origin, origin);
      try {
        const user = await panelUserRepository.findById(value.user.userId);
        if (!user?.enabled) throw new AuthError("Account unavailable.");
        const normalized = normalizeRegistrationResponse({ response });
        const passkey = await passkeyService.verifyRegistration(
          user,
          normalized,
          value.label,
          value.origin,
          id,
        );
        await getRedis().setex(
          key("result", id),
          180,
          JSON.stringify({
            status: "complete",
            scope: value.scope,
            passkey: { id: passkey.id, label: passkey.label },
          }),
        );
        return { id: passkey.id, label: passkey.label };
      } catch (error) {
        await getRedis().setex(
          key("result", id),
          180,
          JSON.stringify({ status: "failed", scope: value.scope }),
        );
        throw error;
      } finally {
        bindings.delete(id);
      }
    });
  },
  async result(id: string, user: SessionUser) {
    const executor = getContextExecutor();
    if (!executor) throw new AuthError("Server session required.");
    const raw = await getRedis().get(key("result", id));
    if (!raw) throw new AuthError("Registration result expired.");
    const result = JSON.parse(raw) as {
      scope: string;
      status: string;
      passkey?: { id: string; label: string };
    };
    if (result.scope !== scope(user, executor))
      throw new AuthError("Invalid result owner.");
    return { status: result.status, passkey: result.passkey };
  },
};
