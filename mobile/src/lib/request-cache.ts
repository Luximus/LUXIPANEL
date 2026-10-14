// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Caché de peticiones con TTL + SINGLE-FLIGHT (dedupe de peticiones en vuelo).
 *
 * Motivación (perf): la app es cliente del control plane LP y, para todo lo que
 * toca un panel, cada petición atraviesa un TÚNEL SSH (cientos de ms). Con las
 * pestañas (un `useMainTabController` por pestaña) y las pantallas que se
 * remontan (carousel, drawer, chat, módulos nativos), el MISMO GET salía 3-5
 * veces seguidas: `/portal/me`, `/portal/licenses`, `/portal/ssh/modules`,
 * `/portal/wallet`… Este helper unifica los cachés module-level ad-hoc que
 * había repartidos (paleta de panel, estado de paneles) en UNA primitiva:
 *
 *  - **single-flight**: N llamadas concurrentes a la misma clave → UNA petición
 *    de red; todas comparten la misma promesa (mismo patrón que el refresh de
 *    token en `api/auth-bridge.ts`, generalizado por clave).
 *  - **TTL**: un resultado reciente se sirve de memoria sin tocar la red.
 *  - **force**: el refresco EXPLÍCITO del usuario (pull-to-refresh, recargar)
 *    salta la caché, pero sigue uniéndose a una petición ya en vuelo.
 *  - **invalidate**: una mutación tira la entrada (y su petición en vuelo) para
 *    que la siguiente lectura sea fresca.
 *
 * Los ERRORES NO se cachean (ni se recuerdan): la siguiente llamada reintenta.
 *
 * Los cachés se registran en `store-reset` (higiene de sesión: logout / cambio
 * de cuenta vacían todo; las claves llevan el token, pero no dependemos de eso).
 */
import { registerStoreReset } from "./store-reset";

type Entry = { value: unknown; at: number };

export type CacheFetchOptions = {
  /** Ventana de frescura en ms. `0` = solo dedupe (nunca sirve de memoria). */
  ttlMs?: number;
  /** Ignora el valor cacheado (refresco explícito). Sigue uniéndose al vuelo. */
  force?: boolean;
};

export interface RequestCache {
  /**
   * Devuelve el valor de `key`: de memoria si está fresco, uniéndose a la
   * petición en vuelo si la hay, o ejecutando `fetcher` (y cacheando su
   * resultado). Los rechazos se propagan a todos los que esperan y NO se cachean.
   */
  fetch<T>(key: string, fetcher: () => Promise<T>, opts?: CacheFetchOptions): Promise<T>;
  /** Lee el valor cacheado si sigue fresco (sin red). `undefined` si no hay. */
  peek<T>(key: string, ttlMs?: number): T | undefined;
  /** Siembra el caché (p. ej. tras una mutación que ya devuelve el recurso). */
  set<T>(key: string, value: T): void;
  /** Tira una clave (valor + petición en vuelo). */
  invalidate(key: string): void;
  /** Tira todas las claves que empiezan por `prefix`. */
  invalidatePrefix(prefix: string): void;
  /** Tira todas las claves que cumplen el predicado. */
  invalidateWhere(match: (key: string) => boolean): void;
  /** Vacía el caché entero. */
  clear(): void;
  /** Nº de entradas cacheadas (tests/diagnóstico). */
  size(): number;
}

export type RequestCacheOptions = {
  /** TTL por defecto de `fetch` (ms). Por defecto 0 = solo dedupe. */
  defaultTtlMs?: number;
  /** Reloj inyectable (tests). */
  now?: () => number;
  /** Vaciar en `resetAllStores()` (logout / cambio de cuenta). Por defecto sí. */
  resetOnLogout?: boolean;
};

export function createRequestCache(options: RequestCacheOptions = {}): RequestCache {
  const now = options.now ?? Date.now;
  const defaultTtlMs = options.defaultTtlMs ?? 0;
  const entries = new Map<string, Entry>();
  const inflight = new Map<string, Promise<unknown>>();

  const cache: RequestCache = {
    fetch<T>(key: string, fetcher: () => Promise<T>, opts: CacheFetchOptions = {}): Promise<T> {
      const ttlMs = opts.ttlMs ?? defaultTtlMs;
      if (!opts.force && ttlMs > 0) {
        const hit = entries.get(key);
        if (hit && now() - hit.at < ttlMs) return Promise.resolve(hit.value as T);
      }
      // Petición ya en vuelo (incluso con `force`): esos datos SON de ahora
      // mismo, así que unirse es correcto y evita el doble round-trip del
      // doble toque / de dos componentes montando a la vez.
      const pending = inflight.get(key) as Promise<T> | undefined;
      if (pending) return pending;

      // `self` permite que el cuerpo async se compare con la petición registrada
      // sin auto-referenciar la const antes de asignarla (el cuerpo solo la lee
      // DESPUÉS del primer `await`, cuando ya está puesta).
      const self: { promise?: Promise<T> } = {};
      const promise = (async () => {
        try {
          const value = await fetcher();
          // Solo cachea si la entrada no fue invalidada mientras volaba: si una
          // mutación tiró la clave, este resultado ya es viejo.
          if (inflight.get(key) === self.promise) entries.set(key, { value, at: now() });
          return value;
        } finally {
          if (inflight.get(key) === self.promise) inflight.delete(key);
        }
      })();
      self.promise = promise;
      inflight.set(key, promise);
      return promise;
    },

    peek<T>(key: string, ttlMs = defaultTtlMs): T | undefined {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (ttlMs > 0 && now() - hit.at >= ttlMs) return undefined;
      return hit.value as T;
    },

    set<T>(key: string, value: T): void {
      entries.set(key, { value, at: now() });
    },

    invalidate(key: string): void {
      entries.delete(key);
      inflight.delete(key);
    },

    invalidatePrefix(prefix: string): void {
      cache.invalidateWhere((key) => key.startsWith(prefix));
    },

    invalidateWhere(match: (key: string) => boolean): void {
      for (const key of [...entries.keys()]) if (match(key)) entries.delete(key);
      for (const key of [...inflight.keys()]) if (match(key)) inflight.delete(key);
    },

    clear(): void {
      entries.clear();
      inflight.clear();
    },

    size(): number {
      return entries.size;
    },
  };

  if (options.resetOnLogout !== false) registerStoreReset(() => cache.clear());
  return cache;
}
