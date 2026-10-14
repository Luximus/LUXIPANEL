// Vitest — Files module AI editor bar.
// Covers the testable logic: per-path history (isolation + ≤10-turn request
// cap + editApplied stripped), applying a replaceAll/replaceRange edit over a
// mock Monaco API, and the bar being disabled without an active tab.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (declared BEFORE importing the module under test) ────────────────
vi.mock("/scripts/extracted/lib/api-client.js", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  api: { post: vi.fn(async () => ({ ok: true, data: { reply: "ok" } })) },
  resolvePanelApiPath: (p: string) => p,
}));

import {
  applyEditorAiEdit,
  bindEditorAi,
  clearEditorAiHistory,
  getEditorAiHistory,
  historyForRequest,
  pushEditorAiTurn,
} from "./editor-ai";
import { S } from "./state";

function resetState() {
  S.openTabs = [];
  S.activeTabPath = "";
  S.editingPath = "";
}

beforeEach(() => {
  document.body.innerHTML = "";
  resetState();
  clearEditorAiHistory("/a.ts");
  clearEditorAiHistory("/b.ts");
  delete (window as any).__lxpFilesMonacoEditor;
  delete (window as any).__lxpFilesAiRefresh;
});

// ── Per-path history ────────────────────────────────────────────────────────
describe("per-path conversation history", () => {
  it("keeps each path's turns isolated", () => {
    pushEditorAiTurn("/a.ts", { role: "user", content: "hi A" });
    pushEditorAiTurn("/b.ts", { role: "user", content: "hi B" });
    expect(getEditorAiHistory("/a.ts")).toHaveLength(1);
    expect(getEditorAiHistory("/a.ts")[0]?.content).toBe("hi A");
    expect(getEditorAiHistory("/b.ts")[0]?.content).toBe("hi B");
  });

  it("caps historyForRequest to the last 10 turns and strips editApplied", () => {
    for (let i = 0; i < 14; i++) {
      pushEditorAiTurn("/a.ts", { role: "assistant", content: `t${i}`, editApplied: true });
    }
    const req = historyForRequest("/a.ts");
    expect(req).toHaveLength(10);
    expect(req[0]?.content).toBe("t4"); // last 10 of 14 → t4..t13
    expect(req[9]?.content).toBe("t13");
    expect("editApplied" in req[0]!).toBe(false);
  });

  it("clearEditorAiHistory drops the conversation", () => {
    pushEditorAiTurn("/a.ts", { role: "user", content: "x" });
    clearEditorAiHistory("/a.ts");
    expect(getEditorAiHistory("/a.ts")).toHaveLength(0);
  });
});

// ── applyEditorAiEdit ───────────────────────────────────────────────────────
describe("applyEditorAiEdit", () => {
  it("applies a replaceAll edit through the Monaco API", () => {
    const applyEdit = vi.fn(() => true);
    const ok = applyEditorAiEdit({ applyEdit } as any, { mode: "replaceAll", content: "new" });
    expect(ok).toBe(true);
    expect(applyEdit).toHaveBeenCalledWith({ mode: "replaceAll", content: "new" });
  });

  it("passes the range through for a replaceRange edit", () => {
    const applyEdit = vi.fn(() => true);
    const range = { startLineNumber: 1, startColumn: 1, endLineNumber: 2, endColumn: 3 };
    const ok = applyEditorAiEdit({ applyEdit } as any, { mode: "replaceRange", range, content: "x" });
    expect(ok).toBe(true);
    expect(applyEdit).toHaveBeenCalledWith({ mode: "replaceRange", range, content: "x" });
  });

  it("returns false for a missing editor or edit", () => {
    expect(applyEditorAiEdit(undefined, { mode: "replaceAll", content: "x" })).toBe(false);
    expect(applyEditorAiEdit({ applyEdit: vi.fn() } as any, undefined)).toBe(false);
  });
});

// ── Bar disabled without an active tab ──────────────────────────────────────
function buildAiBarInDom(): { input: HTMLInputElement; send: HTMLButtonElement } {
  const root = document.createElement("div");
  root.id = "files-editor-ai";
  const form = document.createElement("form");
  form.id = "files-editor-ai-form";
  const input = document.createElement("input");
  input.id = "files-editor-ai-input";
  const send = document.createElement("button");
  send.id = "files-editor-ai-send";
  const panel = document.createElement("div");
  panel.id = "files-editor-ai-panel";
  const messages = document.createElement("div");
  messages.id = "files-editor-ai-messages";
  panel.appendChild(messages);
  form.append(input, send);
  root.append(panel, form);
  document.body.appendChild(root);
  return { input, send };
}

describe("bar availability", () => {
  it("is disabled when there is no active tab and enabled once one exists", () => {
    const { input, send } = buildAiBarInDom();
    bindEditorAi();
    // No active tab → disabled.
    expect(input.disabled).toBe(true);
    expect(send.disabled).toBe(true);

    // Open a tab and re-run the exposed refresh (editor.ts calls this from
    // syncToolbarState on tab changes).
    S.openTabs.push({ path: "/a.ts", name: "a.ts", content: "x", originalContent: "x", dirty: false });
    S.activeTabPath = "/a.ts";
    (window as any).__lxpFilesAiRefresh();
    expect(input.disabled).toBe(false);
    expect(send.disabled).toBe(false);
  });
});
