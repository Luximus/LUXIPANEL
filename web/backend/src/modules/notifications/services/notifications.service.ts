// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Notifications service — write-once helper that every other module calls
 * to surface a system / module / AI message into the bell dropdown.
 *
 * Emits an in-process event ("notifications:new") so the SSE endpoint can
 * push new rows to connected clients without polling. The SSE layer
 * subscribes via `bus.on(...)` directly so we do not leak EventEmitter
 * across module boundaries.
 */

import { EventEmitter } from "node:events";
import { eventBus, Events } from "../../../shared/events/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { getContextExecutor, type Executor } from "../../../shared/executor/index.js";
import { notificationEventTargetId, resolveNotificationExecutor } from "./notification-scope.js";
import {
  notificationsRepository,
  type ListFilters,
  type PagedNotifications,
} from "../repositories/notifications.repository.js";
import {
  sanitizeNotificationTarget,
  targetToLink,
  type NotificationTarget,
} from "../models/notification-target.js";
import type {
  NewNotification,
  Notification,
  NotificationSeverity,
  NotificationSource,
} from "../models/notification.model.js";

const log = createModuleLogger("notifications");

class NotificationsBus extends EventEmitter {}
export const notificationsBus = new NotificationsBus();
notificationsBus.setMaxListeners(200);

// Short-lived in-process cache for unreadCount — avoids an SSH SFTP read on
// every tab-focus event. The SSE stream keeps the browser badge accurate in
// real-time; this cache only serves the fallback HTTP poll.
const UNREAD_CACHE_TTL_MS = 30_000;
// Bounded: one entry per (targetId, userId). A panel bridging many servers ×
// users could otherwise accumulate keys unbounded (entries only ever expire by
// TTL on read, never get swept). FIFO-evict the oldest past the cap.
const UNREAD_CACHE_CAP = 2_000;
const _unreadPending = new Map<string, Promise<number>>();
const _unreadCache = new Map<string, { count: number; until: number }>();

function _unreadCacheKey(targetId: string, userId: number | null): string {
  return `${targetId}:${userId ?? "*"}`;
}
function _unreadCacheSet(key: string, count: number, until: number): void {
  if (_unreadCache.size >= UNREAD_CACHE_CAP && !_unreadCache.has(key)) {
    const oldest = _unreadCache.keys().next().value;
    if (oldest !== undefined) _unreadCache.delete(oldest);
  }
  _unreadCache.set(key, { count, until });
}
function _invalidateUnreadCache(targetId: string): void {
  for (const key of _unreadPending.keys()) if (key.startsWith(`${targetId}:`)) _unreadPending.delete(key);
  for (const key of _unreadCache.keys()) {
    if (key.startsWith(`${targetId}:`)) _unreadCache.delete(key);
  }
}

/**
 * Re-sanea el `target` de CUALQUIER entrada antes de persistirla (incluidas las
 * que vienen de otros módulos vía `tryCreate`): el saneador es la única puerta,
 * nunca se confía en que el emisor ya lo hubiera validado. Deriva `link` desde
 * el target cuando el llamante no dio uno.
 */
function withSafeTarget(entry: NewNotification): NewNotification {
  const target = entry.target ? sanitizeNotificationTarget(entry.target) : null;
  const link = entry.link ?? targetToLink(target) ?? undefined;
  return {
    ...entry,
    ...(link ? { link } : { link: null }),
    target,
  };
}

export const NOTIFICATION_EVENTS = {
  CREATED: "notifications:new",
  READ: "notifications:read",
  CLEARED: "notifications:cleared",
} as const;

function notificationExecutor(executor?: Executor | null): Executor {
  const target = executor ?? getContextExecutor();
  if (!target) throw new Error("Notifications require a server executor");
  return target;
}

export const notificationsService = {
  /** Create on the selected server and broadcast only to clients on that server. */
  async create(entry: NewNotification, executor?: Executor | null): Promise<Notification> {
    const target = notificationExecutor(executor);
    const row = await notificationsRepository.create(withSafeTarget({
      ...entry,
      metadata: { ...entry.metadata, targetId: target.target.id },
    }), target);
    notificationsBus.emit(NOTIFICATION_EVENTS.CREATED, row);
    _invalidateUnreadCache(target.target.id);
    return row;
  },

  /** Internal events may outlive their HTTP request; resolve their origin before writing. */
  async tryCreate(entry: NewNotification, targetId?: string): Promise<Notification | null> {
    try {
      return await this.create(entry, await resolveNotificationExecutor(targetId));
    } catch (err) {
      log.warn({ err, source: entry.source }, "tryCreate: ignored notification error");
      return null;
    }
  },

  async list(filters: ListFilters, executor?: Executor | null): Promise<PagedNotifications> {
    return notificationsRepository.list(filters, notificationExecutor(executor));
  },

  async unreadCount(userId: number | null, executor?: Executor | null): Promise<number> {
    const target = notificationExecutor(executor);
    const key = _unreadCacheKey(target.target.id, userId);
    const now = Date.now();
    const hit = _unreadCache.get(key);
    if (hit && hit.until > now) return hit.count;
    const pending = _unreadPending.get(key);
    if (pending) return pending;
    const task = notificationsRepository.unreadCount(userId, target).then(count => {
      if (_unreadPending.get(key) === task) _unreadCacheSet(key, count, now + UNREAD_CACHE_TTL_MS);
      return count;
    }).finally(() => { if (_unreadPending.get(key) === task) _unreadPending.delete(key); });
    _unreadPending.set(key, task);
    return task;
  },

  async markRead(id: string, requesterId: number | null, isAdmin: boolean, executor?: Executor | null): Promise<Notification | null> {
    const target = notificationExecutor(executor);
    const existing = await notificationsRepository.get(id, target);
    if (!existing) return null;
    if (!isAdmin && existing.userId !== null && existing.userId !== requesterId) return null;
    const row = existing.userId === null && requesterId !== null
      ? await notificationsRepository.markReadForUser(id, requesterId, target)
      : await notificationsRepository.markRead(id, target);
    if (row) {
      notificationsBus.emit(NOTIFICATION_EVENTS.READ, { id: row.id, read: true, userId: row.userId === null ? requesterId : row.userId, targetId: target.target.id });
      _invalidateUnreadCache(target.target.id);
    }
    return row;
  },

  async markAllRead(userId: number | null, executor?: Executor | null): Promise<number> {
    const target = notificationExecutor(executor);
    const changed = await notificationsRepository.markAllRead(userId, target);
    notificationsBus.emit(NOTIFICATION_EVENTS.READ, { all: true, userId, targetId: target.target.id });
    _invalidateUnreadCache(target.target.id);
    return changed;
  },

  async delete(id: string, requesterId: number | null, isAdmin: boolean, executor?: Executor | null): Promise<boolean> {
    const target = notificationExecutor(executor);
    const existing = await notificationsRepository.get(id, target);
    if (!existing) return false;
    if (!isAdmin && existing.userId !== null && existing.userId !== requesterId) return false;
    const ok = existing.userId === null && requesterId !== null
      ? await notificationsRepository.deleteForUser(id, requesterId, target)
      : await notificationsRepository.delete(id, target);
    if (ok) {
      notificationsBus.emit(NOTIFICATION_EVENTS.CLEARED, { id, userId: existing.userId === null ? requesterId : existing.userId, targetId: target.target.id });
      _invalidateUnreadCache(target.target.id);
    }
    return ok;
  },

  async clearAll(userId: number | null, executor?: Executor | null): Promise<number> {
    const target = notificationExecutor(executor);
    const removed = await notificationsRepository.deleteAll(userId, target);
    notificationsBus.emit(NOTIFICATION_EVENTS.CLEARED, { all: true, userId, targetId: target.target.id });
    _invalidateUnreadCache(target.target.id);
    return removed;
  },
};

// ── Internal event bus wiring ─────────────────────────────────────────────
// We listen to a small set of internal events and translate them to
// notifications. This keeps each module decoupled from the notifications
// store — they emit their existing event bus event and we mirror it into
// the bell dropdown. To add more sources, append handlers below.

function asSeverity(level: string | undefined): NotificationSeverity {
  switch (level) {
    case "warn":
    case "warning":
      return "warning";
    case "error":
    case "critical":
      return "error";
    case "success":
      return "success";
    default:
      return "info";
  }
}

// Firewall payload contract: { action, port?, from?, target }.
function describeFirewallRule(data: Record<string, unknown>): string {
  return [
    data.action ? String(data.action) : null,
    data.port ? `puerto ${String(data.port)}` : null,
    data.from ? `desde ${String(data.from)}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

type EventData = Record<string, unknown>;
/** A literal value or a function computing it from the event payload. */
type Dynamic<T> = T | ((data: EventData) => T);

/**
 * Declarative table of internal-event → notification mappings. Each row maps
 * an event to the static/dynamic fields of the `tryCreate` call. `link` is
 * omitted when absent (handlers that don't deep-link). This replaces ~25
 * near-identical `eventBus.on` blocks — behavior is identical: same source/
 * module/severity/title/message/link/metadata for every event.
 */
export interface NotificationRule {
  event: string;
  source: NotificationSource;
  module: string;
  severity: Dynamic<NotificationSeverity>;
  title: Dynamic<string>;
  message: (data: EventData) => string;
  link?: Dynamic<string>;
  /** Aterrizaje exacto. Cuando la regla no trae `link`, se deriva de aquí. */
  target?: Dynamic<NotificationTarget | null>;
}

function resolve<T>(field: Dynamic<T>, data: EventData): T {
  return typeof field === "function" ? (field as (d: EventData) => T)(data) : field;
}

/** Valor de evento → string no vacío (o `undefined`). */
function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t ? t : undefined;
}

// ── Targets reutilizables ─────────────────────────────────────────────────
const MONITOR_TARGET: NotificationTarget = { href: "/panel/monitor" };
const SSL_TARGET: NotificationTarget = { href: "/panel/nginx", click: "#tab-ssl" };

function moduleTarget(view: string): NotificationTarget {
  return { href: `/panel/${view}` };
}

function cloudflareTarget(tab: "dns" | "cache" | "access" | "security"): NotificationTarget {
  return { href: "/panel/cloudflare", query: { tab }, click: `[data-tab="${tab}"]` };
}

/**
 * Target de una conversación del asistente. La home del panel (`/panel`) ES
 * "Agentes IA" (el antiguo `/panel/assistant` redirige a `/` perdiendo el
 * `?c=`), así que el deep-link correcto es `/panel?c=<conv>` + el evento que
 * abre esa conversación en el panel ya montado.
 */
function assistantTarget(data: EventData, idKey = "conversationId"): NotificationTarget {
  const conversationId = str(data[idKey]);
  if (!conversationId) return { href: "/panel" };
  const provider = str(data.provider);
  const agentId = str(data.agentId);
  return {
    href: "/panel",
    query: { c: conversationId, ...(provider ? { provider } : {}) },
    event: {
      name: "luxipanel:assistant-open-conversation",
      detail: {
        conversationId,
        ...(provider ? { provider } : {}),
        ...(agentId ? { agentId } : {}),
      },
    },
  };
}

/** «Título del chat» — cuerpo, cuando el emisor pudo resolver el título. */
function withConversationTitle(data: EventData, body: string): string {
  const title = str(data.conversationTitle);
  return title ? `«${title}» — ${body}` : body;
}

/**
 * Metadata SEGURA para persistir: solo escalares (strings ≤500). El wiring
 * anterior guardaba el payload ENTERO del evento — incluido `executor`
 * (objeto con conexión SSH viva) en `AI_TEAM_PLAN_COMPLETED`, que además
 * revienta la serialización del sidecar.
 */
export function pickNotificationMetadata(data: EventData): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (key === "executor") continue;
    if (typeof value === "string") {
      const t = value.trim();
      if (t) out[key] = t.length > 500 ? `${t.slice(0, 499)}…` : t;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    }
    // objetos, arrays, funciones, null, undefined → fuera.
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Regla + payload → fila lista para `tryCreate`. Pura y exportada para poder
 * testear la tabla sin tocar el bus ni el almacenamiento.
 */
export function buildNotificationFromRule(rule: NotificationRule, data: EventData): NewNotification {
  const safeData = (data ?? {}) as EventData;
  const target = rule.target ? sanitizeNotificationTarget(resolve(rule.target, safeData)) : null;
  const link = rule.link !== undefined ? resolve(rule.link, safeData) : targetToLink(target);
  return {
    source: rule.source,
    module: rule.module,
    severity: resolve(rule.severity, safeData),
    title: resolve(rule.title, safeData),
    message: rule.message(safeData),
    ...(link ? { link } : {}),
    ...(target ? { target } : {}),
    ...(typeof safeData.userId === "number" ? { userId: safeData.userId } : {}),
    metadata: pickNotificationMetadata(safeData),
  };
}

export const NOTIFICATION_RULES: NotificationRule[] = [
  {
    event: Events.ALERT_TRIGGERED,
    source: "system",
    module: "monitor",
    severity: (d) => asSeverity(d.severity as string),
    title: (d) => `Alerta de ${String(d.metric ?? "") || "sistema"}`,
    message: (d) => `Umbral superado${d.value !== undefined ? `: ${d.value}` : ""}.`,
    target: MONITOR_TARGET,
  },
  {
    event: Events.ALERT_RESOLVED,
    source: "system",
    module: "monitor",
    severity: "success",
    title: (d) => `Alerta resuelta — ${String(d.metric ?? "")}`,
    message: () => "El recurso volvió a un estado normal.",
    target: MONITOR_TARGET,
  },
  {
    event: Events.SSL_ISSUED,
    source: "module",
    module: "ssl",
    severity: "success",
    title: "Certificado SSL emitido",
    message: (d) =>
      d.domain ? `Let's Encrypt emitió un certificado para ${String(d.domain)}.` : "Certificado emitido.",
    target: SSL_TARGET,
  },
  {
    event: Events.SSL_RENEWED,
    source: "module",
    module: "ssl",
    severity: "success",
    title: "Certificado SSL renovado",
    message: (d) => (d.domain ? `Renovación correcta para ${String(d.domain)}.` : "Renovación correcta."),
    target: SSL_TARGET,
  },
  {
    event: Events.SSL_EXPIRING,
    source: "module",
    module: "ssl",
    severity: "warning",
    title: "Certificado SSL por expirar",
    message: (d) =>
      d.domain
        ? `${String(d.domain)} expira pronto. Revisa la renovación automática.`
        : "Hay certificados próximos a expirar.",
    target: SSL_TARGET,
  },
  {
    event: Events.BACKUP_COMPLETED,
    source: "module",
    module: "backups",
    severity: "success",
    title: "Backup completado",
    message: (d) => (d.target ? `Backup terminado: ${String(d.target)}.` : "Backup terminado."),
    target: moduleTarget("backups"),
  },
  {
    event: Events.BACKUP_FAILED,
    source: "module",
    module: "backups",
    severity: "error",
    title: "Backup fallido",
    message: (d) =>
      d.error ? `El backup terminó con error: ${String(d.error)}.` : "El backup terminó con error.",
    target: moduleTarget("backups"),
  },
  {
    event: Events.FIREWALL_RULE_ADDED,
    source: "module",
    module: "firewall",
    severity: "info",
    title: "Regla de firewall añadida",
    message: (d) => {
      const rule = describeFirewallRule(d);
      return rule ? `Nueva regla: ${rule}.` : "Se añadió una regla al firewall.";
    },
    target: moduleTarget("firewall"),
  },
  {
    event: Events.FIREWALL_RULE_DELETED,
    source: "module",
    module: "firewall",
    severity: "info",
    title: "Regla de firewall eliminada",
    message: (d) => {
      const rule = describeFirewallRule(d);
      return rule ? `Regla eliminada: ${rule}.` : "Se eliminó una regla del firewall.";
    },
    target: moduleTarget("firewall"),
  },
  // ── Cloudflare ────────────────────────────────────────────────────────
  {
    event: Events.CLOUDFLARE_DNS_CHANGED,
    source: "module",
    module: "cloudflare",
    severity: "info",
    title: "DNS de Cloudflare actualizado",
    message: (d) => {
      const action = String(d.action ?? "");
      const actionEs =
        action === "created" ? "creado" : action === "deleted" ? "eliminado" : "actualizado";
      return d.name ? `Registro ${String(d.name)} ${actionEs}.` : `Registro DNS ${actionEs}.`;
    },
    target: cloudflareTarget("dns"),
  },
  {
    event: Events.CLOUDFLARE_PURGED,
    source: "module",
    module: "cloudflare",
    severity: "info",
    title: "Caché de Cloudflare purgada",
    message: (d) => {
      const zone = d.zoneName ? ` de ${String(d.zoneName)}` : " de la zona";
      return d.everything === true
        ? `Se purgó toda la caché${zone}.`
        : `Se purgaron ${String(d.files ?? 0)} archivo(s)${zone}.`;
    },
    target: cloudflareTarget("cache"),
  },
  {
    event: Events.CLOUDFLARE_ACCESS_RULE_ADDED,
    source: "module",
    module: "cloudflare",
    severity: (d) => (String(d.mode ?? "") === "block" ? "warning" : "info"),
    title: "Regla de acceso en Cloudflare",
    message: (d) => {
      const mode = String(d.mode ?? "");
      return d.ip
        ? `Regla ${mode || "de acceso"} para ${String(d.ip)}.`
        : "Se añadió una regla de acceso a la zona.";
    },
    target: cloudflareTarget("access"),
  },
  {
    event: Events.CLOUDFLARE_SSL_MODE_SUGGESTED,
    source: "module",
    module: "cloudflare",
    severity: "warning",
    title: "Sugerencia SSL de Cloudflare",
    message: (d) =>
      `El sitio ${String(d.domain ?? "")} tiene certificado nuevo pero la zona ` +
      `${String(d.zoneName ?? "")} está en modo ${String(d.currentMode ?? "")}. ` +
      "Sube a Full (strict) para cifrado extremo a extremo.",
    target: cloudflareTarget("security"),
  },
  {
    event: Events.AUTH_LOGIN_FAILED,
    source: "security",
    module: "auth",
    severity: "warning",
    title: "Intento de inicio fallido",
    message: (d) => (d.ip ? `Origen: ${String(d.ip)}.` : "Se registró un intento de inicio fallido."),
    target: { href: "/panel/preferences", hash: "#pref-audit" },
  },
  {
    event: Events.AUTH_PASSKEY_REGISTERED,
    source: "security",
    module: "auth",
    severity: "info",
    title: "Nueva passkey registrada",
    message: () => "Se añadió una passkey a una cuenta del panel.",
    target: { href: "/panel/preferences", hash: "#pref-passkeys" },
  },
  {
    event: Events.WEBHOOK_FAILED,
    source: "module",
    module: "webhooks",
    severity: "error",
    title: "Webhook con error",
    message: (d) => (d.url ? `Falló entrega a ${String(d.url)}.` : "Un webhook terminó en error."),
    target: moduleTarget("webhooks"),
  },
  // ── Write-behind queue health (panel-side failures) ──────────────────
  // Client-side failures (a step fails on the customer's box) are written
  // straight to the notifications sidecar by worker.py; these handlers cover
  // the failures the worker can't see: enqueue degraded, a job that ended
  // failed, a stuck queue, and read-path breaker openings.
  {
    event: Events.WRITE_QUEUE_DEGRADED,
    source: "system",
    module: "cola-escritura",
    severity: "warning",
    title: "Cola de escritura degradada",
    message: (d) =>
      `No se pudo encolar una operación ${String(d.op ?? "")} en ` +
      `${String(d.module ?? "")}/${String(d.collection ?? "")}; se aplicó ` +
      `de forma síncrona (${String(d.reason ?? "motivo desconocido")}). ` +
      `Revisa el worker/Redis del servidor.`,
    target: MONITOR_TARGET,
  },
  {
    event: Events.WRITE_QUEUE_JOB_FAILED,
    source: "system",
    module: "cola-escritura",
    severity: "error",
    title: "Operación en cola fallida",
    message: (d) =>
      `La operación ${String(d.op ?? "")} en ${String(d.module ?? "")}/` +
      `${String(d.collection ?? "")} falló en el servidor` +
      (d.error ? `: ${String(d.error)}` : "."),
    target: MONITOR_TARGET,
  },
  {
    event: Events.WRITE_QUEUE_STUCK,
    source: "system",
    module: "cola-escritura",
    severity: "error",
    title: "Cola de escritura sin procesar",
    message: () =>
      "Un trabajo lleva demasiado tiempo en cola sin ejecutarse: el worker " +
      "del servidor cliente podría estar caído. Revisa " +
      "'luxipanel-cache-worker' en ese servidor.",
    target: MONITOR_TARGET,
  },
  {
    event: Events.REMOTE_CACHE_BREAKER_OPEN,
    source: "system",
    module: "cache-engine",
    severity: "warning",
    title: "Problemas para consultar datos del servidor",
    message: () =>
      "La consulta a la caché del servidor falló repetidamente; el panel " +
      "está leyendo en modo directo (más lento). Revisa Redis/colectores en " +
      "ese servidor.",
    target: MONITOR_TARGET,
  },
  // ── Preview sandbox (PIPS) — out-of-process module-preview runtime ───
  // Wired automatically by the wireInternalNotifications loop below. Inert
  // until F5 (PREVIEW_SANDBOX_ENABLED=false default) — these only fire once an
  // operator enables previews and the runtime degrades / can't self-test.
  {
    event: Events.PREVIEW_SANDBOX_DEGRADED,
    source: "system",
    module: "module-dev",
    severity: "warning",
    title: "Sandbox preview indisponible",
    message: (d) =>
      "El sandbox de previews de módulos arrancó en un tier DEGRADADO" +
      (d.reason ? `: ${String(d.reason)}` : ".") +
      " Las previews siguen ejecutándose confinadas, pero revisa el host (Tier 2 / linger).",
    target: moduleTarget("module-dev"),
  },
  {
    event: Events.PREVIEW_SANDBOX_UNAVAILABLE,
    source: "system",
    module: "module-dev",
    severity: "warning",
    title: "Sandbox preview indisponible",
    message: (d) =>
      "El sandbox de previews de módulos no superó su auto-test de arranque" +
      (d.reason ? ` (${String(d.reason)})` : "") +
      "; las previews quedan deshabilitadas (fail-closed) hasta resolverlo.",
    target: moduleTarget("module-dev"),
  },
  // ── AI assistant — CLI background jobs ───────────────────────────────
  {
    event: Events.CLI_JOB_COMPLETED,
    // "ai", no "module": el filtro IA de la campana se apoya en `source`.
    source: "ai",
    module: "ai-assistant",
    severity: "success",
    title: (d) => String(d.title ?? `Tarea IA completada en ${String(d.serverName ?? "servidor")}`),
    message: (d) => withConversationTitle(d, String(d.preview ?? "Tarea completada.")),
    target: (d) => assistantTarget(d),
  },
  {
    event: Events.CLI_JOB_FAILED,
    source: "ai",
    module: "ai-assistant",
    severity: "warning",
    title: (d) => String(d.title ?? `Tarea IA terminó con error en ${String(d.serverName ?? "servidor")}`),
    message: (d) => withConversationTitle(d, String(d.preview ?? "El agente terminó con código de error.")),
    target: (d) => assistantTarget(d),
  },
  // A chat/agent run finished (any provider, api or cli). Drives the bell;
  // the owner push (web/app/desktop) is wired separately in server-alerts.
  {
    event: Events.AI_CHAT_FINISHED,
    source: "ai",
    module: "ai-assistant",
    severity: (d) => (d.errored ? "warning" : "success"),
    title: (d) => (d.errored ? "Chat IA terminó con error" : "Chat IA finalizado"),
    message: (d) =>
      withConversationTitle(
        d,
        String(d.preview || "") ||
          (d.errored ? "El asistente terminó con error." : "El asistente terminó de responder."),
      ),
    target: (d) => assistantTarget(d),
  },
  // The CLI agent paused asking the user to approve a mutating tool. Surfaces in
  // the bell so the user notices even when not watching the chat; the chat-list
  // and Dashboard yellow dots come from the active-runs feed.
  {
    event: Events.AI_PERMISSION_REQUESTED,
    source: "ai",
    module: "ai-assistant",
    severity: "warning",
    title: () => "El asistente necesita tu aprobación",
    message: (d) =>
      String(d.title ?? `El asistente quiere usar ${String(d.tool ?? "una herramienta")} y espera tu aprobación.`),
    target: (d) => assistantTarget(d),
  },
  // A team plan (leader → subordinate agents) finished every step. Links to the
  // LEADER's chat, where the consolidated synthesis lands.
  {
    event: Events.AI_TEAM_PLAN_COMPLETED,
    source: "ai",
    module: "ai-assistant",
    severity: (d) => (d.status === "failed" ? "warning" : "success"),
    title: (d) =>
      d.status === "failed"
        ? `Tu equipo terminó el plan «${String(d.title ?? "sin título")}» con errores`
        : `Tu equipo terminó el plan «${String(d.title ?? "sin título")}»`,
    message: (d) =>
      d.status === "failed"
        ? "Al menos un paso falló. Revisa el chat del líder para ver el detalle."
        : "Todos los pasos se completaron. El líder está consolidando el resultado.",
    target: (d) => assistantTarget(d, "leaderConversationId"),
  },
  // ── Mail clone (background job) ──────────────────────────────────────
  {
    event: Events.MAIL_CLONE_STARTED,
    source: "module",
    module: "mail",
    severity: "info",
    title: "Clonación de correo iniciada",
    message: (d) =>
      `Copiando ${String(d.source ?? "")} → ${String(d.destination ?? "")} en segundo plano. Te avisamos al terminar.`,
    target: moduleTarget("mail"),
  },
  {
    event: Events.MAIL_CLONE_COMPLETED,
    source: "module",
    module: "mail",
    severity: "success",
    title: "Clonación de correo completada",
    message: (d) =>
      `${String(d.source ?? "")} → ${String(d.destination ?? "")}` +
      (d.copied != null ? `: ${String(d.copied)} mensaje(s) copiados.` : "."),
    target: moduleTarget("mail"),
  },
  {
    event: Events.MAIL_CLONE_FAILED,
    source: "module",
    module: "mail",
    severity: "error",
    title: "Clonación de correo fallida",
    message: (d) =>
      `${String(d.source ?? "")} → ${String(d.destination ?? "")}` +
      (d.error ? `: ${String(d.error)}` : "."),
    target: moduleTarget("mail"),
  },
  // ── Hosting jail (chroot) no disponible ──────────────────────────────
  {
    event: Events.HOSTING_JAIL_DEGRADED,
    source: "module",
    module: "hosting",
    severity: "warning",
    title: "Jail de hosting no disponible",
    message: (d) =>
      `La cuenta '${String(d.username ?? "")}' tiene el jail activado pero jailkit no está instalado ` +
      "en este servidor. Instálalo con `apt-get install jailkit` y reaprovisiona el jail desde " +
      "el detalle de la cuenta de hosting.",
    target: moduleTarget("hosting"),
  },
];

let wired = false;

export function wireInternalNotifications(): void {
  if (wired) return;
  wired = true;

  for (const rule of NOTIFICATION_RULES) {
    eventBus.on(rule.event, (payload: unknown) => {
      const data = (payload as EventData) ?? {};
      void notificationsService.tryCreate(buildNotificationFromRule(rule, data), notificationEventTargetId(data));
    });
  }

  // User-to-user chat: one bell row PER away recipient (each keyed by their own
  // userId so only they see it). The device push (web/app/desktop) is wired
  // separately in server-alerts. Recipients without a resolved userId only get
  // the push (the bell needs a numeric userId).
  eventBus.on(Events.CHAT_MESSAGE_RECEIVED, (payload: unknown) => {
    const p = (payload ?? {}) as {
      targetId?: string;
      convId?: string;
      title?: string;
      body?: string;
      recipients?: Array<{ username: string; userId?: number }>;
    };
    if (!Array.isArray(p.recipients)) return;
    for (const r of p.recipients) {
      if (typeof r.userId !== "number") continue;
      void notificationsService.tryCreate({
        source: "user",
        module: "chat",
        severity: "info",
        title: p.title ?? "Nuevo mensaje",
        message: p.body ?? "",
        target: { href: "/panel/chat", ...(p.convId ? { query: { c: p.convId } } : {}) },
        userId: r.userId,
        metadata: {
          ...(p.targetId ? { targetId: p.targetId } : {}),
          ...(p.convId ? { convId: p.convId } : {}),
        },
      }, p.targetId);
    }
  });

  log.info("Notifications wired to internal event bus");
}
