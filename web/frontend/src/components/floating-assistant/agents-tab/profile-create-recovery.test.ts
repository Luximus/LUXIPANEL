// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAgentsTab, type AgentsTabVM } from "./use-agents-tab";
import { AgentEditor } from "./AgentEditor";
import { AgentRequestError } from "../assistant-api/agents";
import type { AssistantAgent } from "../assistant-api";

const m = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), done: vi.fn(), scope: "a", session: "test-session" }));
vi.mock("@/lib/api-client", async original => ({
  ...await original<Record<string, unknown>>(),
  resolveTargetScope: () => m.scope,
  scopeHeaders: () => ({ "X-Bridge-Session-Id": m.session, "X-CSRF-Token": `test-csrf-${m.session}` }),
}));
vi.mock("../use-module-catalog", () => ({ useModuleCatalog: () => undefined }));
vi.mock("../assistant-api", async original => ({
  ...await original<Record<string, unknown>>(),
  assistantAgentsApi: { list: m.list, create: m.create, update: m.update },
  assistantAgentRolesApi: { list: async () => [] }, assistantAgentTeamsApi: { list: async () => [] },
  assistantProjectsApi: { list: async () => [] }, fetchAssociatableConnections: async () => [],
  fetchTerminalSnippetFilterOptions: async () => ({ ok: false }),
}));
let root: Root, host: HTMLDivElement, identity: HTMLAnchorElement, vm: AgentsTabVM, records: AssistantAgent[];
const persisted = {
  id: "persisted-id", name: "Revisor", providerId: "claude", model: "", description: "", systemPrompt: "", allowedTools: null,
  capabilities: { canEditProfile: true },
} as AssistantAgent;

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); sessionStorage.clear(); m.scope = crypto.randomUUID(); m.session = crypto.randomUUID(); records = [];
  m.list.mockImplementation(async () => records); m.update.mockResolvedValue(persisted);
  m.create.mockImplementation(async () => {
    records.push({ ...persisted, id: records.length ? "duplicate-id" : "persisted-id" });
    throw new AgentRequestError(0, undefined, "lost response");
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, items: [] }), { headers: { "Content-Type": "application/json" } })));
  identity = document.createElement("a"); identity.id = "messenger-link"; identity.dataset.me = crypto.randomUUID(); document.body.append(identity);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); identity.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
function Probe() {
  vm = useAgentsTab({ editorOnly: true, onLaunchAgent: () => {}, onEditorDone: m.done });
  return createElement(AgentEditor, { vm });
}
async function mount() {
  await act(async () => root.render(createElement(Probe)));
  await act(async () => vm.setDraft(d => d ? { ...d, name: "Revisor" } : d));
}
async function close() { await act(async () => root.render(null)); }
function changeScope(axis: "user" | "session" | "target") {
  if (axis === "user") {
    const previous = identity.dataset.me;
    identity.dataset.me = crypto.randomUUID();
    return () => { identity.dataset.me = previous; };
  }
  if (axis === "session") {
    const previous = m.session; m.session = crypto.randomUUID();
    return () => { m.session = previous; };
  }
  const previous = m.scope; m.scope = crypto.randomUUID();
  return () => { m.scope = previous; };
}

it("does not repeat a creation whose response was lost after persistence", async () => {
  await mount(); await act(async () => vm.save()); await act(async () => vm.save());
  expect(m.create).toHaveBeenCalledTimes(1); expect(records).toHaveLength(1);
  expect(host.textContent).toContain("No se pudo confirmar"); expect(vm.draft?.name).toBe("Revisor");
  expect(m.done).not.toHaveBeenCalled();
});
it("recovers by explicitly choosing the persisted id, never by a matching name", async () => {
  await mount(); await act(async () => vm.save()); records.push({ ...persisted, id: "same-name" });
  await act(async () => vm.reload()); expect(vm.draft?.id).toBeUndefined();
  const select = host.querySelector<HTMLSelectElement>("[data-profile-recovery]")!;
  expect(select).not.toBeNull(); expect(select.value).toBe("");
  await act(async () => { select.value = "persisted-id"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(vm.draft?.id).toBe("persisted-id"); expect(m.done).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
  await act(async () => vm.save());
  expect(m.create).toHaveBeenCalledTimes(1); expect(m.update).toHaveBeenCalledWith("persisted-id", expect.any(Object));
  expect(records).toHaveLength(2); expect(m.done).toHaveBeenCalledTimes(1);
});
it("keeps an unresolved creation blocked after closing and reopening its editor", async () => {
  await mount(); await act(async () => vm.save()); await close(); await mount(); await act(async () => vm.save());
  expect(m.create).toHaveBeenCalledTimes(1); expect(vm.creationUncertain).toBe(true);
});
it("allows correcting a definitively rejected creation", async () => {
  m.create.mockRejectedValueOnce(new AgentRequestError(400, "VALIDATION_ERROR", "invalid"));
  await mount(); await act(async () => vm.save()); await act(async () => vm.save());
  expect(m.create).toHaveBeenCalledTimes(2);
});

it.each(["empty", "failed", "matching-name"] as const)("keeps uncertainty after a %s review GET", async result => {
  await mount(); await act(async () => vm.save());
  if (result === "failed") m.list.mockRejectedValueOnce(new Error("catalog unavailable"));
  else m.list.mockResolvedValueOnce(result === "empty" ? [] : [{ ...persisted, id: "unrelated-same-name" }]);
  await act(async () => vm.reload()); await act(async () => vm.save());
  expect(vm.creationUncertain).toBe(true); expect(vm.draft?.id).toBeUndefined();
  expect(host.textContent).toContain("No se pudo confirmar"); expect(m.create).toHaveBeenCalledTimes(1);
  expect(m.update).not.toHaveBeenCalled(); expect(m.done).not.toHaveBeenCalled();
});
it.each(["empty", "failed", "wrong-id", "forbidden"] as const)("requires an authorized exact id when recovery GET is %s", async result => {
  await mount(); await act(async () => vm.save());
  if (result === "failed") m.list.mockRejectedValueOnce(new Error("catalog unavailable"));
  else m.list.mockResolvedValueOnce(result === "empty" ? [] : [{
    ...persisted, id: result === "wrong-id" ? "unrelated-same-name" : "persisted-id",
    capabilities: { canEditProfile: result !== "forbidden" },
  }]);
  await act(async () => vm.recoverProfile("persisted-id")); await act(async () => vm.save());
  expect(vm.creationUncertain).toBe(true); expect(vm.draft?.id).toBeUndefined();
  expect(m.create).toHaveBeenCalledTimes(1); expect(m.update).not.toHaveBeenCalled(); expect(m.done).not.toHaveBeenCalled();
});
it.each(["user", "session", "target"] as const)("does not expose or clear another %s's unresolved creation", async axis => {
  await mount(); await act(async () => vm.save()); await close();
  const restore = changeScope(axis); await mount();
  expect(vm.creationUncertain).toBe(false); expect(host.querySelector("[data-profile-recovery]")).toBeNull();
  m.create.mockResolvedValueOnce({ ...persisted, id: "other-scope" });
  await act(async () => vm.save()); expect(m.create).toHaveBeenCalledTimes(2);
  await close(); restore(); await mount(); await act(async () => vm.save());
  expect(vm.creationUncertain).toBe(true); expect(m.create).toHaveBeenCalledTimes(2);
});
it.each(["user", "session", "target"] as const)("discards recovery GET after a %s change without releasing the old latch", async axis => {
  await mount(); await act(async () => vm.save());
  const pending = deferred<AssistantAgent[]>(); m.list.mockReturnValueOnce(pending.promise);
  let recovery!: Promise<void>;
  await act(async () => { recovery = vm.recoverProfile("persisted-id"); });
  const restore = changeScope(axis);
  await act(async () => { pending.resolve([persisted]); await recovery; });
  expect(vm.draft?.id).toBeUndefined(); expect(vm.creationUncertain).toBe(true); expect(m.done).not.toHaveBeenCalled();
  await close(); restore(); await mount(); await act(async () => vm.save());
  expect(m.create).toHaveBeenCalledTimes(1); expect(vm.creationUncertain).toBe(true);
});
it.each(["user", "session", "target"] as const)("keeps a late uncertain POST in its original %s scope", async axis => {
  await mount(); const pending = deferred<AssistantAgent>(); m.create.mockReturnValueOnce(pending.promise);
  let saving!: Promise<void>;
  await act(async () => { saving = vm.save(); }); expect(m.create).toHaveBeenCalledTimes(1);
  await close(); const restore = changeScope(axis); await mount();
  await act(async () => { pending.reject(new AgentRequestError(0, undefined, "lost response")); await saving; });
  expect(vm.creationUncertain).toBe(false); expect(vm.draft?.name).toBe("Revisor"); expect(m.done).not.toHaveBeenCalled();
  await close(); restore(); await mount(); await act(async () => vm.save());
  expect(vm.creationUncertain).toBe(true); expect(m.create).toHaveBeenCalledTimes(1);
});
it("never stores session headers or form data in its safety marker", async () => {
  await mount(); await act(async () => vm.setDraft(d => d ? { ...d, description: "private draft instructions" } : d));
  await act(async () => vm.save());
  const stored = JSON.stringify(Object.entries(sessionStorage));
  expect(stored).not.toContain(m.session); expect(stored).not.toContain("private draft instructions");
  expect(m.create).toHaveBeenCalledTimes(1);
});
