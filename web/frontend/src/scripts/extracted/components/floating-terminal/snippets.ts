// Floating terminal — database-backed snippets (categories/tags/snippets):
// dialog, list rendering, DataTable bridge for categories/tags.
import { S, sessions, escapeHtml, type SnippetCategory, type SnippetTag, type SnippetItem, type SnippetState } from "./state";
import { I18N, tI18n } from "./i18n";
import { api } from "@/lib/api-client";
import { TerminalWsMsg } from "@/lib/terminal-ws-protocol";
import { DATATABLE_EVENTS } from "@/lib/datatable-events";
import { openConfirm, openAlert } from "@/lib/confirm";
import { acquireBodyPointerEvents, releaseBodyPointerEvents } from "@/lib/body-pointer-events";
import { applyShellHighlight, initSnippetCommandEditor } from "./editor";
import { pushHistory } from "./history";

  const SNIPPET_PAGE_SIZE = 7;
  const snippetStateRefs = {
    categorySelect: () => document.getElementById("snippet-category") as HTMLSelectElement | null,
    categoryFilter: () => document.getElementById("snippet-cat") as HTMLSelectElement | null,
    tagFilter: () => document.getElementById("snippet-tag-filters") as HTMLDivElement | null,
    snippetTagBox: () => document.getElementById("snippet-tags") as HTMLDivElement | null,
    settingsTagCategory: () => document.getElementById("tag-category-select") as HTMLSelectElement | null,
  };

  function sendToTerminal(cmd: string) {
    const session = sessions.get(S.activeTabId);
    if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) return;
    pushHistory(cmd);
    session.ws.send(JSON.stringify({ type: TerminalWsMsg.INPUT, data: cmd + "\r" }));
    session.term.focus();
  }

  function categoryName(categoryId: number): string {
    return S.snippetState.categories.find((cat) => cat.id === categoryId)?.name ?? I18N.categorySelect.uncategorized;
  }

  function tagsForCategory(categoryId: number): SnippetTag[] {
    return S.snippetState.tags.filter((tag) => tag.categoryId === categoryId);
  }

  function selectedFilterCategoryId(): number {
    const value = snippetStateRefs.categoryFilter()?.value ?? "";
    return value ? Number(value) : 0;
  }

  function selectedTagManagerCategoryId(): number {
    const value = snippetStateRefs.settingsTagCategory()?.value ?? "";
    return value ? Number(value) : 0;
  }

  function renderCategoryOptions(select: HTMLSelectElement | null, selectedId = "") {
    if (!select) return;
    // Colapsa duplicados por id y por nombre (case-insensitive) para que el
    // picker/filtro nunca muestre la misma categoría dos veces, aunque el
    // backend devuelva duplicados (carrera de creación no atómica, etc.).
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const uniqueCats = S.snippetState.categories.filter((cat) => {
      const idKey = String(cat.id);
      if (seenIds.has(idKey)) return false;
      seenIds.add(idKey);
      const nameKey = cat.name.trim().toLowerCase();
      if (seenNames.has(nameKey)) return false;
      seenNames.add(nameKey);
      return true;
    });
    const options = uniqueCats
      .map((cat) => `<option value="${cat.id}" ${String(cat.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(cat.name)}</option>`)
      .join("");
    select.innerHTML = uniqueCats.length
      ? `<option value="">${escapeHtml(I18N.categorySelect.selectCategory)}</option>${options}`
      : `<option value="">${escapeHtml(I18N.categorySelect.noCategories)}</option>`;
    select.disabled = uniqueCats.length === 0;
  }

  function pushSnippetsToDataTables(): void {
    // Las tablas Categorías/Tags se renderizan vía el componente React DataTable.
    // Aquí solo empujamos los datos por evento; las acciones (edit/delete) se
    // reciben de vuelta como CustomEvents desde el DataTable.
    window.dispatchEvent(
      new CustomEvent(DATATABLE_EVENTS.SET_DATA, {
        detail: {
          tableId: "terminal-categories-table",
          data: S.snippetState.categories.map((cat) => ({ id: cat.id, name: cat.name })),
        },
      }),
    );

    const categoriesById = new Map(S.snippetState.categories.map((cat) => [cat.id, cat.name] as const));
    window.dispatchEvent(
      new CustomEvent(DATATABLE_EVENTS.SET_DATA, {
        detail: {
          tableId: "terminal-tags-table",
          data: S.snippetState.tags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            categoryId: tag.categoryId,
            categoryName: categoriesById.get(tag.categoryId) ?? "—",
          })),
        },
      }),
    );

    // El ConfigPanel React necesita conocer las categorías para construir el
    // filtro select del DataTable de tags (las opciones dependen de los nombres
    // de categoría actuales).
    window.dispatchEvent(
      new CustomEvent("lxp-terminal:snippets-changed", {
        detail: {
          categories: S.snippetState.categories.map((cat) => ({ id: cat.id, name: cat.name })),
          tags: S.snippetState.tags.map((tag) => ({ id: tag.id, name: tag.name, categoryId: tag.categoryId })),
        },
      }),
    );
  }

  function renderSnippetTagFilters() {
    const wrap = snippetStateRefs.tagFilter();
    const categoryId = selectedFilterCategoryId();
    if (!wrap) return;

    if (!categoryId) {
      S.snippetFilterTagIds = [];
      wrap.innerHTML = `<p class="text-[11px] text-muted-foreground">${escapeHtml(I18N.snippetList.selectCategoryToFilter)}</p>`;
      return;
    }

    const tags = tagsForCategory(categoryId);
    if (tags.length === 0) {
      S.snippetFilterTagIds = [];
      wrap.innerHTML = `<p class="text-[11px] text-muted-foreground">${escapeHtml(I18N.snippetList.categoryNoTags)}</p>`;
      return;
    }

    wrap.innerHTML = tags.map((tag) => {
      const active = S.snippetFilterTagIds.includes(tag.id);
      return `
        <button type="button"
          class="rounded-full border px-2 py-1 text-[11px] transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"}"
          onclick="toggleSnippetFilterTag(${tag.id})">${escapeHtml(tag.name)}</button>
      `;
    }).join("");
  }

  function renderSnippetDialogTags() {
    const wrap = snippetStateRefs.snippetTagBox();
    const categorySelect = snippetStateRefs.categorySelect();
    if (!wrap || !categorySelect) return;

    const categoryId = categorySelect.value ? Number(categorySelect.value) : 0;
    if (!categoryId) {
      S.snippetDialogTagIds = [];
      wrap.innerHTML = `<div class="col-span-2 rounded-lg border border-dashed border-border px-4 py-5 text-xs text-muted-foreground">${escapeHtml(I18N.snippetList.selectCategoryToSeeTags)}</div>`;
      return;
    }

    const tags = tagsForCategory(categoryId);
    if (tags.length === 0) {
      S.snippetDialogTagIds = [];
      wrap.innerHTML = `<div class="col-span-2 rounded-lg border border-dashed border-border px-4 py-5 text-xs text-muted-foreground">${escapeHtml(I18N.snippetList.categoryNoTags)}</div>`;
      return;
    }

    S.snippetDialogTagIds = S.snippetDialogTagIds.filter((tagId) => tags.some((tag) => tag.id === tagId));
    wrap.innerHTML = tags.map((tag) => {
      const checked = S.snippetDialogTagIds.includes(tag.id);
      return `
        <label class="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <input type="checkbox" class="h-3.5 w-3.5 accent-primary" ${checked ? "checked" : ""} onchange="toggleSnippetDialogTag(${tag.id}, this.checked)" />
          <span class="truncate">${escapeHtml(tag.name)}</span>
        </label>
      `;
    }).join("");
  }

  function renderSnippetCategorySelectors(selectedSnippetCategoryId?: number) {
    renderCategoryOptions(snippetStateRefs.categorySelect(), String(selectedSnippetCategoryId ?? ""));
    renderCategoryOptions(snippetStateRefs.categoryFilter(), String(selectedFilterCategoryId() || ""));
    // OJO: `#tag-category-select` lo renderiza React (ConfigPanel) de forma
    // reactiva desde `snippetsSnapshot.categories`. Si además lo poblamos aquí
    // por innerHTML hay doble propietario del mismo <select> → opciones
    // duplicadas. Lo dejamos en manos de React; aquí solo leemos/seteamos
    // `.value` (selectedTagManagerCategoryId / renderTagManager).
  }


  const standaloneSnippetRoots = new WeakSet<HTMLElement>();
  function bindStandaloneSnippetActions(root: HTMLElement) {
    if (standaloneSnippetRoots.has(root)) return;
    standaloneSnippetRoots.add(root);
    root.addEventListener("click", event => {
      const trigger = (event.target as Element)?.closest<HTMLElement>("[data-lxp-handler-click]");
      if (!trigger || !root.contains(trigger)) return;
      const match = trigger.dataset.lxpHandlerClick?.match(/^(runSnippet|editSnippet|deleteSnippet|snippetSetPage)\((-?\d+)\)$/);
      if (!match) return;
      event.preventDefault(); event.stopPropagation();
      (window as any)[match[1]!]?.(Number(match[2]));
    });
  }
  function renderSnippetList() {
    const listEl = document.getElementById("snippet-list");
    if (!listEl) return;
    let pager = document.getElementById("snippet-pagination");
    if (!pager) { pager = document.createElement("div"); pager.id = "snippet-pagination"; pager.className = "shrink-0"; listEl.after(pager); }

    const panel = document.getElementById("panel-snippets");
    if (panel) bindStandaloneSnippetActions(panel);
    const query = (document.getElementById("snippet-search") as HTMLInputElement | null)?.value.trim().toLowerCase() ?? "";
    const categoryId = selectedFilterCategoryId();
    const tagIds = S.snippetFilterTagIds.slice();

    const filtered = S.snippetState.snippets.filter((snippet) => {
      if (categoryId && snippet.categoryId !== categoryId) return false;
      if (query && !snippet.name.toLowerCase().includes(query) && !snippet.command.toLowerCase().includes(query)) return false;
      if (tagIds.length > 0 && !tagIds.every((tagId) => snippet.tagIds.includes(tagId))) return false;
      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="py-8 text-center text-xs text-muted-foreground">
        <i class="ti ti-code text-2xl block mb-2 opacity-30 mx-auto"></i>
        ${S.snippetState.snippets.length === 0 ? escapeHtml(I18N.snippetList.empty) : escapeHtml(I18N.snippetList.noResults)}
      </div>`;
      pager.innerHTML = "";
      applyShellHighlight(listEl);
      return;
    }

    // Paginación: 7 resultados por página sobre la lista YA filtrada. Se
    // agrupan por categoría solo los items de la página actual.
    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / SNIPPET_PAGE_SIZE));
    if (S.snippetPage > pageCount - 1) S.snippetPage = pageCount - 1;
    if (S.snippetPage < 0) S.snippetPage = 0;
    const start = S.snippetPage * SNIPPET_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + SNIPPET_PAGE_SIZE);

    const grouped = new Map<string, SnippetItem[]>();
    for (const snippet of pageItems) {
      const key = categoryName(snippet.categoryId);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(snippet);
    }

    const listHtml = Array.from(grouped.entries()).map(([group, items]) => `
      <div class="mb-2">
        ${!categoryId || grouped.size > 1 ? `<p class="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">${escapeHtml(group)}</p>` : ""}
        ${items.map((snippet) => {
          const tagNames = snippet.tagIds
            .map((tagId) => S.snippetState.tags.find((tag) => tag.id === tagId)?.name)
            .filter((name): name is string => Boolean(name));
          return `
            <article class="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-muted-foreground/50 hover:bg-accent/40" data-snippet-card="${snippet.id}">
              <button type="button" class="flex w-full flex-col gap-2 p-3 pr-16 text-left" data-lxp-handler-click="runSnippet(${snippet.id})" title="${escapeHtml(snippet.command)}">
                <span class="break-words text-sm font-medium">${escapeHtml(snippet.name)}</span>
                <code class="block w-full break-all font-mono text-xs text-muted-foreground" data-shell-highlight="${escapeHtml(snippet.command)}">${escapeHtml(snippet.command)}</code>
                ${tagNames.length ? `<span class="flex flex-wrap gap-1">${tagNames.map((tag) => `<span class="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">${escapeHtml(tag)}</span>`).join("")}</span>` : ""}
              </button>
              <div class="absolute right-2 top-2 flex gap-1">
                <button type="button" data-lxp-handler-click="editSnippet(${snippet.id})" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="${escapeHtml(I18N.snippetList.editTitle)}" aria-label="${escapeHtml(I18N.snippetList.editAria)}"><i class="ti ti-pencil text-sm"></i></button>
                <button type="button" data-lxp-handler-click="deleteSnippet(${snippet.id})" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive" title="${escapeHtml(I18N.snippetList.deleteTitle)}" aria-label="${escapeHtml(I18N.snippetList.deleteAria)}"><i class="ti ti-trash text-sm"></i></button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `).join("");

    const rangeEnd = start + pageItems.length;
    const pagerHtml = pageCount > 1
      ? `
        <div class="mt-1 flex items-center justify-between gap-2 border-t border-border px-2 py-2">
          <button type="button" data-lxp-handler-click="snippetSetPage(${S.snippetPage - 1})" ${S.snippetPage <= 0 ? "disabled" : ""}
            class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="${escapeHtml(I18N.snippetList.prevPageAria)}">
            <i class="ti ti-chevron-left text-xs"></i> ${escapeHtml(I18N.snippetList.prevPage)}
          </button>
          <span class="text-[10px] text-muted-foreground">${escapeHtml(tI18n(I18N.snippetList.pageInfo, { start: start + 1, end: rangeEnd, total, page: S.snippetPage + 1, pageCount }))}</span>
          <button type="button" data-lxp-handler-click="snippetSetPage(${S.snippetPage + 1})" ${S.snippetPage >= pageCount - 1 ? "disabled" : ""}
            class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="${escapeHtml(I18N.snippetList.nextPageAria)}">
            ${escapeHtml(I18N.snippetList.nextPage)} <i class="ti ti-chevron-right text-xs"></i>
          </button>
        </div>`
      : "";

    listEl.innerHTML = listHtml;
    pager.innerHTML = pagerHtml;
    applyShellHighlight(listEl);
  }

  function renderSnippetUI(selectedSnippetCategoryId?: number) {
    renderSnippetCategorySelectors(selectedSnippetCategoryId);
    renderSnippetTagFilters();
    renderSnippetDialogTags();
    pushSnippetsToDataTables();
    renderSnippetList();
  }

  async function loadSnippetState() {
    const res = await api.get<SnippetState>("/api/terminal/snippets");
    if (!res.ok || !res.data) {
      throw new Error(res.error || I18N.errors.loadSnippets);
    }
    S.snippetState = res.data;
  }

  async function saveSnippetState() {
    await loadSnippetState();
    renderSnippetUI();
  }

  async function mutateSnippet(action: () => Promise<{ ok: boolean; error?: string }>) {
    const result = await action();
    if (!result.ok) {
      throw new Error(result.error || I18N.errors.saveGeneric);
    }
    await saveSnippetState();
  }

  function setCategoryForm(category?: SnippetCategory) {
    const editId = document.getElementById("category-edit-id") as HTMLInputElement | null;
    const nameEl = document.getElementById("category-name") as HTMLInputElement | null;
    if (editId) editId.value = category ? String(category.id) : "";
    if (nameEl) nameEl.value = category?.name ?? "";
  }

  function setTagForm(tag?: SnippetTag) {
    const categorySelect = snippetStateRefs.settingsTagCategory();
    const editId = document.getElementById("tag-edit-id") as HTMLInputElement | null;
    const nameEl = document.getElementById("tag-name") as HTMLInputElement | null;
    if (editId) editId.value = tag ? String(tag.id) : "";
    if (nameEl) nameEl.value = tag?.name ?? "";
    if (categorySelect) {
      categorySelect.value = tag ? String(tag.categoryId) : categorySelect.value || S.snippetState.categories[0]?.id?.toString() || "";
      categorySelect.disabled = false;
    }
  }

  function resetCategoryForm() {
    setCategoryForm();
  }

  function resetTagForm() {
    setTagForm();
  }

  function resetSnippetForm() {
    (document.getElementById("snippet-edit-id") as HTMLInputElement).value = "";
    (document.getElementById("snippet-name") as HTMLInputElement).value = "";
    (document.getElementById("snippet-cmd") as HTMLTextAreaElement).value = "";
    window.__lxpTerminalCommandEditor?.setValue("");
    const categorySelect = snippetStateRefs.categorySelect();
    if (categorySelect) {
      categorySelect.value = S.snippetState.categories[0]?.id?.toString() || "";
    }
    S.snippetDialogTagIds = [];
    renderSnippetDialogTags();
    document.getElementById("snippet-dialog-title")!.textContent = I18N.dialog.newSnippetTitle;
  }

  function openSnippetDialog(snippet?: SnippetItem) {
    if (snippet) {
      (document.getElementById("snippet-edit-id") as HTMLInputElement).value = String(snippet.id);
      (document.getElementById("snippet-name") as HTMLInputElement).value = snippet.name;
      (document.getElementById("snippet-cmd") as HTMLTextAreaElement).value = snippet.command;
      window.__lxpTerminalCommandEditor?.setValue(snippet.command);
      const categorySelect = snippetStateRefs.categorySelect();
      if (categorySelect) categorySelect.value = String(snippet.categoryId);
      S.snippetDialogTagIds = snippet.tagIds.slice();
      document.getElementById("snippet-dialog-title")!.textContent = I18N.dialog.editSnippetTitle;
    } else {
      resetSnippetForm();
    }
    renderSnippetDialogTags();
    const dialog = document.getElementById("dialog-snippet") as HTMLDialogElement;
    // The terminal drawer (vaul/Radix) leaves `body { pointer-events: none }`,
    // which this native modal would inherit — making its name field and Monaco
    // editor un-clickable. Re-enable body pointer events while it's open and
    // restore on close (the `close` event covers Escape/cancel/submit too).
    if (!dialog.dataset.lxpPeBound) {
      dialog.dataset.lxpPeBound = "1";
      dialog.addEventListener("close", () => releaseBodyPointerEvents());
    }
    if (!dialog.open) acquireBodyPointerEvents();
    dialog.showModal();
    void initSnippetCommandEditor().then(() => {
      if (!dialog.open) return;
      window.__lxpTerminalCommandEditor?.layout();
      window.__lxpTerminalCommandEditor?.focus();
    }).catch(() => {
      // Editing remains possible if the optional Monaco asset cannot load.
      const textarea = document.getElementById("snippet-cmd") as HTMLTextAreaElement | null;
      document.getElementById("snippet-cmd-editor")?.classList.add("hidden");
      textarea?.classList.remove("hidden");
      textarea?.focus();
    });
  }

  (window as any).snippetSetPage = (page: number) => {
    const next = Number(page);
    if (!Number.isFinite(next)) return;
    S.snippetPage = Math.max(0, Math.trunc(next));
    renderSnippetList();
    document.getElementById("snippet-list")?.scrollTo({ top: 0 });
  };

  (window as any).runSnippet = (id: number) => {
    const snip = S.snippetState.snippets.find((item) => item.id === id);
    if (!snip) return;
    // Pasamos por el evento de inyección (con reintentos) para no perder el
    // comando si el usuario hace click antes de que el WS esté abierto o si
    // aún no hay sesión activa creada.
    window.dispatchEvent(
      new CustomEvent("lxp-terminal:inject-command", {
        detail: { command: snip.command, run: true },
      }),
    );
  };

  (window as any).editSnippet = (id: number) => {
    const snip = S.snippetState.snippets.find((item) => item.id === id);
    if (snip) openSnippetDialog(snip);
  };

  (window as any).deleteSnippet = async (id: number) => {
    if (!await openConfirm(I18N.confirm.deleteSnippetMsg, { title: I18N.confirm.deleteSnippetTitle, variant: "danger" })) return;
    await mutateSnippet(() => api.delete(`/api/terminal/snippets/${id}`));
  };

  // Las acciones de edit/delete sobre categorías y tags ahora llegan vía
  // CustomEvents desde DataTable (bindSnippetsDataTableEvents) en lugar de
  // funciones globales onclick.

  (window as any).toggleSnippetFilterTag = (tagId: number) => {
    if (S.snippetFilterTagIds.includes(tagId)) {
      S.snippetFilterTagIds = S.snippetFilterTagIds.filter((value) => value !== tagId);
    } else {
      S.snippetFilterTagIds = [...S.snippetFilterTagIds, tagId];
    }
    S.snippetPage = 0; // al cambiar el filtro de tags, volver a la primera página
    renderSnippetList();
    renderSnippetTagFilters();
  };

  (window as any).toggleSnippetDialogTag = (tagId: number, checked: boolean) => {
    if (checked) {
      if (!S.snippetDialogTagIds.includes(tagId)) S.snippetDialogTagIds = [...S.snippetDialogTagIds, tagId];
    } else {
      S.snippetDialogTagIds = S.snippetDialogTagIds.filter((value) => value !== tagId);
    }
  };

  let snippetsDataTableEventsBound = false;
  function bindSnippetsDataTableEvents(): void {
    if (snippetsDataTableEventsBound) return;
    snippetsDataTableEventsBound = true;

    type RowActionDetail = {
      tableId: string;
      actionId: string;
      row: Record<string, unknown>;
    };
    type QuickActionDetail = {
      tableId: string;
      actionId: string;
      rows: Record<string, unknown>[];
    };

    window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (async (event: Event) => {
      const detail = (event as CustomEvent<RowActionDetail>).detail;
      if (!detail) return;
      const row = detail.row ?? {};
      const id = Number(row.id);
      if (!Number.isFinite(id)) return;

      if (detail.tableId === "terminal-categories-table") {
        if (detail.actionId === "edit") {
          const category = S.snippetState.categories.find((cat) => cat.id === id);
          if (!category) return;
          setCategoryForm(category);
          (document.getElementById("category-name") as HTMLInputElement | null)?.focus();
        } else if (detail.actionId === "delete") {
          if (!await openConfirm(I18N.confirm.deleteCategoryMsg, { title: I18N.confirm.deleteCategoryTitle, variant: "danger" })) return;
          await mutateSnippet(() => api.delete(`/api/terminal/snippets/categories/${id}`));
        }
      } else if (detail.tableId === "terminal-tags-table") {
        if (detail.actionId === "edit") {
          const tag = S.snippetState.tags.find((item) => item.id === id);
          if (!tag) return;
          setTagForm(tag);
          (document.getElementById("tag-name") as HTMLInputElement | null)?.focus();
        } else if (detail.actionId === "delete") {
          if (!await openConfirm(I18N.confirm.deleteTagMsg, { title: I18N.confirm.deleteTagTitle, variant: "danger" })) return;
          await mutateSnippet(() => api.delete(`/api/terminal/snippets/tags/${id}`));
        }
      }
    }) as EventListener);

    window.addEventListener(DATATABLE_EVENTS.QUICK_ACTION, (async (event: Event) => {
      const detail = (event as CustomEvent<QuickActionDetail>).detail;
      if (!detail || detail.actionId !== "delete") return;
      const ids = (detail.rows ?? [])
        .map((row) => Number((row as { id?: unknown }).id))
        .filter((value) => Number.isFinite(value));
      if (ids.length === 0) return;

      if (detail.tableId === "terminal-categories-table") {
        const label = ids.length === 1
          ? I18N.confirm.deleteOneCategory
          : tI18n(I18N.confirm.deleteManyCategories, { count: ids.length });
        if (!await openConfirm(tI18n(I18N.confirm.deleteCategoriesMsg, { label }), { title: I18N.confirm.deleteCategoriesTitle, variant: "danger" })) return;
        for (const id of ids) {
          await mutateSnippet(() => api.delete(`/api/terminal/snippets/categories/${id}`));
        }
      } else if (detail.tableId === "terminal-tags-table") {
        const label = ids.length === 1
          ? I18N.confirm.deleteOneTag
          : tI18n(I18N.confirm.deleteManyTags, { count: ids.length });
        if (!await openConfirm(tI18n(I18N.confirm.deleteTagsMsg, { label }), { title: I18N.confirm.deleteTagsTitle, variant: "danger" })) return;
        for (const id of ids) {
          await mutateSnippet(() => api.delete(`/api/terminal/snippets/tags/${id}`));
        }
      }
    }) as EventListener);

    // Reenviamos el estado actual cuando el DataTable de React acaba de montar
    // (puede ocurrir después de runOneTimeInit). Así se hidrata aún si se
    // perdió el evento set-data inicial.
    window.addEventListener(DATATABLE_EVENTS.READY, ((event: Event) => {
      const tableId = (event as CustomEvent<{ tableId?: string }>).detail?.tableId;
      if (tableId === "terminal-categories-table" || tableId === "terminal-tags-table") {
        pushSnippetsToDataTables();
      }
    }) as EventListener);
  }

export {
  loadSnippetState,
  saveSnippetState,
  mutateSnippet,
  renderSnippetUI,
  setCategoryForm,
  setTagForm,
  resetCategoryForm,
  resetTagForm,
  openSnippetDialog,
  bindSnippetsDataTableEvents,
  snippetStateRefs,
  renderSnippetList,
  renderSnippetDialogTags,
  sendToTerminal,
};
