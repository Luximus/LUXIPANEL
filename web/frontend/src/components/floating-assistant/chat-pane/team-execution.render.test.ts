// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatMain } from "./ChatMain";
import { TurnView } from "./turn-view";
import type { ChatPaneVM } from "./use-chat-pane";
import { TeamTaskBoard } from "../TeamTaskBoard";
import { teamApi, type AssistantAgent, type TeamTaskView } from "../assistant-api";
import { chatEngine, type ChatTurn } from "../chat-engine";
import { useAssistantI18n } from "../i18n";
import { bubblePrefs } from "../bubble-prefs";
import { openConfirm } from "@/lib/confirm";
import { groupTeamNotices, isTeamNotice } from "./team-execution";
import { historyTurn } from "../chat-engine/history";
import { applyEvent } from "../chat-engine/stream-apply";
import { chats } from "../chat-engine/state";
import type { AgentEvent, ConversationMessage } from "../assistant-api";

const scope = vi.hoisted(() => {
  // Some imported services preload data; isolate those requests before imports.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, tasks: [], items: [] }), { headers: { "Content-Type": "application/json" } })));
  return { value: "target-a" };
});
vi.mock("@/lib/api-client", async original => ({
  ...await original<Record<string, unknown>>(),
  resolveTargetScope: () => scope.value,
}));
vi.mock("@/lib/confirm", () => ({ openConfirm: vi.fn(async () => true) }));
vi.mock("@/lib/assistant-ws", async original => ({
  ...await original<Record<string, unknown>>(),
  connectAssistantWs: vi.fn(),
}));
// Keep the production terminal renderer and use installed xterm packages in place
// of the CDN transport. No React component is mocked.
vi.mock("https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/+esm", async () => import("@xterm/xterm"));
vi.mock("https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/+esm", async () => import("@xterm/addon-fit"));

const agent = { id: "agent", name: "Sofía", providerId: "codex" } as AssistantAgent;
const task = (overrides: Partial<TeamTaskView> = {}): TeamTaskView => ({
  id: "task-1", title: "Revisar interfaz", status: "running",
  workerAgentId: "worker", workerAgentName: "Ana", workerConversationId: "worker-chat",
  createdAt: "2026-10-16T10:00:00Z", ...overrides,
});
const user: ChatTurn = { role: "user", text: "Petición humana conservada", tools: [] };
const notice: ChatTurn = { role: "user", text: "Aviso generado conservado", tools: [], auto: true };
const reply = (cli: boolean, history: boolean): ChatTurn => ({
  role: "assistant", text: history ? "Respuesta final conservada" : "", pending: !history,
  ...(cli ? { cli: true } : {}),
  tools: cli
    ? history ? [] : [
      { id: "cli", name: "codex.cli", input: {}, terminal: "Registro de ejecución" },
      { id: "nested", name: "team.assign", input: {}, result: { success: true, output: "Salida anidada no duplicada" } },
    ]
    : [
      { id: "read", name: "files.read", input: {}, result: { success: true, output: "Lectura conservada" } },
      { id: "assign", name: "team.assign", input: {}, ...(history ? { result: { success: true, output: "Resultado de asignación" } } : {}) },
    ],
  ...(cli && history ? { cliHistoryLog: "Registro guardado" } : {}),
});

let host: HTMLDivElement;
let root: Root;
const openChat = vi.fn();
const send = vi.fn(async () => {});
const approvalModeChange = vi.fn(async () => true);

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  scope.value = "target-a";
  // happy-dom has no CSS/layout; prevent an unrelated CDN stylesheet request.
  if (!document.getElementById("xterm-css-cdn")) {
    const style = document.createElement("style"); style.id = "xterm-css-cdn"; document.head.append(style);
  }
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, tasks: [], items: [] }), { headers: { "Content-Type": "application/json" } })));
  vi.spyOn(teamApi, "getSummary").mockResolvedValue(null);
  vi.spyOn(teamApi, "listFeedback").mockResolvedValue([]);
  vi.spyOn(teamApi, "cancelTask").mockResolvedValue(null);
  vi.spyOn(chatEngine, "refreshTeamTasks").mockResolvedValue(undefined);
  vi.spyOn(chatEngine, "respondPermission").mockResolvedValue(undefined);
  openChat.mockClear(); send.mockClear(); approvalModeChange.mockClear();
  vi.mocked(openConfirm).mockClear();
  bubblePrefs.set("codex", { terminalLive: true });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

type Thread = {
  mode: "api" | "cli";
  turns: ChatTurn[];
  tasks?: TeamTaskView[];
  byTurn?: Map<number, TeamTaskView[]>;
  agent?: AssistantAgent | null;
  chatKey?: string;
};
function ThreadView({ mode, turns, tasks = [], byTurn = new Map(), agent: currentAgent = null, chatKey = "leader" }: Thread) {
  const { chatTab: ct } = useAssistantI18n();
  const vm = {
    active: false, activeId: chatKey, chatKey, provider: "codex", mode, uiMode: "advanced",
    turns, streaming: turns.some(t => t.pending), chatLoading: false,
    ct, projects: [], projectTeamAgents: [], rolesById: new Map(),
    currentAgent, headerAgent: currentAgent, currentProjectId: null,
    draft: "", attachments: [], queued: [], modelOptions: [], quickStartSuggestions: [],
    visibleProviderOptions: [{ id: "codex" }], selectedModel: "", selectedEffort: "Auto",
    chatTokens: { total: 0, assistantTurns: 0 }, support: { enabled: false },
    contentRef: { current: null }, scrollerRef: { current: null }, textareaRef: { current: null },
    teamBoardGroups: { byTurn, unanchored: tasks },
    renderTeamBoard: (items: TeamTaskView[], key: string, embedded: boolean) => items.length
      ? createElement(TeamTaskBoard, { key, conversationId: chatKey, tasks: items, onOpenChat: openChat, embedded })
      : null,
    send, newConversation: vi.fn(), openConversation: openChat,
    onApprovalModeChange: approvalModeChange,
    setDraft: vi.fn(), setEditorPath: vi.fn(), setSelectedModel: vi.fn(), setSelectedEffort: vi.fn(),
  } as unknown as ChatPaneVM;
  return createElement(ChatMain, { vm, attachmentImages: new Map() });
}
async function renderThread(thread: Thread) {
  await act(async () => root.render(createElement(ThreadView, thread)));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}
// happy-dom has no layout engine. Evaluate native <details> visibility instead
// of treating hidden DOM text as a visible answer or relying on source strings.
function visibleText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node instanceof HTMLDetailsElement && !node.open) {
    return node.querySelector(":scope > summary")?.textContent ?? "";
  }
  if (node instanceof HTMLElement && (node.hidden || node.getAttribute("aria-hidden") === "true")) return "";
  return Array.from(node.childNodes).map(visibleText).join(" ").replace(/\s+/g, " ");
}
function boardDisclosure() {
  const boards = host.querySelectorAll('[data-testid="team-task-board"]');
  expect(boards).toHaveLength(1);
  const details = boards[0]!.closest("details");
  expect(details).not.toBeNull();
  expect(details!.closest('[data-message-section="console"]')).not.toBeNull();
  return details!;
}
async function toggle(details: HTMLDetailsElement) {
  await act(async () => details.querySelector("summary")!.click());
}

it.each([false, true])("updates one bubble across automatic phases and preserves the full execution history: cli=%s", async cli => {
  const first: ChatTurn = { ...reply(cli, true), text: "Avance de la primera fase", completionPending: true };
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, first] });
  const bubble = host.querySelector("[data-assistant-message]");
  const second = { ...reply(cli, false), text: "", permission: { id: "permission", tool: "files.write", title: "Autorizar cambio" } };
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, first, notice, second],
    byTurn: new Map([[1, [task({ id: "one", title: "Fase inicial", status: "done" })]], [3, [task({ id: "two", title: "Fase actual" })]]]),
  });
  expect(host.querySelectorAll("[data-assistant-message]")).toHaveLength(1);
  expect(host.querySelector("[data-assistant-message]")).toBe(bubble);
  expect(host.querySelectorAll("[data-execution-phase]")).toHaveLength(1);
  expect(visibleText(host)).not.toContain("Avance de la primera fase");
  expect(visibleText(host)).toContain("Autorizar cambio");
  expect(host.querySelectorAll('[data-testid="team-task-board"]')).toHaveLength(1);
  await act(async () => button("Aprobar").click());
  expect(chatEngine.respondPermission).toHaveBeenCalledWith("leader", "permission", "allow", "files.write");
  const details = boardDisclosure();
  await toggle(details);
  expect(visibleText(host)).toContain("Avance de la primera fase");
  expect(visibleText(host)).toContain("Fase inicial");
  expect(visibleText(host)).toContain("Fase actual");
  const last: ChatTurn = { ...reply(cli, true), text: "Resultado consolidado" };
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, first, notice, { ...second, pending: false, permission: undefined }, notice, last] });
  expect(host.querySelectorAll("[data-assistant-message]")).toHaveLength(1);
  expect(host.querySelector("[data-assistant-message]")).toBe(bubble);
  expect(host.querySelectorAll("[data-execution-phase]")).toHaveLength(2);
  expect(host.querySelectorAll("[data-team-notice]")).toHaveLength(2);
  expect(host.querySelector('[data-message-section="answer"]')?.textContent).toContain("Resultado consolidado");
  await act(async () => button("Reintentar").click());
  expect(send).toHaveBeenCalledWith(user.text);
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, first, notice, last, { ...user, text: "Otra petición" }, reply(cli, true)] });
  expect(host.querySelectorAll("[data-assistant-message]")).toHaveLength(2);
});

it("keeps a failure visible on the single current bubble and earlier failures in history", async () => {
  await renderThread({ mode: "api", turns: [user, { role: "assistant", text: "", tools: [], error: "Fallo de la primera fase" }, notice,
    { role: "assistant", text: "", tools: [], error: "No se pudo completar la tarea" }] });
  expect(host.querySelectorAll("[data-assistant-message]")).toHaveLength(1);
  expect(visibleText(host)).toContain("No se pudo completar la tarea");
  expect(visibleText(host)).not.toContain("Fallo de la primera fase");
  const history = host.querySelector<HTMLDetailsElement>('[data-message-section="console"] > details')!;
  await toggle(history);
  expect(visibleText(host)).toContain("Fallo de la primera fase");
});
function button(label: string) {
  const result = [...host.querySelectorAll<HTMLButtonElement>("button")].find(el => el.title === label || el.textContent?.trim() === label);
  expect(result, label).toBeTruthy();
  return result!;
}

describe.each([false, true])("normal/agent chat: agent=%s", withAgent => {
  it.each([
    { cli: false, history: false }, { cli: true, history: false },
    { cli: false, history: true }, { cli: true, history: true },
  ])("places the board and generated notices once inside closed execution details: %j", async ({ cli, history }) => {
    const response = reply(cli, history);
    await renderThread({ mode: cli ? "cli" : "api", turns: [user, notice, response], tasks: [task({ status: history ? "done" : "running" })], agent: withAgent ? agent : null });
    const details = boardDisclosure();
    expect(details.open).toBe(false);
    expect(host.querySelectorAll("[data-team-notice]")).toHaveLength(1);
    expect(host.querySelector("[data-team-notice]")!.closest("details")).toBe(details);
    expect(visibleText(host)).toContain(user.text);
    expect(visibleText(host)).not.toContain(task().title);
    expect(visibleText(host)).not.toContain(notice.text);
    if (history) expect(visibleText(host)).toContain(response.text);
    expect(details.querySelector("summary")!.textContent).toContain("Consola del servidor");
    if (!cli) expect(visibleText(host)).not.toContain("team.assign");
    if (cli) expect(host.textContent).not.toContain("Salida anidada no duplicada");
    await toggle(details);
    expect(details.open).toBe(true);
    expect(visibleText(host)).toContain(task().title);
    expect(visibleText(host)).toContain(notice.text);
    await act(async () => button("Abrir chat").click());
    expect(openChat).toHaveBeenCalledWith("worker-chat");
    if (!history) {
      await act(async () => button("Cancelar tarea").click());
      expect(openConfirm).toHaveBeenCalledOnce();
      expect(teamApi.cancelTask).toHaveBeenCalledWith("task-1");
      expect(chatEngine.refreshTeamTasks).toHaveBeenCalledWith("leader");
    }
    await toggle(details);
    expect(details.open).toBe(false);
    expect(visibleText(host)).not.toContain(task().title);
  });

  it.each([false, true])("adds no team surface to an ordinary API/CLI conversation: cli=%s", async cli => {
    await renderThread({ mode: cli ? "cli" : "api", turns: [user, reply(cli, true)], agent: withAgent ? agent : null });
    expect(host.querySelector('[data-testid="team-task-board"]')).toBeNull();
    expect(host.querySelector("[data-team-notice]")).toBeNull();
    expect(visibleText(host)).toContain(user.text);
    expect(visibleText(host)).toContain("Respuesta final conservada");
    expect([...host.querySelectorAll("details")].every(details => !details.open)).toBe(true);
  });
});

it.each([null, agent])("keeps API activity compact and streamed process text inside its details: %j", async currentAgent => {
  const response = { ...reply(false, false), text: "Reviso el estado del proyecto.\n\nAhora compruebo los cambios." };
  const saved = JSON.stringify(response);
  await renderThread({ mode: "api", turns: [user, response], agent: currentAgent });
  const consoleSection = host.querySelector('[data-message-section="console"]')!;
  const group = consoleSection.querySelector<HTMLDetailsElement>(':scope > details')!;
  expect(group.dataset.executionSource).toBe("API");
  expect(consoleSection.querySelectorAll(':scope > details')).toHaveLength(1);
  expect(group.open).toBe(false);
  const activity = host.querySelector('[data-message-section="reasoning"]')!;
  expect([...activity.querySelectorAll(".thought-line__step-text")].map(el => el.textContent)).toEqual(["files.read", "team.assign"]);
  expect(activity.querySelector('[data-entry-id="read"]')?.getAttribute("data-status")).toBe("done");
  expect(activity.querySelector('[data-entry-id="assign"]')?.getAttribute("data-status")).toBe("running");
  expect(activity.textContent).not.toContain("Reviso el estado");
  expect(host.querySelector('[data-message-section="answer"]')).toBeNull();
  expect(group.querySelector("[data-api-progress]")?.textContent).toContain("Reviso el estado");
  expect(visibleText(host)).not.toContain("Reviso el estado");
  expect(visibleText(host)).not.toContain("files.read");
  expect(visibleText(host)).not.toContain("team.assign");
  const activityToggle = activity.querySelector<HTMLButtonElement>("button")!;
  expect(activityToggle.getAttribute("aria-expanded")).toBe("false");
  await act(async () => activityToggle.click());
  expect(visibleText(host)).toContain("files.read");
  expect(visibleText(host)).not.toContain("Lectura conservada");
  await toggle(group);
  expect(visibleText(host)).toContain("files.read");
  const tool = [...group.querySelectorAll('details')].find(el => el.querySelector('summary')?.textContent?.includes("files.read"))!;
  await toggle(tool);
  expect(visibleText(host)).toContain("Lectura conservada");
  await renderThread({ mode: "api", turns: [user, { ...response, text: response.text + "\n\nValidación en curso." }], agent: currentAgent });
  expect(group.open).toBe(true);
  expect(tool.open).toBe(true);
  await toggle(group);
  await renderThread({ mode: "api", turns: [user, { ...response, pending: false, text: "Comprobación terminada con resultado conservado." }], agent: currentAgent });
  expect(group.open).toBe(false);
  expect(host.querySelector('[data-message-section="answer"]')?.textContent).toContain("Comprobación terminada con resultado conservado.");
  expect(visibleText(host)).toContain("files.read");
  expect(activity.querySelector('[data-entry-id="assign"]')?.getAttribute("data-status")).toBe("unconfirmed");
  expect(group.querySelector("summary")?.textContent).toContain("Resultado no confirmado");
  expect(JSON.stringify(response)).toBe(saved);
});

it.each([{ stopped: true }, { error: "Fallo que requiere atención" }, { interrupted: true }])("keeps partial API text readable outside the closed console after an interrupted run: %j", async state => {
  const response = { ...reply(false, false), text: "Resultado parcial conservado.", ...state };
  await renderThread({ mode: "api", turns: [user, response], agent });
  expect(host.querySelector('[data-message-section="answer"]')?.textContent).toContain(response.text);
  expect(host.querySelector<HTMLDetailsElement>('[data-execution-source="API"]')?.open).toBe(false);
});

it("keeps a failed API call in the history after the execution returns its final answer", async () => {
  const response = { ...reply(false, true), tools: [{ id: "failed-tool", name: "files.read", input: {}, result: { success: false, output: "El archivo solicitado no existe" } }] };
  await renderThread({ mode: "api", turns: [user, response], agent });
  const group = host.querySelector<HTMLDetailsElement>('[data-execution-source="API"]')!;
  expect(group.open).toBe(false);
  expect(group.querySelector('summary')?.textContent).toContain("Ver historial");
  await toggle(group);
  await toggle(group.querySelector('details')!);
  expect(visibleText(host)).toContain("El archivo solicitado no existe");
});

it("keeps ordinary API text and honors background display for active tool runs", async () => {
  const text = "Respuesta de texto conservada.";
  await renderThread({ mode: "api", turns: [user, { role: "assistant", text, tools: [], pending: true }], agent });
  expect(host.querySelector('[data-message-section="answer"]')?.textContent).toContain(text);
  await act(async () => bubblePrefs.set("codex", { terminalLive: false }));
  await renderThread({ mode: "api", turns: [user, { ...reply(false, false), text }], agent });
  expect(host.querySelector('[data-message-section="answer"]')).toBeNull();
  expect(visibleText(host)).not.toContain(text);
  expect(host.querySelector("[data-api-progress]")?.textContent).toContain(text);
  expect(host.querySelector<HTMLDetailsElement>('[data-execution-source="API"]')?.open).toBe(false);
});

it("merges anchored and live tasks into one board without duplicating either task", async () => {
  await renderThread({ mode: "api",
    turns: [user, reply(false, false)],
    byTurn: new Map([[1, [task({ id: "finished", title: "Tarea anterior", status: "done" })]]]),
    tasks: [task({ id: "new", title: "Tarea actual" })],
  });
  const details = boardDisclosure();
  expect(host.textContent!.match(/Tarea anterior/g)).toHaveLength(1);
  expect(host.textContent!.match(/Tarea actual/g)).toHaveLength(1);
  expect(details.open).toBe(false);
});

it.each([false, true])("keeps tasks before any reply, through streaming and history: cli=%s", async cli => {
  const tasks = [task()];
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, notice], tasks });
  expect(boardDisclosure().open).toBe(false);
  expect(visibleText(host)).not.toContain(notice.text);
  const pending: ChatTurn = { role: "assistant", text: "", tools: [], pending: true };
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, notice, pending], tasks });
  expect(boardDisclosure().open).toBe(false);
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, notice, reply(cli, false)], tasks });
  const live = boardDisclosure();
  await toggle(live);
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, notice, { ...reply(cli, false), text: "Respuesta parcial" }], tasks });
  expect(boardDisclosure()).toBe(live);
  expect(live.open).toBe(true);
  expect(visibleText(host)).toContain("Respuesta parcial");
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, notice, reply(cli, true)], tasks: [task({ status: "done" })] });
  boardDisclosure();
  expect(visibleText(host)).toContain("Respuesta final conservada");
  expect(host.querySelectorAll("[data-team-notice]")).toHaveLength(1);
});

it("keeps the team reachable when live terminal display is disabled", async () => {
  bubblePrefs.set("codex", { terminalLive: false });
  await renderThread({ mode: "cli", turns: [user, reply(true, false)], tasks: [task()] });
  const details = boardDisclosure();
  expect(details.open).toBe(false);
  expect(details.querySelector("summary")!.textContent).toContain("Ver historial");
  await toggle(details);
  expect(visibleText(host)).toContain(task().title);
});

it.each([false, true])("keeps failures and pending task approvals visible in the closed summary: cli=%s", async cli => {
  const failed = task({ id: "failed", status: "failed", error: "Falló la comprobación solicitada" });
  const waiting = task({ id: "waiting", pendingPermission: true });
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, { ...reply(cli, true), error: "Error del turno conservado" }], tasks: [failed, waiting] });
  const details = boardDisclosure();
  expect(details.open).toBe(false);
  expect(visibleText(host)).toContain(failed.error);
  expect(visibleText(host)).toContain("Esperando tu aprobación");
  expect(visibleText(host)).toContain("Error del turno conservado");
  expect(host.querySelector("[data-team-attention]")!.closest("summary")).toBe(details.querySelector("summary"));
});

it.each([false, true])("leaves permission and plan approval buttons visible after a trailing notice: cli=%s", async cli => {
  const permission = { id: "approval", title: "Acción que requiere permiso", tool: "files.write", detail: "Detalle original" };
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, { ...reply(cli, false), permission }, notice], tasks: [task()] });
  expect(boardDisclosure().open).toBe(false);
  expect(visibleText(host)).toContain(permission.title);
  expect(button("Aprobar").closest("details")).toBeNull();
  await act(async () => button("Aprobar").click());
  expect(chatEngine.respondPermission).toHaveBeenCalledWith("leader", "approval", "allow", "files.write");
  await renderThread({ mode: cli ? "cli" : "api",
    chatKey: "plan",
    turns: [user, { ...reply(cli, true), askKind: "plan-approval", ask: [{ id: "plan", type: "single", text: "¿Apruebas este plan?", options: ["Aprobar plan", "Pedir cambios"] }] }, notice],
    tasks: [task()],
  });
  expect(button("Aprobar plan").closest("details")).toBeNull();
  await act(async () => button("Aprobar plan").click());
  expect(approvalModeChange).toHaveBeenCalledWith("auto");
  expect(send).toHaveBeenCalled();
});

it.each((["api", "cli"] as const).flatMap(mode =>
  (["chat", "server"] as const).map(change => ({ mode, change })),
))("isolates expanded content and callbacks: mode=$mode change=$change", async ({ mode, change }) => {
  const cli = mode === "cli";
  const permission = { id: "old-approval", title: "Permiso del contexto anterior", tool: "files.write", detail: "Anterior" };
  await renderThread({ mode, turns: [user, notice, { ...reply(cli, false), permission }], tasks: [task()] });
  const previous = boardDisclosure();
  const oldApproval = button("Aprobar");
  await toggle(previous);
  if (change === "server") scope.value = "target-b";
  const nextTask = task({ id: "next", title: "Tarea del nuevo contexto", workerConversationId: "next-worker" });
  await renderThread({ mode, chatKey: change === "chat" ? "other-chat" : "leader", turns: [user, reply(cli, false)], tasks: [nextTask] });
  const next = boardDisclosure();
  expect(next).not.toBe(previous);
  expect(oldApproval.isConnected).toBe(false);
  expect(host.textContent).not.toContain(permission.title);
  await act(async () => oldApproval.click());
  expect(chatEngine.respondPermission).not.toHaveBeenCalled();
  expect(next.open).toBe(false);
  expect(host.textContent).not.toContain(notice.text);
  expect(host.textContent).not.toContain(task().title);
  await toggle(next);
  await act(async () => button("Abrir chat").click());
  expect(openChat).toHaveBeenLastCalledWith("next-worker");
  await act(async () => button("Cancelar tarea").click());
  expect(teamApi.cancelTask).toHaveBeenCalledExactlyOnceWith("next");
  expect(chatEngine.refreshTeamTasks).toHaveBeenCalledExactlyOnceWith(change === "chat" ? "other-chat" : "leader");
  const nextPermission = { ...permission, id: "next-approval", title: "Permiso del nuevo contexto" };
  await renderThread({ mode, chatKey: change === "chat" ? "other-chat" : "leader", turns: [user, { ...reply(cli, false), permission: nextPermission }], tasks: [nextTask] });
  await act(async () => button("Aprobar").click());
  expect(chatEngine.respondPermission).toHaveBeenCalledExactlyOnceWith(change === "chat" ? "other-chat" : "leader", "next-approval", "allow", "files.write");
});

it("folds only generated coordination text and never mutates history", () => {
  const human = { ...user, text: notice.text };
  const assistant = { ...reply(false, true), auto: true };
  const failed = { ...notice, error: "Error que debe permanecer visible" };
  const turns = [human, notice, assistant, failed, { ...notice, text: "Aviso final" }];
  const saved = JSON.stringify(turns);
  const groups = groupTeamNotices(turns);
  expect(groups.byTurn.get(2)?.map(t => t.text)).toEqual([notice.text, "Aviso final"]);
  expect(groups.unanchored).toEqual([]);
  expect(isTeamNotice(human)).toBe(false);
  expect(isTeamNotice(assistant)).toBe(false);
  expect(isTeamNotice(failed)).toBe(false);
  expect(groups.lastVisibleTurnIndex).toBe(3);
  expect(JSON.stringify(turns)).toBe(saved);
});

it("preserves a human message that happens to repeat the generated notice", async () => {
  await renderThread({ mode: "api", turns: [{ ...user, text: notice.text }, notice, reply(false, true)] });
  expect(visibleText(host)).toContain(notice.text);
  expect(host.querySelectorAll("[data-team-notice]")).toHaveLength(1);
  expect(host.textContent!.match(/Aviso generado conservado/g)).toHaveLength(2);
});

it("preserves assistant responses even if they carry the automatic flag", async () => {
  await act(async () => root.render(createElement(TurnView, {
    turn: { role: "assistant", text: "Respuesta del asistente", tools: [], auto: true }, provider: "codex",
  })));
  expect(visibleText(host)).toContain("Respuesta del asistente");
  expect(host.querySelector("[data-team-notice]")).toBeNull();
});

it.each([false, true])("retains historical tasks when the tool trace/log is absent: cli=%s", async cli => {
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, notice, { role: "assistant", text: "Respuesta guardada", tools: [], cli }], tasks: [task({ status: "done" })] });
  const details = boardDisclosure();
  expect(details.open).toBe(false);
  expect(visibleText(host)).toContain("Respuesta guardada");
  await toggle(details);
  expect(visibleText(host)).toContain(task().title);
  expect(visibleText(host)).toContain(notice.text);
});

it("keeps a verification failure visible even when the task completed", async () => {
  await renderThread({ mode: "api", turns: [user, reply(false, true)], tasks: [task({ status: "done", verify: { state: "failed", attempts: 2 } })] });
  expect(boardDisclosure().open).toBe(false);
  expect(visibleText(host)).toContain("Verificación falló (2)");
});

it("retains a lone generated notice until any reply or task exists", async () => {
  await renderThread({ mode: "api", turns: [notice] });
  expect(host.querySelector('[data-testid="team-task-board"]')).toBeNull();
  const content = host.querySelector("[data-team-notice]")!;
  const details = content.closest("details")!;
  expect(details.open).toBe(false);
  expect(visibleText(host)).not.toContain(notice.text);
  await toggle(details);
  expect(visibleText(host)).toContain(notice.text);
  await renderThread({ mode: "api", turns: [notice, reply(false, true)] });
  expect(host.querySelectorAll("[data-team-notice]")).toHaveLength(1);
  expect(host.querySelectorAll('[data-message-section="console"]')).toHaveLength(1);
});

it("keeps confirmed API calls collapsed under Listo and the full trace behind one history control", async () => {
  const response: ChatTurn = {
    role: "assistant", text: "Respuesta final intacta.\n\nSegundo párrafo conservado.", tools: [
      { id: "plan", name: "team.plan", input: { title: "Dato original del plan" }, result: { success: true, output: "Plan original completo" } },
      { id: "assign-one", name: "team.assign", input: { agentId: "worker-one" }, result: { success: true, output: "Asignación uno confirmada" } },
      { id: "assign-two", name: "team.assign", input: { agentId: "worker-two" }, result: { success: true, output: "Asignación dos confirmada" } },
      { id: "collect", name: "team.collect", input: {}, result: { success: true, output: "Resultado completo recogido" } },
    ],
  };
  await renderThread({ mode: "api", turns: [user, response] });
  const activity = host.querySelector('[data-message-section="reasoning"]')!;
  const header = activity.querySelector<HTMLButtonElement>("button")!;
  const entries = [...activity.querySelectorAll<HTMLElement>("[data-entry-id]")];
  expect(entries.map(entry => [entry.dataset.entryId, entry.querySelector(".thought-line__step-text")?.textContent, entry.dataset.status]))
    .toEqual([["plan", "team.plan", "done"], ["assign-one", "team.assign", "done"], ["assign-two", "team.assign", "done"], ["collect", "team.collect", "done"]]);
  expect(activity.querySelector(".thought-line__text[data-active]")?.textContent).toBe("Listo");
  expect(header.getAttribute("aria-expanded")).toBe("false");
  expect(visibleText(activity)).not.toContain("team.plan");
  await act(async () => header.click());
  expect(header.getAttribute("aria-expanded")).toBe("true");
  header.focus();
  expect(document.activeElement).toBe(header);
  expect(document.getElementById(header.getAttribute("aria-controls")!)).toBe(activity.querySelector(".thought-line__trace"));
  expect(visibleText(activity)).not.toContain("Dato original del plan");
  expect(visibleText(activity)).not.toContain("Respuesta final");
  const consoleSection = host.querySelector('[data-message-section="console"]')!;
  const history = consoleSection.querySelector<HTMLDetailsElement>(":scope > details")!;
  expect(consoleSection.querySelectorAll(":scope > details")).toHaveLength(1);
  expect(history.open).toBe(false);
  const summary = history.querySelector<HTMLElement>("summary")!;
  expect(summary.textContent).toContain("API");
  expect(summary.textContent).toContain("Consola del servidor");
  expect(summary.textContent).toContain("Ver historial");
  expect(summary.textContent).not.toContain("CLI");
  expect(summary.getAttribute("aria-expanded")).toBe("false");
  expect(visibleText(host)).not.toContain("Plan original completo");
  await toggle(history);
  expect(summary.getAttribute("aria-expanded")).toBe("true");
  await toggle(history.querySelector("details")!);
  expect(visibleText(host)).toContain("Dato original del plan");
  expect(visibleText(host)).toContain("Plan original completo");
  await toggle(history);
  expect(summary.getAttribute("aria-expanded")).toBe("false");
  expect(visibleText(host)).not.toContain("Plan original completo");
  await act(async () => header.click());
  expect(header.getAttribute("aria-expanded")).toBe("false");
  await act(async () => header.click());
  expect(header.getAttribute("aria-expanded")).toBe("true");
  const answer = host.querySelector('[data-message-section="answer"]')!;
  expect(answer.querySelector("[data-visible-summary]")).toBeNull();
  expect([...answer.querySelectorAll("p")].map(el => el.textContent)).toEqual(response.text.split("\n\n"));
});

it.each([
  { name: "confirmed", pending: false, result: { success: true, output: "Salida completa" }, expected: "done", label: "Ver historial" },
  { name: "failure while streaming", pending: true, result: { success: false, output: "Fallo de la llamada" }, expected: "failed", label: "ejecutando" },
  { name: "failure at rest", pending: false, result: { success: false, output: "Fallo de la llamada" }, expected: "failed", label: "Error" },
  { name: "final answer after recovery", pending: false, result: { success: false, output: "Fallo conservado" }, expected: "failed", label: "Ver historial" },
  { name: "running", pending: true, expected: "running", label: "ejecutando" },
  { name: "no result at rest", pending: false, expected: "unconfirmed", label: "Resultado no confirmado" },
  { name: "interrupted", pending: true, interrupted: true, expected: "unconfirmed", label: "Resultado no confirmado" },
  { name: "stopped without result", pending: false, stopped: true, expected: "unconfirmed", label: "detenido" },
  { name: "turn error without result", pending: false, error: "Fallo del turno", expected: "unconfirmed", label: "Error" },
  { name: "permission", pending: true, permission: { id: "permission", tool: "files.write", title: "Permiso conservado" }, expected: "waiting", label: "En espera" },
  { name: "question", pending: true, ask: [{ id: "question", type: "text" as const, text: "Pregunta conservada" }], expected: "waiting", label: "En espera" },
])("shows the actual API state with history closed: $name", async scenario => {
  const response: ChatTurn = {
    role: "assistant", text: scenario.name === "failure at rest" ? "" : "Texto conservado", pending: scenario.pending,
    interrupted: scenario.interrupted, stopped: scenario.stopped, error: scenario.error,
    permission: scenario.permission, ask: scenario.ask,
    tools: [{ id: "actual-call", name: "files.write", input: { path: "example.txt" }, result: scenario.result }],
  };
  await renderThread({ mode: "api", turns: [user, response] });
  const activity = host.querySelector('[data-message-section="reasoning"]')!;
  const entry = activity.querySelector('[data-entry-id="actual-call"]')!;
  expect(entry.getAttribute("data-status")).toBe(scenario.expected);
  expect(entry.querySelector("svg")).not.toBeNull();
  expect(visibleText(activity)).not.toContain("files.write");
  await act(async () => activity.querySelector<HTMLButtonElement>("button")!.click());
  expect(visibleText(activity)).toContain("files.write");
  const history = host.querySelector<HTMLDetailsElement>('[data-execution-source="API"]')!;
  expect(history.open).toBe(false);
  expect(history.querySelector("summary")?.textContent).toContain(scenario.label);
  // Collapsing the compact list must still leave warnings in the console bar.
  await act(async () => activity.querySelector<HTMLButtonElement>("button")!.click());
  expect(visibleText(host)).toContain(scenario.label);
  if (scenario.permission) expect(visibleText(host)).toContain(scenario.permission.title);
  if (scenario.ask) expect(visibleText(host)).toContain(scenario.ask[0]!.text);
  await toggle(history);
  const tool = history.querySelector<HTMLDetailsElement>("details")!;
  expect(tool.querySelector("summary")?.textContent).toContain(
    scenario.expected === "unconfirmed" ? "Resultado no confirmado"
      : scenario.expected === "waiting" ? "En espera" : "files.write",
  );
  await toggle(tool);
  expect(visibleText(host)).toContain("example.txt");
  if (scenario.result) expect(visibleText(host)).toContain(scenario.result.output);
});

it("does not treat a successful assignment as completion of the worker", async () => {
  const response: ChatTurn = { role: "assistant", text: "Asignación enviada", tools: [
    { id: "assign", name: "team.assign", input: {}, result: { success: true, output: "Asignación confirmada" } },
  ] };
  await renderThread({ mode: "api", turns: [user, notice, response], tasks: [task()] });
  const activity = host.querySelector('[data-message-section="reasoning"]')!;
  expect(activity.querySelector('[data-entry-id="assign"]')?.getAttribute("data-status")).toBe("done");
  expect(activity.querySelector(".thought-line__text[data-active]")?.textContent).toContain("ejecutando");
  const history = boardDisclosure();
  expect(history.querySelector("summary")?.textContent).toContain("ejecutando");
  await toggle(history);
  expect(visibleText(host)).toContain(task().title);
  expect(host.querySelectorAll("[data-team-notice]")).toHaveLength(1);
  await renderThread({ mode: "api", turns: [user, notice, response], tasks: [task({ status: "done" })] });
  expect(boardDisclosure()).toBe(history);
  expect(history.open).toBe(true);
  expect(activity.querySelector(".thought-line__text[data-active]")?.textContent).toBe("Listo");
});

it("does not reconstruct API calls from historical answer paragraphs", async () => {
  const response: ChatTurn = { role: "assistant", text: "team.plan\n\nteam.assign\n\nRespuesta guardada", tools: [] };
  await renderThread({ mode: "api", turns: [user, response] });
  expect(host.querySelector("[data-entry-id]")).toBeNull();
  expect(host.querySelector('[data-execution-source="API"]')).toBeNull();
  const answer = host.querySelector('[data-message-section="answer"]')!;
  expect(answer.querySelector("[data-visible-summary]")).toBeNull();
  expect([...answer.querySelectorAll("p")].map(el => el.textContent)).toEqual(response.text.split("\n\n"));
});

it("separates observed API narration from the final answer and copy action", async () => {
  const narration = "Voy a revisar el archivo.\n\n";
  const answer = "Archivo revisado.\n\nNo quedan cambios pendientes.";
  const response: ChatTurn = { ...reply(false, true), text: narration + answer, apiTextOffset: narration.length };
  const saved = JSON.stringify(response);
  await renderThread({ mode: "api", turns: [user, response] });
  const bubble = host.querySelector('[data-message-section="answer"]')!;
  expect(bubble.querySelector("[data-visible-summary]")).toBeNull();
  expect([...bubble.querySelectorAll("p")].map(el => el.textContent)).toEqual(answer.split("\n\n"));
  expect(visibleText(host)).not.toContain(narration.trim());
  const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  const copy = [...bubble.querySelectorAll<HTMLButtonElement>("button")].find(el => el.textContent?.trim() === "Copiar")!;
  await act(async () => copy.click());
  expect(clipboard).toHaveBeenCalledWith(answer);
  const history = host.querySelector<HTMLDetailsElement>('[data-execution-source="API"]')!;
  await toggle(history);
  expect(visibleText(history)).toContain(narration.trim());
  expect(history.querySelector("[data-api-progress]")?.textContent).not.toContain(answer);
  expect(JSON.stringify(response)).toBe(saved);
});

it("keeps manual activity expansion through permission, progress and completion", async () => {
  const response = reply(false, false);
  await renderThread({ mode: "api", turns: [user, response] });
  const header = host.querySelector<HTMLButtonElement>(".thought-line__head")!;
  expect(header.getAttribute("aria-expanded")).toBe("false");
  await act(async () => header.click());
  const permission = { id: "approval", tool: "files.write", title: "Permiso original" };
  await renderThread({ mode: "api", turns: [user, { ...response, permission }] });
  expect(header.getAttribute("aria-expanded")).toBe("true");
  await act(async () => header.click());
  await renderThread({ mode: "api", turns: [user, response] });
  expect(header.getAttribute("aria-expanded")).toBe("false");
  await renderThread({ mode: "api", turns: [user, reply(false, true)] });
  expect(header.getAttribute("aria-expanded")).toBe("false");
});

it.each([false, true])("never marks a pending, canceled or verifying historical worker as done: cli=%s", async cli => {
  // happy-dom has no Web Animations API; exercise the reduced-motion path.
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation(query => {
    const media = matchMedia(query);
    if (query === "(prefers-reduced-motion: reduce)") Object.defineProperty(media, "matches", { value: true });
    return media;
  });
  const response: ChatTurn = { role: "assistant", text: "Respuesta guardada", tools: [], cli,
    ...(cli ? { cliHistoryLog: "Registro guardado" } : {}) };
  for (const [worker, label] of [
    [task({ status: "pending" }), "En espera"],
    [task({ status: "canceled" }), "detenido"],
    [task({ status: "done", verify: { state: "running", attempts: 1 } }), "ejecutando"],
    [task({ status: "failed" }), "Error"],
  ] as const) {
    await renderThread({ mode: cli ? "cli" : "api", turns: [user, response], tasks: [worker] });
    const summary = boardDisclosure().querySelector("summary")!;
    expect(summary.textContent).toContain(label);
    expect(summary.textContent).not.toContain("Listo");
    expect(host.querySelector('[role="img"][aria-label^="' + label + '"]')).not.toBeNull();
  }
});

it("reports an absent final API answer without promoting narration to completion", async () => {
  const text = "Voy a comprobar los cambios.";
  const response: ChatTurn = { role: "assistant", text, apiTextOffset: text.length, tools: [
    { id: "read", name: "files.read", input: {}, result: { success: true, output: "Lectura completa" } },
  ] };
  await renderThread({ mode: "api", turns: [user, response] });
  expect(host.querySelector('[data-message-section="answer"]')?.textContent).toContain("sin una respuesta final");
  expect(visibleText(host)).toContain("Resultado no confirmado");
  expect(visibleText(host)).not.toContain(text);
  await toggle(host.querySelector<HTMLDetailsElement>('[data-execution-source="API"]')!);
  expect(visibleText(host)).toContain(text);
});

it("keeps a failed reloaded CLI console in error", async () => {
  const response: ChatTurn = { role: "assistant", text: "", tools: [], cli: true, error: "Fallo conservado", cliHistoryLog: "Registro del fallo" };
  await renderThread({ mode: "cli", turns: [user, response] });
  const history = host.querySelector<HTMLDetailsElement>('[data-message-section="console"] details')!;
  expect(history.querySelector("summary")?.textContent).toContain("Error");
  expect(history.open).toBe(false);
  await toggle(history);
  expect(visibleText(host)).toContain("Registro del fallo");
});

it("preserves ordered API details and final-only copy across SSE and history reload", async () => {
  const key = "api-history-render";
  const answer = "Respuesta final conservada.";
  const events: AgentEvent[] = [
    { type: "text", phase: "commentary", delta: "Primer avance conservado." },
    { type: "tool_use", id: "call-one", name: "files.read", input: { path: "first.txt" } },
    { type: "tool_result", id: "call-one", success: true, output: "Primera salida íntegra" },
    { type: "text", phase: "commentary", delta: "Segundo avance conservado." },
    { type: "tool_use", id: "call-two", name: "files.read", input: { path: "second.txt" } },
    { type: "tool_result", id: "call-two", success: true, output: "Segunda salida íntegra" },
    { type: "text", phase: "commentary", delta: "Avance posterior a la última llamada." },
    { type: "text", phase: "final_answer", delta: answer },
    { type: "done" },
  ];
  chats.set(key, { provider: "codex", conversationId: key, streaming: false,
    turns: [{ role: "assistant", text: "", pending: true, tools: [] }] });
  await act(async () => events.forEach((event, seq) => applyEvent(key, event, { isCli: false, startedAt: 0, seq })));
  const live = chats.get(key)!.turns[0]!;
  const message: ConversationMessage = JSON.parse(JSON.stringify({
    role: "assistant", content: answer, ts: "2026-10-17T00:00:00Z", apiActivity: live.apiActivity,
  }));
  const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  for (const response of [live, historyTurn(message)]) {
    await renderThread({ mode: "api", turns: [user, response] });
    const history = host.querySelector<HTMLDetailsElement>('[data-execution-source="API"]')!;
    expect(host.querySelectorAll('[data-message-section="console"] > details')).toHaveLength(1);
    expect(history.open).toBe(false);
    expect(visibleText(host)).not.toContain("avance");
    const bubble = host.querySelector('[data-message-section="answer"]')!;
    expect([...bubble.querySelectorAll("p")].map(p => p.textContent)).toEqual([answer]);
    const copy = bubble.querySelector<HTMLButtonElement>('button[title="Copiar"]')!;
    await act(async () => copy.click());
    expect(clipboard).toHaveBeenLastCalledWith(answer);
    await toggle(history);
    const blocks = [...history.querySelectorAll("[data-api-progress], details")];
    expect(blocks.map(block => block.matches("details") ? block.querySelector("summary")!.textContent : block.textContent))
      .toEqual(["Primer avance conservado.", expect.stringContaining("files.read"), "Segundo avance conservado.",
        expect.stringContaining("files.read"), "Avance posterior a la última llamada."]);
    const tools = history.querySelectorAll<HTMLDetailsElement>("details");
    for (const tool of tools) if (!tool.open) await toggle(tool);
    expect(visibleText(history)).toContain("Primera salida íntegra");
    expect(visibleText(history)).toContain("Segunda salida íntegra");
    expect(visibleText(history)).toContain("first.txt");
    expect(visibleText(history)).toContain("second.txt");
    expect(visibleText(history)).not.toContain(answer);
    await toggle(history);
  }
  chats.delete(key);
});

it.each([false, true])("renders a persisted pending outcome as waiting, without a fabricated final: cli=%s", async cli => {
  const response = historyTurn({
    role: "assistant", content: "", ts: "", pending: true,
    ...(cli ? { cli: true, cliLog: "$ codex\nTrabajo en curso." } : {
      apiActivity: { events: [{ type: "text", phase: "commentary", delta: "Trabajo en curso." }] },
    }),
  });
  await renderThread({ mode: cli ? "cli" : "api", turns: [user, response] });
  expect(host.querySelector('[role="img"][aria-label="En espera"]')).not.toBeNull();
  expect(host.querySelector('[data-message-section="answer"]')).toBeNull();
  expect(host.querySelectorAll('[data-message-section="console"] > details')).toHaveLength(1);
  const history = host.querySelector<HTMLDetailsElement>('[data-message-section="console"] details')!;
  expect(history.querySelector("summary")!.textContent).toContain("En espera");
  expect(visibleText(host)).not.toContain("Trabajo en curso.");
  expect(visibleText(host)).not.toContain("Listo");
  await toggle(history);
  expect(visibleText(history)).toContain("Trabajo en curso.");
});

it("keeps truncated and orphaned historical API details reachable, without duplicating the team board", async () => {
  const response = historyTurn({ role: "assistant", content: "", ts: "", error: "Fallo que requiere revisión",
    apiActivity: { truncated: true, events: [
      { type: "text", phase: "commentary", delta: "Avance guardado." },
      { type: "tool_result", id: "orphan", success: false, output: "Salida histórica sin llamada" },
    ] },
  });
  await renderThread({ mode: "api", turns: [user, response], tasks: [task({ status: "failed" })] });
  const history = boardDisclosure();
  expect(host.querySelectorAll('[data-message-section="console"] > details')).toHaveLength(1);
  expect(visibleText(host)).toContain("Error");
  expect(visibleText(host)).not.toContain("Salida histórica");
  await toggle(history);
  expect(visibleText(history)).toContain("Salida histórica sin llamada");
  expect(history.querySelector("[data-api-truncated]")?.textContent).toBe("Parte del detalle no se conservó por el límite del historial.");
  expect(history.querySelector("[data-api-result]")?.textContent).toContain("Error");
});

it.each([false, true])("shows a bounded preview only for explicitly authorized summary presentation: cli=%s", async cli => {
  const content = "Revisión completada. Falta desplegar.\n\n" + "Evidencia completa y restricciones conservadas. ".repeat(100);
  for (const selected of [null, agent]) {
    const response = historyTurn({ role: "assistant", content, ts: "", cli, presentation: "summary" });
    const canonicalContent = response.text;
    await renderThread({ mode: cli ? "cli" : "api", turns: [user, response], agent: selected });
    const preview = host.querySelector<HTMLElement>('[data-visible-summary]')!;
    expect(preview.textContent).toBe("Revisión completada. Falta desplegar.");
    expect(visibleText(host)).not.toContain("Evidencia completa");
    const detail = host.querySelector<HTMLDetailsElement>('[data-compact-answer] > details')!;
    if (!detail.open) await toggle(detail);
    expect(detail.textContent).toContain("Evidencia completa y restricciones conservadas.");
    expect(response.text).toBe(canonicalContent);
    await toggle(detail);
  }
});

it("keeps internal JSON hidden in the team preview and uses the same persisted summary after reconnect", async () => {
  const content = JSON.stringify({ protocol: "lxp.agent.v1", kind: "result", summary: "Servicio verificado.", data: { check: "HTTP 200" } });
  const response = historyTurn({ role: "assistant", content: "Servicio verificado.\n\nDetalle extenso.", displaySummary: "Servicio verificado.", presentation: "summary", ts: "" });
  await renderThread({ mode: "api", turns: [user, { role: "user", auto: true, text: content, tools: [] }, response] });
  expect(host.querySelector('[data-message-section="answer"] [data-visible-summary]')?.textContent).toBe("Servicio verificado.");
  expect(visibleText(host)).not.toContain("lxp.agent.v1");
  expect(visibleText(host)).not.toContain("HTTP 200");
});

it.each([0, 1, 3, 4, 27])("keeps one task list with three initial rows and an accessible remainder: %s tasks", async count => {
  const tasks = Array.from({ length: count }, (_, index) => task({
    id: `task-${index}`, title: `Tarea ${index + 1}`, workerAgentId: `worker-${index}`,
    status: "done",
  }));
  await renderThread({ mode: "api", turns: [user, reply(false, true)], tasks });
  if (!count) {
    expect(host.querySelector('[data-testid="team-task-board"]')).toBeNull();
    return;
  }
  const history = boardDisclosure();
  await toggle(history);
  const board = host.querySelector<HTMLElement>('[data-testid="team-task-board"]')!;
  expect(board.querySelectorAll("[data-team-task-id]")).toHaveLength(Math.min(3, count));
  expect(board.textContent).toContain(`${count} de ${count} tareas completadas`);
  const expand = board.querySelector<HTMLButtonElement>("[data-team-tasks-toggle]");
  if (count <= 3) { expect(expand).toBeNull(); return; }
  expect(expand!.textContent).toContain(`Ver más tareas (${count - 3})`);
  expect(expand!.getAttribute("aria-expanded")).toBe("false");
  expect(document.getElementById(expand!.getAttribute("aria-controls")!)).toBe(board.querySelector("ul"));
  expand!.focus();
  expect(document.activeElement).toBe(expand);
  await act(async () => expand!.click());
  expect(expand!.getAttribute("aria-expanded")).toBe("true");
  expect(board.querySelectorAll("[data-team-task-id]")).toHaveLength(count);
  await renderThread({ mode: "api", turns: [user, { ...reply(false, true), text: "Actualización final." }], tasks: JSON.parse(JSON.stringify(tasks)) });
  expect(host.querySelector('[data-testid="team-task-board"]')).toBe(board);
  expect(board.querySelectorAll("[data-team-task-id]")).toHaveLength(count);
  await act(async () => expand!.click());
  expect(expand!.getAttribute("aria-expanded")).toBe("false");
  expect(board.querySelectorAll("[data-team-task-id]")).toHaveLength(3);
  // A fresh mount/rehydrated history starts compact, without changing task identity.
  await act(async () => root.render(null));
  await renderThread({ mode: "api", turns: [user, historyTurn({ role: "assistant", content: "Actualización final.", ts: "" })], tasks });
  expect(host.querySelectorAll("[data-team-task-id]")).toHaveLength(3);
});

it.each([false, true])("retains a single open history through continuation, error and reload: cli=%s", async cli => {
  // happy-dom lacks Web Animations; keep the production reduced-motion path.
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation(query => {
    const media = matchMedia(query);
    if (query === "(prefers-reduced-motion: reduce)") Object.defineProperty(media, "matches", { value: true });
    return media;
  });
  const mode = cli ? "cli" : "api";
  const first = { ...reply(cli, true), completionPending: true, text: "Primera fase conservada." };
  await renderThread({ mode, turns: [user, first] });
  const history = host.querySelector<HTMLDetailsElement>("[data-execution-history]")!;
  await toggle(history);
  const final = { ...reply(cli, true), text: "", error: "Resultado no confirmado de la última fase." };
  await renderThread({ mode, turns: [user, first, notice, final] });
  expect(host.querySelectorAll("[data-execution-history]")).toHaveLength(1);
  expect(host.querySelector("[data-execution-history]")).toBe(history);
  expect(history.open).toBe(true);
  expect([...host.querySelectorAll("summary")].filter(el => el.textContent?.includes("Consola del servidor"))).toHaveLength(1);
  expect(visibleText(host)).toContain("Primera fase conservada.");
  expect(visibleText(host)).toContain(final.error);
  await toggle(history);
  expect(visibleText(host)).toContain(final.error);
  await renderThread({ mode, turns: JSON.parse(JSON.stringify([user, first, notice, final])) });
  expect(host.querySelectorAll("[data-execution-history]")).toHaveLength(1);
  expect(history.open).toBe(false);
});

it.each([false, true])("preserves the chosen console when a history refresh prepends older messages: cli=%s", async cli => {
  const mode = cli ? "cli" : "api";
  const request = { ...user, messageId: "current-request" };
  const first = { ...reply(cli, true), messageId: "current-answer", completionPending: true };
  await renderThread({ mode, turns: [request, first] });
  const history = host.querySelector<HTMLDetailsElement>("[data-execution-history]")!;
  await toggle(history);
  const older = [{ ...user, messageId: "older-request" }, { ...reply(cli, true), messageId: "older-answer" }];
  await renderThread({ mode, turns: JSON.parse(JSON.stringify([...older, request, first])) });
  const consoles = host.querySelectorAll<HTMLDetailsElement>("[data-execution-history]");
  expect(consoles).toHaveLength(2);
  expect(consoles[1]).toBe(history);
  expect(consoles[1]!.open).toBe(true);
  expect(consoles[0]!.open).toBe(false);
  await toggle(history);
  await renderThread({ mode, turns: [request, { ...first, text: "Otro avance del equipo." }, notice,
    { ...reply(cli, true), messageId: "next-phase", text: "La misma ejecución continúa." }] });
  expect(host.querySelector("[data-execution-history]")).toBe(history);
  expect(history.open).toBe(false);
});

it("keeps the attention of a hidden fourth task visible without opening the history", async () => {
  const tasks = Array.from({ length: 5 }, (_, index) => task({ id: `task-${index}`, title: `Tarea ${index}`, status: "done" }));
  tasks[3] = task({ id: "task-3", workerAgentName: "Agente con error", status: "failed", error: "No se confirmó la operación." });
  tasks[4] = task({ id: "task-4", workerAgentName: "Agente con permiso", status: "running", pendingPermission: true });
  await renderThread({ mode: "api", turns: [user, reply(false, true)], tasks });
  expect(boardDisclosure().open).toBe(false);
  expect(visibleText(host)).toContain("No se confirmó la operación.");
  expect(visibleText(host)).toContain("Esperando tu aprobación");
});

it("does not echo settled CLI narration above its final answer", async () => {
  const answer = "Validación completada.";
  await renderThread({ mode: "cli", turns: [user, {
    role: "assistant", text: answer, tools: [{
      id: "cli", name: "codex.cli", input: {}, terminal: "Primer avance.\n\n" + answer,
      result: { success: true, output: answer },
    }],
  }] });
  expect(host.querySelector('[data-message-section="reasoning"]')?.textContent).not.toContain(answer);
  expect(visibleText(host).split(answer)).toHaveLength(2);
  expect(host.querySelector('[data-compact-answer] details')).toBeNull();
});

it("replaces the preview when expanding full text and never changes the saved answer", async () => {
  const text = "Resumen único.\n\n" + "Detalle conservado. ".repeat(40);
  const response: ChatTurn = { role: "assistant", text, tools: [], presentation: "summary" };
  await renderThread({ mode: "api", turns: [user, response] });
  const container = host.querySelector<HTMLElement>("[data-compact-answer]")!;
  const detail = container.querySelector<HTMLDetailsElement>("details")!;
  expect(container.querySelector("[data-answer-detail]")).toBeNull();
  await toggle(detail);
  expect(container.querySelector("[data-visible-summary]")).toBeNull();
  expect(visibleText(container).split("Resumen único.")).toHaveLength(2);
  expect(container.querySelector("[data-answer-detail]")?.textContent).toContain("Detalle conservado.");
  expect(response.text).toBe(text);
  await toggle(detail);
  expect(container.querySelector("[data-visible-summary]")).not.toBeNull();
  expect(container.querySelector("[data-answer-detail]")).toBeNull();
});

it.each(["document", "code"] as const)("preserves complete requested %s content and exact copy through history reload", async kind => {
  const body = kind === "code"
    ? Array.from({ length: 40 }, (_, index) => `const value${index} = ${index};`).join("\n")
    : Array.from({ length: 12 }, (_, index) => `Apartado ${index + 1}: contenido íntegro y verificable del documento.`).join("\n\n");
  const text = kind === "code" ? "```ts\n" + body + "\n```" : "Documento solicitado.\n\n" + body;
  const live: ChatTurn = { role: "assistant", text, tools: [] };
  const restored = historyTurn({ role: "assistant", content: text, ts: "", textTranslated: text, presentation: "full" });
  const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  for (const response of [live, restored]) {
    await act(async () => root.render(null));
    await renderThread({ mode: "api", turns: [{ ...user, text: `Entrega el ${kind} completo.` }, response] });
    const answer = host.querySelector<HTMLElement>('[data-message-section="answer"]')!;
    expect(answer.querySelector("[data-compact-answer]")).toBeNull();
    expect(answer.querySelector("[data-visible-summary]")).toBeNull();
    if (kind === "code") expect(answer.querySelector("pre")?.textContent).toBe(body);
    else for (const paragraph of body.split("\n\n")) expect(visibleText(answer)).toContain(paragraph);
    const copy = [...answer.querySelectorAll<HTMLButtonElement>('button[title="Copiar"]')].at(-1)!;
    await act(async () => copy.click());
    expect(clipboard).toHaveBeenLastCalledWith(text);
    expect(response.text).toBe(text);
    expect(visibleText(answer)).toContain(kind === "code" ? "const value39 = 39;" : "Apartado 12: contenido íntegro");
  }
});

it("retains all requested plan steps and its approval after history reload", async () => {
  const steps = Array.from({ length: 12 }, (_, index) => `${index + 1}. Paso verificable ${index + 1} del plan solicitado.`);
  const text = "Resumen: Preparar y verificar el cambio.\n\nPlan completo:\n" + steps.join("\n");
  const response = historyTurn({
    role: "assistant", content: text, ts: "", askKind: "plan-approval",
    ask: [{ id: "plan", type: "single", text: "¿Apruebas el plan?", options: ["Aprobar plan", "Pedir cambios"] }],
  });
  await renderThread({ mode: "api", turns: [user, response] });
  const plan = host.querySelector<HTMLElement>('[data-message-section="answer"]')!;
  expect(plan.querySelector("[data-compact-answer]")).toBeNull();
  for (let index = 1; index <= 12; index++) expect(visibleText(plan)).toContain(`Paso verificable ${index} del plan solicitado.`);
  expect(button("Aprobar plan").closest("details")).toBeNull();
  expect(button("Aprobar plan").disabled).toBe(false);
  expect(response.text).toBe(text);
});

it.each([
  { error: "La operación no está confirmada." },
  { interrupted: true },
  { stopped: true },
  { pending: true },
  { ask: [{ id: "request", type: "text" as const, text: "Decisión pendiente" }] },
  { permission: { id: "permission", tool: "files.write", title: "Permiso pendiente" } },
])("preserves the full body for attention states despite a summary signal: %j", async state => {
  const text = "Información imprescindible.\n\n" + "Detalle verificable conservado. ".repeat(30);
  const response: ChatTurn = { role: "assistant", tools: [], text, presentation: "summary", displaySummary: "Síntesis", ...state };
  await renderThread({ mode: "api", turns: [user, response] });
  const answer = host.querySelector('[data-message-section="answer"]')!;
  expect(answer.querySelector("[data-compact-answer]")).toBeNull();
  expect(visibleText(answer)).toContain("Información imprescindible.");
  expect(visibleText(answer)).toContain("Detalle verificable conservado.");
  expect(visibleText(answer)).not.toContain("Síntesis");
  if ("error" in state) expect(visibleText(answer)).toContain(state.error);
  if (state.permission) expect(visibleText(answer)).toContain(state.permission.title);
  if (state.ask) expect(visibleText(answer)).toContain(state.ask[0]!.text);
});
