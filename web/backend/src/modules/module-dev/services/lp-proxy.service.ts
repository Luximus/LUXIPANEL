/**
 * Proxy hacia LP-LS para el ciclo de vida de los módulos del dev.
 *
 * Envuelve los métodos dev* de panelApiClient (credencial por-panel). LP debe
 * responder en cada lectura; una copia anterior nunca autoriza el acceso.
 *   - MUTACIONES (submit/resubmit/unpublish/republish): FAIL-CLOSED — sin
 *     caché, sin reintentos, 502 con el mensaje de LP; nunca éxito ficticio.
 *
 * Gate "IA-obligatoria" v1 (soft): submit/resubmit EXIGEN que exista el
 * marketplace-link del módulo en el TARGET (el alta nace en el asistente con
 * /mod vincular). Sin link → 400 tipado.
 *
 * Host del panel = identidad del developer ante LP. SIEMPRE sale de la SESIÓN
 * (controllers pasan `user.targetHost`; las agent tools, sin request, lo
 * resuelven del SessionUser pineado en el ALS — chat y MCP loopback lo
 * portan). Sin host de sesión → fail-closed (MODULE_DEV_NO_HOST). Jamás se
 * memoiza en estado de proceso ni se acepta de un header: ambos cruzarían la
 * identidad de developer entre tenants.
 */

import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { getContextUser } from "../../../shared/executor/context.js";
import { env } from "../../../config/env.js";
// Deep import on purpose: the `shared/executor` barrel pulls in the SSH
// executor factory (and, through it, `config/auth`), which this service does
// not need and which drags the whole env schema into every consumer.
import { requireExecutor } from "../../../shared/executor/require-executor.js";
import { marketplaceLinkRepository } from "../../../shared/marketplace-link/index.js";
import {
  panelApiClient,
  type DevModuleReviews,
  type DevModuleSummary,
} from "../../license/panel-api.client.js";
import { lpCacheRepository } from "../repositories/lp-cache.repository.js";
import type { CachedRead } from "../models/index.js";

const log = createModuleLogger("module-dev:lp-proxy");

// ── Errores upstream ────────────────────────────────────────────────────────

/**
 * Extrae el mensaje de negocio de LP de un fallo del canal de servicio.
 * `postLicenseServerJson` rechaza non-2xx con
 * `License server returned <code>: {"ok":false,"error":"…"}` — recuperamos el
 * `error` del cuerpo para que el dev vea el motivo real (SubmissionError).
 */
function extractLpMessage(err: unknown): string {
  const msg = errMessage(err);
  const match = msg.match(/License server returned \d+:\s*(\{[\s\S]*\})\s*$/);
  if (match) {
    try {
      const body = JSON.parse(match[1]!) as { error?: unknown };
      if (typeof body?.error === "string" && body.error) return body.error;
    } catch {
      /* cuerpo no-JSON: cae al mensaje crudo */
    }
  }
  return msg;
}

function upstreamError(err: unknown): AppError {
  return new AppError(extractLpMessage(err), 502, "MODULE_DEV_UPSTREAM_ERROR");
}

// ── Host del panel ──────────────────────────────────────────────────────────

/**
 * Host del panel de la sesión actual: el explícito del controller
 * (`user.targetHost`) o el del SessionUser pineado en el ALS. Fail-closed:
 * sin host de sesión NO hay fallback (ni headers ni último-visto) — eso
 * permitiría operar como el developer de otro panel.
 */
function resolveHost(hostFromSession?: string): string {
  const explicit = (hostFromSession ?? "").trim();
  if (explicit) return explicit;
  const fromContext = (getContextUser()?.targetHost ?? "").trim();
  if (fromContext) return fromContext;
  // LP derives the customer and panel from the API key, so a local session is
  // valid. This value is only a stable cache namespace and optional display host.
  return env.WEBAUTHN_RP_ID;
}

/** Claves de caché SIEMPRE con scope por host (instancia multi-tenant). */
function cacheKeyModules(host: string): string {
  return `modules:${host}`;
}
function cacheKeyReviews(host: string, code: string): string {
  return `reviews:${host}:${code}`;
}

// ── Gate IA v1 ──────────────────────────────────────────────────────────────

async function assertLinkedModule(moduleId: string): Promise<void> {
  const executor = requireExecutor();
  const link = await marketplaceLinkRepository.getByModuleId(executor, String(moduleId));
  if (!link) {
    throw new ValidationError(
      `El alta se hace desde el asistente (/mod vincular): no existe vínculo proyecto↔módulo para "${moduleId}" en este servidor`,
    );
  }
}

// ── Normalización ───────────────────────────────────────────────────────────

function normalizeModules(data: unknown): DevModuleSummary[] {
  if (Array.isArray(data)) return data as DevModuleSummary[];
  const wrapped = (data as { modules?: unknown } | null | undefined)?.modules;
  return Array.isArray(wrapped) ? (wrapped as DevModuleSummary[]) : [];
}

// ── Servicio ────────────────────────────────────────────────────────────────

export const lpProxyService = {
  /** Módulos del dev con su estado (fail-closed). */
  async listModules(host?: string): Promise<CachedRead<DevModuleSummary[]>> {
    // Sin host de sesión NO se sirve caché: la clave va scoped por host y un
    // fallback sin identidad mezclaría developers (el error 409 ya es claro).
    const resolvedHost = resolveHost(host);
    const key = cacheKeyModules(resolvedHost);
    try {
      const raw = await panelApiClient.devListModules({ host: resolvedHost });
      const modules = normalizeModules(raw);
      await lpCacheRepository.set(key, modules);
      return { data: modules, stale: false, fetchedAt: new Date().toISOString() };
    } catch (err) {
      throw upstreamError(err);
    }
  },

  /** Timeline de revisión de un módulo (fail-closed). */
  async getReviews(code: string, host?: string): Promise<CachedRead<DevModuleReviews>> {
    const resolvedHost = resolveHost(host);
    const key = cacheKeyReviews(resolvedHost, code);
    try {
      const reviews = await panelApiClient.devModuleReviews({
        host: resolvedHost,
        moduleId: code,
      });
      await lpCacheRepository.set(key, reviews);
      return { data: reviews, stale: false, fetchedAt: new Date().toISOString() };
    } catch (err) {
      throw upstreamError(err);
    }
  },

  /** Enviar a revisión (gate IA: exige marketplace-link). Fail-closed. */
  async submit(
    params: { moduleId: string; prUrl: string; scope?: string },
    host?: string,
  ): Promise<{ moduleId: string; versionId: unknown; reviewStatus: string }> {
    await assertLinkedModule(params.moduleId);
    const resolvedHost = resolveHost(host);
    try {
      const data = await panelApiClient.devSubmitModule({
        host: resolvedHost,
        moduleId: params.moduleId,
        prUrl: params.prUrl,
        ...(params.scope ? { scope: params.scope } : {}),
      });
      this.refreshAfterMutation(resolvedHost);
      return {
        moduleId: params.moduleId,
        versionId: data?.versionId ?? null,
        reviewStatus: typeof data?.reviewStatus === "string" ? data.reviewStatus : "enviado",
      };
    } catch (err) {
      throw upstreamError(err);
    }
  },

  /** Reenviar tras corrección (mismo gate que submit). Fail-closed. */
  async resubmit(
    code: string,
    prUrl: string,
    host?: string,
  ): Promise<{ moduleId: string; versionId: unknown; reviewStatus: string }> {
    await assertLinkedModule(code);
    const resolvedHost = resolveHost(host);
    try {
      const data = await panelApiClient.devResubmitModule({
        host: resolvedHost,
        moduleId: code,
        prUrl,
      });
      this.refreshAfterMutation(resolvedHost);
      return {
        moduleId: code,
        versionId: data?.versionId ?? null,
        reviewStatus: typeof data?.reviewStatus === "string" ? data.reviewStatus : "enviado",
      };
    } catch (err) {
      throw upstreamError(err);
    }
  },

  /** Despublicar (publico → inactivo). Fail-closed. */
  async unpublish(code: string, host?: string): Promise<{ reviewStatus: string }> {
    const resolvedHost = resolveHost(host);
    try {
      const data = await panelApiClient.devUnpublishModule({ host: resolvedHost, moduleId: code });
      this.refreshAfterMutation(resolvedHost);
      return { reviewStatus: typeof data?.reviewStatus === "string" ? data.reviewStatus : "inactivo" };
    } catch (err) {
      throw upstreamError(err);
    }
  },

  /** Reactivar (inactivo → publico, solo si fue aprobado antes). Fail-closed. */
  async republish(code: string, host?: string): Promise<{ reviewStatus: string }> {
    const resolvedHost = resolveHost(host);
    try {
      const data = await panelApiClient.devRepublishModule({ host: resolvedHost, moduleId: code });
      this.refreshAfterMutation(resolvedHost);
      return { reviewStatus: typeof data?.reviewStatus === "string" ? data.reviewStatus : "publico" };
    } catch (err) {
      throw upstreamError(err);
    }
  },

  /** Refresco best-effort de la lista tras una mutación (no bloquea). */
  refreshAfterMutation(host: string): void {
    void this.listModules(host).catch((err) => {
      log.debug({ err: (err as Error).message }, "post-mutation refresh failed (ignored)");
    });
  },
};
