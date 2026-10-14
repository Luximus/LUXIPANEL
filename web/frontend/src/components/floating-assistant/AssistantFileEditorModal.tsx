// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * File editor modal for the floating assistant. Opens a file the agent modified
 * (from the "Archivos modificados" list under a response) in the SAME Monaco
 * editor the Files module uses — `initFilesMonacoEditor` (`@/lib/panel-files-monaco`),
 * so themes/languages/settings match — reading/writing via the same
 * `/api/files/read` + `/api/files/write` endpoints (so per-server isolation and
 * permissions apply: a forbidden write surfaces as an error here).
 *
 * Diff-by-default: the whole point of opening a file the agent just changed is
 * to SEE what changed. So we also fetch the file's git-HEAD content
 * (`/api/files/history/git-show?rev=HEAD`) and open in the Monaco diff view
 * (HEAD on the left → current on the right), which naturally folds together
 * EVERY change the file accumulated vs its last commit. When the file isn't in
 * a git repo (or git history isn't permitted), we fall back to the plain editor.
 * A header toggle switches between the diff and the editable view.
 *
 * Monaco is a singleton bound to one host element; we lazy-import it (keeps it
 * out of the main assistant chunk) and dispose on close so the Files page can
 * re-host it cleanly. Our diff panel uses its OWN element ids so it never
 * collides with the Files page's `#file-diff-panel`.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useBodyPointerEventsWhileOpen } from "@/lib/body-pointer-events";
import type { FilesMonacoEditorApi } from "@/lib/panel-files-monaco";
import { ModalNavbar } from "@/components/ui/ModalNavbar";
import { ModalShell } from "@/components/ui/ModalShell";
import { useAssistantI18n } from "./i18n";

const HOST_ID = "assistant-file-editor-host";
const DIFF_HOST_ID = "assistant-file-diff-host";
const DIFF_PANEL_ID = "assistant-file-diff-panel";

// Guards against a reload loop while still allowing a fresh recovery per deploy.
const MONACO_RELOAD_KEY = "lxp:assistant-monaco-chunk-reloaded";

/**
 * Lazy-import the shared Files/Monaco module, recovering from the classic
 * post-deploy failure: a new build renames the hashed `panel-files-monaco.*.js`
 * chunk, so an OLD tab still referencing the previous hash gets
 * "Failed to fetch dynamically imported module" and the viewer opens empty.
 * On that specific error we reload the page ONCE (flagged in sessionStorage) to
 * pull the current asset manifest; if it still fails after the reload we let the
 * error surface so the modal shows a real message instead of looping.
 */
async function importFilesMonaco(): Promise<typeof import("@/lib/panel-files-monaco")> {
  try {
    const mod = await import("@/lib/panel-files-monaco");
    // Loaded fine → clear the guard so a future deploy can recover again.
    try {
      sessionStorage.removeItem(MONACO_RELOAD_KEY);
    } catch {
      /* sessionStorage unavailable — nothing to clean up */
    }
    return mod;
  } catch (e) {
    const msg = (e as Error)?.message || "";
    const isChunkError =
      /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch/i.test(
        msg,
      );
    let alreadyReloaded = true;
    try {
      alreadyReloaded = sessionStorage.getItem(MONACO_RELOAD_KEY) === "1";
    } catch {
      /* no sessionStorage → skip the auto-reload path */
    }
    if (isChunkError && !alreadyReloaded) {
      try {
        sessionStorage.setItem(MONACO_RELOAD_KEY, "1");
      } catch {
        /* ignore */
      }
      window.location.reload();
      // Stall this async chain; the page is reloading.
      await new Promise(() => {});
    }
    throw e;
  }
}

export function AssistantFileEditorModal({ path, onClose }: { path: string; onClose(): void }) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const fe = (ct.fileEditor ?? {}) as Record<string, string>;
  useBodyPointerEventsWhileOpen(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // A git-HEAD baseline was found → the diff toggle is offered.
  const [diffAvailable, setDiffAvailable] = useState(false);
  // Which pane is showing (the lib drives this via `lxp-files-editor-diff-change`).
  const [inDiff, setInDiff] = useState(false);
  const editorRef = useRef<FilesMonacoEditorApi | null>(null);
  const name = path.split("/").pop() || path;

  /** Best-effort git-HEAD content of `path` to use as the diff baseline.
   *  The backend returns "" for a file absent at HEAD (newly created → diff
   *  shows it all as added) and errors for a tracked file it couldn't read.
   *  Returns null when not diffable so we fall back to the plain editor — we
   *  must NOT fabricate an empty baseline on error, or an existing file would
   *  wrongly render with every line as new. */
  async function loadDiffBaseline(): Promise<string | null> {
    try {
      const show = await api.get<{ content?: string }>("/api/files/history/git-show", {
        params: { path, rev: "HEAD" },
      });
      if (show.ok) return (show.data as { content?: string } | undefined)?.content ?? "";
    } catch {
      /* not diffable — fall back to the plain editor */
    }
    return null;
  }

  // Mount Monaco (lazy) + load the file content.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const mod = await importFilesMonaco();
        const res = await api.get<unknown>("/api/files/read", { params: { path } });
        if (!alive) return;
        if (!res.ok) {
          setError(res.error || (fe.readError ?? "No se pudo leer el archivo (¿binario o sin permiso?)."));
          setLoading(false);
          return;
        }
        const data = res.data as string | { content?: string } | undefined;
        const content = typeof data === "string" ? data : (data?.content ?? "");
        // Pull the git-HEAD baseline so we can open straight into the diff.
        const baseline = await loadDiffBaseline();
        if (!alive) return;
        // Only worth a diff when the baseline differs from the current content.
        const hasDiff = baseline !== null && baseline !== content;
        await mod.initFilesMonacoEditor({ hostId: HOST_ID, diffHostId: DIFF_HOST_ID, diffPanelId: DIFF_PANEL_ID });
        editorRef.current = window.__lxpFilesMonacoEditor ?? null;
        editorRef.current?.openFile({ path, name, content, ...(hasDiff ? { diffBaseline: baseline } : {}) });
        editorRef.current?.layout();
        setDiffAvailable(hasDiff);
        if (hasDiff) editorRef.current?.openDiff();
        setLoading(false);
      } catch (e) {
        if (alive) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Track dirty state + the editor's Ctrl+S shortcut (both via the lib's events).
  useEffect(() => {
    const onDirty = (e: Event) => {
      setDirty(Boolean((e as CustomEvent<{ dirty: boolean }>).detail?.dirty));
      if ((e as CustomEvent<{ dirty: boolean }>).detail?.dirty) setSaved(false);
    };
    const onSaveShortcut = () => void save();
    const onDiffChange = (e: Event) => setInDiff(Boolean((e as CustomEvent<{ open: boolean }>).detail?.open));
    window.addEventListener("lxp-files-editor-dirty-change", onDirty);
    window.addEventListener("lxp-files-editor-save", onSaveShortcut);
    window.addEventListener("lxp-files-editor-diff-change", onDiffChange);
    return () => {
      window.removeEventListener("lxp-files-editor-dirty-change", onDirty);
      window.removeEventListener("lxp-files-editor-save", onSaveShortcut);
      window.removeEventListener("lxp-files-editor-diff-change", onDiffChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dispose Monaco on close so the Files page can re-host the singleton cleanly.
  useEffect(() => {
    return () => {
      try {
        editorRef.current?.closeFile();
        editorRef.current?.dispose();
      } catch {
        /* noop */
      }
    };
  }, []);

  async function save() {
    const ed = editorRef.current;
    if (!ed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const content = ed.getValue();
      const res = await api.put("/api/files/write", { path, content });
      if (!res.ok) {
        setError(res.error || (fe.saveError ?? "No se pudo guardar el archivo."));
        return;
      }
      ed.markSaved(content);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function requestClose() {
    if (editorRef.current?.isDirty()) {
      if (!window.confirm(fe.unsavedConfirm ?? "Tienes cambios sin guardar. ¿Cerrar de todas formas?")) return;
    }
    onClose();
  }

  // The Monaco/diff host needs the card to clip its own scroll (`overflow-hidden`
  // overrides the drawer's default `overflow-y-auto`). `requestClose` keeps the
  // confirm-while-dirty gate on both backdrop click and Escape.
  return (
    <ModalShell onClose={requestClose} cardClassName="overflow-hidden">
        {/* Header */}
        <ModalNavbar
          icon="ti-file-pencil"
          title={
            <>
              {name}
              {dirty ? <span className="ml-0.5 text-primary">●</span> : null}
            </>
          }
          description={path}
          onClose={requestClose}
          closeLabel={fe.closeTitle ?? "Cerrar editor"}
          actions={
            <>
              {saved && !dirty && (
                <span className="text-[10px] text-emerald-500">
                  <i className="ti ti-check" aria-hidden></i> {fe.saved ?? "Guardado"}
                </span>
              )}
              {diffAvailable && (
                <button
                  type="button"
                  onClick={() => {
                    const ed = editorRef.current;
                    if (!ed) return;
                    if (inDiff) ed.closeDiff();
                    else ed.openDiff();
                  }}
                  aria-pressed={inDiff}
                  title={inDiff ? (fe.editFileTitle ?? "Editar el archivo") : (fe.viewDiffTitle ?? "Ver cambios (diff)")}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                    inDiff
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <i className={`ti ${inDiff ? "ti-pencil" : "ti-git-compare"} text-[13px]`} aria-hidden></i>
                  {inDiff ? (fe.editTab ?? "Editar") : (fe.diffTab ?? "Cambios")}
                </button>
              )}
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <i className={`ti ${saving ? "ti-loader-2 animate-spin" : "ti-device-floppy"} text-[13px]`} aria-hidden></i>
                {saving ? (fe.saving ?? "Guardando…") : (fe.save ?? "Guardar")}
              </button>
            </>
          }
        />
        {error && (
          <p className="border-b border-border bg-red-500/10 px-3 py-1.5 text-xs text-red-500">⚠ {error}</p>
        )}
        {/* Editor body — plain editor host + (hidden until toggled) diff panel.
            The lib toggles which one is visible; the diff panel needs `flex-col`
            and a `flex-1` host so the diff editor gets real height. */}
        <div className="relative min-h-0 flex-1 bg-background">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card">
              <i className="ti ti-loader-2 animate-spin text-xl text-primary" aria-hidden></i>
            </div>
          )}
          <div id={HOST_ID} className="absolute inset-0"></div>
          <div id={DIFF_PANEL_ID} className="absolute inset-0 hidden flex-col bg-background">
            <div id={DIFF_HOST_ID} className="min-h-0 flex-1"></div>
          </div>
        </div>
    </ModalShell>
  );
}
