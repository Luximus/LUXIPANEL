// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tabla de reglas evento → notificación + saneador de `target`.
 *
 * Todo es puro (`buildNotificationFromRule`, `pickNotificationMetadata`,
 * `sanitizeNotificationTarget`): no toca el bus ni el sidecar.
 */

import { describe, it, expect } from "vitest";
import { Events } from "../../../shared/events/index.js";
import {
  NOTIFICATION_RULES,
  buildNotificationFromRule,
  pickNotificationMetadata,
  type NotificationRule,
} from "./notifications.service.js";
import {
  sanitizeNotificationTarget,
  targetToLink,
  linkToTarget,
  NOTIFICATION_EVENT_ALLOWLIST,
} from "../models/notification-target.js";

function ruleFor(event: string): NotificationRule {
  const rule = NOTIFICATION_RULES.find((r) => r.event === event);
  if (!rule) throw new Error(`sin regla para ${event}`);
  return rule;
}

describe("targets por evento", () => {
  it("monitor / cola de escritura / breaker → /panel/monitor", () => {
    for (const event of [
      Events.ALERT_TRIGGERED,
      Events.ALERT_RESOLVED,
      Events.WRITE_QUEUE_DEGRADED,
      Events.WRITE_QUEUE_JOB_FAILED,
      Events.WRITE_QUEUE_STUCK,
      Events.REMOTE_CACHE_BREAKER_OPEN,
    ]) {
      const row = buildNotificationFromRule(ruleFor(event), { metric: "cpu" });
      expect(row.target).toEqual({ href: "/panel/monitor" });
      expect(row.link).toBe("/panel/monitor");
    }
  });

  it("SSL → /panel/nginx + click en el tab SSL", () => {
    const row = buildNotificationFromRule(ruleFor(Events.SSL_ISSUED), { domain: "a.test" });
    expect(row.target).toEqual({ href: "/panel/nginx", click: "#tab-ssl" });
    expect(row.link).toBe("/panel/nginx");
  });

  it("cada evento Cloudflare abre SU tab", () => {
    const cases: Array<[string, string]> = [
      [Events.CLOUDFLARE_DNS_CHANGED, "dns"],
      [Events.CLOUDFLARE_PURGED, "cache"],
      [Events.CLOUDFLARE_ACCESS_RULE_ADDED, "access"],
      [Events.CLOUDFLARE_SSL_MODE_SUGGESTED, "security"],
    ];
    for (const [event, tab] of cases) {
      const row = buildNotificationFromRule(ruleFor(event), { name: "x", zoneName: "z" });
      expect(row.target).toEqual({
        href: "/panel/cloudflare",
        query: { tab },
        click: `[data-tab="${tab}"]`,
      });
      expect(row.link).toBe(`/panel/cloudflare?tab=${tab}`);
    }
  });

  it("vistas de módulo simples", () => {
    const cases: Array<[string, string]> = [
      [Events.BACKUP_FAILED, "/panel/backups"],
      [Events.FIREWALL_RULE_ADDED, "/panel/firewall"],
      [Events.WEBHOOK_FAILED, "/panel/webhooks"],
      [Events.MAIL_CLONE_COMPLETED, "/panel/mail"],
      [Events.HOSTING_JAIL_DEGRADED, "/panel/hosting"],
      [Events.PREVIEW_SANDBOX_DEGRADED, "/panel/module-dev"],
    ];
    for (const [event, href] of cases) {
      const row = buildNotificationFromRule(ruleFor(event), {});
      expect(row.target).toEqual({ href });
      expect(row.link).toBe(href);
    }
  });

  it("auth → preferencias con su hash", () => {
    expect(buildNotificationFromRule(ruleFor(Events.AUTH_LOGIN_FAILED), { ip: "1.2.3.4" }).target)
      .toEqual({ href: "/panel/preferences", hash: "#pref-audit" });
    expect(buildNotificationFromRule(ruleFor(Events.AUTH_PASSKEY_REGISTERED), {}).link)
      .toBe("/panel/preferences#pref-passkeys");
  });

  it("IA → /panel?c= + evento de la allowlist (y source 'ai')", () => {
    const row = buildNotificationFromRule(ruleFor(Events.AI_CHAT_FINISHED), {
      conversationId: "conv-1",
      provider: "claude",
      agentId: "agent-9",
      conversationTitle: "Auditoría del servidor",
      preview: "Riesgo: medio · Amenazas: BitNinja no está instalado",
    });
    expect(row.source).toBe("ai");
    expect(row.target).toEqual({
      href: "/panel",
      query: { c: "conv-1", provider: "claude" },
      event: {
        name: "luxipanel:assistant-open-conversation",
        detail: { conversationId: "conv-1", provider: "claude", agentId: "agent-9" },
      },
    });
    expect(row.link).toBe("/panel?c=conv-1&provider=claude");
    expect(row.message).toBe("«Auditoría del servidor» — Riesgo: medio · Amenazas: BitNinja no está instalado");
  });

  it("IA sin conversationId → solo /panel", () => {
    const row = buildNotificationFromRule(ruleFor(Events.CLI_JOB_COMPLETED), { preview: "listo" });
    expect(row.target).toEqual({ href: "/panel" });
    expect(row.link).toBe("/panel");
    expect(row.source).toBe("ai");
    expect(row.message).toBe("listo");
  });

  it("plan de equipo usa la conversación del LÍDER", () => {
    const row = buildNotificationFromRule(ruleFor(Events.AI_TEAM_PLAN_COMPLETED), {
      leaderConversationId: "leader-1",
      title: "Plan",
      status: "done",
    });
    expect(row.source).toBe("ai");
    expect(row.target?.query).toEqual({ c: "leader-1" });
  });

  it("permiso pendiente conserva source 'ai' y target de conversación", () => {
    const row = buildNotificationFromRule(ruleFor(Events.AI_PERMISSION_REQUESTED), {
      conversationId: "conv-2",
      provider: "codex",
      tool: "files.write",
    });
    expect(row.source).toBe("ai");
    expect(row.link).toBe("/panel?c=conv-2&provider=codex");
  });
});

describe("pickNotificationMetadata", () => {
  it("solo escalares: fuera objetos, funciones y `executor`", () => {
    const meta = pickNotificationMetadata({
      executor: { target: { id: "srv" }, exec: () => undefined },
      nested: { a: 1 },
      list: [1, 2],
      fn: () => undefined,
      empty: "",
      nulo: null,
      conversationId: "conv-1",
      count: 3,
      errored: false,
    });
    expect(meta).toEqual({ conversationId: "conv-1", count: 3, errored: false });
  });

  it("trunca strings largas a 500", () => {
    const meta = pickNotificationMetadata({ big: "x".repeat(900) });
    expect((meta?.big as string).length).toBe(500);
    expect((meta?.big as string).endsWith("…")).toBe(true);
  });

  it("payload sin escalares → null", () => {
    expect(pickNotificationMetadata({ executor: {} })).toBeNull();
  });

  it("una regla real nunca persiste el executor", () => {
    const row = buildNotificationFromRule(ruleFor(Events.AI_TEAM_PLAN_COMPLETED), {
      leaderConversationId: "leader-1",
      title: "Plan",
      executor: { secret: true },
    });
    expect(row.metadata).not.toHaveProperty("executor");
    expect(row.metadata).toHaveProperty("leaderConversationId", "leader-1");
  });
});

describe("sanitizeNotificationTarget — fail-closed", () => {
  it("rechaza destinos externos o peligrosos", () => {
    for (const href of [
      "https://x.test",
      "//evil.test",
      "javascript:alert(1)",
      "/panel/../x",
      "/etc/passwd",
      "/panelx",
      "panel/monitor",
      "/panel/monitor\\..",
    ]) {
      expect(sanitizeNotificationTarget({ href })).toBeNull();
    }
  });

  it("acepta rutas internas", () => {
    expect(sanitizeNotificationTarget({ href: "/panel" })).toEqual({ href: "/panel" });
    expect(sanitizeNotificationTarget({ href: "/panel/mail" })).toEqual({ href: "/panel/mail" });
  });

  it("descarta eventos fuera de la allowlist", () => {
    const t = sanitizeNotificationTarget({
      href: "/panel",
      event: { name: "luxipanel:evil", detail: { a: 1 } },
    });
    expect(t).toEqual({ href: "/panel" });
    expect(NOTIFICATION_EVENT_ALLOWLIST).toContain("luxipanel:assistant-open-conversation");
  });

  it("detail solo escalares y ≤10 claves", () => {
    const detail: Record<string, unknown> = { obj: { a: 1 }, fn: () => 1, ok: "sí" };
    for (let i = 0; i < 12; i++) detail[`k${i}`] = i;
    const t = sanitizeNotificationTarget({
      href: "/panel",
      event: { name: "luxipanel:assistant-open-conversation", detail },
    });
    expect(Object.keys(t?.event?.detail ?? {}).length).toBeLessThanOrEqual(10);
    expect(t?.event?.detail).not.toHaveProperty("obj");
    expect(t?.event?.detail).not.toHaveProperty("fn");
  });

  it("query: ≤10 claves, valores string ≤200", () => {
    const query: Record<string, unknown> = { ok: "1", num: 5, largo: "x".repeat(201) };
    for (let i = 0; i < 12; i++) query[`q${i}`] = String(i);
    const t = sanitizeNotificationTarget({ href: "/panel", query });
    expect(Object.keys(t?.query ?? {}).length).toBeLessThanOrEqual(10);
    expect(t?.query).not.toHaveProperty("num");
    expect(t?.query).not.toHaveProperty("largo");
  });

  it("clickSeq: ≤6 pasos y selectores válidos", () => {
    const t = sanitizeNotificationTarget({
      href: "/panel",
      clickSeq: ['[data-tab="dns"]', "#uno", "<script>", "a".repeat(300), "#dos", "#tres", "#cuatro", "#cinco"],
    });
    expect(t?.clickSeq).toEqual(['[data-tab="dns"]', "#uno", "#dos", "#tres"]);
  });

  it("hash inválido se descarta, válido se conserva", () => {
    expect(sanitizeNotificationTarget({ href: "/panel", hash: "#a b" })).toEqual({ href: "/panel" });
    expect(sanitizeNotificationTarget({ href: "/panel", hash: "#pref-audit" })?.hash).toBe("#pref-audit");
  });

  it("entradas no-objeto → null", () => {
    expect(sanitizeNotificationTarget(null)).toBeNull();
    expect(sanitizeNotificationTarget("/panel")).toBeNull();
    expect(sanitizeNotificationTarget({})).toBeNull();
  });
});

describe("targetToLink / linkToTarget", () => {
  it("ida y vuelta de un deep-link", () => {
    const target = { href: "/panel/cloudflare", query: { tab: "dns" }, hash: "#zona" };
    const link = targetToLink(target);
    expect(link).toBe("/panel/cloudflare?tab=dns#zona");
    expect(linkToTarget(link)).toEqual(target);
  });

  it("links externos → null", () => {
    expect(linkToTarget("https://x.test/panel")).toBeNull();
    expect(linkToTarget("/otro")).toBeNull();
    expect(targetToLink(null)).toBeNull();
  });
});
