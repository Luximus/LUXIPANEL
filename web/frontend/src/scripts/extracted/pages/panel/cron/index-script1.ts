// Cron Manager page script — entry point.
// Split into cohesive submodules (dom / providers / schedule-builder /
// text-filter / deps / jobs / agents / agent-presets / agent-bulk / logs /
// file-browser). This entry only wires them together + runs the canonical
// init() lifecycle. The submodules register their window.* onclick globals and
// the text-filter subscribers as a side effect of being imported here.
  import { watchModuleData } from "/scripts/extracted/lib/live-data.js";
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
  import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
  import { loadI18n, t, $ } from "./dom";
  import { syncTextFilterState } from "./text-filter";
  import { checkDeps, wireService } from "./deps";
  import { loadPresets, wirePresets } from "./agent-presets";
  import { loadProjects, loadAgents, wireAgents } from "./agents";
  import { wireJobs, loadJobs } from "./jobs";
  import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
  import { wireAgentBulk } from "./agent-bulk";
  import { wireLogs } from "./logs";
  import { wireFiles } from "./file-browser";

  // Re-runs on every fresh DOM (SPA swap replaces all elements, killing the
  // previous listeners). Must bind EVERYTHING that targets page elements.
  function wire() {
    wireJobs();
    wireAgents();
    wireLogs();
    wirePresets();
    wireAgentBulk();
    wireFiles();
    wireService();
    const selectTab = (tab: string) => {
      for (const name of ["jobs", "agents"]) {
        const active = name === tab;
        $("cron-" + name + "-pane")?.classList.toggle("hidden", !active);
        const button = $("cron-tab-" + name);
        button?.setAttribute("aria-selected", String(active));
        button?.classList.toggle("bg-card", active);
        button?.classList.toggle("shadow-sm", active);
        button?.classList.toggle("text-foreground", active);
        button?.classList.toggle("text-muted-foreground", !active);
      }
    };
    for (const tab of ["jobs", "agents"]) $("cron-tab-" + tab)?.addEventListener("click", () => {
      selectTab(tab);
      if (tab === "jobs") void loadJobs();
      else { void loadPresets(); void loadProjects(); void loadAgents(); }
    });
    if (new URLSearchParams(location.search).get("workspaceView") === "agents") selectTab("agents");

    // AI quick-ask: hand the question to the floating assistant in a fresh
    // chat and auto-send it. Module context tells the agent which cron.* tools
    // cover the full CRUD (jobs, AI agents, logs, presets/configuración).
    // Uses the unified `lxp:assistant:request` v1 contract so the handoff
    // lands on a NORMAL conversation (agentId:null, projectId:null) and is
    // delivered even when the FAB is hidden.
    $("cron-ai-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("cron-ai-input") as HTMLInputElement | null;
      const question = (input?.value ?? "").trim();
      if (!question) return;
      const prompt = `${question}\n\n` + t(
        "ai.contextPrompt",
        "(Contexto: estoy en el módulo Cron de LUXIPANEL. Tienes herramientas cron.* para CRUD completo de cron jobs IA programados (cron.ai_list/ai_add/ai_update/ai_remove/ai_run/ai_toggle, logs con cron.ai_logs/ai_read_log) y la configuración del módulo — categorías, tags por categoría y reglas predefinidas — con cron.presets_get/presets_set.)",
      );
      requestAssistant({
        kind: "prompt",
        prompt,
        submit: "auto",
        conversation: "new",
        origin: { module: "cron", action: "quickAsk" },
        target: { agentId: null, projectId: null },
      });
      if (input) input.value = "";
    });

    syncTextFilterState();
  }

  // Canonical init (see frontend/ARCHITECTURE.md §Scripts extraídos):
  // bindings re-run whenever the root element changed (fresh DOM after a SPA
  // swap); the cooldown only throttles the fetches, and a fresh DOM resets it
  // so re-entering the module always reloads the lists.
  let lastBoundRoot: Element | null = null;
  let initLastAt = 0;
  const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
  function init() {
    loadI18n();
    const root = $("cron-workspace");
    if (!root) return;
    if (root !== lastBoundRoot) {
      lastBoundRoot = root;
    watchModuleData(["cron/jobs"], () => loadJobs(), root);
      wire();
      initLastAt = 0;
    }
    if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
    initLastAt = Date.now();
    checkDeps();
    void (async () => {
      const select = $("cron-user") as HTMLSelectElement | null;
      if (!select) return;
      const res = await api.get<Array<{ username: string }>>("/api/cron/users");
      if (!res.ok || !Array.isArray(res.data)) return;
      const chosen = select.value;
      select.replaceChildren(...res.data.map((entry) => {
        const option = document.createElement("option"); option.value = entry.username; option.textContent = entry.username; return option;
      }));
      if ([...select.options].some((option) => option.value === chosen)) select.value = chosen;
    })();
    const drawerView = new URLSearchParams(location.search).get("workspaceView");
    if (drawerView !== "agents") void loadJobs();
    void loadPresets();
    if (drawerView !== "jobs") { void loadProjects(); void loadAgents(); }
    syncTextFilterState();
  }
  document.addEventListener("astro:page-load", init);
  document.addEventListener("astro:after-swap", init);
  init();
