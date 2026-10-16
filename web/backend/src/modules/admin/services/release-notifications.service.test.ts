import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ saved: "{}", temp: "{}" }));
vi.mock("node:fs/promises", () => ({ default: { readFile: vi.fn(async () => state.saved), mkdir: vi.fn(), writeFile: vi.fn(async (_: string, text: string) => { state.temp = text; }), rename: vi.fn(async () => { state.saved = state.temp; }) } }));
vi.mock("./releases.service.js", () => ({ installationRoot: () => "/installation", releasesService: { status: vi.fn() } }));
vi.mock("../../notifications/services/notifications.service.js", () => ({ notificationsService: { create: vi.fn(async () => ({})) } }));
vi.mock("../../../shared/executor/index.js", () => ({ localExecutor: { target: { id: "local" } } }));
import { checkReleaseNotifications } from "./release-notifications.service.js";
import { releasesService } from "./releases.service.js";
import { notificationsService } from "../../notifications/services/notifications.service.js";
import { localExecutor } from "../../../shared/executor/index.js";
const status = { branches: [{ name: "developer", commit: "a".repeat(40), ahead: 3, updateAvailable: true }], updateAvailable: true, latest: { tag: "v2.0.4" } };
beforeEach(() => { vi.clearAllMocks(); state.saved = "{}"; vi.mocked(releasesService.status).mockResolvedValue(status as Awaited<ReturnType<typeof releasesService.status>>); });
it("records each revision once and targets the same drawer and selected branch", async () => {
  await Promise.all([checkReleaseNotifications(), checkReleaseNotifications()]); await checkReleaseNotifications();
  expect(notificationsService.create).toHaveBeenCalledTimes(2);
  expect(notificationsService.create).toHaveBeenCalledWith(expect.objectContaining({ target: { href: "/panel", query: { updates: "developer" }, event: { name: "luxipanel:releases-open", detail: { branch: "developer" } } } }), localExecutor);
  vi.mocked(releasesService.status).mockResolvedValue({ ...status, branches: [{ ...status.branches[0]!, commit: "b".repeat(40) }] } as Awaited<ReturnType<typeof releasesService.status>>);
  await checkReleaseNotifications(); expect(notificationsService.create).toHaveBeenCalledTimes(3);
});
it("does not notify uncertain branch or release results", async () => {
  vi.mocked(releasesService.status).mockResolvedValue({ ...status, error: "offline", branches: [{ ...status.branches[0]!, error: "comparison failed" }] } as Awaited<ReturnType<typeof releasesService.status>>);
  await checkReleaseNotifications(); expect(notificationsService.create).not.toHaveBeenCalled();
});

it("preserves the branch event and fallback link through the notification sanitizer", async () => {
  const { sanitizeNotificationTarget, targetToLink } = await import("../../notifications/models/notification-target.js");
  const target = { href: "/panel", query: { updates: "developer" }, event: { name: "luxipanel:releases-open", detail: { branch: "developer" } } };
  expect(sanitizeNotificationTarget(target)).toEqual(target);
  expect(targetToLink(sanitizeNotificationTarget(target))).toBe("/panel?updates=developer");
});
