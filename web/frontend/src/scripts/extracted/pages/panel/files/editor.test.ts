// Vitest — Files module editor behaviour.
// Pins attemptCloseEditor (X/shortcut reuse via the unsaved-confirm dialog,
// hiding the workspace editor view) and openOrActivateTab (persistent tab open).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (declared BEFORE importing the module under test) ────────────────
vi.mock("/scripts/extracted/lib/api-client.js", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  api: {
    get: vi.fn(async () => ({ ok: true, data: "" })),
    put: vi.fn(async () => ({ ok: true, data: {} })),
    post: vi.fn(async () => ({ ok: true, data: {} })),
    delete: vi.fn(async () => ({ ok: true })),
  },
  resolvePanelApiPath: (p: string) => p,
  uploadFile: vi.fn(),
}));

vi.mock("/scripts/extracted/lib/assistant-request.js", () => ({
  requestAssistant: vi.fn(),
}));

vi.mock("/scripts/extracted/lib/confirm.js", () => ({
  openConfirm: vi.fn(async () => true),
}));

import * as editor from "./editor";
import { S } from "./state";

// ── Helpers ────────────────────────────────────────────────────────────────
// The editor is a separate native drawer above the explorer.
function buildWorkspaceInDom(): { panel: HTMLDialogElement; browser: HTMLElement } {
  const browser = document.createElement("div");
  browser.id = "files-browser";
  const panel = document.createElement("dialog");
  panel.id = "files-editor-panel";
  panel.classList.add("hidden");
  panel.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  panel.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
  document.body.append(browser, panel);
  return { panel, browser };
}

function buildUnsavedDialogInDom(): HTMLDialogElement {
  const dlg = document.createElement("dialog");
  dlg.id = "dialog-editor-unsaved";
  dlg.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  dlg.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
  for (const id of ["editor-unsaved-save", "editor-unsaved-discard", "editor-unsaved-cancel", "editor-unsaved-close"]) {
    const b = document.createElement("button");
    b.id = id;
    dlg.appendChild(b);
  }
  document.body.appendChild(dlg);
  return dlg;
}

function installMonacoStub(initial = "") {
  let buffer = initial;
  const stub = {
    openFile: vi.fn((p: any) => {
      buffer = typeof p?.content === "string" ? p.content : "";
    }),
    getValue: () => buffer,
    setValue: vi.fn((v: string) => { buffer = v; }),
    closeFile: vi.fn(),
    markSaved: vi.fn(),
    openDiff: vi.fn(),
    closeDiff: vi.fn(),
    isDirty: () => false,
    gotoLine: vi.fn(),
    layout: vi.fn(),
  };
  (window as any).__lxpFilesMonacoEditor = stub;
  return stub;
}

function resetState() {
  S.openTabs = [];
  S.activeTabPath = "";
  S.editingPath = "";
  S.saveBtn = null;
  S.diffBtn = null;
  S.mediaObjectUrl = "";
  S.editorVisible = false;
}

beforeEach(() => {
  document.body.innerHTML = "";
  // The virtual Monaco stub needs no stylesheet or external HTTP request.
  const style = document.createElement("link");
  style.dataset.lxpFilesMonacoCss = "";
  style.dataset.loaded = "true";
  document.head.appendChild(style);
  resetState();
  delete (window as any).__lxpFilesMonacoEditor;
});

afterEach(() => {
  document.querySelectorAll('link[data-lxp-files-monaco-css]').forEach(link => link.remove());
});

// ── attemptCloseEditor (X/shortcut reuse → hides the workspace view) ──────
describe("attemptCloseEditor", () => {
  it("hides the editor view when no tab is dirty", async () => {
    const { panel } = buildWorkspaceInDom();
    S.editorVisible = true;
    S.openTabs.push({ path: "/etc/a.txt", name: "a.txt", content: "x", originalContent: "x", dirty: false });

    await editor.attemptCloseEditor();

    expect(S.editorVisible).toBe(false);
    expect(panel.classList.contains("hidden")).toBe(true);
  });

  it("does NOT hide the view when the unsaved-confirm resolves to 'cancel'", async () => {
    buildWorkspaceInDom();
    buildUnsavedDialogInDom();
    S.editorVisible = true;
    S.openTabs.push({ path: "/etc/a.txt", name: "a.txt", content: "x", originalContent: "y", dirty: true });

    const p = editor.attemptCloseEditor();
    await Promise.resolve();
    document.getElementById("editor-unsaved-cancel")!.click();
    await p;

    expect(S.editorVisible).toBe(true);
  });

  it("saves all dirty tabs and hides on 'save' choice", async () => {
    const { panel } = buildWorkspaceInDom();
    buildUnsavedDialogInDom();
    S.editorVisible = true;
    S.openTabs.push({ path: "/etc/a.txt", name: "a.txt", content: "X", originalContent: "x", dirty: true });

    const { api } = await import("/scripts/extracted/lib/api-client.js");
    const writeSpy = vi.mocked(api.put);

    const p = editor.attemptCloseEditor();
    await Promise.resolve();
    document.getElementById("editor-unsaved-save")!.click();
    await p;

    expect(writeSpy).toHaveBeenCalledWith("/api/files/write", { path: "/etc/a.txt", content: "X" });
    expect(S.openTabs[0]?.dirty).toBe(false);
    expect(S.editorVisible).toBe(false);
    expect(panel.classList.contains("hidden")).toBe(true);
  });

  it("discards and hides on 'discard' choice", async () => {
    const { panel } = buildWorkspaceInDom();
    buildUnsavedDialogInDom();
    S.editorVisible = true;
    S.openTabs.push({ path: "/etc/a.txt", name: "a.txt", content: "X", originalContent: "x", dirty: true });

    const p = editor.attemptCloseEditor();
    await Promise.resolve();
    document.getElementById("editor-unsaved-discard")!.click();
    await p;

    expect(S.editorVisible).toBe(false);
    expect(panel.classList.contains("hidden")).toBe(true);
  });
});

// ── editor drawer ───────────
describe("showEditorView / hideEditorView", () => {
  it("closes the drawer while keeping the explorer mounted and visible", () => {
    const { panel, browser } = buildWorkspaceInDom();
    S.editorVisible = true;
    panel.classList.remove("hidden");
    panel.setAttribute("open", "");

    editor.hideEditorView();

    expect(S.editorVisible).toBe(false);
    expect(panel.classList.contains("hidden")).toBe(true);
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(panel.hasAttribute("inert")).toBe(true);
    expect(panel.close).toHaveBeenCalledOnce();
    expect(browser.classList.contains("hidden")).toBe(false);
    expect(browser.hasAttribute("inert")).toBe(false);
  });

  it("opens above the explorer without hiding its DOM", () => {
    const { panel, browser } = buildWorkspaceInDom();
    void editor.showEditorView().catch(() => {});
    expect(panel.showModal).toHaveBeenCalledOnce();
    expect(panel.open).toBe(true);
    expect(browser.classList.contains("hidden")).toBe(false);
    expect(browser.hasAttribute("inert")).toBe(false);
  });

  it("syncEditorToggleButtons mirrors S.editorVisible onto aria-pressed", () => {
    const btn = document.createElement("button");
    btn.setAttribute("data-files-editor-toggle", "");
    btn.setAttribute("aria-pressed", "false");
    document.body.appendChild(btn);

    S.editorVisible = true;
    editor.syncEditorToggleButtons();
    expect(btn.getAttribute("aria-pressed")).toBe("true");

    S.editorVisible = false;
    editor.syncEditorToggleButtons();
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });
});

// ── openOrActivateTab (persistent tab open) ──────────────────────────────
describe("openOrActivateTab", () => {
  it("opens a persistent tab and makes it active", () => {
    installMonacoStub();
    editor.openOrActivateTab("/etc/a.txt", "a.txt", "hello");

    expect(S.openTabs).toHaveLength(1);
    expect(S.openTabs[0]?.path).toBe("/etc/a.txt");
    expect(S.activeTabPath).toBe("/etc/a.txt");
  });

  it("activates the existing tab instead of stacking a duplicate", () => {
    installMonacoStub();
    editor.openOrActivateTab("/etc/p.txt", "p.txt", "p");
    editor.openOrActivateTab("/etc/p.txt", "p.txt", "p2");

    expect(S.openTabs).toHaveLength(1);
    expect(S.openTabs[0]?.path).toBe("/etc/p.txt");
    expect(S.activeTabPath).toBe("/etc/p.txt");
  });
});

// ── Preview vs permanent tabs (VS Code-style) ────────────────────────────
describe("preview tabs", () => {
  it("a preview open marks the tab as preview", () => {
    installMonacoStub();
    editor.openOrActivateTab("/etc/a.txt", "a.txt", "a", { preview: true });
    expect(S.openTabs).toHaveLength(1);
    expect(S.openTabs[0]?.preview).toBe(true);
    expect(editor.getPreviewTab()?.path).toBe("/etc/a.txt");
  });

  it("a second preview open REPLACES the preview slot (no stacking)", () => {
    installMonacoStub();
    editor.openOrActivateTab("/etc/a.txt", "a.txt", "a", { preview: true });
    editor.openOrActivateTab("/etc/b.txt", "b.txt", "b", { preview: true });
    expect(S.openTabs).toHaveLength(1);
    expect(S.openTabs[0]?.path).toBe("/etc/b.txt");
    expect(S.openTabs[0]?.preview).toBe(true);
    expect(S.activeTabPath).toBe("/etc/b.txt");
  });

  it("a permanent open does NOT reuse the preview slot (keeps both)", () => {
    installMonacoStub();
    editor.openOrActivateTab("/etc/a.txt", "a.txt", "a", { preview: true });
    editor.openOrActivateTab("/etc/b.txt", "b.txt", "b"); // permanent
    expect(S.openTabs).toHaveLength(2);
    expect(editor.getPreviewTab()?.path).toBe("/etc/a.txt");
    expect(S.openTabs.find((t) => t.path === "/etc/b.txt")?.preview).toBeFalsy();
  });

  it("a dirty preview is NOT replaced by the next preview open (change-safe)", () => {
    const stub = installMonacoStub();
    editor.openOrActivateTab("/etc/a.txt", "a.txt", "a", { preview: true });
    // Simulate an edit: the editor buffer now differs from the saved content, so
    // the next open's commitActiveTabFromEditor marks the preview tab dirty.
    stub.setValue("a-edited");
    editor.openOrActivateTab("/etc/b.txt", "b.txt", "b", { preview: true });
    expect(S.openTabs).toHaveLength(2);
    expect(S.openTabs.find((t) => t.path === "/etc/a.txt")?.dirty).toBe(true);
  });

  it("promoteTabToPermanent clears the preview flag", () => {
    installMonacoStub();
    editor.openOrActivateTab("/etc/a.txt", "a.txt", "a", { preview: true });
    editor.promoteTabToPermanent("/etc/a.txt");
    expect(S.openTabs[0]?.preview).toBe(false);
  });

  it("re-opening a preview tab as permanent pins it", () => {
    installMonacoStub();
    editor.openOrActivateTab("/etc/a.txt", "a.txt", "a", { preview: true });
    editor.openOrActivateTab("/etc/a.txt", "a.txt", "a"); // permanent open of same path
    expect(S.openTabs).toHaveLength(1);
    expect(S.openTabs[0]?.preview).toBe(false);
  });
});
