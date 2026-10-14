// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Panel-API client — HTTP wrapper around the license server's /panel-api/*.
 *
 * Authenticated endpoints use the per-panel API key issued by LP's portal.
 *
 * The legacy public catalog endpoints have been removed from the panel-side
 * client. The panel now consumes only authenticated module operations.
 */

import { env } from "../../config/env.js";
import { lpApiAuthorization } from "../../shared/lp-api-key.js";
import { postLicenseServerJson, agentsBaseUrl } from "../../shared/license-server-tls.js";
import { getActive as getActiveSharedSecret } from "../secret-rotation/services/secret-store.service.js";

const REQUEST_TIMEOUT_MS = 15_000;

/** Entrada del catálogo global de módulos (LP `premium_modules`) con la metadata
 *  de presentación que muestra la página de Módulos del panel. */
export interface ModuleCatalogEntry {
  code: string;
  status?: string;
  name?: string;
  /** Descripción localizada (al `lang` solicitado, cae al locale fuente). */
  description?: string;
  version?: string | null;
  /** Valoración media (0–5). */
  rating?: number;
  /** Nº de instalaciones del módulo. */
  downloads?: number;
  tag?: string;
  category?: string;
  kind?: string;
  /** Autor crudo ('system' para módulos del sistema). */
  createdBy?: string;
  /** Nombre del cliente creador (community), si aplica. */
  authorName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type BrandingCategory = "layout" | "general" | "login_methods" | "modules";

export interface BrandingEntry {
  key: string;
  value: string;
  category: BrandingCategory;
}

function authHeader(): string {
  return lpApiAuthorization();
}

function url(path: string): string {
  return `${env.LICENSE_SERVER_URL.replace(/\/$/, "")}${path}`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    /* non-JSON body */
  }
  return fallback;
}

/** Resumen de un módulo del marketplace propiedad del dev (LP `premium_modules`). */
export interface DevModuleSummary {
  id: string;
  code: string;
  name: string;
  /** 'enviado' | 'revision' | 'correccion' | 'suspendido' | 'inactivo' | 'publico'. */
  reviewStatus: string;
  /** Kill-switch global del admin: 'active' | 'disabled'. */
  status: string;
  scope: string;
  version: string | null;
  prUrl?: string | null;
  updatedAt: string;
  [k: string]: unknown;
}

/** Passthrough de LP getModuleReviews (módulo + versiones + eventos de revisión). */
export interface DevModuleReviews {
  module: { code: string; reviewStatus: string; [k: string]: unknown };
  versions: unknown[];
  events: unknown[];
  [k: string]: unknown;
}

/** Preferencias de alertas de servidor del dueño del panel (espejo de LP). */
export interface NotificationPrefs {
  enabled?: boolean;
  statusEnabled?: boolean;
  accessEnabled?: boolean;
  cpuPct?: number;
  ramPct?: number;
  diskPct?: number;
  [k: string]: unknown;
}

/** Resultado de un push enviado a los dispositivos del dueño (vía LP). */
export interface NotificationPushResult {
  sent: { expo: number; web: number };
}

/**
 * Las rutas service de LP usan la misma credencial por-panel que el catálogo.
 * LP deriva panel y customer del hash, sin confiar en el host del body.
 */
async function postDevService<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  const json = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: unknown } | null;
  if (!json?.ok) {
    throw new Error(typeof json?.error === "string" ? json.error : `Respuesta inválida de LP en ${path}`);
  }
  return json.data as T;
}

// Legacy notification channel is separate from the protected API-key features.
function serviceChannel(): { key: string; baseUrl: string } {
  const key = getActiveSharedSecret("luxipanel_key") || env.LUXIPANEL_KEY;
  if (!key) throw new Error("LUXIPANEL_KEY no disponible para notificaciones");
  return { key, baseUrl: agentsBaseUrl() };
}

export const panelApiClient = {
  /** Global module catalog with display metadata (version, installs, rating,
   *  author, dates) keyed by `code`. Source of truth was LP's `premium_modules`.
   *  Self-hosted: the authenticated route throws ("panel not activated"). */
  async getModuleCatalog(lang?: string): Promise<ModuleCatalogEntry[]> {
    const locale = (lang ?? "").trim() || "es";
    const res = await fetch(url(`/panel-api/modules?lang=${encodeURIComponent(locale)}`), {
      headers: { Authorization: authHeader() },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(await readError(res, `License server returned ${res.status}`));
    }
    const body = (await res.json()) as { ok: boolean; modules?: ModuleCatalogEntry[] };
    return body.modules ?? [];
  },

  /**
   * PUT /panel-api/branding — write-through of panel branding + login-method
   * settings from the panel admin UI into LP-LS DB. Categories accepted by
   * LP-LS: "layout", "general" (subset), "login_methods".
   *
   * Throws on non-OK so callers can surface the failure to the admin — the
   * write-through must not silently drop changes when LP-LS rejects them.
   */
  async putBranding(entries: BrandingEntry[]): Promise<{ written: number }> {
    if (entries.length === 0) return { written: 0 };
    const res = await fetch(url("/panel-api/branding"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify({ entries }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(await readError(res, `License server returned ${res.status}`));
    }
    const body = (await res.json()) as { ok: boolean; written?: number };
    return { written: body.written ?? 0 };
  },

  // ── Marketplace dev-side (módulo module-dev, SOLO managed) ────────────────
  // Contrato: POST /panel-api/service/dev/modules/* (A4 en LP-LS). Cada ruta
  // recibe el `host` público del panel y LP resuelve panel→customer.

  /** POST /panel-api/service/dev/modules/list — módulos del dev con su estado. */
  async devListModules(params: { host: string }): Promise<DevModuleSummary[] | { modules?: DevModuleSummary[] }> {
    return postDevService("/panel-api/service/dev/modules/list", { host: params.host });
  },

  /** POST /panel-api/service/dev/modules/reviews — módulo + versiones + eventos. */
  async devModuleReviews(params: { host: string; moduleId: string }): Promise<DevModuleReviews> {
    return postDevService("/panel-api/service/dev/modules/reviews", {
      host: params.host,
      moduleId: params.moduleId,
    });
  },

  /** POST /panel-api/service/dev/modules/submit — enviar a revisión. */
  async devSubmitModule(params: {
    host: string;
    moduleId: string;
    prUrl: string;
    scope?: string;
  }): Promise<Record<string, unknown>> {
    return postDevService("/panel-api/service/dev/modules/submit", {
      host: params.host,
      moduleId: params.moduleId,
      prUrl: params.prUrl,
      ...(params.scope ? { scope: params.scope } : {}),
    });
  },

  /** POST /panel-api/service/dev/modules/resubmit — reenviar tras corrección. */
  async devResubmitModule(params: {
    host: string;
    moduleId: string;
    prUrl: string;
  }): Promise<Record<string, unknown>> {
    return postDevService("/panel-api/service/dev/modules/resubmit", {
      host: params.host,
      moduleId: params.moduleId,
      prUrl: params.prUrl,
    });
  },

  /** POST /panel-api/service/dev/modules/unpublish — publico → inactivo. */
  async devUnpublishModule(params: { host: string; moduleId: string }): Promise<{ reviewStatus: string }> {
    return postDevService("/panel-api/service/dev/modules/unpublish", {
      host: params.host,
      moduleId: params.moduleId,
    });
  },

  /** POST /panel-api/service/dev/modules/republish — inactivo → publico. */
  async devRepublishModule(params: { host: string; moduleId: string }): Promise<{ reviewStatus: string }> {
    return postDevService("/panel-api/service/dev/modules/republish", {
      host: params.host,
      moduleId: params.moduleId,
    });
  },

  // ── Notificaciones del servidor (módulo server-alerts, SOLO managed) ──────
  // LUXIPANEL corre EN el servidor cliente y NO tiene los push tokens del dueño
  // (viven en LP). Para entregar a sus dispositivos (web/desktop/app) usamos el
  // canal de SERVICIO managed igual que `getSshUsage`/dev: `LUXIPANEL_KEY`
  // (Bearer) + mTLS + URL loopback interna; LP resuelve panel→customer por el
  // `host` público del panel. El license JWT per-panel NUNCA existe en managed,
  // así que `authHeader()` jamás se usa aquí.

  /**
   * POST /panel-api/service/notifications/push — dispara una notificación a los
   * dispositivos del dueño del panel. `respectPrefs` (default en LP) deja que LP
   * aplique las preferencias del dueño; `signals` permite a LP clasificar/filtrar
   * por tipo de señal. Devuelve cuántos destinos recibieron el push.
   */
  async sendNotificationPush(params: {
    host: string;
    title: string;
    body: string;
    signals?: string[];
    data?: Record<string, unknown>;
    respectPrefs?: boolean;
    /** Target a SPECIFIC recipient (Linux username on the panel's server)
     *  instead of the panel owner — LP resolves it to that user's LP customer.
     *  Used by user-to-user chat so a message only pings its recipient. When
     *  omitted, LP falls back to the panel owner (legacy behaviour). */
    recipientUsername?: string;
  }): Promise<NotificationPushResult> {
    const host = (params.host ?? "").trim();
    if (!host) throw new Error("No se pudo determinar el host del panel para enviar la notificación");
    const { key, baseUrl } = serviceChannel();
    const json = await postLicenseServerJson<{ ok?: boolean; sent?: { expo: number; web: number }; error?: unknown }>(
      "/panel-api/service/notifications/push",
      {
        host,
        title: params.title,
        body: params.body,
        ...(params.signals ? { signals: params.signals } : {}),
        ...(params.data ? { data: params.data } : {}),
        ...(params.respectPrefs !== undefined ? { respectPrefs: params.respectPrefs } : {}),
        ...(params.recipientUsername ? { recipientUsername: params.recipientUsername } : {}),
      },
      REQUEST_TIMEOUT_MS,
      { Authorization: `Bearer ${key}` },
      baseUrl,
    );
    if (!json?.ok) {
      throw new Error(typeof json?.error === "string" ? json.error : "Respuesta inválida de LP al enviar notificación");
    }
    return { sent: json.sent ?? { expo: 0, web: 0 } };
  },

  /**
   * POST /panel-api/service/notifications/prefs — lee (sin `patch`) o actualiza
   * (con `patch`) las preferencias de alertas del dueño del panel, que viven en
   * LP. Devuelve el documento de preferencias resultante.
   */
  async notificationPrefs(params: {
    host: string;
    patch?: {
      enabled?: boolean;
      statusEnabled?: boolean;
      accessEnabled?: boolean;
      cpuPct?: number;
      ramPct?: number;
      diskPct?: number;
      lowMbThreshold?: number;
    };
  }): Promise<NotificationPrefs> {
    const host = (params.host ?? "").trim();
    if (!host) throw new Error("No se pudo determinar el host del panel para las preferencias de notificación");
    const { key, baseUrl } = serviceChannel();
    const json = await postLicenseServerJson<{ ok?: boolean; data?: NotificationPrefs; error?: unknown }>(
      "/panel-api/service/notifications/prefs",
      { host, ...(params.patch ? { patch: params.patch } : {}) },
      REQUEST_TIMEOUT_MS,
      { Authorization: `Bearer ${key}` },
      baseUrl,
    );
    if (!json?.ok || !json.data) {
      throw new Error(typeof json?.error === "string" ? json.error : "Respuesta inválida de LP en preferencias");
    }
    return json.data;
  },
};
