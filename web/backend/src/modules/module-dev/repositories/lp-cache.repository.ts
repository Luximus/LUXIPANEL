/**
 * Caché de instancia de las LECTURAS a LP (estado de los módulos del dev).
 *
 * El estado de revisión de los módulos del marketplace es ESTADO DE INSTANCIA
 * (pertenece a este panel/instalación, no a ningún servidor puenteado), igual
 * que la licencia o el catálogo de módulos. Por eso este sidecar vive en el
 * HOST DEL PANEL vía `localExecutor` EXPLÍCITO — nunca `getContextExecutor()`
 * (regla CLAUDE.md §Estado de instancia).
 *
 * Sidecar: `${LUXIPANEL_CONFIG_DIR}/module-dev/lp-cache.json` en el panel host.
 * Las claves SIEMPRE van prefijadas por el HOST del panel que originó la
 * lectura (`modules:<host>`, `reviews:<host>:<code>`): el proceso es
 * multi-tenant y una caché sin scope filtraría los módulos de un developer al
 * panel de otro. Aquí NO se memoiza ningún host: la identidad del panel viene
 * SIEMPRE de la sesión (lp-proxy.service resolveHost, fail-closed) — un global
 * de proceso cruzaría identidades entre tenants concurrentes.
 *
 * Trampa kv conocida: la clave SIEMPRE se lee/escribe como String.
 */

import { kv } from "../../../shared/kv-store/index.js";
import { localExecutor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("module-dev:lp-cache");

const MODULE = "module-dev";
const COLLECTION = "lp-cache";

interface CacheEntry {
  data: unknown;
  fetchedAt: string;
}

function store() {
  return kv(localExecutor).module(MODULE).collection<CacheEntry>(COLLECTION);
}

export const lpCacheRepository = {
  /** Última copia buena de una lectura LP, o null. */
  async get<T = unknown>(key: string): Promise<{ data: T; fetchedAt: string } | null> {
    try {
      const entry = await store().get(String(key));
      if (!entry || entry.fetchedAt === undefined) return null;
      return { data: entry.data as T, fetchedAt: String(entry.fetchedAt) };
    } catch (err) {
      // La caché es best-effort: un sidecar corrupto/ilegible no debe tumbar
      // la lectura (el caller decidirá si puede ir a LP o devolver 502).
      log.warn({ key, err: (err as Error).message }, "lp-cache read failed");
      return null;
    }
  },

  /** Guarda la última respuesta buena de LP (best-effort, nunca lanza). */
  async set(key: string, data: unknown): Promise<void> {
    try {
      await store().set(String(key), { data, fetchedAt: new Date().toISOString() });
    } catch (err) {
      log.warn({ key, err: (err as Error).message }, "lp-cache write failed");
    }
  },
};
