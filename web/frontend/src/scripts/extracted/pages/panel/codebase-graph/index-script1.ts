import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { readScopedPreference, writeScopedPreference } from "/scripts/extracted/lib/scoped-preferences.js";
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";

type Project = { id: string; title: string; path: string; graphIndex?: { enabled?: boolean; status?: string; lastIndexedAt?: string } };
let projects: Project[] = [];
let lastInit = 0;
let generation = 0;
const $ = (id: string) => document.getElementById(id);
function tr(key: string, params: Record<string, string | number> = {}): string {
  const root = $("codebase-graph-root");
  const messages = root?.dataset.messages ? JSON.parse(root.dataset.messages) as Record<string, string> : null;
  return (messages?.[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

function setError(message: string) {
  const node = $("cg-error");
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("hidden", !message);
}

function setQueryMode() {
  const tool = ($("cg-tool") as HTMLSelectElement)?.value;
  const labels: Record<string, string> = { search_graph: tr("querySymbolPattern"), trace_path: tr("queryFunctionName"), get_code_snippet: tr("queryQualifiedName") };
  $("cg-query-wrap")?.classList.toggle("hidden", !labels[tool]);
  const input = $("cg-query") as HTMLInputElement | null;
  if (input) input.placeholder = labels[tool] || "";
}

function selectedProject() {
  const id = ($("cg-project") as HTMLSelectElement)?.value;
  return projects.find((project) => project.id === id);
}

function refreshProjectState() {
  const project = selectedProject();
  const state = $("cg-index-state");
  const button = $("cg-run") as HTMLButtonElement | null;
  if (state) state.textContent = project ? `${tr("index", { status: project.graphIndex?.status || tr("notCreated") })}${project.graphIndex?.lastIndexedAt ? ` · ${new Date(project.graphIndex.lastIndexedAt).toLocaleString($("codebase-graph-root")?.dataset.locale || "en")}` : ""}` : "";
  if (button) button.disabled = !(project?.graphIndex?.enabled && project.graphIndex.status === "ready");
}

function resultNode(tag: string, className: string, value: unknown): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = String(value ?? "");
  return node;
}

function appendSymbol(container: HTMLElement, item: Record<string, unknown>, hop?: boolean) {
  const card = document.createElement("div");
  card.className = "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3";
  const details = document.createElement("div");
  details.className = "min-w-0";
  details.append(resultNode("div", "break-words font-medium text-foreground", item.name || item.qualified_name));
  details.append(resultNode("div", "mt-1 break-all text-xs text-muted-foreground", item.file_path || item.qualified_name || ""));
  if (item.label || (hop && item.hop)) details.append(resultNode("div", "mt-1 text-xs text-muted-foreground", [item.label, hop && item.hop ? tr("hop", { hop: String(item.hop) }) : ""].filter(Boolean).join(" · ")));
  card.append(details);
  if (typeof item.qualified_name === "string" && item.qualified_name) {
    const button = resultNode("button", "shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent", tr("viewCode")) as HTMLButtonElement;
    button.type = "button";
    button.addEventListener("click", () => {
      ($("cg-tool") as HTMLSelectElement).value = "get_code_snippet";
      ($("cg-query") as HTMLInputElement).value = String(item.qualified_name);
      setQueryMode();
      void runQuery();
    });
    card.append(button);
  }
  container.append(card);
}

function renderResult(value: unknown, tool: string) {
  const root = $("cg-result");
  if (!root) return;
  root.replaceChildren();
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (tool === "search_graph" && Array.isArray(data.results)) {
    root.append(resultNode("p", "mb-3 text-xs text-muted-foreground", tr("resultsCount", { count: String(data.total ?? data.results.length) })));
    const list = resultNode("div", "space-y-2", "");
    for (const item of data.results) if (item && typeof item === "object") appendSymbol(list, item as Record<string, unknown>);
    root.append(list);
    return;
  }
  if (tool === "trace_path" && (Array.isArray(data.callees) || Array.isArray(data.callers))) {
    root.append(resultNode("p", "mb-3 font-medium text-foreground", `${data.function || tr("function")} · ${data.direction || tr("relations")}`));
    const list = resultNode("div", "space-y-2", "");
    for (const item of [...(Array.isArray(data.callers) ? data.callers : []), ...(Array.isArray(data.callees) ? data.callees : [])]) {
      if (item && typeof item === "object") appendSymbol(list, item as Record<string, unknown>, true);
    }
    root.append(list);
    return;
  }
  if (tool === "get_code_snippet" && typeof data.source === "string") {
    root.append(resultNode("h3", "break-words font-medium text-foreground", data.name || data.qualified_name));
    root.append(resultNode("p", "mt-1 break-all text-xs text-muted-foreground", `${data.file_path || ""}:${data.start_line || ""}`));
    root.append(resultNode("pre", "mt-3 overflow-x-auto whitespace-pre rounded-lg bg-muted/40 p-4 text-xs leading-relaxed text-foreground", data.source));
    return;
  }
  if (tool === "get_architecture" && (data.total_nodes != null || data.total_edges != null)) {
    const metrics = resultNode("div", "grid gap-3 sm:grid-cols-2", "");
    for (const [label, number] of [[tr("symbols"), data.total_nodes], [tr("relations"), data.total_edges]]) {
      const card = resultNode("div", "rounded-lg border border-border p-4", "");
      card.append(resultNode("div", "text-xs text-muted-foreground", label));
      card.append(resultNode("div", "mt-1 text-2xl font-semibold text-foreground", number));
      metrics.append(card);
    }
    root.append(metrics);
    return;
  }
  root.append(resultNode("pre", "overflow-x-auto whitespace-pre-wrap break-words text-xs", JSON.stringify(value, null, 2)));
}

async function loadProjects(run: number) {
  setError("");
  const res = await api.get<{ availability: { available: boolean }; projects: Project[] }>("/api/codebase-graph/projects");
  if (run !== generation || !$("codebase-graph-root")) return;
  const select = $("cg-project") as HTMLSelectElement;
  if (!res.ok) { setError(res.error || tr("projectsLoadFailed")); select.replaceChildren(new Option(tr("noProjects"), "")); return; }
  projects = res.data?.projects || [];
  select.replaceChildren(new Option(tr("selectProject"), ""), ...projects.map((project) => new Option(project.title || project.path, project.id)));
  const saved = readScopedPreference("codebase-graph", "project", "");
  if (projects.some((project) => project.id === saved)) select.value = saved;
  if (!res.data?.availability.available) setError(tr("graphUnavailable"));
  else if (!projects.length) setError(tr("noVisibleProjects"));
  refreshProjectState();
}

async function runQuery() {
  const project = selectedProject();
  if (!project) return;
  const tool = ($("cg-tool") as HTMLSelectElement).value;
  const query = ($("cg-query") as HTMLInputElement).value.trim();
  const args: Record<string, unknown> = {};
  if (["search_graph", "trace_path", "get_code_snippet"].includes(tool) && !query) { setError(tr("queryRequired")); return; }
  if (tool === "search_graph") { args.name_pattern = query; args.limit = Number(readScopedPreference("codebase-graph", "limit", "25")); }
  if (tool === "trace_path") { args.function_name = query; args.depth = 3; }
  if (tool === "get_code_snippet") args.qualified_name = query;
  setError("");
  const result = $("cg-result")!;
  const button = $("cg-run") as HTMLButtonElement;
  const run = generation;
  button.disabled = true;
  result.textContent = tr("queryingIndex");
  const res = await api.post<unknown>(`/api/codebase-graph/projects/${encodeURIComponent(project.id)}/query`, { tool, args });
  if (run !== generation || !$("codebase-graph-root")) return;
  if (res.ok) renderResult(res.data, tool);
  else result.textContent = res.error || tr("queryFailed");
  button.disabled = false;
}

function init() {
  if (!$("codebase-graph-root") || Date.now() - lastInit < SCRIPT_INIT_COOLDOWN_MS) return;
  lastInit = Date.now();
  generation++;
  const run = generation;
  const limit = $("cg-result-limit") as HTMLSelectElement;
  limit.value = readScopedPreference("codebase-graph", "limit", "25");
  limit.addEventListener("change", () => writeScopedPreference("codebase-graph", "limit", limit.value));
  $("cg-project")?.addEventListener("change", () => { writeScopedPreference("codebase-graph", "project", ($("cg-project") as HTMLSelectElement).value); refreshProjectState(); });
  $("cg-tool")?.addEventListener("change", setQueryMode);
  $("cg-run")?.addEventListener("click", runQuery);
  $("cg-show-original")?.addEventListener("click", () => showView("original"));
  $("cg-show-explorer")?.addEventListener("click", () => showView("explorer"));
  if (!$('cg-explorer')) return;
  setQueryMode();
  void loadProjects(run);
}

document.addEventListener("astro:before-swap", () => { generation++; });
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
window.addEventListener("luxipanel:target-changed", () => {
  if (!$('codebase-graph-root')) return;
  if (!$('cg-explorer')) return;
  generation++;
  showView("explorer");
  void loadProjects(generation);
});
init();

function showView(view: "original" | "explorer") {
  $("cg-original")?.classList.toggle("hidden", view !== "original");
  $("cg-explorer")?.classList.toggle("hidden", view !== "explorer");
  for (const [id, active] of [["cg-show-original", view === "original"], ["cg-show-explorer", view === "explorer"]] as const) {
    const button = $(id);
    if (!button) continue;
    button.setAttribute("aria-selected", String(active));
    button.classList.toggle("bg-primary", active);
    button.classList.toggle("text-primary-foreground", active);
    button.classList.toggle("border", !active);
    button.classList.toggle("border-border", !active);
  }
}
