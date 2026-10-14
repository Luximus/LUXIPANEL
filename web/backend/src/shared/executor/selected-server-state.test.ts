// SPDX-License-Identifier: AGPL-3.0-only
import { EventEmitter } from "node:events";
import path from "node:path";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { Executor } from "./types.js";

const h = vi.hoisted(() => ({ targets: new Map<string, unknown>() }));
vi.mock("./vault-executor.js", () => ({ getVaultExecutor: async (id: string) => h.targets.get(id) ?? null }));
vi.mock("./index.js", async original => {
  const actual = await original<typeof import("./index.js")>();
  return { ...actual, getExecutor: () => actual.getContextExecutor()! };
});
vi.mock("../http/sse.js", () => ({ openSse: (res: { sendEvent: unknown }) => ({ send: res.sendEvent, close: vi.fn() }) }));
vi.mock("../redis/index.js", () => ({ getRedis: () => ({ get: async () => null, set: async () => "OK", del: async () => 0 }) }));

import { getContextExecutor, runWithExecutor } from "./context.js";
import { notificationsService } from "../../modules/notifications/services/notifications.service.js";
import { notificationsController } from "../../modules/notifications/controllers/notifications.controller.js";
import { resolveNotificationExecutor } from "../../modules/notifications/services/notification-scope.js";
import { moduleRegistryService } from "../../modules/admin/services/module-registry.service.js";
import { modulesController } from "../../modules/admin/controllers/modules.controller.js";
import { serverSettingsService } from "../../modules/admin/services/server-settings.service.js";
import { settingsRepository } from "../../modules/admin/repositories/settings.repository.js";
import { assistantConfigRepository } from "../../modules/ai-assistant/repositories/assistant-config.repository.js";
import { assistantModuleAccessRepository } from "../../modules/ai-assistant/repositories/assistant-module-access.repository.js";
import { usageRepository } from "../../modules/ai-assistant/repositories/usage.repository.js";
import { isChatFinishedPushEnabled, CHAT_FINISHED_PREF_KEY } from "../../modules/server-alerts/services/chat-finished-push.service.js";
import { notificationDeliveryService } from "../../modules/server-alerts/services/notification-delivery.service.js";
import { cacheModulesService } from "../../modules/admin/services/cache-modules.service.js";
import { agentRunRegistry } from "../../modules/ai-assistant/services/agent-run-registry.js";
import { permissionBroker } from "../../modules/ai-assistant/services/permission-broker.js";
import { cliJobTracker } from "../../modules/ai-assistant/services/cli-job-tracker.service.js";
import { agentController } from "../../modules/ai-assistant/controllers/agent.controller.js";
import { conversationsRepository } from "../../modules/ai-assistant/repositories/conversations.repository.js";
import { brandingController } from "../../modules/admin/controllers/branding.controller.js";
import { CONFIG_DIR } from "../../config/paths.js";

function server(id: string) {
  const files = new Map<string, string>();
  const executor = {
    target: { id, name: id },
    readFile: async (path: string, encoding = "utf8") => {
      if (!files.has(path)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return encoding === "base64" ? Buffer.from(files.get(path)!).toString("base64") : files.get(path)!;
    },
    writeFile: async (path: string, data: string | Buffer) => { files.set(path, data.toString()); },
    rename: async (from: string, to: string) => { files.set(to, files.get(from)!); files.delete(from); },
    unlink: async (path: string) => { files.delete(path); },
    readdir: async () => [],
    stat: async (path: string) => {
      if (!files.has(path)) throw Object.assign(new Error("No such file"), { code: 2 });
      return { type: "file", size: Buffer.byteLength(files.get(path)!) };
    },
    mkdir: async () => {},
    exec: async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 0 }),
  } as unknown as Executor;
  h.targets.set(id, executor);
  return { executor, files };
}

function stream(executor: Executor, userId = 1) {
  const req = new EventEmitter();
  const res = Object.assign(new EventEmitter(), { locals: { user: { userId } }, status: vi.fn(), sendEvent: vi.fn() });
  runWithExecutor(executor, () => notificationsController.stream(req as Request, res as unknown as Response));
  return { req, res };
}

function invoke(handler: typeof modulesController.update, executor: Executor, params: unknown, body: unknown) {
  return runWithExecutor(executor, () => new Promise<any>((resolve, reject) => {
    handler({ params, body } as Request, { locals: { user: { kind: "admin", userId: 1 } }, json: resolve } as unknown as Response, reject);
  }));
}

describe("selected server state using real repositories and simulated server files", () => {
  it("isolates notification files, unread cache, mutations and SSE by server and owner", async () => {
    const a = server("notify-a"), b = server("notify-b");
    const first = stream(a.executor), second = stream(b.executor), otherUser = stream(a.executor, 2);
    try {
      await expect(notificationsService.unreadCount(1, b.executor)).resolves.toBe(0);
      const row = await notificationsService.create({ source: "ai", title: "A", message: "A only", userId: 1, metadata: { targetId: "spoofed" } }, a.executor);
      expect(row.metadata?.targetId).toBe("notify-a");
      expect(first.res.sendEvent).toHaveBeenCalledOnce();
      expect(second.res.sendEvent).not.toHaveBeenCalled();
      expect(otherUser.res.sendEvent).not.toHaveBeenCalled();
      await expect(notificationsService.unreadCount(1, a.executor)).resolves.toBe(1);
      await expect(notificationsService.unreadCount(1, b.executor)).resolves.toBe(0);
      await expect(notificationsService.markRead(row.id, 1, false, b.executor)).resolves.toBeNull();
      await expect(notificationsService.delete(row.id, 2, false, a.executor)).resolves.toBe(false);
      await notificationsService.markAllRead(1, a.executor);
      expect(second.res.sendEvent).not.toHaveBeenCalled();
      await notificationsService.clearAll(1, a.executor);
      await expect(notificationsService.unreadCount(1, a.executor)).resolves.toBe(0);
      expect(b.files.size).toBe(0);
    } finally {
      first.req.emit("close"); second.req.emit("close"); otherUser.req.emit("close");
    }
  });

  it("uses an event's origin even when emitted in a different server context and fails closed for unknown remotes", async () => {
    const a = server("event-a"), b = server("event-b");
    await runWithExecutor(a.executor, () => notificationsService.tryCreate({ source: "system", title: "B", message: "B only" }, "event-b"));
    expect((await notificationsService.list({}, a.executor)).total).toBe(0);
    expect((await notificationsService.list({}, b.executor)).total).toBe(1);
    await expect(runWithExecutor(a.executor, () => resolveNotificationExecutor("missing-remote"))).rejects.toThrow("unavailable");
    expect(a.files.size).toBe(0);
  });

  it("persists module activation, display and order through admin controllers on each server", async () => {
    const a = server("modules-a"), b = server("modules-b");
    await invoke(modulesController.update, a.executor, { id: "users" }, { enabled: true });
    await invoke(modulesController.update, b.executor, { id: "users" }, { enabled: false });
    await invoke(modulesController.update, a.executor, { id: "terminal" }, { showFloatingButton: false });
    await invoke(modulesController.reorder, a.executor, {}, { order: ["monitor", "files"] });
    const read = (executor: Executor) => runWithExecutor(executor, async () => ({
      enabled: await moduleRegistryService.isEnabled("users"),
      order: await moduleRegistryService.getOrder(),
      display: await settingsRepository.get("module.terminal.showFloatingButton"),
    }));
    expect(await read(a.executor)).toMatchObject({ enabled: true, order: ["monitor", "files", ...moduleRegistryService.getAll().map(m => m.id).filter(id => !["monitor", "files"].includes(id))], display: "false" });
    expect(await read(b.executor)).toMatchObject({ enabled: false, display: null });
    const cacheA = await cacheModulesService.list(a.executor), cacheB = await cacheModulesService.list(b.executor);
    expect(cacheA.find(row => row.module === "users")?.enabled).toBe(true);
    expect(cacheB.find(row => row.module === "users")?.enabled).toBe(false);
  });

  it("global settings honor an explicit executor even inside another server's request", async () => {
    const a = server("settings-a"), b = server("settings-b");
    await runWithExecutor(a.executor, async () => {
      await serverSettingsService.setOne(b.executor, "panel_title", "B");
      await serverSettingsService.setBulk(b.executor, [{ key: "locale", value: "es" }]);
      expect(await serverSettingsService.readAll(a.executor)).toEqual({});
      expect(await serverSettingsService.readAll(b.executor)).toMatchObject({ panel_title: { value: "B" }, locale: { value: "es" } });
      await serverSettingsService.remove(b.executor, "panel_title");
      expect((await serverSettingsService.readAll(b.executor)).panel_title).toBeUndefined();
    });
    expect(a.files.size).toBe(0);
  });

  it("uploads and serves branding bytes only on the selected server", async () => {
    const a = server("branding-a"), b = server("branding-b");
    const uploaded = await runWithExecutor(b.executor, () => new Promise<any>((resolve, reject) => {
      const req = { header: () => "remote-logo.png", body: Buffer.from("remote image") } as unknown as Request;
      const res = { locals: {}, status() { return this; }, json: resolve } as unknown as Response;
      brandingController.upload(req, res, reject);
    }));
    expect(uploaded.data.url).toBe("/branding/remote-logo.png");
    expect(b.files.get(path.posix.join(CONFIG_DIR, "branding", "remote-logo.png"))).toBe("remote image");
    expect(a.files.size).toBe(0);
    let bytes: Buffer | undefined;
    await runWithExecutor(b.executor, () => new Promise<void>((resolve, reject) => {
      const res = { set: vi.fn(), type: vi.fn(), end: (value: Buffer) => { bytes = value; resolve(); }, sendStatus: reject } as unknown as Response;
      brandingController.asset({ query: { name: "remote-logo.png", target: "branding-b" } } as unknown as Request, res, reject);
    }));
    expect(bytes).toEqual(Buffer.from("remote image"));
    await runWithExecutor(a.executor, () => new Promise<void>((resolve, reject) => {
      const res = { sendStatus: (status: number) => { expect(status).toBe(404); resolve(); } } as Response;
      brandingController.asset({ query: { name: "remote-logo.png", target: "branding-b" } } as unknown as Request, res, reject);
    }));
  });

  it("provider config, assistant tools, notification preferences and usage belong to the target", async () => {
    const a = server("assistant-a"), b = server("assistant-b");
    await runWithExecutor(a.executor, async () => {
      await assistantConfigRepository.patch({ activeProvider: "codex" }, a.executor);
      await assistantModuleAccessRepository.setModule("files", { enabled: false }, a.executor);
      await settingsRepository.set(CHAT_FINISHED_PREF_KEY, "false", "notifications", undefined, a.executor);
      await notificationDeliveryService.setPreferences(1, "assistant-a", { web: false });
      await usageRepository.record({ ts: new Date().toISOString(), provider: "codex", mode: "cli", model: "test", inputTokens: 12, outputTokens: 3 }, a.executor);
    }, 1);
    expect((await assistantConfigRepository.load(a.executor)).activeProvider).toBe("claude"); // shared default; user config is separate
    await runWithExecutor(a.executor, async () => expect((await assistantConfigRepository.load()).activeProvider).toBe("codex"), 1);
    await runWithExecutor(b.executor, async () => {
      expect((await assistantConfigRepository.load()).activeProvider).toBe("claude");
      expect(await assistantModuleAccessRepository.load()).toEqual({});
      expect(await isChatFinishedPushEnabled(b.executor)).toBe(true);
      expect((await notificationDeliveryService.getPreferences(1, "assistant-b")).web).toBe(true);
      expect((await usageRepository.query(b.executor, {})).total).toBe(0);
    }, 1);
    expect(await isChatFinishedPushEnabled(a.executor)).toBe(false);
    expect((await usageRepository.query(a.executor, {})).total).toBe(1);
  });

  it("keeps detached execution and its active feed on the originating server", async () => {
    const a = server("runs-a"), b = server("runs-b");
    let releaseA!: () => void, releaseB!: () => void;
    const waitA = new Promise<void>(resolve => { releaseA = resolve; });
    const waitB = new Promise<void>(resolve => { releaseB = resolve; });
    const completed: string[] = [];
    const start = (executor: Executor, wait: Promise<void>) => agentRunRegistry.start({
      key: "cloned-conversation", executor, provider: executor.target.id === "runs-a" ? "codex" : "claude",
      user: { userId: 1 } as never,
      makeGen: async function* () {
        expect(getContextExecutor()).toBe(executor);
        await wait;
        yield { type: "done" as const };
      },
      onComplete: () => { completed.push(getContextExecutor()!.target.id); },
    });
    const first = start(a.executor, waitA), second = start(b.executor, waitB);
    // Both stores can contain cloned conversation IDs: the runtime target must
    // still be checked in addition to membership in the conversation index.
    const ids = vi.spyOn(conversationsRepository, "listIds").mockResolvedValue(new Set(["cloned-conversation"]));
    try {
      let result: any;
      await runWithExecutor(a.executor, () => agentController.activeRuns({} as Request, { json: (value: unknown) => { result = value; } } as Response));
      expect(result.runs).toMatchObject([{ id: "cloned-conversation", provider: "codex" }]);
      const listenerA = vi.fn(), listenerB = vi.fn();
      runWithExecutor(a.executor, () => agentRunRegistry.attach("cloned-conversation", 0, listenerA));
      runWithExecutor(b.executor, () => agentRunRegistry.attach("cloned-conversation", 0, listenerB));
      runWithExecutor(a.executor, () => {
        expect(agentRunRegistry.activeCountForUser(1)).toBe(1);
        agentRunRegistry.inject("cloned-conversation", { type: "text", delta: "A only" });
      });
      expect(listenerA).toHaveBeenCalledOnce();
      expect(listenerB).not.toHaveBeenCalled();
      runWithExecutor(b.executor, () => agentRunRegistry.stop("cloned-conversation"));
      expect(second.ac.signal.aborted).toBe(true);
      expect(first.ac.signal.aborted).toBe(false);
    } finally {
      ids.mockRestore(); releaseA(); releaseB();
      await Promise.all([first.completion, second.completion]);
    }
    expect(completed.sort()).toEqual(["runs-a", "runs-b"]);
  });

  it("keeps approval requests on their originating server for cloned conversation IDs", async () => {
    const a = server("approval-a"), b = server("approval-b");
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const start = (executor: Executor) => agentRunRegistry.start({
      key: "approval-clone", executor,
      makeGen: async function* () { await wait; yield { type: "done" as const }; },
    });
    const first = start(a.executor), second = start(b.executor);
    try {
      const ask = (executor: Executor) => runWithExecutor(executor, () => permissionBroker.request({
        conversationId: "approval-clone", tool: "files.write", title: "Approve write",
      }), 1);
      const decisionA = ask(a.executor), decisionB = ask(b.executor);
      const requestA = first.events.find(event => event.type === "permission_request");
      expect(requestA?.type).toBe("permission_request");
      if (requestA?.type !== "permission_request") throw new Error("Missing request");
      runWithExecutor(b.executor, () => {
        expect(permissionBroker.resolve("approval-clone", requestA.id, "allow")).toBe(false);
        permissionBroker.cancelConversation("approval-clone");
      });
      await expect(decisionB).resolves.toBe("deny");
      runWithExecutor(a.executor, () => {
        expect(permissionBroker.pendingCount("approval-clone")).toBe(1);
        expect(permissionBroker.resolve("approval-clone", requestA.id, "allow")).toBe(true);
      });
      await expect(decisionA).resolves.toBe("allow");
    } finally {
      runWithExecutor(a.executor, () => permissionBroker.cancelConversation("approval-clone"));
      runWithExecutor(b.executor, () => permissionBroker.cancelConversation("approval-clone"));
      release(); await Promise.all([first.completion, second.completion]);
    }
  });

  it("steers and stops only the selected server's CLI even with cloned job IDs", async () => {
    const a = server("cli-a"), b = server("cli-b");
    const steerA = vi.fn(async () => {}), steerB = vi.fn(async () => {});
    const start = (executor: Executor, steer: typeof steerA) => runWithExecutor(executor, () => cliJobTracker.start({
      jobId: "cloned-job", conversationId: "cli-clone", executor, steer,
      serverName: executor.target.id, logFile: "/tmp/cloned-job.log", exitFile: "/tmp/cloned-job.exit",
      notificationCtx: { title: "CLI", link: "/panel" },
    }));
    const first = start(a.executor, steerA), second = start(b.executor, steerB);
    try {
      await runWithExecutor(a.executor, async () => {
        expect(cliJobTracker.get("cloned-job")).toBe(first);
        expect(await cliJobTracker.steerConversation("cli-clone", "A only")).toBe(true);
        expect(cliJobTracker.killForConversation("cli-clone")).toBe(1);
        expect(cliJobTracker.hasJobForConversation("cli-clone")).toBe(false);
      });
      expect(steerA).toHaveBeenCalledWith("A only");
      expect(steerB).not.toHaveBeenCalled();
      runWithExecutor(b.executor, () => {
        expect(cliJobTracker.get("cloned-job")).toBe(second);
        expect(cliJobTracker.hasJobForConversation("cli-clone")).toBe(true);
      });
    } finally {
      cliJobTracker.killForConversation("cli-clone", a.executor.target.id);
      cliJobTracker.killForConversation("cli-clone", b.executor.target.id);
    }
  });
});
