// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assistantApi,
  assistantProjectStructureApi,
  PROVIDER_META,
  PROVIDER_ORDER,
  type AssistantConfigState,
  type AssistantProviderId,
  type ProjectStructure,
  type StructureNodeStatus,
} from "./assistant-api";
import { ProviderIcon } from "./ProviderIcon";
import { ModalNavbar } from "@/components/ui/ModalNavbar";
import { ModalShell } from "@/components/ui/ModalShell";
import { formatAssistantMessage, mergeNamespaces, useAssistantI18n } from "./i18n";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";

type StructurePanelMessages = {
  editorLoading: string;
  loading: string;
  createdNotice: string;
  nothingToCreate: string;
  savedNotice: string;
  noActiveProviders: string;
  improvedNotice: string;
  noAiChanges: string;
  structureLoading: string;
  retry: string;
  copyAllContent: string;
  copied: string;
  copy: string;
  downloadFile: string;
  download: string;
  diff: string;
  originalDiffTitle: string;
  back: string;
  improveContentTitle: string;
  improving: string;
  improveWithAi: string;
  cancel: string;
  saving: string;
  save: string;
  chooseProvider: string;
  close: string;
  noModel: string;
  directory: string;
  structureCount: string;
  markMissing: string;
  creating: string;
  create: string;
  expand: string;
  collapse: string;
  edit: string;
  exists: string;
  createLabel: string;
  fallbackFilename: string;
  /** Provider hint subtitle, keyed by provider id (claude/codex/gemini). */
  structureHints: Record<string, string>;
  /** Localized node descriptions, keyed by node `rel` (marketplace slug → `*`). */
  structureNodes: Record<string, string>;
};

// Type-only fallback string shape; actual strings live in the i18n locale files
// (assistant.structurePanel.*) and are deep-merged at runtime via mergeNamespaces.
const structurePanelFallback: StructurePanelMessages = {
  editorLoading: "",
  loading: "",
  createdNotice: "",
  nothingToCreate: "",
  savedNotice: "",
  noActiveProviders: "",
  improvedNotice: "",
  noAiChanges: "",
  structureLoading: "",
  retry: "",
  copyAllContent: "",
  copied: "",
  copy: "",
  downloadFile: "",
  download: "",
  diff: "",
  originalDiffTitle: "",
  back: "",
  improveContentTitle: "",
  improving: "",
  improveWithAi: "",
  cancel: "",
  saving: "",
  save: "",
  chooseProvider: "",
  close: "",
  noModel: "",
  directory: "",
  structureCount: "",
  markMissing: "",
  creating: "",
  create: "",
  expand: "",
  collapse: "",
  edit: "",
  exists: "",
  createLabel: "",
  fallbackFilename: "",
  // Backend-sourced labels: empty by default so the backend description (the
  // ultimate fallback) shows through until the locale provides a translation.
  structureHints: {},
  structureNodes: {},
};

/** An active provider offered in the "improve with AI" picker. */
interface PickProvider {
  id: AssistantProviderId;
  mode: "api" | "cli";
  model: string;
}

/**
 * Manage a project's on-disk provider structure (CLAUDE.md, .claude/, AGENTS.md,
 * GEMINI.md…) as a real folder TREE that mirrors the recommended layout. Nodes
 * reflect the actual files in the project's working dir on the connected server:
 * present files can be opened/edited with a Monaco editor, missing nodes can be
 * scaffolded, and nothing existing is ever overwritten.
 */

interface TreeNode {
  name: string;
  rel: string;
  status?: StructureNodeStatus;
  children: TreeNode[];
}

function buildTree(nodes: StructureNodeStatus[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const s of nodes) {
    const parts = s.rel.split("/");
    let acc = "";
    let siblings = roots;
    let node: TreeNode | null = null;
    for (let i = 0; i < parts.length; i++) {
      acc = i === 0 ? parts[0]! : `${acc}/${parts[i]}`;
      const existed = map.has(acc);
      if (!existed) {
        node = { name: parts[i]!, rel: acc, children: [] };
        map.set(acc, node);
        siblings.push(node);
      } else {
        node = map.get(acc)!;
      }
      siblings = node.children;
    }
    if (node) node.status = s;
  }
  return roots;
}

function collectMissing(node: TreeNode, out: string[]): void {
  if (node.status && !node.status.present) out.push(node.rel);
  for (const c of node.children) collectMissing(c, out);
}

/**
 * Normalize a node `rel` to a stable i18n key. Marketplace nodes carry the
 * module slug in their path (`modules/<slug>/...`); collapse it to `modules/*`
 * so a single key localizes every marketplace project.
 */
function structureKey(rel: string): string {
  return rel.replace(/^modules\/[^/]+/, "modules/*");
}

function detectLanguage(rel: string): string {
  const name = rel.split("/").pop() ?? rel;
  if (name.endsWith(".md")) return "markdown";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return "yaml";
  if (name.endsWith(".toml")) return "ini";
  if (name.endsWith(".sh") || name.endsWith(".bash")) return "shell";
  if (name.endsWith(".py")) return "python";
  if (name.startsWith(".env") || name === ".gitignore" || name === ".gitattributes") return "shell";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "javascript";
  return "plaintext";
}

// ── Monaco editor (writable, lazy-loaded) ────────────────────────────────────

/**
 * Code editor backed by Monaco (the same library the Files module uses), so it
 * has syntax colors, folding, find/replace and the usual code-editor shortcuts.
 * Two modes:
 *   - normal: a single editable editor (`value`).
 *   - diff (`diff` true): a side-by-side diff of `original` (read-only, left) vs
 *     `value` (editable, right) — used to review what the AI changed.
 * The editor is UNCONTROLLED after mount; the parent bumps a `key` to feed a new
 * `value` (e.g. after an AI improvement). Toggling `diff` recreates the instance.
 */
function StructureCodeEditor({
  value,
  original,
  language,
  diff,
  onChange,
}: {
  value: string;
  original: string;
  language: string;
  diff: boolean;
  onChange: (v: string) => void;
}) {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    structurePanel?: Partial<StructurePanelMessages>;
  };
  const t = mergeNamespaces(structurePanelFallback, i18n.structurePanel);
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fallback, setFallback] = useState(value);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let instance: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let models: any[] = [];
    let cancelled = false;
    if (!hostRef.current) return;

    void (async () => {
      try {
        const monaco = await import("monaco-editor/esm/vs/editor/editor.api");
        await import("monaco-editor/min/vs/editor/editor.main.css");
        if (cancelled || !hostRef.current) return;
        const dark = document.documentElement.classList.contains("dark");
        const common = {
          theme: dark ? "vs-dark" : "vs",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          automaticLayout: true,
          wordWrap: "on" as const,
          renderLineHighlight: "line" as const,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          scrollbar: { alwaysConsumeMouseWheel: false },
        };
        if (diff) {
          const de = monaco.editor.createDiffEditor(hostRef.current, {
            ...common,
            renderSideBySide: true,
            originalEditable: false,
            readOnly: false,
          });
          const orig = monaco.editor.createModel(original, language);
          const mod = monaco.editor.createModel(value, language);
          de.setModel({ original: orig, modified: mod });
          mod.onDidChangeContent(() => onChange(mod.getValue()));
          instance = de;
          models = [orig, mod];
        } else {
          const ed = monaco.editor.create(hostRef.current, {
            ...common,
            value,
            language,
            lineNumbers: "on",
            folding: true,
            contextmenu: true,
          });
          ed.onDidChangeModelContent(() => onChange(ed.getValue()));
          instance = ed;
        }
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      instance?.dispose?.();
      models.forEach((m) => m.dispose?.());
    };
    // Recreate when the mode toggles; `value`/`original` are read fresh on each run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diff]);

  if (failed) {
    return (
      <textarea
        value={fallback}
        onChange={(e) => { setFallback(e.target.value); onChange(e.target.value); }}
        spellCheck={false}
        className="h-full min-h-[200px] w-full resize-none rounded-md border border-input bg-background p-2 font-mono text-xs leading-relaxed focus:border-primary focus:outline-none"
      />
    );
  }

  return (
    <>
      {!ready && (
        <p className="py-4 text-xs text-muted-foreground">{t.editorLoading}</p>
      )}
      <div
        ref={hostRef}
        className={`h-full min-h-[200px] w-full overflow-hidden rounded-md border border-input ${ready ? "" : "hidden"}`}
      />
    </>
  );
}

/** Trigger a browser download of `content` as `filename`. */
function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function StructurePanel({ projectId }: { projectId: string }) {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    structurePanel?: Partial<StructurePanelMessages>;
  };
  const t = mergeNamespaces(structurePanelFallback, i18n.structurePanel);
  const [structure, setStructure] = useState<ProjectStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [scaffolding, setScaffolding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Inline file editor state
  const [editRel, setEditRel] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  // Baseline used for the diff view (content as loaded / last saved).
  const [originalContent, setOriginalContent] = useState("");
  const [diffMode, setDiffMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  // Bumped after an AI improvement so the (uncontrolled) Monaco editor remounts
  // with the new value as its initialValue.
  const [editVersion, setEditVersion] = useState(0);

  // Assistant config → which providers are active (for the "improve" picker).
  const [assistantConfig, setAssistantConfig] = useState<AssistantConfigState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void assistantApi.getConfig().then((c) => { if (!cancelled) setAssistantConfig(c); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  const activeProviders = useMemo<PickProvider[]>(() => {
    if (!assistantConfig) return [];
    return PROVIDER_ORDER.filter((id) => assistantConfig.providers[id]?.active).map((id) => {
      const p = assistantConfig.providers[id]!;
      const model = (p.mode === "cli" ? p.cli?.model : p.api?.model) || "";
      return { id, mode: p.mode, model };
    });
  }, [assistantConfig]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const s = await assistantProjectStructureApi.scan(projectId);
      setStructure(s);
      setSelected(new Set(s.nodes.filter((n) => !n.present && n.core).map((n) => n.rel)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const tree = useMemo(() => buildTree(structure?.nodes ?? []), [structure]);
  const missingCount = useMemo(() => (structure?.nodes ?? []).filter((n) => !n.present).length, [structure]);

  function toggleNode(node: TreeNode) {
    const rels: string[] = [];
    collectMissing(node, rels);
    if (rels.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = rels.every((r) => next.has(r));
      for (const r of rels) {
        if (allOn) next.delete(r);
        else next.add(r);
      }
      return next;
    });
  }

  function toggleCollapse(rel: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(rel)) next.delete(rel);
      else next.add(rel);
      return next;
    });
  }

  function selectAllMissing() {
    setSelected(new Set((structure?.nodes ?? []).filter((n) => !n.present).map((n) => n.rel)));
  }

  async function scaffold() {
    if (selected.size === 0) return;
    setScaffolding(true);
    setNotice(null);
    setErr(null);
    try {
      const { created } = await assistantProjectStructureApi.scaffold(projectId, [...selected]);
      setNotice(created.length ? formatAssistantMessage(t.createdNotice, { count: created.length }) : t.nothingToCreate);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setScaffolding(false);
    }
  }

  async function openEditor(rel: string) {
    setEditRel(rel);
    setEditLoading(true);
    setEditContent("");
    setOriginalContent("");
    setDiffMode(false);
    setErr(null);
    setNotice(null);
    try {
      const content = await assistantProjectStructureApi.readFile(projectId, rel);
      setEditContent(content);
      setOriginalContent(content);
    } catch (e) {
      setErr((e as Error).message);
      setEditRel(null);
    } finally {
      setEditLoading(false);
    }
  }

  async function saveEditor() {
    if (!editRel) return;
    setEditSaving(true);
    setErr(null);
    try {
      await assistantProjectStructureApi.writeFile(projectId, editRel, editContent);
      setNotice(formatAssistantMessage(t.savedNotice, { rel: editRel }));
      setEditRel(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  // Click handler for the "Mejorar con IA" button: pick a provider first.
  // 0 active → clear error; 1 active → use it directly; >1 → open the picker.
  function onImproveClick() {
    if (!editRel || improving || editLoading) return;
    setErr(null);
    setNotice(null);
    if (activeProviders.length === 0) {
      setErr(t.noActiveProviders);
      return;
    }
    if (activeProviders.length === 1) {
      void improveWithAi(activeProviders[0]!.id);
      return;
    }
    setPickerOpen(true);
  }

  // Improve the open file with the chosen AI provider. Sends the editor's
  // current text (so unsaved edits are improved too); the backend adds project
  // context. The result is loaded back into the editor for review — NOT saved
  // automatically, so the user confirms with "Guardar".
  async function improveWithAi(providerId: AssistantProviderId) {
    if (!editRel || improving || editLoading) return;
    setPickerOpen(false);
    setImproving(true);
    setErr(null);
    setNotice(null);
    try {
      const improved = await assistantProjectStructureApi.improveFile(projectId, editRel, editContent, { providerId });
      if (improved.trim() && improved !== editContent) {
        setEditContent(improved);
        setDiffMode(true); // jump to the diff so the changes are visible at once
        setEditVersion((v) => v + 1); // remount Monaco with the improved content
        setNotice(t.improvedNotice);
      } else {
        setNotice(t.noAiChanges);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setImproving(false);
    }
  }

  if (loading) return <p className="px-1 py-4 text-xs text-muted-foreground">{t.structureLoading}</p>;

  if (err && !structure) {
    return (
      <div className="px-1 py-4 space-y-2">
        <p className="text-xs text-amber-500">⚠ {err}</p>
        <button type="button" onClick={() => void load()} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">{t.retry}</button>
      </div>
    );
  }
  if (!structure) return null;

  // ── Inline editor view ──────────────────────────────────────────────────────
  if (editRel) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex shrink-0 items-center justify-between gap-2 min-w-0">
          <span className="font-mono text-xs break-all min-w-0 flex-1 text-foreground">{editRel}</span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void copy(editContent)}
              disabled={editLoading}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              title={t.copyAllContent}
            >
              <i className={`ti ${copied ? "ti-check text-emerald-500" : "ti-copy"} text-xs`} aria-hidden></i>
              {copied ? t.copied : t.copy}
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile(editRel.split("/").pop() || t.fallbackFilename, editContent)}
              disabled={editLoading}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              title={t.downloadFile}
            >
              <i className="ti ti-download text-xs" aria-hidden></i>
              {t.download}
            </button>
            <button
              type="button"
              onClick={() => setDiffMode((d) => !d)}
              disabled={editLoading}
              aria-pressed={diffMode}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] disabled:opacity-50 ${
                diffMode
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title={t.originalDiffTitle}
            >
              <i className="ti ti-git-compare text-xs" aria-hidden></i>
              {t.diff}
            </button>
            <button
              type="button"
              onClick={() => setEditRel(null)}
              className="ml-1 shrink-0 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
            >
              ← {t.back}
            </button>
          </div>
        </div>

        {editLoading ? (
          <p className="text-xs text-muted-foreground py-2">{t.loading}</p>
        ) : (
          /* key includes editVersion so an AI improvement remounts Monaco with
             the new content as its value (the editor is uncontrolled). */
          <div className="min-h-0 flex-1">
            <StructureCodeEditor
              key={`${editRel}#${editVersion}`}
              value={editContent}
              original={originalContent}
              language={detectLanguage(editRel)}
              diff={diffMode}
              onChange={setEditContent}
            />
          </div>
        )}

        {notice && <p className="shrink-0 text-xs text-emerald-500">{notice}</p>}
        {err && <p className="shrink-0 text-xs text-amber-500">⚠ {err}</p>}

        <div className="flex shrink-0 items-center justify-between gap-2">
          <button
            type="button"
            onClick={onImproveClick}
            disabled={improving || editSaving || editLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            title={t.improveContentTitle}
          >
            <i className={`ti ${improving ? "ti-loader-2 animate-spin" : "ti-sparkles"}`} aria-hidden></i>
            {improving ? t.improving : t.improveWithAi}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditRel(null)}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={saveEditor}
              disabled={editSaving || editLoading || improving}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {editSaving ? t.saving : t.save}
            </button>
          </div>
        </div>

        {/* Provider picker — shown when more than one AI provider is active. */}
        {pickerOpen && (
          <ModalShell onClose={() => setPickerOpen(false)} zIndexClass="z-[10000]">
              <ModalNavbar title={t.chooseProvider} onClose={() => setPickerOpen(false)} closeLabel={t.close} />
              <div className="max-h-[60vh] space-y-1 overflow-y-auto p-2">
                {activeProviders.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void improveWithAi(p.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <ProviderIcon id={p.id} className="shrink-0 text-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{PROVIDER_META[p.id]?.label ?? p.id}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {p.model || t.noModel} · {p.mode.toUpperCase()}
                      </span>
                    </span>
                    <i className="ti ti-chevron-right shrink-0 text-muted-foreground" aria-hidden></i>
                  </button>
                ))}
              </div>
          </ModalShell>
        )}
      </div>
    );
  }

  // ── Tree view ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="shrink-0 text-[11px] leading-snug text-muted-foreground">{t.structureHints[structure.provider] || structure.hint}</p>
      <p className="shrink-0 text-[11px] text-muted-foreground break-all">
        {t.directory}: <span className="font-mono">{structure.path}</span>
      </p>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {formatAssistantMessage(t.structureCount, { count: missingCount })}
        </span>
        <div className="flex items-center gap-1.5">
          {missingCount > 0 && (
            <button type="button" onClick={selectAllMissing} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-accent">{t.markMissing}</button>
          )}
          <button
            type="button"
            onClick={scaffold}
            disabled={scaffolding || selected.size === 0}
            className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {scaffolding ? t.creating : formatAssistantMessage(t.create, { count: selected.size })}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border p-1">
        {tree.map((n) => (
          <TreeRow
            key={n.rel}
            node={n}
            depth={0}
            selected={selected}
            collapsed={collapsed}
            onToggleSelect={toggleNode}
            onToggleCollapse={toggleCollapse}
            onEdit={(rel) => void openEditor(rel)}
          />
        ))}
      </div>

      {notice && <p className="text-[11px] text-emerald-500">{notice}</p>}
      {err && <p className="text-xs text-amber-500">⚠ {err}</p>}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  selected,
  collapsed,
  onToggleSelect,
  onToggleCollapse,
  onEdit,
}: {
  node: TreeNode;
  depth: number;
  selected: Set<string>;
  collapsed: Set<string>;
  onToggleSelect: (n: TreeNode) => void;
  onToggleCollapse: (rel: string) => void;
  onEdit: (rel: string) => void;
}) {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    structurePanel?: Partial<StructurePanelMessages>;
  };
  const t = mergeNamespaces(structurePanelFallback, i18n.structurePanel);
  const s = node.status;
  const isDir = s ? s.type === "dir" : node.children.length > 0;
  const present = !!s?.present;
  const isCollapsed = collapsed.has(node.rel);
  const checked = !!s && !present && selected.has(node.rel);
  // Localize the backend-provided description; fall back to it when no key.
  const localizedDesc = s ? t.structureNodes[structureKey(s.rel)] || s.description : undefined;

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-accent/50 overflow-hidden"
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        {isDir && node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggleCollapse(node.rel)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={isCollapsed ? t.expand : t.collapse}
          >
            <i className={`ti ${isCollapsed ? "ti-chevron-right" : "ti-chevron-down"} text-xs`} aria-hidden />
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <i
          className={`ti ${isDir ? "ti-folder" : "ti-file-text"} text-xs shrink-0 ${present ? "text-primary" : "text-muted-foreground"}`}
          aria-hidden
        />

        <div className="min-w-0 flex-1 flex items-baseline gap-1.5 overflow-hidden">
          <span className="font-mono text-[11px] truncate shrink-0 max-w-[50%]">
            {node.name}{isDir ? "/" : ""}
          </span>
          {localizedDesc && (
            <span className="text-[10px] text-muted-foreground truncate min-w-0">
              {localizedDesc}
            </span>
          )}
        </div>

        {/* All present files get Editar; dirs get a checkmark; missing get a checkbox */}
        {!s ? null : present ? (
          !isDir ? (
            <button
              type="button"
              onClick={() => onEdit(node.rel)}
              className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/10"
            >
              {t.edit}
            </button>
          ) : (
            <span className="shrink-0 text-[10px] text-emerald-500" title={t.exists}>✓</span>
          )
        ) : (
          <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] text-muted-foreground">
            <input type="checkbox" checked={checked} onChange={() => onToggleSelect(node)} className="h-3.5 w-3.5 accent-primary" />
            {t.createLabel}
          </label>
        )}
      </div>

      {isDir && !isCollapsed &&
        node.children.map((c) => (
          <TreeRow
            key={c.rel}
            node={c}
            depth={depth + 1}
            selected={selected}
            collapsed={collapsed}
            onToggleSelect={onToggleSelect}
            onToggleCollapse={onToggleCollapse}
            onEdit={onEdit}
          />
        ))}
    </div>
  );
}
