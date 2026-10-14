// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tolqia ACCOUNT link — "this server belongs to a tolqia.com account".
 *
 * LUXIPANEL joins Tolqia with an API token that the owner generates on
 * tolqia.com (Ajustes › API, plans Plus/Premium). With that token:
 *
 *   • the room endpoints are called with `Authorization: Bearer tq_live_…`
 *     instead of the internal S2S secret;
 *   • LUXIPANEL stops sending `credentials` — Tolqia uses the ElevenLabs/OpenAI
 *     keys of the TOKEN OWNER, so the panel never pays for the pipeline;
 *   • the account's plan limits apply (how many participants may have
 *     translation on, how many groups/members).
 *
 * Without a token everything keeps working exactly as before (internal S2S
 * secret + the panel's own provider credentials) — the link is OPT-IN.
 *
 * This service owns the account probe and its cache; `tolqia-bridge.service.ts`
 * owns the calls themselves and only asks us for the bearer.
 */

import { createHash } from "node:crypto";
import { env } from "../../../config/env.js";
import { fetchWithTimeout } from "../../../shared/http/fetch-timeout.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { localizeTolqiaMessage, summarizeTolqiaAccount } from "./tolqia-i18n.js";
import {
  tolqiaCredentialRepository,
  TOLQIA_TOKEN_RE,
} from "../repositories/tolqia-credential.repository.js";

const log = createModuleLogger("tolqia-account");

/** Same budget as the bridge: Tolqia answers in single-digit ms on loopback. */
const HTTP_TIMEOUT_MS = 5_000;
/** The credentials card and the messenger badge both poll this. */
const ACCOUNT_CACHE_MS = 5 * 60_000;

// ── Contract (tolerant: Tolqia is still shipping this) ─────────────────────

export interface TolqiaPlanLimits {
  /** How many participants may have translation ON. `null` = unlimited. */
  translationParticipants: number | null;
  maxGroups: number | null;
  maxMembers: number | null;
}

export interface TolqiaAccount {
  displayName: string;
  plan: string;
  status: string;
  limits: TolqiaPlanLimits;
  credentials: { elevenlabs: boolean; openai: boolean };
}

/** `GET /api/chat/tolqia/config` — admin-only. */
export interface TolqiaConfigView {
  tokenSet: boolean;
  /** First 12 chars (`tq_live_abcd`). Never more. */
  tokenPreview: string;
  updatedAt?: string;
  account?: TolqiaAccount;
  /** One-line "Plan Plus · activo · …" for the credentials card. */
  accountSummary?: string;
}

/** `POST /api/chat/tolqia/test`. Always 200. */
export interface TolqiaTestResult {
  valid: boolean;
  plan: string | null;
  limits: TolqiaPlanLimits | null;
  message: string;
}

/** `GET /api/chat/tolqia/plan` — any authenticated user. */
export interface TolqiaPlanView {
  configured: boolean;
  plan: string | null;
  status: string | null;
  limits: TolqiaPlanLimits | null;
  /** Whether a call started now may switch translation on. */
  translationAvailable: boolean;
}

// ── Parsing ────────────────────────────────────────────────────────────────

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * `{ok, data:{user, plan, status, limits, usage, credentials}}` → `TolqiaAccount`.
 * Deliberately forgiving: the endpoint is being built alongside this code, so a
 * missing `limits` means "unknown / unlimited", not a hard failure.
 */
export function parseAccount(body: unknown): TolqiaAccount | null {
  const root = (body ?? {}) as Record<string, unknown>;
  const data = ((root.data ?? root) ?? {}) as Record<string, unknown>;
  const plan = typeof data.plan === "string" ? data.plan : "";
  if (!plan) return null;
  const user = (data.user ?? {}) as Record<string, unknown>;
  const limits = (data.limits ?? {}) as Record<string, unknown>;
  const creds = (data.credentials ?? {}) as Record<string, unknown>;
  return {
    displayName: typeof user.displayName === "string" ? user.displayName : "",
    plan,
    status: typeof data.status === "string" ? data.status : "active",
    limits: {
      translationParticipants: num(limits.translationParticipants),
      maxGroups: num(limits.maxGroups),
      maxMembers: num(limits.maxMembers),
    },
    credentials: {
      elevenlabs: creds.elevenlabs === true,
      openai: creds.openai === true,
    },
  };
}

/** Human one-liner shown under the token field (`.cred-note`). */
export function summarize(account: TolqiaAccount, locale: unknown = "es"): string {
  return summarizeTolqiaAccount(locale, account);
}

// ── Probe + cache ──────────────────────────────────────────────────────────

interface ProbeResult {
  ok: boolean;
  status: number;
  account: TolqiaAccount | null;
  message: string;
}

/** `${targetId}::${sha256(token).slice(0,16)}` — a new token busts the entry. */
function cacheKey(targetId: string, token: string): string {
  return `${targetId}::${createHash("sha256").update(token).digest("hex").slice(0, 16)}`;
}

const accountCache = new Map<string, { at: number; account: TolqiaAccount }>();

/** Test seam + used whenever the stored token changes. */
export function __resetTolqiaAccountCache(): void {
  accountCache.clear();
}

/** Base URL of Tolqia, no trailing slash. */
function baseUrl(): string {
  return env.TOLQIA_URL.replace(/\/+$/, "");
}

/**
 * `GET /v1/calls/account` with the token as bearer.
 *
 * NEVER throws and NEVER logs the token: an unreachable Tolqia, a 401 or a
 * malformed body all come back as `{ok:false, message}` so the card can show a
 * toast and `PUT` can answer a clean 400.
 */
export async function probeAccount(token: string): Promise<ProbeResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${baseUrl()}/v1/calls/account`,
      { method: "GET", headers: { authorization: `Bearer ${token}`, accept: "application/json" } },
      HTTP_TIMEOUT_MS,
    );
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      account: null,
      message: timedOut
        ? "Tiempo de espera agotado al contactar con Tolqia"
        : "No se pudo contactar con Tolqia",
    };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.status === 401) {
    return { ok: false, status: 401, account: null, message: "Tolqia rechazó el token (no autorizado)" };
  }
  if (res.status === 402) {
    return { ok: false, status: 402, account: parseAccount(body), message: "El plan de Tolqia está inactivo" };
  }
  if (res.status === 403) {
    return {
      ok: false,
      status: 403,
      account: parseAccount(body),
      message: "La cuenta de Tolqia necesita un plan Plus o Premium",
    };
  }
  if (!res.ok) {
    log.warn({ status: res.status }, "tolqia account probe failed");
    return { ok: false, status: res.status, account: null, message: `Tolqia respondió ${res.status}` };
  }

  const account = parseAccount(body);
  if (!account) {
    return { ok: false, status: res.status, account: null, message: "Respuesta inesperada de Tolqia" };
  }
  return { ok: true, status: res.status, account, message: summarize(account) };
}

/** Cached probe (5 min per server+token). `null` when the probe failed. */
async function cachedAccount(targetId: string, token: string): Promise<TolqiaAccount | null> {
  const key = cacheKey(targetId, token);
  const hit = accountCache.get(key);
  if (hit && Date.now() - hit.at < ACCOUNT_CACHE_MS) return hit.account;
  const probe = await probeAccount(token);
  if (probe.account) accountCache.set(key, { at: Date.now(), account: probe.account });
  return probe.account;
}

// ── Public API ─────────────────────────────────────────────────────────────

export const tolqiaAccountService = {
  /**
   * The token that must authenticate this server's call traffic, or null when
   * the server is not linked (the bridge then falls back to the S2S secret).
   */
  async token(executor: Executor): Promise<string | null> {
    return tolqiaCredentialRepository.token(executor);
  },

  /** `GET /api/chat/tolqia/config` — presence, preview and the cached account. */
  async getConfig(executor: Executor, locale: unknown = "es"): Promise<TolqiaConfigView> {
    const redacted = await tolqiaCredentialRepository.redacted(executor);
    if (!redacted.tokenSet) return redacted;
    const token = await tolqiaCredentialRepository.token(executor);
    if (!token) return redacted;
    const account = await cachedAccount(executor.target.id, token);
    if (!account) return redacted;
    return { ...redacted, account, accountSummary: summarize(account, locale) };
  },

  /**
   * `PUT /api/chat/tolqia/config` — save a token.
   *
   * Two gates before anything is written: the wire format (`tq_live_` + 40) and
   * a live `GET /v1/calls/account`. A token that Tolqia does not accept is a
   * 400 with the upstream's human reason — we never store a token we could not
   * use.
   */
  async setToken(executor: Executor, raw: string, savedBy?: string, locale: unknown = "es"): Promise<TolqiaConfigView> {
    const token = raw.trim();
    if (!TOLQIA_TOKEN_RE.test(token)) {
      throw new ValidationError("Formato de token inválido: debe ser tq_live_ seguido de 40 caracteres", [
        { field: "token", message: "Formato inválido" },
      ]);
    }
    const probe = await probeAccount(token);
    if (!probe.ok || !probe.account) {
      throw new ValidationError(probe.message, [{ field: "token", message: probe.message }]);
    }
    const saved = await tolqiaCredentialRepository.save(executor, token, savedBy);
    accountCache.set(cacheKey(executor.target.id, token), { at: Date.now(), account: probe.account });
    return { ...saved, account: probe.account, accountSummary: summarize(probe.account, locale) };
  },

  /** `DELETE /api/chat/tolqia/config` — unlink the server. */
  async clearToken(executor: Executor): Promise<TolqiaConfigView> {
    const token = await tolqiaCredentialRepository.token(executor);
    if (token) accountCache.delete(cacheKey(executor.target.id, token));
    return tolqiaCredentialRepository.clear(executor);
  },

  /**
   * `POST /api/chat/tolqia/test` — probe the supplied token, else the stored
   * one. ALWAYS resolves (never a 5xx): the card only shows a toast.
   */
  async test(executor: Executor, candidate?: string, locale: unknown = "es"): Promise<TolqiaTestResult> {
    let token = (candidate ?? "").trim();
    if (!token) token = (await tolqiaCredentialRepository.token(executor)) ?? "";
    if (!token) {
      return { valid: false, plan: null, limits: null, message: localizeTolqiaMessage(locale, "No hay ningún token de Tolqia configurado") };
    }
    if (!TOLQIA_TOKEN_RE.test(token)) {
      return {
        valid: false,
        plan: null,
        limits: null,
        message: localizeTolqiaMessage(locale, "Formato de token inválido: debe ser tq_live_ seguido de 40 caracteres"),
      };
    }
    const probe = await probeAccount(token);
    if (probe.account) {
      accountCache.set(cacheKey(executor.target.id, token), { at: Date.now(), account: probe.account });
    }
    return {
      valid: probe.ok,
      plan: probe.account?.plan ?? null,
      limits: probe.account?.limits ?? null,
      message: probe.account && probe.ok ? summarize(probe.account, locale) : localizeTolqiaMessage(locale, probe.message),
    };
  },

  /**
   * `GET /api/chat/tolqia/plan` — what EVERY user may know about the link, so
   * the messenger can badge the plan and warn when translation is unavailable.
   * Carries no token, no preview and no account holder name.
   */
  async plan(executor: Executor): Promise<TolqiaPlanView> {
    const token = await tolqiaCredentialRepository.token(executor);
    if (!token) {
      return { configured: false, plan: null, status: null, limits: null, translationAvailable: false };
    }
    const account = await cachedAccount(executor.target.id, token);
    if (!account) {
      // Linked, but Tolqia is unreachable right now: report the link (so the
      // "configure a token" notice does not flash) with translation unknown.
      return { configured: true, plan: null, status: null, limits: null, translationAvailable: false };
    }
    return {
      configured: true,
      plan: account.plan,
      status: account.status,
      limits: account.limits,
      translationAvailable: account.status === "active",
    };
  },
};
