// SPDX-License-Identifier: AGPL-3.0-only
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { extractModifiedFiles } from "./helpers";
import { historyTurn } from "../chat-engine/history";
import { applyEvent } from "../chat-engine/stream-apply";
import { chats } from "../chat-engine/state";
import { ModifiedFilesView, TurnView } from "./turn-view";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantI18nProvider, formatAssistantMessage, mergeAssistantMessages, type AssistantMessages } from "../i18n";
import type { ApiActivity } from "../assistant-api/api-activity";
import type { AgentEvent } from "../assistant-api";
vi.mock("../chat-engine/resume-poll", () => ({ startBackgroundPoll: vi.fn(), stopBackgroundPoll: vi.fn() }));
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));

afterEach(() => { chats.clear(); vi.unstubAllGlobals(); });

it.each(["files.write", "modules.execute"])("restores confirmed file details and the editor link for %s after JSON history reload", async name => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const path = "/project/src/File (draft)  1.ts";
  const input = name === "files.write" ? { path, content: "example" }
    : { moduleId: "files", tool: "files.write", revision: "2:0", input: { path, content: "example" } };
  const events: AgentEvent[] = [
    { type: "tool_use", id: "write", name, input },
    { type: "tool_result", id: "write", success: true, output: "Archivo guardado" },
    { type: "text", delta: "Cambio comprobado", phase: "final_answer" },
    { type: "done" },
  ];
  chats.set("files", { provider: "openai", conversationId: "files", streaming: false,
    turns: [{ role: "assistant", text: "", pending: true, tools: [] }] });
  events.forEach((event, seq) => applyEvent("files", event, { startedAt: 0, isCli: false, seq }));
  const live = chats.get("files")!.turns[0]!;
  const restored = historyTurn(JSON.parse(JSON.stringify({
    role: "assistant", content: live.text, ts: "2026-10-17T10:00:01Z", apiActivity: live.apiActivity,
  })));
  expect(extractModifiedFiles(live, "/project")).toEqual([{ path, kind: "modified" }]);
  expect(extractModifiedFiles(restored, "/project")).toEqual(extractModifiedFiles(live, "/project"));
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host), open = vi.fn();
  try {
    await act(async () => root.render(createElement(TurnView, { turn: restored, provider: "openai", onOpenFile: open, projectPath: "/project" })));
    const section = host.querySelector('[data-message-section="files"]')!;
    expect(section).not.toBeNull();
    expect(section.textContent).toContain("File (draft)  1.ts");
    await act(async () => section.querySelector("summary")!.click());
    await act(async () => section.querySelector("button")!.click());
    expect(open).toHaveBeenCalledExactlyOnceWith(path);
    expect(host.querySelectorAll('[data-message-section="console"]')).toHaveLength(1);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("does not claim a write from a failed or missing result, a read, prose or redacted input", () => {
  const activity: ApiActivity = { events: [
    { type: "tool_use", id: "failed", name: "files.write", input: { path: "/project/failed.ts" } },
    { type: "tool_result", id: "failed", success: false, output: "Resultado no confirmado" },
    { type: "tool_use", id: "pending", name: "files.write", input: { path: "/project/pending.ts" } },
    { type: "tool_use", id: "read", name: "files.read", input: { path: "/project/read.ts" } },
    { type: "tool_result", id: "read", success: true, output: "Write /project/from-output.ts" },
    { type: "tool_use", id: "redacted", name: "files.write", input: {} },
    { type: "tool_result", id: "redacted", success: true, output: "Guardado" },
  ] };
  const turn = historyTurn({ role: "assistant", content: "", ts: "", apiActivity: activity });
  expect(extractModifiedFiles({ ...turn, raw: "Write /project/from-output.ts" }, "/project")).toEqual([]);
});

it("deduplicates repeated writes and keeps exact relative paths only with a known project", () => {
  const tools = ["one", "two"].map(id => ({ id, name: "files.write", input: { path: "src/review.ts" }, result: { success: true, output: "Guardado" } }));
  const turn = { role: "assistant" as const, text: "", tools };
  expect(extractModifiedFiles(turn, "/project/")).toEqual([{ path: "/project/src/review.ts", kind: "modified" }]);
  expect(extractModifiedFiles(turn)).toEqual([]);
});

it("preserves CLI modified and deleted files across the persisted log", () => {
  const turn = historyTurn({ role: "assistant", content: "Hecho", ts: "", cli: true,
    cliLog: "⏺ Write src/review.ts\n⏺ Bash rm src/old.ts" });
  expect(extractModifiedFiles(turn, "/project")).toEqual([
    { path: "/project/src/review.ts", kind: "modified" }, { path: "/project/src/old.ts", kind: "deleted" },
  ]);
});

const locales = import.meta.glob<Partial<AssistantMessages>>("/src/i18n/*/assistant.ts", { eager: true, import: "default" });
it.each(Object.entries(locales))("uses the existing translated file labels in %s", (_path, locale) => {
  expect(Object.keys(locales)).toHaveLength(12);
  const messages = mergeAssistantMessages(locale);
  const file = "/project/src/review.ts";
  const html = renderToStaticMarkup(createElement(AssistantI18nProvider, { value: messages,
    children: createElement(ModifiedFilesView, { files: [{ path: file, kind: "modified" }], onOpen: () => {} }),
  }));
  const document = new DOMParser().parseFromString(html, "text/html");
  expect(document.querySelector("summary")?.textContent).toContain(messages.providersTab.showModifiedFiles);
  expect(document.querySelector("button")?.title).toBe(formatAssistantMessage(
    (messages.chatTab as Record<string, unknown>).openInEditorTitle as string, { path: file }));
});
