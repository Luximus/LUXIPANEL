// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Passkey service — WebAuthn registration and authentication.
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";
import { authConfig } from "../../../config/auth.js";
import { passkeyRepository, panelUserRepository } from "../repositories/index.js";
import { getRedis } from "../../../shared/redis/index.js";
import { AuthError, ValidationError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { uuid } from "../../../shared/utils/index.js";
import { getPanelOrigin } from "../../../shared/panel-url/index.js";
import type { PanelUser } from "../models/index.js";

const log = createModuleLogger("passkey-service");

/** Redis TTL for pending WebAuthn challenges (seconds). */
const CHALLENGE_TTL = 120;

/** Redis key templates for the short-lived WebAuthn challenges (single source
 *  of truth so set/get/del never drift and leave orphan keys). */
const webauthnRegKey = (userId: string | number): string => `webauthn:reg:${userId}`;
const webauthnAuthKey = (challenge: string): string => `webauthn:auth:${challenge}`;

/** True when `host` is the rpId itself or a subdomain of it (the per-panel
 *  subdomain `xxxx.luxipanel.com` for rpId `luxipanel.com`). */
function hostMatchesRpId(host: string, rpId: string): boolean {
  const h = host.toLowerCase();
  const r = rpId.toLowerCase();
  return h === r || h.endsWith(`.${r}`);
}

/**
 * Resolve the WebAuthn context (expectedOrigin + rpId) for a request.
 *
 * SECURITY (anti-phishing): the `rpId` is ALWAYS the configured registrable
 * domain — NEVER derived from the client `Origin` header (deriving it would let
 * a phishing page on any hostname mint/verify credentials for itself). The
 * expected origin is validated against a fixed allowlist (the configured panel
 * origin + the learned per-panel origin) and the requested origin's host must
 * be the rpId or one of its subdomains. A mismatch is rejected with a typed
 * error; when no origin is supplied we fall back to the configured origin.
 */
async function resolveWebAuthnContext(origin?: string | null) {
  const rpId = authConfig.webauthn.rpId;
  const fallback = { origin: authConfig.webauthn.origin, rpId };

  if (!origin) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new ValidationError("Origen WebAuthn inválido.");
  }
  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname) throw new ValidationError("Origen WebAuthn inválido.");

  // Build the trusted allowlist from instance state, never from the header.
  const allowed = new Set<string>([authConfig.webauthn.origin]);
  const learned = await getPanelOrigin().catch(() => null);
  if (learned) allowed.add(learned);

  // Accept the requested origin only if it is on the allowlist OR its host is
  // the rpId / a subdomain of it (covers the per-panel subdomain that the
  // browser legitimately sends and that the panel hasn't learned yet).
  if (allowed.has(parsed.origin) || hostMatchesRpId(hostname, rpId)) {
    return { origin: parsed.origin, rpId };
  }

  log.warn({ origin: parsed.origin, rpId }, "Rejected WebAuthn origin not on allowlist");
  throw new ValidationError("Origen WebAuthn no permitido.");
}

export const passkeyService = {
  /** Generate registration options for adding a new passkey (user must be authenticated). */
  async getRegistrationOptions(user: PanelUser, origin?: string | null, registrationScope?: string) {
    const existingPasskeys = await passkeyRepository.findActiveByUser(user.id);
    const webAuthn = await resolveWebAuthnContext(origin);

    const options = await generateRegistrationOptions({
      rpName: authConfig.webauthn.rpName,
      rpID: webAuthn.rpId,
      userID: new TextEncoder().encode(String(user.id)),
      userName: user.username,
      userDisplayName: user.displayName || user.username,
      attestationType: "none",
      excludeCredentials: existingPasskeys.map((pk) => ({
        id: pk.credentialId,
        transports: (pk.transports ?? []) as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    const redis = getRedis();
    await redis.setex(webauthnRegKey(registrationScope ? `${registrationScope}:${user.id}` : user.id), CHALLENGE_TTL, options.challenge);

    return options;
  },

  /** Verify registration response and persist the new passkey credential. */
  async verifyRegistration(
    user: PanelUser,
    response: RegistrationResponseJSON,
    label: string,
    origin?: string | null,
    registrationScope?: string,
  ) {
    const redis = getRedis();
    const challenge = await redis.get(webauthnRegKey(registrationScope ? `${registrationScope}:${user.id}` : user.id));
    if (!challenge) throw new AuthError("Registration challenge expired or not found");
    const webAuthn = await resolveWebAuthnContext(origin);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: webAuthn.origin,
      expectedRPID: webAuthn.rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new AuthError("Passkey registration verification failed");
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    const passkey = await passkeyRepository.create({
      id: uuid(),
      userId: user.id,
      label,
      credentialId: credentialID,
      publicKeyB64url: Buffer.from(credentialPublicKey).toString("base64url"),
      counter,
      transports: (response.response.transports ?? []) as string[],
      platform: null,
    });

    await redis.del(webauthnRegKey(registrationScope ? `${registrationScope}:${user.id}` : user.id));
    log.info({ userId: user.id, credentialId: credentialID }, "Passkey registered");
    return passkey;
  },

  /** Generate authentication options. If username provided, pre-fills allowed credentials. */
  async getAuthenticationOptions(username?: string, origin?: string | null) {
    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = [];
    const webAuthn = await resolveWebAuthnContext(origin);

    if (username) {
      const user = await panelUserRepository.findByUsername(username);
      if (user) {
        const passkeys = await passkeyRepository.findActiveByUser(user.id);
        allowCredentials = passkeys.map((pk) => ({
          id: pk.credentialId,
          transports: (pk.transports ?? []) as AuthenticatorTransportFuture[],
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: webAuthn.rpId,
      allowCredentials,
      userVerification: "preferred",
    });

    const redis = getRedis();
    await redis.setex(webauthnAuthKey(options.challenge), CHALLENGE_TTL, options.challenge);

    return options;
  },

  /** Verify authentication response and return the matched user's ID. */
  async verifyAuthentication(response: AuthenticationResponseJSON, origin?: string | null): Promise<number> {
    const redis = getRedis();
    const webAuthn = await resolveWebAuthnContext(origin);

    // Decode the challenge from the clientDataJSON. Attacker-controlled input:
    // guard the parse so a malformed body yields a typed 400, not a 500.
    let challenge: string;
    try {
      const clientDataRaw = Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8");
      const clientData = JSON.parse(clientDataRaw) as { challenge: string };
      challenge = clientData.challenge;
    } catch {
      throw new ValidationError("Respuesta de autenticación WebAuthn inválida.");
    }
    if (!challenge) throw new ValidationError("Respuesta de autenticación WebAuthn inválida.");

    const storedChallenge = await redis.get(webauthnAuthKey(challenge));
    if (!storedChallenge) throw new AuthError("Authentication challenge expired or not found");

    const passkey = await passkeyRepository.findByCredentialId(response.id);
    if (!passkey) throw new AuthError("Passkey not found");

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: storedChallenge,
      expectedOrigin: webAuthn.origin,
      expectedRPID: webAuthn.rpId,
      authenticator: {
        credentialID: passkey.credentialId,
        credentialPublicKey: Buffer.from(passkey.publicKeyB64url, "base64url"),
        counter: passkey.counter,
        transports: (passkey.transports ?? []) as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) throw new AuthError("Passkey authentication failed");

    await passkeyRepository.updateCounter(passkey.credentialId, verification.authenticationInfo.newCounter);
    await redis.del(webauthnAuthKey(challenge));

    log.info({ credentialId: passkey.credentialId, userId: passkey.userId }, "Passkey authenticated");
    return passkey.userId;
  },

  /** List all active passkeys for a user. */
  async list(userId: number) {
    const passkeys = await passkeyRepository.findActiveByUser(userId);
    return passkeys.map((pk) => ({
      id: pk.id,
      label: pk.label,
      platform: pk.platform,
      createdAt: pk.createdAt,
      lastUsedAt: pk.lastUsedAt,
    }));
  },

  /** Change only the display name; ownership and revocation are checked atomically. */
  async rename(userId: number, passkeyId: string, label: string) {
    const passkey = await passkeyRepository.rename(userId, passkeyId, label);
    if (!passkey) throw new AuthError("Passkey not found");
    return { id: passkey.id, label: passkey.label };
  },

  /** Revoke a passkey by ID. Validates ownership. */
  async revoke(userId: number, passkeyId: string) {
    const passkey = await passkeyRepository.findById(passkeyId);
    if (!passkey || passkey.userId !== userId) {
      throw new AuthError("Passkey not found");
    }
    await passkeyRepository.revoke(passkeyId);
    log.info({ userId, passkeyId }, "Passkey revoked");
  },
};
