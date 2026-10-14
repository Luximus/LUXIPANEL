// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Delivery preferences/history belong to the target; device registrations
 * and delivery credentials belong to this panel installation. */
import { createHash } from "node:crypto";
import webpush from "web-push";
import { dataStore } from "../../../shared/data-store/index.js";
import { localExecutor, LOCAL_TARGET_ID, type Executor } from "../../../shared/executor/index.js";
import { getPanelOrigin } from "../../../shared/panel-url/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import { targetsRepository } from "../../servers/repositories/targets.repository.js";
import { userMayUseTarget } from "../../servers/services/servers.service.js";
import { encryptSecret, decryptSecret } from "../../servers/services/servers-vault-crypto.js";
import { notificationsService } from "../../notifications/services/notifications.service.js";
import { resolveNotificationExecutor } from "../../notifications/services/notification-scope.js";
import { ValidationError } from "../../../shared/errors/index.js";

const log = createModuleLogger("notification-delivery");
let logsSinceTrim = 0;
type Category = "manual" | "scheduled" | "rules" | "chat";
type Channel = "web" | "mobile";
type DeliveryState = "accepted" | "failed" | "unavailable";

export interface AlertPreference {
  id: string;
  userId: number;
  targetId: string;
  enabled: boolean;
  manual: boolean;
  scheduled: boolean;
  rules: boolean;
  web: boolean;
  mobile: boolean;
}
interface Device {
  id: string;
  userId: number;
  channel: Channel;
  secretEnc: string;
  appPanelId?: string;
  createdAt?: string;
  updatedAt?: string;
}
interface VapidRecord { id: string; publicKey: string; privateKeyEnc: string }
export interface DeliveryLog {
  id?: string;
  userId: number;
  targetId: string;
  category: Category | "test";
  title: string;
  panel: "stored" | "existing" | "failed";
  web: DeliveryState;
  mobile: DeliveryState;
  webError?: string | null;
  mobileError?: string | null;
  createdAt?: string;
}

const prefsStore = (executor: Executor) => dataStore<AlertPreference>(executor, "server-alerts", "user-preferences", { timestamps: false });
const devicesStore = () => dataStore<Device>(localExecutor, "server-alerts", "devices");
const vapidStore = () => dataStore<VapidRecord>(localExecutor, "server-alerts", "vapid", { timestamps: false });
const logsStore = (executor: Executor) => dataStore<DeliveryLog>(executor, "server-alerts", "delivery-log", { idStrategy: "uuid" });
const prefId = (userId: number, targetId: string) => `${userId}:${targetId}`;
const deviceId = (channel: Channel, value: string) => createHash("sha256").update(`${channel}:${value}`).digest("hex");
function validWebPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return ["push.services.mozilla.com", "push.apple.com", "notify.windows.com", "fcm.googleapis.com", "push.googleapis.com"].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch { return false; }
}

async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const existing = await vapidStore().get("current");
  if (existing) return { publicKey: existing.publicKey, privateKey: decryptSecret(existing.privateKeyEnc) };
  const keys = webpush.generateVAPIDKeys();
  const saved = await vapidStore().set("current", { id: "current", publicKey: keys.publicKey, privateKeyEnc: encryptSecret(keys.privateKey) });
  return { publicKey: saved.publicKey, privateKey: decryptSecret(saved.privateKeyEnc) };
}

async function webSend(devices: Device[], title: string, body: string, url: string): Promise<{ state: DeliveryState; accepted: number; error?: string }> {
  if (!devices.length) return { state: "unavailable", accepted: 0 };
  const keys = await vapidKeys();
  webpush.setVapidDetails("mailto:notifications@luxisoft.com", keys.publicKey, keys.privateKey);
  let accepted = 0;
  const errors: string[] = [];
  for (const device of devices) {
    try {
      const subscription = JSON.parse(decryptSecret(device.secretEnc)) as webpush.PushSubscription;
      await webpush.sendNotification(subscription, JSON.stringify({ title, body, url }), { TTL: 86_400 });
      accepted++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await devicesStore().delete(device.id);
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { state: accepted ? "accepted" : "failed", accepted, ...(errors.length ? { error: errors[0] } : {}) };
}

async function mobileSend(devices: Device[], title: string, body: string, url: string): Promise<{ state: DeliveryState; accepted: number; error?: string }> {
  if (!devices.length) return { state: "unavailable", accepted: 0 };
  const messages = devices.map((device) => ({ to: decryptSecret(device.secretEnc), title, body, data: { type: "server_alert", url, ...(device.appPanelId ? { panelId: device.appPanelId } : {}) } }));
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Expo HTTP ${response.status}`);
    const result = await response.json() as { data?: Array<{ status: string; message?: string; details?: { error?: string } }> };
    const tickets = result.data ?? [];
    let accepted = 0;
    for (let i = 0; i < tickets.length; i++) {
      if (tickets[i]?.status === "ok") accepted++;
      const device = devices[i];
      if (tickets[i]?.details?.error === "DeviceNotRegistered" && device) await devicesStore().delete(device.id);
    }
    return { state: accepted ? "accepted" : "failed", accepted, ...(accepted ? {} : { error: tickets[0]?.message ?? "Expo no aceptó el envío" }) };
  } catch (err) {
    return { state: "failed", accepted: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

async function eligibleUsers(targetId: string, recipientUsername?: string): Promise<Array<{ id: number; username: string }>> {
  const users = (await panelUserRepository.findAllWithRoles(localExecutor)).filter((u) => u.enabled && (!recipientUsername || u.username === recipientUsername));
  if (targetId === LOCAL_TARGET_ID) return users.map((u) => ({ id: u.id, username: u.username }));
  const target = await targetsRepository.getView(targetId);
  if (!target || !target.enabled) return [];
  return users.filter((u) => userMayUseTarget(target, { userId: u.id, isAdmin: (u.groups ?? []).includes("sudo") || (u.groups ?? []).includes("wheel") || (u.modules ?? "").includes('"admin"') || (u.roleModules ?? []).includes("admin") }))
    .map((u) => ({ id: u.id, username: u.username }));
}

export const notificationDeliveryService = {
  async getPreferences(userId: number, targetId: string): Promise<AlertPreference> {
    const saved = await prefsStore(await resolveNotificationExecutor(targetId)).get(prefId(userId, targetId));
    return saved ?? { id: prefId(userId, targetId), userId, targetId, enabled: true, manual: true, scheduled: true, rules: true, web: true, mobile: true };
  },
  async setPreferences(userId: number, targetId: string, patch: Partial<Pick<AlertPreference, "enabled" | "manual" | "scheduled" | "rules" | Channel>>): Promise<AlertPreference> {
    const next = { ...await this.getPreferences(userId, targetId), ...patch };
    await prefsStore(await resolveNotificationExecutor(targetId)).set(next.id, next);
    return next;
  },
  async getVapidPublicKey(): Promise<string> { return (await vapidKeys()).publicKey; },
  async registerWeb(userId: number, subscription: webpush.PushSubscription): Promise<void> {
    if (!validWebPushEndpoint(subscription.endpoint)) throw new ValidationError("Proveedor de notificaciones web no admitido");
    const id = deviceId("web", subscription.endpoint);
    await devicesStore().set(id, { id, userId, channel: "web", secretEnc: encryptSecret(JSON.stringify(subscription)) });
  },
  async registerMobile(userId: number, token: string, appPanelId?: string): Promise<void> {
    const id = deviceId("mobile", token);
    await devicesStore().set(id, { id, userId, channel: "mobile", secretEnc: encryptSecret(token), ...(appPanelId ? { appPanelId } : {}) });
  },
  async removeDevice(userId: number, channel: Channel, value: string): Promise<boolean> {
    const id = deviceId(channel, value);
    const row = await devicesStore().get(id);
    return row?.userId === userId ? devicesStore().delete(id) : false;
  },
  async deviceStatus(userId: number): Promise<{ web: number; mobile: number }> {
    const rows = await devicesStore().query((r) => r.userId === userId);
    return { web: rows.filter((r) => r.channel === "web").length, mobile: rows.filter((r) => r.channel === "mobile").length };
  },
  async history(targetId: string, userId: number | null, page = 1): Promise<{ data: DeliveryLog[]; total: number }> {
    const rows = await logsStore(await resolveNotificationExecutor(targetId)).query((r) => r.targetId === targetId && (userId === null || r.userId === userId));
    rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return { data: rows.slice((page - 1) * 25, page * 25), total: rows.length };
  },
  async send(args: { targetId: string; category: Category | "test"; title: string; body: string; recipientUsername?: string; targetUserId?: number; respectPrefs?: boolean; skipPanel?: boolean; path?: string }): Promise<{ sent: { expo: number; web: number }; panel: number; recipients: number; errors: string[] }> {
    const users = args.targetUserId != null
      ? (await eligibleUsers(args.targetId)).filter((u) => u.id === args.targetUserId)
      : await eligibleUsers(args.targetId, args.recipientUsername);
    const executor = await resolveNotificationExecutor(args.targetId);
    const devices = await devicesStore().list();
    const origin = (await getPanelOrigin().catch(() => null))?.replace(/\/+$/, "") ?? "";
    const url = `${origin}${args.path?.startsWith("/panel") ? args.path : "/panel/server-alerts"}`;
    const result = { sent: { expo: 0, web: 0 }, panel: 0, recipients: 0, errors: [] as string[] };
    for (const user of users) {
      const prefs = await this.getPreferences(user.id, args.targetId);
      if (args.respectPrefs !== false && (!prefs.enabled || (args.category !== "test" && args.category !== "chat" && !prefs[args.category]))) continue;
      result.recipients++;
      if (!args.skipPanel) {
        try {
          await notificationsService.create({ source: "module", module: "server-alerts", severity: args.category === "rules" ? "warning" : "info", title: args.title, message: args.body, userId: user.id, link: "/panel/server-alerts", metadata: { targetId: args.targetId, category: args.category } }, executor);
          result.panel++;
        } catch (err) {
          result.errors.push(`Panel: ${err instanceof Error ? err.message : String(err)}`);
          continue;
        }
      }
      const owned = devices.filter((d) => d.userId === user.id);
      const web = prefs.web ? await webSend(owned.filter((d) => d.channel === "web"), args.title, args.body, url).catch((err) => ({ state: "failed" as DeliveryState, accepted: 0, error: err instanceof Error ? err.message : String(err) })) : { state: "unavailable" as DeliveryState, accepted: 0 };
      const mobile = prefs.mobile ? await mobileSend(owned.filter((d) => d.channel === "mobile"), args.title, args.body, url) : { state: "unavailable" as DeliveryState, accepted: 0 };
      result.sent.web += web.accepted;
      result.sent.expo += mobile.accepted;
      if (web.error) result.errors.push(`Web: ${web.error}`);
      if (mobile.error) result.errors.push(`Móvil: ${mobile.error}`);
      try {
        await logsStore(executor).create({ userId: user.id, targetId: args.targetId, category: args.category, title: args.title, panel: args.skipPanel ? "existing" : "stored", web: web.state, mobile: mobile.state, webError: web.error ?? null, mobileError: mobile.error ?? null });
        if (++logsSinceTrim >= 50) {
          logsSinceTrim = 0;
          await logsStore(executor).transaction(async (current) => {
            const keep = new Set(Object.values(current).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 3000).map((row) => row.id));
            return { next: Object.fromEntries(Object.entries(current).filter(([, row]) => keep.has(row.id))), result: undefined };
          });
        }
      } catch (err) {
        log.warn({ err, userId: user.id }, "Could not record notification delivery history");
      }
    }
    if (!result.recipients) log.warn({ targetId: args.targetId, category: args.category }, "Notification had no eligible recipients");
    return result;
  },
};
