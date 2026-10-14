// Cron page — AI agents bulk selection bar + bulk quick actions.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { t, fmt, $, esc, showToast } from "./dom";
import { PROVIDER_MODELS, PROVIDER_LABELS } from "./providers";
import { presets, tagNamesFor, uniqSorted } from "./agent-presets";
import { agents, projects, agentPaths, visibleAgents, renderAgents, loadAgents } from "./agents";

  // ── Bulk selection + quick actions ────────────────────────────────────────
  export const selectedAgents = new Set<string>();

  export function updateBulkBar() {
    const bar = $("agents-bulk"); if (!bar) return;
    const n = selectedAgents.size;
    const cnt = $("bulk-count"); if (cnt) cnt.textContent = String(n);
    bar.classList.toggle("hidden", n === 0);
    bar.classList.toggle("flex", n > 0);
    syncAgentsSelectAllState();
  }

  export function syncAgentsSelectAllState() {
    const all = $("af-select-all") as HTMLInputElement | null;
    if (!all) return;
    const view = visibleAgents();
    const selected = view.filter((agent) => selectedAgents.has(agent.id)).length;
    all.checked = view.length > 0 && selected === view.length;
    all.indeterminate = selected > 0 && selected < view.length;
  }

  export function refreshBulkSelectors() {
    const catSel = $("bulk-category") as HTMLSelectElement | null;
    if (catSel) {
      const cur = catSel.value;
      const first = catSel.options[0]?.outerHTML ?? `<option value=""></option>`;
      const cats = uniqSorted([...presets.categories, ...agents.map((a) => a.category)]);
      catSel.innerHTML = first + cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
      catSel.value = cats.includes(cur) ? cur : "";
    }
    const tagBox = $("bulk-tags");
    if (tagBox) {
      const cur = bulkCheckedTags();
      const tags = tagNamesFor(($("bulk-category") as HTMLSelectElement | null)?.value ?? "");
      tagBox.innerHTML = tags.length
        ? tags.map((t) => `
          <label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/40">
            <input type="checkbox" value="${esc(t)}" ${cur.includes(t) ? "checked" : ""} class="h-3.5 w-3.5 shrink-0 rounded border-input" />
            <span class="truncate text-xs">${esc(t)}</span>
          </label>`).join("")
        : `<div class="px-2 py-1.5 text-xs text-muted-foreground">—</div>`;
    }
    refreshBulkAssignmentSelectors();
  }

  const bulkCheckedTags = () =>
    Array.from(document.querySelectorAll<HTMLInputElement>("#bulk-tags input[type=checkbox]:checked")).map((i) => i.value);

  const bulkCheckedProjects = () =>
    Array.from(document.querySelectorAll<HTMLInputElement>("#bulk-projects input[type=checkbox]:checked")).map((i) => i.value);

  /** Bulk projects / AI provider / model selectors (selection preserved on refresh). */
  function refreshBulkAssignmentSelectors() {
    const projBox = $("bulk-projects");
    if (projBox) {
      const cur = bulkCheckedProjects();
      const all = uniqSorted([...projects.map((p: any) => p.path), ...agents.flatMap(agentPaths)]);
      const row = (value: string, label: string, extraCls = "") => `
        <label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/40 ${extraCls}">
          <input type="checkbox" value="${esc(value)}" ${cur.includes(value) ? "checked" : ""} class="h-3.5 w-3.5 shrink-0 rounded border-input" />
          <span class="truncate text-xs">${label}</span>
        </label>`;
      projBox.innerHTML =
        row("__none", esc((projBox as HTMLElement).dataset.removeLabel || "(Quitar todos)"), "text-destructive") +
        (all.length ? all.map((p) => row(p, esc(p))).join("") : `<div class="px-2 py-1.5 text-xs text-muted-foreground">—</div>`);
    }
    const provSel = $("bulk-provider") as HTMLSelectElement | null;
    if (provSel && provSel.options.length <= 1) {
      const first = provSel.options[0]?.outerHTML ?? `<option value=""></option>`;
      provSel.innerHTML = first + Object.keys(PROVIDER_MODELS).map((p) => `<option value="${p}">${PROVIDER_LABELS[p]}</option>`).join("");
    }
    refreshBulkModelOptions();
  }

  function refreshBulkModelOptions() {
    const modelSel = $("bulk-model") as HTMLSelectElement | null;
    if (!modelSel) return;
    const provider = ($("bulk-provider") as HTMLSelectElement | null)?.value ?? "";
    const cur = modelSel.value;
    const first = modelSel.options[0]?.outerHTML ?? `<option value=""></option>`;
    const models = provider ? (PROVIDER_MODELS[provider] ?? []) : [];
    modelSel.innerHTML =
      first +
      (provider ? `<option value="__default">${t("models.default", "Modelo por defecto")}</option>` : "") +
      models.map((m) => `<option value="${m}">${m}</option>`).join("");
    modelSel.value = Array.from(modelSel.options).some((o) => o.value === cur) ? cur : "";
  }

  async function bulkPatch(patch: Record<string, unknown>) {
    const ids = [...selectedAgents]; if (!ids.length) return;
    const res = await api.post<any>("/api/cron/ai-jobs/bulk", { ids, patch });
    if (res.ok) { showToast(fmt(t("toasts.bulkUpdated", "Actualizados {n} agentes"), { n: (res.data as any)?.updated ?? ids.length })); await loadAgents(); }
    else showToast(res.error ?? t("toasts.bulkApplyError", "Error al aplicar cambios"), false);
  }

  export function wireAgentBulk() {
    $("bulk-category")?.addEventListener("change", () => refreshBulkSelectors());

    // Bulk selection + quick actions — AI agents
    $("agents-list")?.addEventListener("change", (e) => {
      const cb = e.target as HTMLInputElement;
      if (!cb?.classList?.contains("agent-pick")) return;
      if (cb.checked) selectedAgents.add(cb.dataset.id!); else selectedAgents.delete(cb.dataset.id!);
      updateBulkBar();
    });
    $("af-select-all")?.addEventListener("change", () => {
      const on = ($("af-select-all") as HTMLInputElement).checked;
      selectedAgents.clear();
      if (on) visibleAgents().forEach((a) => selectedAgents.add(a.id));
      updateBulkBar();
      renderAgents();
    });
    $("bulk-provider")?.addEventListener("change", () => refreshBulkModelOptions());
    $("bulk-apply")?.addEventListener("click", () => {
      const patch: Record<string, unknown> = {};
      const cat = ($("bulk-category") as HTMLSelectElement).value;
      const tags = bulkCheckedTags();
      const mode = ($("bulk-mode") as HTMLSelectElement).value;
      if (cat) patch.category = cat;
      if (tags.length) patch.tags = tags;
      if (mode) patch.agentMode = mode;
      // Projects: the checked list REPLACES the assignment; "__none" clears it.
      const projs = bulkCheckedProjects();
      if (projs.includes("__none")) patch.projectPaths = [];
      else if (projs.length) patch.projectPaths = projs;
      const provider = ($("bulk-provider") as HTMLSelectElement).value;
      if (provider) patch.providerId = provider;
      const model = ($("bulk-model") as HTMLSelectElement).value;
      if (model) patch.model = model === "__default" ? "" : model;
      if (!Object.keys(patch).length) { showToast(t("toasts.selectChange", "Selecciona qué cambiar"), false); return; }
      ($("bulk-tags-dd") as HTMLDetailsElement | null)?.removeAttribute("open");
      ($("bulk-projects-dd") as HTMLDetailsElement | null)?.removeAttribute("open");
      void bulkPatch(patch);
    });
    $("bulk-enable")?.addEventListener("click", () => void bulkPatch({ enabled: true }));
    $("bulk-pause")?.addEventListener("click", () => void bulkPatch({ enabled: false }));
    $("bulk-delete")?.addEventListener("click", async () => {
      const ids = [...selectedAgents]; if (!ids.length) return;
      if (!await openConfirm(fmt(t("confirm.deleteAgents", "¿Eliminar {n} agente(s) seleccionado(s)?"), { n: ids.length }), { title: t("confirm.deleteAgentsTitle", "Eliminar agentes"), variant: "danger" })) return;
      for (const id of ids) await api.delete(`/api/cron/ai-jobs/${id}`);
      selectedAgents.clear();
      updateBulkBar();
      showToast(t("toasts.agentsDeleted", "Agentes eliminados"));
      loadAgents();
    });
    $("bulk-clear")?.addEventListener("click", () => {
      selectedAgents.clear();
      const all = $("af-select-all") as HTMLInputElement | null; if (all) all.checked = false;
      updateBulkBar();
      renderAgents();
    });
  }
