import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/api-client", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/lib/panel-releases", async importOriginal => ({ ...await importOriginal<object>(), readPanelReleases: vi.fn(), installPanelRelease: vi.fn(), readReleaseDetails: vi.fn(), translateReleaseDetails: vi.fn() }));
import ReleaseBanner from "./ReleaseBanner";
import labels from "@/i18n/es/panelLayout";
import { api } from "@/lib/api-client";
import { installPanelRelease, readPanelReleases, readReleaseDetails, translateReleaseDetails, type PanelReleaseStatus } from "@/lib/panel-releases";

let root: Root; let container: HTMLDivElement;
const latest = { tag: "v2.0.4", name: "Release", notes: "Fixes", publishedAt: null };
const status: PanelReleaseStatus = { installed: { tag: "v2.0.3" }, currentVersion: "v2.0.3", latest, releases: [latest, { ...latest, tag: "v2.0.3" }], updateAvailable: true, operation: null, previous: null, canInstall: true };
const render = async (isAdmin = true) => { await act(async () => root.render(createElement(ReleaseBanner, { isAdmin, labels: labels.community, locale: "es" }))); };
const open = async () => { await act(async () => container.querySelector("button")!.click()); };
const installButton = () => Array.from(container.querySelectorAll("dialog button")).find(button => button.textContent === "Actualizar a v2.0.4" || button.textContent === labels.community.updating) as HTMLButtonElement | undefined;

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
  vi.mocked(api.get).mockResolvedValue({ ok: true, data: { items: [], unread: 0 } });
  vi.mocked(readPanelReleases).mockResolvedValue(status);
  const details = { ...latest, url: "https://github.com/Luxisoft/LUXIPANEL/releases/tag/v2.0.4", comments: [], commentsUnavailable: false };
  vi.mocked(readReleaseDetails).mockResolvedValue(details);
  vi.mocked(translateReleaseDetails).mockResolvedValue({ ...details, translation: "original" });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

it("only installs the latest release after the explicit drawer action and prevents repeated clicks", async () => {
  let finish!: () => void;
  vi.mocked(installPanelRelease).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await render(); await open();
  expect(installPanelRelease).not.toHaveBeenCalled();
  const select = container.querySelector("select")!;
  await act(async () => { select.value = "v2.0.3"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(installButton()).toBeUndefined(); expect(installPanelRelease).not.toHaveBeenCalled();
  await act(async () => { select.value = "v2.0.4"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  const button = installButton()!;
  await act(async () => { button.click(); button.click(); });
  expect(installPanelRelease).toHaveBeenCalledExactlyOnceWith("v2.0.4");
  expect(button.disabled).toBe(true);
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, operation: { status: "running", tag: latest.tag } });
  await act(async () => finish());
  expect(installButton()?.disabled).toBe(true);
});

it.each([[false, true], [true, false], [true, undefined]])("does not offer installation when admin=%s and canInstall=%s", async (isAdmin, canInstall) => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, canInstall });
  await render(isAdmin); await open();
  expect(installButton()).toBeUndefined(); expect(installPanelRelease).not.toHaveBeenCalled();
});

it("disables installation while another update is running", async () => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, operation: { status: "running", tag: latest.tag } });
  await render(); await open();
  expect(installButton()?.disabled).toBe(true);
  await act(async () => installButton()?.click());
  expect(installPanelRelease).not.toHaveBeenCalled();
});

it("shows a failed catalog check without losing the installed version, and recovers on the next check", async () => {
  await render(); await open();
  vi.mocked(readPanelReleases).mockRejectedValue(new Error("Unavailable"));
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(container.querySelector("button .font-mono")?.textContent).toBe("v2.0.3");
  expect(container.querySelector("[data-release-notification]")).toBeNull();
  expect(container.querySelector("dialog")?.textContent).toContain(labels.community.loadError);
  expect(installButton()).toBeUndefined();
  vi.mocked(readPanelReleases).mockResolvedValue(status);
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(container.querySelector("[data-release-notification]")?.textContent).toContain("nuevo");
  expect(container.querySelector("dialog")?.textContent).not.toContain(labels.community.loadError);
  expect(installPanelRelease).not.toHaveBeenCalled();
});

it("discards a previous target's late catalog response", async () => {
  let finish!: (value: PanelReleaseStatus) => void;
  vi.mocked(readPanelReleases).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render();
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, installed: { tag: "v3.0.0" }, currentVersion: "v3.0.0", updateAvailable: false });
  await act(async () => window.dispatchEvent(new Event("luxipanel:target-changed")));
  await act(async () => finish(status));
  expect(container.querySelector("button .font-mono")?.textContent).toBe("v3.0.0");
  expect(container.querySelector("[data-release-notification]")).toBeNull();
});

it("does not show a previous target's late installation error", async () => {
  let fail!: (error: Error) => void;
  vi.mocked(installPanelRelease).mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
  await render(); await open();
  await act(async () => installButton()!.click());
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, installed: { tag: "v3.0.0" }, currentVersion: "v3.0.0", updateAvailable: false });
  await act(async () => window.dispatchEvent(new Event("luxipanel:target-changed")));
  await act(async () => fail(new Error("Previous target failure")));
  expect(container.querySelector("dialog[open]")).toBeNull();
  expect(container.textContent).not.toContain("Previous target failure");
  expect(container.querySelector("button .font-mono")?.textContent).toBe("v3.0.0");
});
