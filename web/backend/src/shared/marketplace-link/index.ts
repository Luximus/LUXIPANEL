/**
 * marketplace-link — asociación proyecto-del-asistente ↔ módulo-del-marketplace.
 *
 * Sidecar per-target: `${LUXIPANEL_CONFIG_DIR}/marketplace-link/links.json`.
 *
 * Es la fuente de verdad ÚNICA del vínculo (no se duplica en
 * `assistant/projects.json`): module-dev no puede importar ai-assistant
 * (regla no-cross-imports), así que ambos módulos consumen este shared.
 * Guarda `projectPath` desnormalizado para que module-dev (test runner,
 * preview) localice `modules/<id>/` sin leer el sidecar de proyectos.
 *
 * DUEÑO: A1 (ai-assistant). Consumidores: ai-assistant (slash `/mod`,
 * system prompt marketplace, scaffold) y module-dev (gate IA-obligatoria,
 * runner de tests, preview, tool `module-dev.link_project`).
 *
 * TRAMPA kv-store: la clave inyectada como `id` llega SIEMPRE como string —
 * toda comparación se hace con `String(x)`, jamás `===` contra un number.
 */

import { dataStore } from "../data-store/index.js";
import type { Executor } from "../executor/index.js";
import { ValidationError } from "../errors/index.js";

/** Mismo patrón que `module.manifest.schema.json#/properties/id`. */
export const MODULE_ID_RE = /^[a-z][a-z0-9-]{2,38}$/;

/**
 * Estado de revisión del módulo, copia cacheada del valor autoritativo de LP
 * (lo emite `module-dev` lp-proxy). Se persiste en el vínculo (per-target) para
 * que el flujo "crear módulo" y la UI puedan gatear sin un round-trip a LP en
 * cada lectura. `undefined` = aún sin enviar a revisión. La unión es laxa
 * (string) para no romper si LP introduce un estado nuevo; los valores
 * conocidos están en `ReviewStatus`.
 */
export type ReviewStatus =
  | "enviado"
  | "revision"
  | "correccion"
  | "aprobado"
  | "publico"
  | "inactivo"
  | "suspendido";

export interface MarketplaceLink {
  id?: string;
  /** Proyecto del asistente (ai-assistant `projects.json`). */
  ownerUserId?: number;
  projectId: string;
  /** Slug del módulo del marketplace (== carpeta `modules/<id>/`, == prefijo de tools). */
  moduleId: string;
  /** Directorio de trabajo del proyecto en el target (desnormalizado del proyecto). */
  projectPath: string;
  /** Provider cuya estructura on-disk gestiona el proyecto. */
  provider: "claude" | "codex" | "gemini";
  /**
   * Estado de revisión cacheado (espejo de LP). Ausente hasta el primer
   * submit. Lo actualiza `setReviewStatus` tras una mutación contra LP.
   */
  reviewStatus?: ReviewStatus | string;
  createdAt?: string;
  updatedAt?: string;
}

const MODULE = "marketplace-link";
const COLLECTION = "links";

function store(executor?: Executor | null) {
  return dataStore<MarketplaceLink>(executor, MODULE, COLLECTION, { idStrategy: "uuid" });
}

export const marketplaceLinkRepository = {
  async list(executor?: Executor | null): Promise<MarketplaceLink[]> {
    const all = await store(executor).list();
    return [...all].sort((a, b) => (a.moduleId || "").localeCompare(b.moduleId || ""));
  },

  async getByProjectId(
    executor: Executor | null | undefined,
    projectId: string,
  ): Promise<MarketplaceLink | null> {
    if (!projectId) return null;
    return store(executor).find((l) => String(l.projectId) === String(projectId));
  },

  async getByModuleId(
    executor: Executor | null | undefined,
    moduleId: string,
  ): Promise<MarketplaceLink | null> {
    if (!moduleId) return null;
    return store(executor).find((l) => String(l.moduleId) === String(moduleId));
  },

  /**
   * Crea o actualiza el vínculo del proyecto (clave lógica = projectId).
   * Un mismo slug NO puede estar vinculado a dos proyectos del target:
   * si otro proyecto ya reclama `moduleId` se lanza ValidationError.
   */
  async upsert(
    executor: Executor | null | undefined,
    link: Pick<MarketplaceLink, "projectId" | "moduleId" | "projectPath" | "provider">,
  ): Promise<MarketplaceLink> {
    const moduleId = (link.moduleId || "").trim();
    if (!MODULE_ID_RE.test(moduleId)) {
      throw new ValidationError(
        `Slug de módulo inválido: "${moduleId}". Debe cumplir ^[a-z][a-z0-9-]{2,38}$ (minúsculas, dígitos y guiones).`,
      );
    }
    const projectId = String(link.projectId || "").trim();
    if (!projectId) throw new ValidationError("El vínculo necesita un projectId.");

    const s = store(executor);
    const claimedBy = await s.find((l) => String(l.moduleId) === moduleId);
    if (claimedBy && String(claimedBy.projectId) !== projectId) {
      throw new ValidationError(
        `El módulo "${moduleId}" ya está vinculado a otro proyecto de este servidor.`,
      );
    }

    const project = await dataStore<{ ownerId?: number }>(executor, "assistant", "projects", { idStrategy: "uuid" }).get(projectId);
    const clean = {
      ownerUserId: project?.ownerId ?? undefined,
      projectId,
      moduleId,
      projectPath: link.projectPath || "",
      provider: link.provider,
    };

    const existing = await s.find((l) => String(l.projectId) === projectId);
    if (existing) {
      const updated = await s.update(String(existing.id), clean);
      return (updated ?? { ...existing, ...clean }) as MarketplaceLink;
    }
    return (await s.create(clean as MarketplaceLink)) as MarketplaceLink;
  },

  /**
   * Actualiza SOLO el `reviewStatus` cacheado del vínculo del proyecto (espejo
   * de LP). No-op (`null`) si el proyecto no está vinculado. No valida la
   * cadena contra `ReviewStatus` a propósito: LP es la autoridad y puede
   * emitir un estado nuevo; la unión laxa lo absorbe.
   */
  async setReviewStatus(
    executor: Executor | null | undefined,
    projectId: string,
    reviewStatus: string,
  ): Promise<MarketplaceLink | null> {
    const existing = await store(executor).find(
      (l) => String(l.projectId) === String(projectId),
    );
    if (!existing) return null;
    return store(executor).update(String(existing.id), { reviewStatus });
  },

  async removeByProjectId(
    executor: Executor | null | undefined,
    projectId: string,
  ): Promise<boolean> {
    const existing = await store(executor).find(
      (l) => String(l.projectId) === String(projectId),
    );
    if (!existing) return false;
    return store(executor).delete(String(existing.id));
  },
};
