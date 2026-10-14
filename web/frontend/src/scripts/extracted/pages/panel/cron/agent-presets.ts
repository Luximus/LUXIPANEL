// Cron page — agent presets (categories / tags-per-category / reusable rules)
// and the settings modal (auto-saved draft).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { t, esc, $, dlg, showToast } from "./dom";
import { agents, refreshFilterOptions } from "./agents";
import { refreshBulkSelectors } from "./agent-bulk";

  // ── Presets (categories / tags-per-category / reusable rules) ─────────────
  interface RulePreset { id: string; title: string; text: string }
  interface TagPreset { name: string; category: string }
  export let presets: { categories: string[]; tags: TagPreset[]; rules: RulePreset[] } = { categories: [], tags: [], rules: [] };
  export const uniqSorted = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((x, y) => x.localeCompare(y));

  /** Tag names available for a category: its preset tags + tags already used
   *  by agents of that category. Empty category ⇒ all tags. */
  export function tagNamesFor(category: string): string[] {
    const preset = presets.tags.filter((t) => !category || (t.category || "") === category).map((t) => t.name);
    const used = agents
      .filter((a) => !category || (a.category || "") === category)
      .flatMap((a) => a.tags ?? []);
    return uniqSorted([...preset, ...used]);
  }

  export async function loadPresets() {
    try {
      const res = await api.get<any>("/api/cron/agent-presets");
      if (res.ok && res.data) {
        presets = {
          categories: (res.data as any).categories ?? [],
          tags: (res.data as any).tags ?? [],
          rules: (res.data as any).rules ?? [],
        };
      }
    } catch { /* keep last known */ }
  }

  export function fillCategorySelect(selected?: string) {
    const sel = $("agent-category") as HTMLSelectElement | null; if (!sel) return;
    const cats = uniqSorted([...presets.categories, ...agents.map((a) => a.category)]);
    const noneLabel = sel.options[0]?.textContent || "—";
    sel.innerHTML = `<option value="">${esc(noneLabel)}</option>` + cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    if (selected && !cats.includes(selected)) {
      const o = document.createElement("option"); o.value = selected; o.textContent = selected; sel.appendChild(o);
    }
    sel.value = selected || "";
  }

  export const tagChipCls = (on: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"}`;

  export const selectedDialogTags = () =>
    Array.from(document.querySelectorAll<HTMLElement>('#agent-tags [data-tag][data-on="1"]')).map((b) => b.dataset.tag!);

  /** Toggleable tag chips (click to select/deselect) for the agent dialog. */
  export function fillTagsSelect(selected: string[], category?: string) {
    const box = $("agent-tags"); if (!box) return;
    const all = uniqSorted([...tagNamesFor(category ?? ""), ...selected]);
    box.innerHTML = all.length
      ? all.map((t) => {
          const on = selected.includes(t);
          return `<button type="button" data-tag="${esc(t)}" data-on="${on ? "1" : "0"}" class="${tagChipCls(on)}">${esc(t)}</button>`;
        }).join("")
      : `<span class="text-xs text-muted-foreground">—</span>`;
  }

  export const checkedRuleIds = () =>
    Array.from(document.querySelectorAll<HTMLInputElement>("#agent-rules-presets input[type=checkbox]:checked")).map((i) => i.value);

  /** Predefined rules as a checkbox list — stored by REFERENCE (ruleIds), so
   *  editing a preset updates every agent that selected it. */
  export function fillRulesPresetSelect(selectedIds: string[] = []) {
    const box = $("agent-rules-presets"); if (!box) return;
    box.innerHTML = presets.rules.length
      ? presets.rules.map((r) => `
        <label class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40" title="${esc(r.text)}">
          <input type="checkbox" value="${esc(r.id)}" ${selectedIds.includes(r.id) ? "checked" : ""} class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-input" />
          <span class="min-w-0">
            <span class="block text-sm">${esc(r.title)}</span>
            <span class="block truncate text-xs text-muted-foreground">${esc(r.text)}</span>
          </span>
        </label>`).join("")
      : `<div class="px-2 py-1.5 text-xs text-muted-foreground">—</div>`;
  }

  // ── Settings modal (edits a draft; persisted via PUT on save) ─────────────
  let psDraft: { categories: string[]; tags: TagPreset[]; rules: RulePreset[] } | null = null;

  function collectRulesDraft() {
    if (!psDraft) return;
    document.querySelectorAll<HTMLElement>("#ps-rules [data-rule-idx]").forEach((row) => {
      const i = parseInt(row.dataset.ruleIdx!, 10);
      const rule = psDraft!.rules[i]; if (!rule) return;
      rule.title = (row.querySelector("[data-ps-rule-title]") as HTMLInputElement)?.value ?? rule.title;
      rule.text = (row.querySelector("[data-ps-rule-text]") as HTMLTextAreaElement)?.value ?? rule.text;
    });
  }

  function renderPresetsModal() {
    if (!psDraft) return;
    const chip = (label: string, kind: string, val: string, cat = "") =>
      `<span class="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs">${label}<button type="button" data-ps-del="${kind}" data-val="${esc(val)}" data-cat="${esc(cat)}" class="text-muted-foreground hover:text-destructive"><i class="ti ti-x text-xs pointer-events-none"></i></button></span>`;
    $("ps-cats")!.innerHTML = psDraft.categories.map((c) => chip(esc(c), "cat", c)).join("") || `<span class="text-xs text-muted-foreground">—</span>`;
    // The category select doubles as the tag-list filter: selecting one shows
    // ONLY its tags; with none selected the tags render grouped per category.
    const catSel = $("ps-tag-cat") as HTMLSelectElement | null;
    if (catSel) {
      const cur = catSel.value;
      const first = catSel.options[0]?.outerHTML ?? `<option value=""></option>`;
      catSel.innerHTML = first + psDraft.categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
      catSel.value = psDraft.categories.includes(cur) ? cur : "";
    }
    const selCat = catSel?.value ?? "";
    const byName = (a: TagPreset, b: TagPreset) => a.name.localeCompare(b.name);
    const tagChips = (items: TagPreset[]) => items.slice().sort(byName).map((t) => chip(esc(t.name), "tag", t.name, t.category)).join("");
    let tagsHtml = "";
    if (selCat) {
      tagsHtml = tagChips(psDraft.tags.filter((t) => t.category === selCat));
    } else {
      const knownCats = psDraft.categories;
      const orphanCats = uniqSorted(psDraft.tags.map((t) => t.category).filter((c) => !knownCats.includes(c)));
      tagsHtml = [...knownCats, ...orphanCats].map((catName) => {
        const items = psDraft!.tags.filter((t) => t.category === catName);
        if (!items.length) return "";
        return `<div class="w-full">
          <div class="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">${esc(catName)}</div>
          <div class="flex flex-wrap gap-1.5">${tagChips(items)}</div>
        </div>`;
      }).join("");
    }
    $("ps-tags")!.innerHTML = tagsHtml || `<span class="text-xs text-muted-foreground">—</span>`;
    $("ps-rules")!.innerHTML = psDraft.rules.map((r, i) => `
      <div class="rounded-lg border border-border p-3 space-y-2" data-rule-idx="${i}">
        <div class="flex items-center gap-2">
          <input data-ps-rule-title type="text" value="${esc(r.title)}" maxlength="80" class="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none">
          <button type="button" data-ps-rule-del="${i}" class="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><i class="ti ti-trash text-sm pointer-events-none"></i></button>
        </div>
        <textarea data-ps-rule-text rows="2" class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none">${esc(r.text)}</textarea>
      </div>`).join("");
  }

  /** Internal modal tabs: "cats" (categorías/tags) | "rules" (reglas). */
  function switchPresetsTab(tab: string) {
    document.querySelectorAll<HTMLButtonElement>(".ps-tab").forEach((b) => {
      const active = b.dataset.psTab === tab;
      // Left-nav rail styling (matches DrawerSectionNav / the mail settings drawer).
      b.className = `ps-tab flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`;
    });
    $("ps-tab-cats")?.classList.toggle("hidden", tab !== "cats");
    $("ps-tab-rules")?.classList.toggle("hidden", tab !== "rules");
    $("ps-tab-rules")?.classList.toggle("flex", tab === "rules");
    $("ps-tab-service")?.classList.toggle("hidden", tab !== "service");
    $("ps-tab-service")?.classList.toggle("flex", tab === "service");
    $("ps-autosave")?.classList.toggle("hidden", tab === "service");
  }

  // The ViewSettingsModal component opens/closes its own <dialog>; here we only
  // (re)load the presets and render the editable draft into it.
  export async function openPresetsModal() {
    while (psSaving) await new Promise((resolve) => setTimeout(resolve, 25));
    if (psSaveTimer) { clearTimeout(psSaveTimer); psSaveTimer = null; }
    if (psDraft && !await persistPresets()) { renderPresetsModal(); return; }
    await loadPresets();
    psDraft = JSON.parse(JSON.stringify(presets));
    setAutosaveStatus("");
    switchPresetsTab("cats");
    renderPresetsModal();
  }

  // Auto-save: every change in the settings modal persists automatically
  // (debounced) — there is no save button. Status shows in the modal header.
  let psSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let psSaving = false;
  let psDirtyAgain = false;

  function setAutosaveStatus(text: string, error = false) {
    const el = $("ps-autosave"); if (!el) return;
    el.textContent = text;
    el.className = `mr-2 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`;
    el.classList.toggle("hidden", !$("ps-tab-service")?.classList.contains("hidden"));
  }

  function schedulePresetsSave(delayMs = 600) {
    if (!psDraft) return;
    setAutosaveStatus(t("presets.saving", "Guardando…"));
    if (psSaveTimer) clearTimeout(psSaveTimer);
    psSaveTimer = setTimeout(() => { psSaveTimer = null; void persistPresets(); }, delayMs);
  }

  async function persistPresets(): Promise<boolean> {
    if (!psDraft) return true;
    if (psSaving) { psDirtyAgain = true; return false; }
    psSaving = true;
    try {
      collectRulesDraft();
      // Save the document as a unit. Omitting an incomplete row would silently
      // delete a previously saved rule while its owner is still editing it.
      if (psDraft.rules.some((r) => !r.title.trim() || !r.text.trim())) {
        setAutosaveStatus(t("presets.completeRule", "Completa el nombre y el texto de cada regla"), true);
        return false;
      }
      const complete = psDraft.rules;
      const res = await api.put<any>("/api/cron/agent-presets", {
        categories: psDraft.categories,
        tags: psDraft.tags,
        rules: complete.map((r) => ({ id: r.id || undefined, title: r.title.trim(), text: r.text.trim() })),
      });
      if (!res.ok) { setAutosaveStatus(res.error ?? t("presets.saveError", "Error al guardar"), true); return false; }
      // Adopt server-assigned rule ids (payload order) WITHOUT re-rendering, so
      // typing focus is never lost mid-autosave.
      const saved: RulePreset[] = ((res.data as any)?.rules ?? []) as RulePreset[];
      complete.forEach((r, i) => { if (saved[i]?.id) r.id = saved[i].id; });
      presets = (res.data as any) ?? presets;
      setAutosaveStatus(t("presets.saved", "Guardado ✓"));
      refreshFilterOptions();
      refreshBulkSelectors();
      return true;
    } finally {
      psSaving = false;
      if (psDirtyAgain) { psDirtyAgain = false; schedulePresetsSave(200); }
    }
  }

  export function wirePresets() {
    // Settings modal (presets) — the trigger button lives in the panel navbar
    // (title-actions slot, ViewSettingsModal); the component opens the dialog,
    // we just populate the draft on each open.
    $("cron-settings-modal-trigger")?.addEventListener("click", () => void openPresetsModal());
    document.querySelectorAll<HTMLButtonElement>(".ps-tab").forEach((b) => b.addEventListener("click", () => switchPresetsTab(b.dataset.psTab!)));
    $("ps-cat-add")?.addEventListener("click", () => {
      const inp = $("ps-cat-in") as HTMLInputElement | null;
      const v = inp?.value.trim();
      if (!v || !psDraft) return;
      collectRulesDraft();
      if (!psDraft.categories.includes(v)) psDraft.categories.push(v);
      inp!.value = "";
      renderPresetsModal();
      schedulePresetsSave();
    });
    $("ps-tag-add")?.addEventListener("click", () => {
      const inp = $("ps-tag-in") as HTMLInputElement | null;
      const cat = ($("ps-tag-cat") as HTMLSelectElement | null)?.value ?? "";
      const v = inp?.value.trim();
      if (!v || !psDraft) return;
      // A tag must belong to a category — pick it first.
      if (!cat) { showToast(t("toasts.tagNeedsCategory", "Selecciona primero la categoría del tag"), false); return; }
      collectRulesDraft();
      if (!psDraft.tags.some((t) => t.name === v && t.category === cat)) psDraft.tags.push({ name: v, category: cat });
      inp!.value = "";
      renderPresetsModal();
      schedulePresetsSave();
    });
    $("ps-rule-add")?.addEventListener("click", () => {
      if (!psDraft) return;
      collectRulesDraft();
      psDraft.rules.push({ id: "", title: "", text: "" });
      renderPresetsModal();
      setAutosaveStatus(t("presets.completeRule", "Completa el nombre y el texto de cada regla"));
    });
    // Rule title/text edits auto-save while typing (debounced).
    $("ps-rules")?.addEventListener("input", () => schedulePresetsSave());
    // Changing the tag-category select re-filters the tag chips (no save).
    $("ps-tag-cat")?.addEventListener("change", () => { collectRulesDraft(); renderPresetsModal(); });
    dlg("cron-settings-modal")?.addEventListener("click", (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-ps-del],[data-ps-rule-del]");
      if (!t || !psDraft) return;
      collectRulesDraft();
      if (t.dataset.psDel === "cat") {
        psDraft.categories = psDraft.categories.filter((c) => c !== t.dataset.val);
        // Cascade: a category's tags die with it.
        psDraft.tags = psDraft.tags.filter((x) => x.category !== t.dataset.val);
      } else if (t.dataset.psDel === "tag") {
        psDraft.tags = psDraft.tags.filter((x) => !(x.name === t.dataset.val && x.category === (t.dataset.cat ?? "")));
      } else if (t.dataset.psRuleDel !== undefined) {
        psDraft.rules.splice(parseInt(t.dataset.psRuleDel!, 10), 1);
      } else {
        return;
      }
      renderPresetsModal();
      schedulePresetsSave();
    });
  }
