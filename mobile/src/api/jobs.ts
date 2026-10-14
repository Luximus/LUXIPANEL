/**
 * Jobs Marketplace (Empleos) — capa API del cliente APP móvil (Fase 7).
 *
 * FACHADA: el cuerpo se dividió por dominio en `jobs/*` (types, requirements,
 * professionals, workflow, channel); este archivo re-exporta TODO idéntico para
 * no tocar los imports existentes de "../api/jobs". Nota resolución: `./jobs`
 * resuelve a ESTE archivo (jobs.ts gana a la carpeta `jobs/`, que a propósito
 * NO tiene index.ts).
 *
 * Espejo de `frontend/src/lib/portal-jobs.ts` (y calco 1:1 de
 * `desktop/src/api/jobs.ts`) sobre los MISMOS endpoints `/portal/jobs/*`
 * (Fases 1–5 del contrato). NO toca backend ni web: la Fase 7 SOLO consume los
 * endpoints existentes.
 *
 * Convención (igual que blog.ts / payouts.ts / desktop jobs.ts):
 *  - `token` SIEMPRE primero; cada función usa `request<{ ok; data }>(...)` de
 *    `./client` (Authorization Bearer, Play Integrity heredado, 403 step-up,
 *    401 refresh, 429) y DESEMPAQUETA el envelope devolviendo `res.data.<campo>`.
 *  - Respuesta canónica `{ ok:true, data }` / `{ ok:false, error, code? }`;
 *    `request` aplana el error a `Error(message)` (sin status).
 *  - Cada id se interpola con `encodeURIComponent`.
 *  - POST sin cuerpo → `{ method:"POST" }` (el web envía `{}`; ambos válidos).
 *
 * Play Integrity: heredado automáticamente vía `request` (que envuelve
 * `requestWithPlayIntegrity` en `client.ts`); NO se llama a
 * `requestWithPlayIntegrity` directamente (el web/desktop tampoco para
 * `/portal/jobs/*`).
 *
 * NUNCA exponer/loguear secretos: los grants de acceso son por REFERENCIA
 * (`resourceType`/`resourceRef`/`label`), JAMÁS material de llave (el backend
 * rechaza con KEY_MATERIAL → `jobs.grants.keyForbidden`).
 */

export * from "./jobs/types";
export * from "./jobs/requirements";
export * from "./jobs/professionals";
export * from "./jobs/workflow";
export * from "./jobs/channel";
