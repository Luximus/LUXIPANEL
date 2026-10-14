// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Rate limiter middleware backed by Redis (rate-limit-redis on top of ioredis).
 *
 * Previously this declared itself "using Redis as store" while leaving the
 * default `express-rate-limit` `MemoryStore`, which made the lockout inert
 * across pm2 cluster workers and easily defeated (each process kept its own
 * bucket). Wired now to share a single bucket across the whole fleet via the
 * shared `getRedis()` client. The RedisStore loads a Lua script in its
 * constructor, so construction must wait until after bootstrap connects Redis.
 * Bootstrap refuses to listen when Redis cannot be connected.
 */

import type { Request } from "express";
import { trustedClientIp } from "../../../shared/middleware/trusted-proxy.js";
import rateLimit, { type Options, type Store } from "express-rate-limit";
import RedisStoreModule from "rate-limit-redis";
import { serverConfig } from "../../../config/server.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { getRedis } from "../../../shared/redis/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";

/** Espejo del `RedisReply` interno de `rate-limit-redis` (no lo exporta). */
type RedisReply = boolean | number | string | Array<boolean | number | string>;

const log = createModuleLogger("rate-limiter");

// CJS/ESM interop: rate-limit-redis exposes a `.default` on the CJS build.
// Some resolvers hand us the object directly.
const RedisStore =
  (RedisStoreModule as unknown as { default?: typeof RedisStoreModule })
    .default ?? RedisStoreModule;

/**
 * Un `Store` NUEVO por limitador, con su propio prefijo.
 *
 * `express-rate-limit` v7 rechaza compartir una instancia entre limitadores
 * (ERR_ERL_STORE_REUSE) y lanza al construir el segundo — es decir, tumba el
 * arranque de la app entera. Y con razón: dos limitadores sobre el mismo store
 * y sin prefijo distinto contarían sus peticiones en las MISMAS claves, así que
 * el tráfico normal iría consumiendo el cupo del login (y viceversa).
 */
function buildStore(prefix: string): Store {
  let instance: Store | undefined;
  let options: Options | undefined;
  const ready = (): Store => {
    if (instance) return instance;
    const client = getRedis();
    instance = new RedisStore({
      prefix,
      // Shim para la firma de ioredis: `call(comando, ...args)`. `rate-limit-redis`
      // ya entrega el comando como PRIMER elemento de `args` (SCRIPT LOAD /
      // EVALSHA / DECR / DEL), así que se reenvía tal cual.
      //
      // OJO: aquí había un `call("call", ...args)` — pasaba la cadena literal
      // "call" como nombre de comando, con lo que el comando de verdad viajaba
      // como argumento y Redis contestaba algo que la librería rechazaba
      // ("unexpected reply from redis client"). El rate-limit quedaba inservible.
      //
      // El tipo de retorno se afirma porque `ioredis.call()` está tipado como
      // `unknown` y los tipos de `rate-limit-redis` son internos (no exportados).
      sendCommand: (...args: string[]) =>
        (client as unknown as {
          call: (...a: unknown[]) => Promise<RedisReply>;
        }).call(...args),
    });
    if (options) instance.init?.(options);
    return instance;
  };
  return {
    prefix,
    init: (value) => { options = value; },
    increment: (key) => ready().increment(key),
    decrement: (key) => ready().decrement(key),
    resetKey: (key) => ready().resetKey(key),
    shutdown: () => instance?.shutdown?.(),
  };
}

// Instancias separadas (ver buildStore): NO reutilizar una sola.
const globalStore = buildStore("rl:global:");
const loginStore = buildStore("rl:login:");

/** Only attested ingress may supply a client IP; all other requests share
 * their actual TCP peer bucket, including untrusted processes on loopback. */
export function clientIpKey(req: Request): string {
  return trustedClientIp(req) ?? req.socket.remoteAddress ?? "unknown";
}

/** Global API rate limiter. */
export const globalRateLimiter = rateLimit({
  windowMs: serverConfig.rateLimit.windowMs,
  max: serverConfig.rateLimit.max,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: globalStore,
  skip: (req) => req.path === "/api/health",
  keyGenerator: clientIpKey,
  handler: (_req, res, _next, options) => {
    log.warn({ ip: _req.ip, client: clientIpKey(_req) }, "Global rate limit exceeded");
    res.status(options.statusCode).json({ ok: false, error: apiErrorMessage(res.locals.locale, "rateLimit"), code: ErrorCodes.RATE_LIMIT });
  },
});

/** Stricter rate limiter for login endpoints. */
export const loginRateLimiter = rateLimit({
  windowMs: serverConfig.loginRateLimit.windowMs,
  max: serverConfig.loginRateLimit.max,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: loginStore,
  keyGenerator: clientIpKey,
  handler: (_req, res, _next, options) => {
    log.warn({ ip: _req.ip, client: clientIpKey(_req) }, "Login rate limit exceeded");
    res.status(options.statusCode).json({ ok: false, error: apiErrorMessage(res.locals.locale, "rateLimit"), code: ErrorCodes.RATE_LIMIT });
  },
});

const ssoExchangeStore = buildStore("rl:sso-exchange:");

/**
 * Clave POR-USUARIO (no por-IP) para el SSO exchange. El handoff SSO llega
 * SIEMPRE desde la única IP del backend LP-LS, así que un limitador por-IP
 * estrangularía a todos los usuarios a la vez o sería inútil. Aquí se limita por
 * el usuario Linux objetivo (defensa por-cuenta INDEPENDIENTE del lockout que el
 * admin pueda haber desactivado en la seguridad del box). `user` vacío → un solo
 * bucket (esas peticiones fallan en validación de todos modos).
 */
function ssoExchangeUserKey(req: Request): string {
  const raw = (req.body as { user?: unknown } | undefined)?.user;
  const user = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return user ? `u:${user}` : "u:__empty__";
}

/**
 * Limitador del SSO exchange (`POST /api/auth/sso/exchange`). Reusa la ventana/
 * cupo estricto del login pero keyea por USUARIO. Cierra el hueco de que, si el
 * admin del box desactiva el lockout por-cuenta (`maxFailedLoginAttempts=0`), el
 * exchange (sin captcha, servicio→servicio) se convierta en un oráculo de
 * contraseñas sin throttle.
 */
export const ssoExchangeRateLimiter = rateLimit({
  windowMs: serverConfig.loginRateLimit.windowMs,
  max: serverConfig.loginRateLimit.max,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: ssoExchangeStore,
  keyGenerator: ssoExchangeUserKey,
  handler: (_req, res, _next, options) => {
    log.warn({ userKey: ssoExchangeUserKey(_req) }, "SSO exchange rate limit exceeded");
    res.status(options.statusCode).json({ ok: false, error: apiErrorMessage(res.locals.locale, "rateLimit"), code: ErrorCodes.RATE_LIMIT });
  },
});
