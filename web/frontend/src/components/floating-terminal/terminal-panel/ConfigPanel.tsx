// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useMemo, useState } from "react";
import { useViewDirection, useViewEnterReplay } from "@/components/ui/ViewTransition";

const CONFIG_SUBTAB_ORDER = ["general", "categories", "tags"] as const;

import DataTable from "@/components/ui/DataTable";
import { formatMessage } from "@/i18n/client";
import { getCli, type CliEntry, type CliId } from "../cli-registry";
import type { TerminalMessages } from "../i18n";
import {
  TERMINAL_CATEGORY_TABLE_ID,
  TERMINAL_TABLE_PAGE_SIZE_OPTIONS,
  TERMINAL_TAG_TABLE_ID,
  buildCategoryTableColumns,
  buildCategoryTableFilters,
  buildCategoryTableQuickActions,
  buildCategoryTableRowActions,
  buildTagTableColumns,
  buildTagTableFilters,
  buildTagTableQuickActions,
  buildTagTableRowActions,
} from "@/config/tables/terminal-snippets-table-config";
import { HistoryOrderSettingsCard } from "./HistoryOrderTable";
import type { ConfigSubtab, SnippetsSnapshot } from "./types";

interface ConfigPanelProps {
  messages: TerminalMessages;
  activeConfigTab: ConfigSubtab;
  setActiveConfigTab: (t: ConfigSubtab) => void;
  installedEntries: CliEntry[];
  availableToInstall: CliEntry[];
  activeCli: CliId;
  onSelectActive: (id: CliId) => void;
  onInstall: (entry: CliEntry) => void;
  snippetsSnapshot: SnippetsSnapshot;
}

const AVAILABLE_INSTALL_PAGE_SIZE = 3;

export function ConfigPanel({
  messages,
  activeConfigTab,
  setActiveConfigTab,
  installedEntries,
  availableToInstall,
  activeCli,
  onSelectActive,
  onInstall,
  snippetsSnapshot,
}: ConfigPanelProps) {
  const cfg = messages.config;
  const [installPage, setInstallPage] = useState(0);
  // Transición entre sub-tabs de configuración (general/categorías/tags).
  const configViewDirection = useViewDirection(activeConfigTab, CONFIG_SUBTAB_ORDER);
  const configViewRef = useViewEnterReplay<HTMLDivElement>(activeConfigTab, configViewDirection);
  const installPageCount = Math.max(
    1,
    Math.ceil(availableToInstall.length / AVAILABLE_INSTALL_PAGE_SIZE),
  );
  useEffect(() => {
    if (installPage >= installPageCount) setInstallPage(0);
  }, [installPage, installPageCount]);
  const installPageStart = installPage * AVAILABLE_INSTALL_PAGE_SIZE;
  const availableToInstallPage = availableToInstall.slice(
    installPageStart,
    installPageStart + AVAILABLE_INSTALL_PAGE_SIZE,
  );

  // Defensa contra duplicados en el PICKER de categoría y el filtro: colapsa
  // por id y luego por nombre (case-insensitive). Aunque el backend devuelva
  // —por una carrera de creación no atómica, un evento repetido o un bundle
  // viejo en caché— dos categorías con el mismo nombre, aquí el <select> y el
  // filtro muestran cada categoría UNA sola vez. La tabla de gestión
  // (categoryRows) sigue usando la lista cruda para poder borrar el duplicado.
  const uniqueCategories = useMemo(() => {
    const byId = new Map<number, { id: number; name: string }>();
    const seenNames = new Set<string>();
    const out: Array<{ id: number; name: string }> = [];
    for (const cat of snippetsSnapshot.categories) {
      if (byId.has(cat.id)) continue;
      byId.set(cat.id, cat);
      const nameKey = cat.name.trim().toLowerCase();
      if (seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);
      out.push({ id: cat.id, name: cat.name });
    }
    return out;
  }, [snippetsSnapshot.categories]);

  const tagTableFilters = useMemo(
    () => buildTagTableFilters(uniqueCategories, messages.tables),
    [uniqueCategories, messages.tables],
  );
  const categoryTableColumns = useMemo(() => buildCategoryTableColumns(messages.tables), [messages.tables]);
  const categoryTableFilters = useMemo(() => buildCategoryTableFilters(messages.tables), [messages.tables]);
  const categoryTableRowActions = useMemo(() => buildCategoryTableRowActions(messages.tables), [messages.tables]);
  const categoryTableQuickActions = useMemo(() => buildCategoryTableQuickActions(messages.tables), [messages.tables]);
  const tagTableColumns = useMemo(() => buildTagTableColumns(messages.tables), [messages.tables]);
  const tagTableRowActions = useMemo(() => buildTagTableRowActions(messages.tables), [messages.tables]);
  const tagTableQuickActions = useMemo(() => buildTagTableQuickActions(messages.tables), [messages.tables]);
  const categoriesById = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of snippetsSnapshot.categories) map.set(cat.id, cat.name);
    return map;
  }, [snippetsSnapshot.categories]);
  const categoryRows = useMemo(
    () => snippetsSnapshot.categories.map((cat) => ({ id: cat.id, name: cat.name })),
    [snippetsSnapshot.categories],
  );
  const tagRows = useMemo(
    () =>
      snippetsSnapshot.tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        categoryId: tag.categoryId,
        categoryName: categoriesById.get(tag.categoryId) ?? "—",
      })),
    [snippetsSnapshot.tags, categoriesById],
  );
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col bg-card"
      role="region"
      aria-label={cfg.regionAria}
    >
      <div className="flex h-full min-h-0 w-full">
          <nav data-rubber-tabs aria-orientation="vertical" className="flex w-14 shrink-0 flex-col gap-1 border-r border-border bg-muted/20 p-2 @xl:w-40" aria-label={cfg.regionAria}>
            {(["general", "categories", "tags"] as ConfigSubtab[]).map((sub) => (
              <button
                key={sub}
                type="button"
                data-terminal-config-tab={sub}
                onClick={() => setActiveConfigTab(sub)}
                title={sub === "general" ? cfg.tabGeneral : sub === "categories" ? cfg.tabCategories : cfg.tabTags}
                aria-current={activeConfigTab === sub ? "page" : undefined}
                className={
                  activeConfigTab === sub
                    ? "terminal-config-tab flex items-center justify-center gap-2 rounded-lg bg-primary/10 px-2 py-2 text-sm font-medium text-primary @xl:justify-start"
                    : "terminal-config-tab flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground @xl:justify-start"
                }
              >
                <i className={`ti ${sub === "general" ? "ti-adjustments" : sub === "categories" ? "ti-category" : "ti-tag"} text-lg`} aria-hidden="true"></i>
                <span className="hidden truncate @xl:inline">{sub === "general"
                  ? cfg.tabGeneral
                  : sub === "categories"
                    ? cfg.tabCategories
                    : cfg.tabTags}</span>
              </button>
            ))}
          </nav>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 space-y-4">

          {/* Las secciones permanecen montadas (hidden) para conservar el estado
              de formularios/tablas: la transición de vista se reproduce sobre
              este wrapper ya montado (motion.css preset). */}
          <div ref={configViewRef} className="space-y-4">
          <section
            data-terminal-config-panel="general"
            className={activeConfigTab === "general" ? "space-y-4" : "hidden space-y-4"}
          >
            <div className="rounded-xl border border-border bg-background p-4">
              <label htmlFor="s-terminal-font-size" className="block text-sm font-semibold">{cfg.fontSizeTitle ?? "Tamaño de letra"}</label>
              <p className="mt-1 text-xs text-muted-foreground">{cfg.fontSizeDescription ?? "Se aplica a todas las pestañas de este servidor."}</p>
              <select id="s-terminal-font-size" defaultValue="13" className="mt-3 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                {Array.from({ length: 10 }, (_, index) => index + 11).map((size) => <option key={size} value={size}>{size} px</option>)}
              </select>
            </div>
            <details open className="group rounded-xl border border-border bg-background">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 [&::-webkit-details-marker]:hidden">
                <div>
                  <h4 className="text-sm font-semibold">{cfg.themeTitle}</h4>
                  <p className="text-xs text-muted-foreground">
                    {cfg.themeDescription}
                  </p>
                </div>
                <i
                  className="ti ti-chevron-down text-base text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="border-t border-border p-4">
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    htmlFor="s-terminal-cli-active"
                  >
                    {cfg.activeCli}
                  </label>
                  <select
                    id="s-terminal-cli-active"
                    value={activeCli}
                    onChange={(e) => onSelectActive(e.target.value as CliId)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {installedEntries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const desc = cfg.cliDescriptions?.[activeCli] ?? getCli(activeCli)?.description;
                    return desc ? (
                      <p className="pt-1 text-[11px] text-muted-foreground">{desc}</p>
                    ) : null;
                  })()}
                </div>
              </div>
            </details>

            {availableToInstall.length > 0 ? (
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">{cfg.installableTitle}</h4>
                    <p className="text-xs text-muted-foreground">
                      {cfg.installableDescription}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-2">
                  {availableToInstallPage.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border border-border bg-card/50 p-3"
                    >
                      <i
                        className={`ti ${entry.icon} mt-0.5 text-base text-muted-foreground`}
                        aria-hidden="true"
                      ></i>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{entry.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {cfg.cliDescriptions?.[entry.id] ?? entry.description}
                        </p>
                        {entry.installCommand && (
                          <code className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
                            {entry.installCommand}
                          </code>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onInstall(entry)}
                        className="shrink-0 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                      >
                        {cfg.install}
                      </button>
                    </li>
                  ))}
                </ul>
                {installPageCount > 1 ? (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setInstallPage((p) => Math.max(0, p - 1))}
                      disabled={installPage === 0}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                    >
                      {cfg.previous}
                    </button>
                    <span className="text-[11px] text-muted-foreground">
                      {formatMessage(cfg.pageInfo, {
                        page: installPage + 1,
                        pageCount: installPageCount,
                        count: availableToInstall.length,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setInstallPage((p) => Math.min(installPageCount - 1, p + 1))
                      }
                      disabled={installPage >= installPageCount - 1}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                    >
                      {cfg.next}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <HistoryOrderSettingsCard messages={messages} />
          </section>

          <section
            data-terminal-config-panel="categories"
            className={activeConfigTab === "categories" ? "space-y-4" : "hidden space-y-4"}
          >
            <form
              id="category-form"
              className="flex items-center gap-2 rounded-xl border border-border bg-background p-2"
            >
              <input type="hidden" id="category-edit-id" />
              <input
                id="category-name"
                type="text"
                placeholder={cfg.categoryNamePlaceholder}
                aria-label={cfg.categoryNamePlaceholder}
                className="h-9 flex-1 min-w-0 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                id="category-cancel"
                title={cfg.cancel}
                aria-label={cfg.cancel}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <i className="ti ti-x text-base"></i>
              </button>
              <button
                type="submit"
                title={cfg.save}
                aria-label={cfg.save}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <i className="ti ti-check text-base"></i>
              </button>
            </form>
            <DataTable
              tableId={TERMINAL_CATEGORY_TABLE_ID}
              title={cfg.tableCategories}
              columns={categoryTableColumns}
              data={categoryRows}
              filters={categoryTableFilters}
              rowActions={categoryTableRowActions}
              quickActions={categoryTableQuickActions}
              pageSizeOptions={TERMINAL_TABLE_PAGE_SIZE_OPTIONS}
            />
          </section>

          <section
            data-terminal-config-panel="tags"
            className={activeConfigTab === "tags" ? "space-y-4" : "hidden space-y-4"}
          >
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                htmlFor="tag-category-select"
              >
                {cfg.categoryLabel}
              </label>
              <select
                id="tag-category-select"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                disabled={uniqueCategories.length === 0}
              >
                {uniqueCategories.length === 0 ? (
                  <option value="">{cfg.noCategories}</option>
                ) : (
                  <>
                    <option value="">{cfg.selectCategory}</option>
                    {uniqueCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            <form
              id="tag-form"
              className="flex items-center gap-2 rounded-xl border border-border bg-background p-2"
            >
              <input type="hidden" id="tag-edit-id" />
              <input
                id="tag-name"
                type="text"
                placeholder={cfg.tagNamePlaceholder}
                aria-label={cfg.tagNamePlaceholder}
                className="h-9 flex-1 min-w-0 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                id="tag-cancel"
                title={cfg.cancel}
                aria-label={cfg.cancel}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <i className="ti ti-x text-base"></i>
              </button>
              <button
                type="submit"
                title={cfg.save}
                aria-label={cfg.save}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <i className="ti ti-check text-base"></i>
              </button>
            </form>
            <DataTable
              tableId={TERMINAL_TAG_TABLE_ID}
              title={cfg.tableTags}
              columns={tagTableColumns}
              data={tagRows}
              filters={tagTableFilters}
              rowActions={tagTableRowActions}
              quickActions={tagTableQuickActions}
              pageSizeOptions={TERMINAL_TABLE_PAGE_SIZE_OPTIONS}
            />
          </section>
          </div>
        </div>
      </div>
    </div>
  );
}
