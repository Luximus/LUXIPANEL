// Files page — AI editor bar (sibling of editor-find.ts). Lives at the foot of
// the editor panel (below Monaco). The user asks a question or requests a change
// about the ACTIVE tab's file; if the backend returns an `edit`, we apply it to
// the Monaco model UNDOABLY (never to disk — Save stays the button). The heavy
// editor work (selection/apply-edit) lives in the shared `__lxpFilesMonacoEditor`
// API (lib/panel-files-monaco.ts); here we only own the DOM wiring + the
// per-path conversation history (in memory, not persisted). Same init()/lifecycle
// contract as editor-find.ts: re-bound per fresh SPA DOM from bindEditor.
import { getActiveTab, getEditorApi } from "./editor";
import { fmt, t } from "./i18n";
import { escapeHtml } from "./paths";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";

const EDITOR_CHAT_ENDPOINT = "/api/ai/files/editor-chat";
// The contract caps `history` at the last 10 turns.
const HISTORY_MAX_TURNS = 10;

export interface EditorAiTurn {
  role: "user" | "assistant";
  content: string;
  /** Marks an assistant turn whose `edit` was applied to the buffer (shows the
   *  "aplicado al documento" badge). Never sent to the backend. */
  editApplied?: boolean;
}

export interface EditorAiEditRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export type EditorAiEdit =
  | { mode: "replaceAll"; content: string }
  | { mode: "replaceRange"; range: EditorAiEditRange; content: string };

interface EditorChatResponse {
  reply?: string;
  edit?: EditorAiEdit;
}

// ── Per-path conversation history (in memory; NOT persisted) ────────────────
const historyByPath = new Map<string, EditorAiTurn[]>();
// Last transient error per path (rendered below the turns, cleared on the next
// successful send or when the path is cleared). Kept out of `historyByPath` so
// error strings never leak into the `history` we send back to the model.
const errorByPath = new Map<string, string>();

/** All stored turns for a path (empty array when none). */
export function getEditorAiHistory(path: string): EditorAiTurn[] {
  return historyByPath.get(path) ?? [];
}

/** Append a turn to a path's history. */
export function pushEditorAiTurn(path: string, turn: EditorAiTurn): void {
  const list = historyByPath.get(path) ?? [];
  list.push(turn);
  historyByPath.set(path, list);
}

/** Drop a path's conversation (history + any transient error). */
export function clearEditorAiHistory(path: string): void {
  historyByPath.delete(path);
  errorByPath.delete(path);
}

/** The `history` payload for a request: the last ≤10 turns, stripped of the
 *  UI-only `editApplied` flag (contract shape `{ role, content }`). */
export function historyForRequest(path: string): Array<{ role: "user" | "assistant"; content: string }> {
  return getEditorAiHistory(path)
    .slice(-HISTORY_MAX_TURNS)
    .map((turn) => ({ role: turn.role, content: turn.content }));
}

type MonacoApi = NonNullable<ReturnType<typeof getEditorApi>>;

/** Apply a backend `edit` to the live model via the Monaco API. Returns whether
 *  it was applied (false for a missing editor or an unknown mode). Undoable —
 *  the shared API uses executeEdits, never setValue. */
export function applyEditorAiEdit(editorApi: MonacoApi | undefined, edit: EditorAiEdit | undefined): boolean {
  if (!editorApi || !edit) return false;
  if (edit.mode === "replaceAll") return editorApi.applyEdit({ mode: "replaceAll", content: edit.content });
  if (edit.mode === "replaceRange") return editorApi.applyEdit({ mode: "replaceRange", range: edit.range, content: edit.content });
  return false;
}

// ── DOM wiring ──────────────────────────────────────────────────────────────
interface AiEls {
  root: HTMLElement;
  form: HTMLFormElement;
  input: HTMLInputElement;
  send: HTMLButtonElement | null;
  spinner: HTMLElement | null;
  panel: HTMLElement | null;
  messages: HTMLElement | null;
  collapse: HTMLButtonElement | null;
  clear: HTMLButtonElement | null;
}

let els: AiEls | null = null;
let busy = false;
let collapsed = false;

/** Render the per-path conversation panel for the active tab (or hide it when
 *  there are no turns / no error to show). */
function renderPanel(): void {
  if (!els?.panel || !els.messages) return;
  const tab = getActiveTab();
  const turns = tab ? getEditorAiHistory(tab.path) : [];
  const error = tab ? errorByPath.get(tab.path) : undefined;
  if (!turns.length && !error) {
    els.panel.classList.add("hidden");
    els.messages.innerHTML = "";
    return;
  }
  els.panel.classList.remove("hidden");
  els.messages.classList.toggle("hidden", collapsed);
  if (els.collapse) {
    const icon = els.collapse.querySelector("i");
    if (icon) icon.className = collapsed ? "ti ti-chevron-up text-xs" : "ti ti-chevron-down text-xs";
  }
  const youLabel = t("workspace.aiEditorYou", "Tú");
  const aiLabel = t("workspace.aiEditorAssistant", "IA");
  const appliedLabel = t("workspace.aiEditorApplied", "Cambio aplicado al documento");
  const turnsHtml = turns
    .map((turn) => {
      const isUser = turn.role === "user";
      const label = isUser ? youLabel : aiLabel;
      const labelCls = isUser ? "text-primary" : "text-muted-foreground";
      const badge = turn.editApplied
        ? `<span class="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"><i class="ti ti-check text-[10px]"></i>${escapeHtml(appliedLabel)}</span>`
        : "";
      return `<div class="space-y-0.5"><div class="text-[10px] font-semibold uppercase tracking-wide ${labelCls}">${escapeHtml(label)}</div><div class="whitespace-pre-wrap break-words text-xs text-foreground">${escapeHtml(turn.content)}</div>${badge}</div>`;
    })
    .join("");
  const errorHtml = error
    ? `<div class="flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive"><i class="ti ti-alert-triangle mt-0.5 text-xs"></i><span class="break-words">${escapeHtml(error)}</span></div>`
    : "";
  els.messages.innerHTML = turnsHtml + errorHtml;
  // Scroll to the newest turn.
  els.messages.scrollTop = els.messages.scrollHeight;
}

/** Reflect the busy state on the input/send/spinner. */
function setBusy(next: boolean): void {
  busy = next;
  if (!els) return;
  if (els.spinner) els.spinner.classList.toggle("hidden", !next);
  refreshAi();
}

/** Enable/disable the bar and re-render the panel as the active tab changes.
 *  Exposed on window so editor.ts can call it from syncToolbarState without a
 *  hard import cycle (mirrors __lxpFilesFindRefresh). */
function refreshAi(): void {
  if (!els) return;
  const hasTab = Boolean(getActiveTab());
  const disabled = !hasTab || busy;
  els.input.disabled = disabled;
  if (els.send) els.send.disabled = disabled;
  els.input.classList.toggle("opacity-50", !hasTab);
  if (els.send) els.send.classList.toggle("opacity-40", disabled);
  renderPanel();
}

async function onSubmit(event: Event): Promise<void> {
  event.preventDefault();
  if (busy || !els) return;
  const tab = getActiveTab();
  const editorApi = getEditorApi();
  if (!tab || !editorApi) return;
  const prompt = els.input.value.trim();
  if (!prompt) return;

  setBusy(true);
  const content = editorApi.getValue();
  const selection = editorApi.getSelection?.() ?? null;
  const history = historyForRequest(tab.path);
  const body: Record<string, unknown> = { path: tab.path, content, prompt };
  if (selection) body.selection = selection;
  if (history.length) body.history = history;

  const res = await api.post<EditorChatResponse>(EDITOR_CHAT_ENDPOINT, body);
  setBusy(false);

  // Guard against a tab switch mid-request: apply/record against the path we
  // asked about, not whatever is active now.
  if (!res.ok || !res.data) {
    errorByPath.set(tab.path, res.error || t("workspace.aiEditorError", "No se pudo obtener respuesta de la IA."));
    renderPanel();
    return;
  }
  errorByPath.delete(tab.path);
  const data = res.data;
  els.input.value = "";
  // Only apply the edit when the asked-about tab is still the active one — an
  // edit targets the live Monaco model, which now shows a different file if the
  // user switched tabs while waiting.
  const activeNow = getActiveTab();
  const applied = Boolean(data.edit) && activeNow?.path === tab.path
    ? applyEditorAiEdit(editorApi, data.edit)
    : false;
  pushEditorAiTurn(tab.path, { role: "user", content: prompt });
  pushEditorAiTurn(tab.path, { role: "assistant", content: data.reply ?? "", editApplied: applied });
  renderPanel();
}

/** Wire the AI editor bar. Called from bindEditor (re-runs per fresh SPA DOM).
 *  No-op when the bar isn't rendered (user lacks the assistant module). */
export function bindEditorAi(): void {
  const form = document.getElementById("files-editor-ai-form") as HTMLFormElement | null;
  const input = document.getElementById("files-editor-ai-input") as HTMLInputElement | null;
  const root = document.getElementById("files-editor-ai");
  if (!form || !input || !root) return;
  els = {
    root,
    form,
    input,
    send: document.getElementById("files-editor-ai-send") as HTMLButtonElement | null,
    spinner: document.getElementById("files-editor-ai-spinner"),
    panel: document.getElementById("files-editor-ai-panel"),
    messages: document.getElementById("files-editor-ai-messages"),
    collapse: document.getElementById("files-editor-ai-collapse") as HTMLButtonElement | null,
    clear: document.getElementById("files-editor-ai-clear") as HTMLButtonElement | null,
  };
  busy = false;

  form.addEventListener("submit", (ev) => void onSubmit(ev));
  input.addEventListener("keydown", (ev: KeyboardEvent) => {
    // Enter submits via the form; Escape returns focus to the editor. Don't
    // touch other keys — Monaco shortcuts belong to the editor, not this input.
    if (ev.key === "Escape") {
      ev.preventDefault();
      getEditorApi()?.focus?.();
    }
  });
  els.collapse?.addEventListener("click", () => {
    collapsed = !collapsed;
    renderPanel();
  });
  els.clear?.addEventListener("click", () => {
    const tab = getActiveTab();
    if (tab) clearEditorAiHistory(tab.path);
    renderPanel();
    els?.input.focus();
  });

  (window as any).__lxpFilesAiRefresh = refreshAi;
  refreshAi();
}
