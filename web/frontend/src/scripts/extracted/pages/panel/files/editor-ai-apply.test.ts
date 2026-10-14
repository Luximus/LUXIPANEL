// Vitest — Files AI editor bar: applying an AI edit to the LIVE buffer.
//
// Acceptance for the "on return to the code the editor is already updated"
// requirement: submitting a prompt whose backend reply carries an `edit` must
// (1) push the new content into the shared Monaco model (getValue reflects it),
// (2) mark the active tab dirty, (3) pin a preview tab as permanent, and
// (4) stay undoable (Ctrl+Z reverts, tab goes clean again).
//
// Monaco itself can't run under happy-dom (vitest stubs it), so we drive the
// REAL wiring — onSubmit (editor-ai) → applyEdit → the `lxp-files-editor-
// content-change` event → bindEditor's tab-update listener — over a faithful
// fake whose `applyEdit` mutates a buffer, keeps an undo stack, and emits the
// same content-change event Monaco's onDidChangeModelContent would.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (declared BEFORE importing the modules under test) ────────────────
vi.mock("/scripts/extracted/lib/api-client.js", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  api: {
    post: vi.fn(async () => ({ ok: true, data: { reply: "ok" } })),
    put: vi.fn(async () => ({ ok: true, data: {} })),
    get: vi.fn(async () => ({ ok: true, data: "" })),
    delete: vi.fn(async () => ({ ok: true })),
  },
  resolvePanelApiPath: (p: string) => p,
  uploadFile: vi.fn(),
}));
vi.mock("/scripts/extracted/lib/assistant-request.js", () => ({ requestAssistant: vi.fn() }));
vi.mock("/scripts/extracted/lib/confirm.js", () => ({ openConfirm: vi.fn(async () => true) }));
// Isolate bindEditor from the file-browser siblings it also wires (not under
// test here); provide every named export editor.ts / bind-editor.ts import.
vi.mock("./listing", () => ({
  setViewMode: vi.fn(),
  updateHiddenToggleUI: vi.fn(),
  renderFiles: vi.fn(),
  rowPathFor: vi.fn(),
}));
vi.mock("./projects", () => ({ setProjectsViewActive: vi.fn() }));
vi.mock("./editor-find", () => ({ bindEditorFind: vi.fn() }));

import { bindEditor } from "./bind-editor";
import { clearEditorAiHistory } from "./editor-ai";
import { S } from "./state";

// ── A faithful fake of the shared Monaco API (window.__lxpFilesMonacoEditor) ──
// `applyEdit` mirrors the real one: computes the new buffer from the edit,
// keeps an undo stack, and dispatches `lxp-files-editor-content-change` with the
// dirty flag = buffer differs from the saved baseline — exactly what Monaco's
// executeEdits → onDidChangeModelContent → emitContentChange does in production.
function offsetAt(text: string, line: number, column: number): number {
  const lines = text.split("\n");
  let off = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) off += lines[i]!.length + 1; // +1 = the \n
  return off + (column - 1);
}

function installFakeMonaco(initial: string, savedBaseline = initial) {
  let buffer = initial;
  const undoStack: string[] = [];
  const emit = () => {
    window.dispatchEvent(
      new CustomEvent("lxp-files-editor-content-change", {
        detail: { content: buffer, dirty: buffer !== savedBaseline },
      }),
    );
  };
  const api = {
    getValue: () => buffer,
    setValue: (v: string) => { buffer = v; },
    getSelection: () => null,
    focus: vi.fn(),
    layout: vi.fn(),
    openFile: vi.fn(),
    closeFile: vi.fn(),
    markSaved: vi.fn(),
    openDiff: vi.fn(),
    closeDiff: vi.fn(),
    isDirty: () => buffer !== savedBaseline,
    gotoLine: vi.fn(),
    applyEdit: (edit: any): boolean => {
      undoStack.push(buffer);
      if (edit.mode === "replaceAll") {
        buffer = edit.content;
      } else {
        const start = offsetAt(buffer, edit.range.startLineNumber, edit.range.startColumn);
        const end = offsetAt(buffer, edit.range.endLineNumber, edit.range.endColumn);
        buffer = buffer.slice(0, start) + edit.content + buffer.slice(end);
      }
      emit();
      return true;
    },
    /** Simulate Ctrl+Z: restore the pre-edit buffer and re-emit (Monaco fires
     *  onDidChangeModelContent on undo too). */
    undo: () => {
      const prev = undoStack.pop();
      if (prev === undefined) return;
      buffer = prev;
      emit();
    },
  };
  (window as any).__lxpFilesMonacoEditor = api;
  return api;
}

// Minimal DOM the AI bar + tab bar bind against.
function buildFilesDom(): HTMLElement {
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
  const tabs = document.createElement("div");
  tabs.id = "file-tabs";
  document.body.append(root, tabs);
  return tabs;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function submitPrompt(prompt: string) {
  const input = document.getElementById("files-editor-ai-input") as HTMLInputElement;
  input.value = prompt;
  document.getElementById("files-editor-ai-form")!.dispatchEvent(new Event("submit", { cancelable: true }));
  await flush();
}

beforeEach(() => {
  document.body.innerHTML = "";
  S.openTabs = [];
  S.activeTabPath = "";
  S.editingPath = "";
  S.saveBtn = null;
  S.diffBtn = null;
  S.viewMode = "list";
  clearEditorAiHistory("/etc/app.conf");
  delete (window as any).__lxpFilesMonacoEditor;
  delete (window as any).__lxpFilesAiRefresh;
});

describe("applying an AI edit to the active tab", () => {
  it("a replaceAll edit updates the buffer, marks the tab dirty, pins the preview, and undo reverts", async () => {
    const mon = installFakeMonaco("hello", "hello");
    // Active tab is a PREVIEW (italic) tab: the edit must pin it permanent.
    S.openTabs.push({ path: "/etc/app.conf", name: "app.conf", content: "hello", originalContent: "hello", dirty: false, preview: true });
    S.activeTabPath = "/etc/app.conf";

    const { api } = await import("/scripts/extracted/lib/api-client.js");
    vi.mocked(api.post).mockResolvedValueOnce({
      ok: true,
      data: { reply: "listo", edit: { mode: "replaceAll", content: "HELLO WORLD" } },
    } as any);

    bindEditor(buildFilesDom());
    await submitPrompt("pon el texto en mayúsculas");

    // (1) buffer reflects the applied edit …
    expect(mon.getValue()).toBe("HELLO WORLD");
    const tab = S.openTabs[0]!;
    // … (2) the tab tracks the new content and is dirty …
    expect(tab.content).toBe("HELLO WORLD");
    expect(tab.dirty).toBe(true);
    // … (3) the preview tab was pinned permanent (no italic, not discardable).
    expect(tab.preview).toBe(false);

    // (4) Ctrl+Z reverts the buffer AND the tab goes clean again.
    mon.undo();
    expect(mon.getValue()).toBe("hello");
    expect(S.openTabs[0]!.dirty).toBe(false);
  });

  it("a replaceRange edit splices only the given range into the buffer", async () => {
    const mon = installFakeMonaco("line one\nline two\nline three", "line one\nline two\nline three");
    S.openTabs.push({ path: "/etc/app.conf", name: "app.conf", content: "line one\nline two\nline three", originalContent: "line one\nline two\nline three", dirty: false });
    S.activeTabPath = "/etc/app.conf";

    const { api } = await import("/scripts/extracted/lib/api-client.js");
    vi.mocked(api.post).mockResolvedValueOnce({
      ok: true,
      data: {
        reply: "cambiado",
        // Replace "two" on line 2 (cols 6..9) with "TWO".
        edit: { mode: "replaceRange", range: { startLineNumber: 2, startColumn: 6, endLineNumber: 2, endColumn: 9 }, content: "TWO" },
      },
    } as any);

    bindEditor(buildFilesDom());
    await submitPrompt("mayúsculas en 'two'");

    expect(mon.getValue()).toBe("line one\nline TWO\nline three");
    expect(S.openTabs[0]!.dirty).toBe(true);
  });

  it("does NOT touch the buffer when the backend returns no edit", async () => {
    const mon = installFakeMonaco("untouched", "untouched");
    S.openTabs.push({ path: "/etc/app.conf", name: "app.conf", content: "untouched", originalContent: "untouched", dirty: false });
    S.activeTabPath = "/etc/app.conf";

    const { api } = await import("/scripts/extracted/lib/api-client.js");
    vi.mocked(api.post).mockResolvedValueOnce({ ok: true, data: { reply: "solo respondo" } } as any);

    bindEditor(buildFilesDom());
    await submitPrompt("¿qué hace este archivo?");

    expect(mon.getValue()).toBe("untouched");
    expect(S.openTabs[0]!.dirty).toBe(false);
  });
});
