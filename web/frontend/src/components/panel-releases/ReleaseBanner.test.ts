import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/api-client", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/lib/panel-releases", async importOriginal => ({ ...await importOriginal<object>(), readPanelReleasePreflight: vi.fn(), readPanelBranch: vi.fn(), installPanelBranch: vi.fn(), readPanelReleases: vi.fn(), installPanelRelease: vi.fn(), readReleaseDetails: vi.fn(), translateReleaseDetails: vi.fn() }));
import ReleaseBanner from "./ReleaseBanner";
import labels from "@/i18n/es/panelLayout";
import { api } from "@/lib/api-client";
import { readPanelReleasePreflight, readPanelBranch, installPanelBranch, installPanelRelease, readPanelReleases, readReleaseDetails, translateReleaseDetails, type PanelReleaseStatus } from "@/lib/panel-releases";

let root: Root; let container: HTMLDivElement;
const latest = { tag: "v2.0.4", name: "Release", notes: "Fixes", publishedAt: null };
const status: PanelReleaseStatus = { comparisonKnown: true, installed: { tag: "v2.0.3" }, currentVersion: "v2.0.3", latest, releases: [latest, { ...latest, tag: "v2.0.3" }], updateAvailable: true, operation: null, previous: null, canInstall: true };
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
  vi.mocked(api.get).mockResolvedValue({ ok: true, status: 200, data: { items: [], unread: 0 } });
  vi.mocked(readPanelReleases).mockResolvedValue(status);
  vi.mocked(readPanelReleasePreflight).mockResolvedValue({ ok: true });
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

const branch = { name: "developer", commit: "a".repeat(40), ahead: 3, updateAvailable: true };
const branchDetails = { ...branch, installable: true, notes: [{ id: branch.commit + ":0", title: "Selector de agentes", changes: ["Elige al miembro del equipo desde el chat."], date: "2026-10-16" }], commits: [{ sha: branch.commit, message: "chore: cambios del asistente internal-task", author: "Luximus", date: "2026-10-16", url: "" }] };
const branchButton = () => Array.from(container.querySelectorAll<HTMLButtonElement>("dialog button")).find(button => button.textContent === labels.community.branchUpdate.replace("{branch}", "developer") || button.textContent === labels.community.updating);
async function selectBranch(name = "developer") {
  const select = container.querySelector<HTMLSelectElement>(`select[aria-label="${labels.community.branches}"]`)!;
  await act(async () => { select.value = name; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
it("opens branch changes without installing and pins an explicit update to the displayed SHA", async () => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch] });
  vi.mocked(readPanelBranch).mockResolvedValue(branchDetails);
  let finish!: () => void;
  vi.mocked(installPanelBranch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await render(); await open(); await selectBranch();
  expect(container.textContent).toContain("Selector de agentes"); expect(installPanelBranch).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Elige al miembro del equipo desde el chat.");
  expect(container.textContent).not.toContain("chore:"); expect(container.textContent).not.toContain("internal-task");
  const link = container.querySelector<HTMLAnchorElement>(".lxp-branch-note a")!;
  expect(link.textContent).toBe(branch.commit.slice(0, 8));
  expect(link.href).toBe("https://github.com/Luxisoft/LUXIPANEL/commit/" + branch.commit);
  expect(link.target).toBe("_blank"); expect(link.rel).toBe("noopener noreferrer");
  expect(link.getAttribute("aria-label")).toContain(labels.community.openGithub);
  const button = branchButton()!;
  await act(async () => { button.click(); button.click(); });
  expect(installPanelBranch).toHaveBeenCalledExactlyOnceWith("developer", branch.commit);
  await act(async () => finish()); expect(branchButton()?.disabled).toBe(true);
  expect(installPanelRelease).not.toHaveBeenCalled();
});
it.each([false, true])("does not install an unsupported branch or allow a reader: reader=%s", async reader => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch] });
  vi.mocked(readPanelBranch).mockResolvedValue({ ...branchDetails, installable: reader });
  await render(!reader); await open(); await selectBranch();
  expect(branchButton()).toBeUndefined(); expect(installPanelBranch).not.toHaveBeenCalled();
});
it("keeps green release and yellow developer badges and explains their meaning", async () => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch] });
  await render(); await open();
  expect((container.querySelector("[data-release-notification]") as HTMLElement).style.backgroundColor).toMatch(/#15803d|rgb\(21, 128, 61\)/);
  expect((container.querySelector('[data-branch-notification="developer"]') as HTMLElement).style.backgroundColor).toMatch(/#eab308|rgb\(234, 179, 8\)/);
  const help = container.querySelector("details")!; await act(async () => help.querySelector("summary")!.click());
  expect(help.open).toBe(true); expect(help.textContent).toContain(labels.community.releaseColorHelp);
  expect(help.textContent).toContain(labels.community.branchColorHelp.replace("{branch}", "developer"));
});
it("opens the notified branch from its deep link without triggering an update", async () => {
  window.history.replaceState({}, "", "/panel?updates=developer");
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch] });
  vi.mocked(readPanelBranch).mockResolvedValue(branchDetails);
  await render();
  expect(container.querySelector("dialog[open]")).not.toBeNull(); expect(container.textContent).toContain("Selector de agentes");
  expect(installPanelBranch).not.toHaveBeenCalled(); expect(window.location.search).toBe("");
});
it("ignores a branch response after choosing a different branch", async () => {
  const other = { ...branch, name: "web", commit: "b".repeat(40) };
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch, other] });
  let finish!: (value: typeof branchDetails) => void;
  vi.mocked(readPanelBranch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ...other, installable: true, commits: [] });
  await render(); await open(); await selectBranch(); await selectBranch("web");
  await act(async () => finish(branchDetails));
  expect(container.textContent).not.toContain("Selector de agentes"); expect(installPanelBranch).not.toHaveBeenCalled();
});

it("selects the notified branch on the current page without navigation or installation", async () => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch] });
  vi.mocked(readPanelBranch).mockResolvedValue(branchDetails);
  await render();
  const before = window.location.href;
  const detail = { branch: "developer", __ack: false };
  await act(async () => window.dispatchEvent(new CustomEvent("luxipanel:releases-open", { detail })));
  expect(detail.__ack).toBe(true); expect(window.location.href).toBe(before);
  expect(container.querySelector("dialog[open]")).not.toBeNull();
  expect((container.querySelector(`select[aria-label="${labels.community.branches}"]`) as HTMLSelectElement).value).toBe("developer");
  expect(container.textContent).toContain("Selector de agentes"); expect(installPanelBranch).not.toHaveBeenCalled();
});

it("shows an honest empty state when notes are missing and keeps technical messages hidden", async () => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch] });
  vi.mocked(readPanelBranch).mockResolvedValue({ ...branchDetails, notes: [], notesIncomplete: true });
  await render(); await open(); await selectBranch();
  expect(container.textContent).toContain(labels.community.branchNotesUnavailable);
  expect(container.textContent).not.toContain("internal-task");
  expect(container.textContent).not.toContain(branch.commit.slice(0, 8));
});

it("does not create a GitHub link from an invalid note revision", async () => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch] });
  vi.mocked(readPanelBranch).mockResolvedValue({ ...branchDetails, notes: [{ ...branchDetails.notes[0]!, id: "javascript:alert(1)" }] });
  await render(); await open(); await selectBranch();
  expect(container.querySelector(".lxp-branch-note")?.textContent).toContain("Selector de agentes");
  expect(container.querySelector(".lxp-branch-note a")).toBeNull();
});

it.each(["branch", "release"])("keeps a blocked %s update visible above long notes and allows retry after the blocker is resolved", async kind => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch] });
  vi.mocked(readPanelBranch).mockResolvedValue(branchDetails);
  vi.mocked(readPanelReleasePreflight).mockResolvedValue({ ok: false });
  await render(); await open();
  if (kind === "branch") await selectBranch();
  const button = kind === "branch" ? branchButton()! : installButton()!;
  await act(async () => button.click());
  expect(installPanelBranch).not.toHaveBeenCalled(); expect(installPanelRelease).not.toHaveBeenCalled();
  const alert = container.querySelector('dialog > [role="alert"]')!;
  expect(alert.textContent).toBe(labels.community.localChangesBlocked);
  expect(container.querySelector(".lxp-community-content")!.contains(alert)).toBe(false);
  expect(button.disabled).toBe(false);
  vi.mocked(readPanelReleasePreflight).mockResolvedValue({ ok: true });
  await act(async () => button.click());
  expect(kind === "branch" ? installPanelBranch : installPanelRelease).toHaveBeenCalledTimes(1);
  expect(container.querySelector('dialog > [role="alert"]')).toBeNull();
});

it("does not install after a preflight failure and shows its error above the notes", async () => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch] });
  vi.mocked(readPanelBranch).mockResolvedValue(branchDetails);
  vi.mocked(readPanelReleasePreflight).mockRejectedValue(new Error("No se pudo comprobar la instalación."));
  await render(); await open(); await selectBranch();
  await act(async () => branchButton()!.click());
  expect(installPanelBranch).not.toHaveBeenCalled();
  expect(container.querySelector('dialog > [role="alert"]')?.textContent).toBe("No se pudo comprobar la instalación.");
});

it("discards a completed preflight if the selected server changed", async () => {
  let finish!: (value: { ok: boolean }) => void;
  vi.mocked(readPanelReleasePreflight).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch] });
  vi.mocked(readPanelBranch).mockResolvedValue(branchDetails);
  await render(); await open(); await selectBranch();
  await act(async () => branchButton()!.click());
  await act(async () => window.dispatchEvent(new Event("luxipanel:target-changed")));
  await act(async () => finish({ ok: true }));
  expect(installPanelBranch).not.toHaveBeenCalled();
  expect(container.querySelector("dialog[open]")).toBeNull();
});

it.each([
  { comparisonKnown: true, updateAvailable: false, ahead: 0 },
  { comparisonKnown: true, updateAvailable: true, ahead: 0 },
  { comparisonKnown: false, updateAvailable: true, ahead: 3 },
  { comparisonKnown: undefined, updateAvailable: true, ahead: 3 },
])("does not offer an update without verified new changes: %j", async selection => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, comparisonKnown: selection.comparisonKnown, branches: [{ ...branch, ...selection }] });
  vi.mocked(readPanelBranch).mockResolvedValue(branchDetails);
  await render(); await open(); await selectBranch();
  expect(branchButton()).toBeUndefined();
  expect(installPanelBranch).not.toHaveBeenCalled();
});
it("never offers old main as an update from developer", async () => {
  const main = { ...branch, name: "main", ahead: 0, updateAvailable: false };
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, installed: { branch: "developer", commit: "b".repeat(40) }, branches: [main] });
  vi.mocked(readPanelBranch).mockResolvedValue({ ...branchDetails, ...main });
  await render(); await open(); await selectBranch("main");
  expect(container.querySelector(".lxp-branch-version-row button")).toBeNull();
  expect(container.textContent).toContain(labels.community.noBranchChanges);
  expect(installPanelBranch).not.toHaveBeenCalled();
});
it("removes the update action when a refreshed comparison has no pending changes", async () => {
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [branch] });
  vi.mocked(readPanelBranch).mockResolvedValue(branchDetails);
  await render(); await open(); await selectBranch();
  expect(branchButton()).toBeDefined();
  vi.mocked(readPanelReleases).mockResolvedValue({ ...status, branches: [{ ...branch, ahead: 0, updateAvailable: false }] });
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(branchButton()).toBeUndefined();
  expect(installPanelBranch).not.toHaveBeenCalled();
});
