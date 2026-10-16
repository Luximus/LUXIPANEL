import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/api-client", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/lib/panel-releases", async importOriginal => ({ ...await importOriginal<object>(), readProjectContributors: vi.fn(), readReleaseDetails: vi.fn(), translateReleaseDetails: vi.fn() }));
import CommunityActivity from "./CommunityActivity";
import labels from "@/i18n/en/panelLayout";
import spanish from "@/i18n/es/panelLayout";
import { api } from "@/lib/api-client";
import { readProjectContributors, readReleaseDetails, translateReleaseDetails, type PanelReleaseStatus } from "@/lib/panel-releases";
let root: Root; let container: HTMLDivElement;
const details = { tag: "v2.0.4", name: "New release", notes: "Fixed terminal", publishedAt: null, url: "https://github.com/Luxisoft/LUXIPANEL/releases/tag/v2.0.4", commentsUnavailable: false, comments: [{ id: "1", body: "Thanks", author: "user", updatedAt: "2026-10-14", url: "https://github.com/Luxisoft/LUXIPANEL/issues/2#issuecomment-1" }] };
const status = { currentVersion: "2.0.3", latest: details, releases: [details], updateAvailable: true, operation: null } as PanelReleaseStatus;
const props = { labels: labels.community, locale: "es", status, installedVersion: "2.0.3", canInstall: false, busy: false, error: "", onInstall: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
  vi.mocked(api.get).mockResolvedValue({ ok: true, data: { items: [], unread: 0 } });
  vi.mocked(readProjectContributors).mockResolvedValue({ items: [], unavailable: false });
  vi.mocked(readReleaseDetails).mockResolvedValue(details);
  vi.mocked(translateReleaseDetails).mockResolvedValue({ ...details, notes: "Terminal corregida", comments: [{ ...details.comments[0]!, body: "Gracias" }], translation: "translated" });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it("shows GitHub and installed version, notifies about a newer version and opens the existing drawer with translated notes/comments", async () => {
  await act(async () => root.render(createElement(CommunityActivity, props)));
  const button = container.querySelector("button")!;
  expect(button.textContent).toContain("v2.0.3"); expect(button.querySelector(".ti-brand-github")).not.toBeNull();
  expect(button.querySelector("[data-release-notification]")?.textContent).toContain(labels.community.newBadge); expect(translateReleaseDetails).not.toHaveBeenCalled();
  await act(async () => button.click());
  expect(container.querySelector("dialog[open]")).not.toBeNull(); expect(container.textContent).toContain("Terminal corregida"); expect(container.textContent).toContain("Gracias");
  const original = Array.from(container.querySelectorAll("button")).find(button => button.textContent === labels.community.showOriginal)!;
  await act(async () => original.click()); expect(container.textContent).toContain("Fixed terminal");
  expect(button.querySelector("[data-release-notification]")).not.toBeNull();
  expect(props.onInstall).not.toHaveBeenCalled();
});
it("shows the recorded installation and the Spanish nuevo badge without replacing the version with the latest release", async () => {
  await act(async () => root.render(createElement(CommunityActivity, { ...props, labels: spanish.community, status: { ...status, installed: { tag: "v2.0.2" } } })));
  const button = container.querySelector("button")!;
  expect(button.querySelector(".font-mono")?.textContent).toBe("v2.0.2");
  expect(button.querySelector("[data-release-notification]")?.firstChild?.textContent).toBe("nuevo");
  expect(button.getAttribute("aria-label")).toContain("v2.0.4");
});
it("keeps the installed version and exposes catalog errors without offering an unconfirmed update", async () => {
  await act(async () => root.render(createElement(CommunityActivity, { ...props, canInstall: true, status: { ...status, latest: null, releases: [], updateAvailable: false, error: "GitHub unavailable" } })));
  expect(container.querySelector("button .font-mono")?.textContent).toBe("v2.0.3");
  expect(container.querySelector("[data-release-notification]")).toBeNull();
  await act(async () => container.querySelector("button")!.click());
  expect(container.querySelector("dialog")?.textContent).toContain("GitHub unavailable");
  expect(props.onInstall).not.toHaveBeenCalled();
  expect(readReleaseDetails).not.toHaveBeenCalled();
});
it("does not flag the installed release as new, and renders GitHub HTML as text", async () => {
  vi.mocked(readReleaseDetails).mockResolvedValue({ ...details, notes: '<img src=x onerror="alert(1)">' });
  vi.mocked(translateReleaseDetails).mockRejectedValue(new Error("No provider"));
  await act(async () => root.render(createElement(CommunityActivity, { ...props, status: { ...status, updateAvailable: false } })));
  expect(container.querySelector("[data-release-notification]")).toBeNull();
  await act(async () => container.querySelector("button")!.click());
  expect(container.querySelector("img")).toBeNull(); expect(container.textContent).toContain('<img src=x'); expect(container.textContent).toContain(labels.community.translationUnavailable);
});
it("discards late translations when the selected server changes", async () => {
  let finish!: (value: typeof details) => void;
  vi.mocked(translateReleaseDetails).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(createElement(CommunityActivity, props)));
  await act(async () => container.querySelector("button")!.click());
  await act(async () => window.dispatchEvent(new Event("luxipanel:target-changed")));
  await act(async () => finish({ ...details, notes: "Stale translation" }));
  expect(container.querySelector("dialog[open]")).toBeNull(); expect(container.textContent).not.toContain("Stale translation");
});

it("selects versions from the header and keeps notes, comments and activity scoped to that release", async () => {
  const recent = { ...details, discussionUrl: "https://github.com/Luxisoft/LUXIPANEL/issues/4" };
  const previous = { ...details, tag: "v2.0.3", name: "Previous release", notes: "Previous notes", discussionUrl: "https://github.com/Luxisoft/LUXIPANEL/issues/3", comments: [{ ...details.comments[0]!, body: "Previous comment" }] };
  vi.mocked(readReleaseDetails).mockImplementation(async tag => tag === previous.tag ? previous : recent);
  vi.mocked(api.get).mockResolvedValue({ ok: true, data: { unread: 2, items: [
    { id: "recent", url: recent.discussionUrl, title: "Recent activity", author: "user", updatedAt: "2026-10-14", read: false },
    { id: "previous", url: `${previous.discussionUrl}#issuecomment-3`, title: "Previous activity", author: "user", updatedAt: "2026-10-14", read: false },
  ] } });
  await act(async () => root.render(createElement(CommunityActivity, { ...props, locale: "en", status: { ...status, releases: [recent, previous] } })));
  expect(readReleaseDetails).not.toHaveBeenCalled();
  await act(async () => container.querySelector("button")!.click());
  const select = container.querySelector<HTMLSelectElement>("dialog > header select")!;
  expect(select).not.toBeNull();
  expect(container.querySelector("dialog > div select")).toBeNull();
  expect(container.querySelector("dialog")?.textContent).toContain("Recent activity");
  expect(container.querySelector("dialog")?.textContent).not.toContain("Previous notes");
  await act(async () => { select.value = previous.tag; select.dispatchEvent(new Event("change", { bubbles: true })); });
  const text = container.querySelector("dialog")!.textContent;
  expect(text).toContain("Previous notes"); expect(text).toContain("Previous comment"); expect(text).toContain("Previous activity");
  expect(text).not.toContain("Fixed terminal"); expect(text).not.toContain("Thanks"); expect(text).not.toContain("Recent activity");
  expect(readReleaseDetails).toHaveBeenCalledTimes(2);
  expect(props.onInstall).not.toHaveBeenCalled();
});

it("ignores a late release response after selecting another version", async () => {
  let finish!: (value: typeof details) => void;
  vi.mocked(readReleaseDetails).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const previous = { ...details, tag: "v2.0.3", notes: "Selected release notes", comments: [] };
  vi.mocked(readReleaseDetails).mockResolvedValue(previous);
  await act(async () => root.render(createElement(CommunityActivity, { ...props, locale: "en", status: { ...status, releases: [details, previous] } })));
  await act(async () => container.querySelector("button")!.click());
  const select = container.querySelector<HTMLSelectElement>("header select")!;
  await act(async () => { select.value = previous.tag; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await act(async () => finish({ ...details, notes: "Late unselected notes" }));
  expect(container.querySelector("dialog")?.textContent).toContain("Selected release notes");
  expect(container.querySelector("dialog")?.textContent).not.toContain("Late unselected notes");
  expect(container.querySelector("dialog")?.textContent).not.toContain("Thanks");
});

it("refreshes comments while the selected release drawer stays open", async () => {
  vi.useFakeTimers();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  try {
    vi.mocked(readReleaseDetails).mockResolvedValueOnce({ ...details, comments: [] });
    await act(async () => root.render(createElement(CommunityActivity, { ...props, locale: "en" })));
    await act(async () => container.querySelector("button")!.click());
    expect(container.querySelector("dialog")?.textContent).not.toContain("Thanks");
    await act(async () => { await vi.advanceTimersByTimeAsync(180000); });
    expect(container.querySelector("dialog")?.textContent).toContain("Thanks");
    expect(readReleaseDetails).toHaveBeenCalledTimes(2);
    expect(readReleaseDetails).toHaveBeenLastCalledWith(details.tag);
    await act(async () => container.querySelector("dialog")!.close());
    await act(async () => { await vi.advanceTimersByTimeAsync(180000); });
    expect(readReleaseDetails).toHaveBeenCalledTimes(2);
    expect(props.onInstall).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});

it("explains a translation balance failure while keeping the original comments visible", async () => {
  vi.mocked(translateReleaseDetails).mockResolvedValue({ ...details, translation: "unavailable", translationReason: "insufficient_balance" });
  await act(async () => root.render(createElement(CommunityActivity, { ...props, labels: spanish.community })));
  await act(async () => container.querySelector("button")!.click());
  expect(container.querySelector("dialog")?.textContent).toContain(spanish.community.translationInsufficientBalance);
  expect(container.querySelector("dialog")?.textContent).toContain("Thanks");
});

it("places accessible tabs in the header and keeps contributors visible without refetching on tab changes", async () => {
  vi.mocked(readProjectContributors).mockResolvedValue({ items: [{ login: "contributor", url: "https://github.com/contributor", avatarUrl: "", contributions: 5 }], unavailable: false });
  await act(async () => root.render(createElement(CommunityActivity, props)));
  expect(readProjectContributors).not.toHaveBeenCalled();
  await act(async () => container.querySelector("button")!.click());
  const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('dialog > header [role="tab"]'));
  expect(tabs).toHaveLength(3);
  expect(container.querySelector("dialog > header")?.textContent).not.toContain(labels.community.title);
  const footer = container.querySelector("dialog > footer")!;
  expect(footer.textContent).toContain("@contributor");
  expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
  await act(async () => tabs[1]!.click());
  expect(container.querySelector('[role="tabpanel"]:not([hidden])')?.textContent).toContain("Gracias");
  expect(footer.closest('[hidden]')).toBeNull();
  await act(async () => tabs[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  expect(tabs[2]!.getAttribute("aria-selected")).toBe("true"); expect(document.activeElement).toBe(tabs[2]);
  await act(async () => tabs[2]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
  expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
  expect(readProjectContributors).toHaveBeenCalledTimes(1); expect(readReleaseDetails).toHaveBeenCalledTimes(1);
  expect(props.onInstall).not.toHaveBeenCalled();
});
it("isolates contributor failures and late contributor responses across target changes", async () => {
  let finish!: (value: { items: { login: string; url: string; avatarUrl: string; contributions: number }[]; unavailable: boolean }) => void;
  vi.mocked(readProjectContributors).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(createElement(CommunityActivity, props)));
  await act(async () => container.querySelector("button")!.click());
  await act(async () => window.dispatchEvent(new Event("luxipanel:target-changed")));
  await act(async () => finish({ items: [{ login: "old-target", url: "https://github.com/old-target", avatarUrl: "", contributions: 1 }], unavailable: false }));
  expect(container.textContent).not.toContain("old-target");
  vi.mocked(readProjectContributors).mockRejectedValue(new Error("unavailable"));
  await act(async () => container.querySelector("button")!.click());
  expect(container.querySelector("footer")?.textContent).toContain(labels.community.contributorsUnavailable);
  expect(container.querySelector('[role="tabpanel"]:not([hidden])')?.textContent).toContain("Terminal corregida");
});
