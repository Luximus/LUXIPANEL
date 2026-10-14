/**
 * Registro de previews de módulos de comunidad (Modo B del flujo marketplace).
 *
 * Un "preview" es un módulo del marketplace vendorizado por su PROPIO dev en
 * `modules/community/installed/<id>/` con el marker `.preview.json` — se
 * carga en el agentCapabilityRegistry pero NUNCA entra al communityCatalog
 * (invisible en /panel/modules, sidebar y getCatalog para todos los usuarios).
 * Solo el dueño (ownerUserId) lo ve/invoca a través del asistente, el MCP
 * loopback y las rutas del módulo `module-dev`.
 *
 * Este registro es IN-MEMORY: la fuente de verdad son los markers en disco
 * (el loader de community los re-lee en cada boot/recarga y repuebla esto).
 * Vive en shared/ para no acoplar módulos entre sí (regla del repo):
 * lo escribe el loader (modules/community), lo consultan module-dev y el
 * filtro por-owner del asistente (ai-assistant/assistant-modules.service).
 *
 * Identidad del dueño = String(user.userId) — SIEMPRE string por la trampa
 * conocida del kv-store (ids inyectados como string). Limitación documentada:
 * las sesiones SSO comparten identidad LP (memoria
 * luxipanel-sso-identity-linux-user); se acepta en v1.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

/** Metadatos de un preview instalado (espejo del marker `.preview.json`). */
export interface PreviewMeta {
  moduleId: string;
  /** String(user.userId) del dev que lo instaló (trampa kv id-string). */
  ownerUserId: string;
  ownerUsername?: string;
  /** Proyecto del asistente desde el que se instaló (marketplace-link). */
  projectId?: string;
  installedAt: string;
}

/** Nombre canónico del marker dentro de installed/<id>/. */
export const PREVIEW_MARKER_FILE = ".preview.json";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Directorio canónico donde se vendorizan los módulos de comunidad
 * (aprobados Y previews): `modules/community/installed/` relativo al árbol
 * compilado en ejecución (src/ en dev, dist/ en prod — misma estructura).
 * Única fuente del path: el loader de community y module-dev importan de aquí.
 */
export function getCommunityInstalledDir(): string {
  return path.resolve(HERE, "../../modules/community/installed");
}

const previews = new Map<string, PreviewMeta>();

export const communityPreviewRegistry = {
  /** Alta/refresco (idempotente). La clave SIEMPRE va como String. */
  register(meta: PreviewMeta): void {
    previews.set(String(meta.moduleId), { ...meta, ownerUserId: String(meta.ownerUserId) });
  },
  unregister(moduleId: string): void {
    previews.delete(String(moduleId));
  },
  get(moduleId: string): PreviewMeta | undefined {
    return previews.get(String(moduleId));
  },
  list(): PreviewMeta[] {
    return [...previews.values()].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  },
  /** Helper de tests — limpia el registro. */
  _resetForTest(): void {
    previews.clear();
  },
};
