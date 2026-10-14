// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useRef, useState } from "react";
import esFiles from "@/i18n/es/files";
import { DIALOG_CHROME } from "@/lib/ui-classes";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { useNamespaceMessages } from "@/lib/use-namespace-messages";

// Spanish fallback for the strings rendered by this island: the `workspace.*`
// group of the ES source bundle itself (F-05) — antes era una copia verbatim de
// esas ~100 claves, que ya se había desincronizado en otros módulos. Las
// traducciones reales se cargan en diferido con `useNamespaceMessages`.
const workspaceFallback = esFiles.workspace;

type WorkspaceMessages = typeof workspaceFallback;

/** Clases compartidas por los items del menú "…" (F-23/F-24); el modificador de
 *  display (`flex` / `hidden`) se antepone por item. */
const ACTION_MENU_ITEM_CLASS =
  "w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent";

export function FilesWorkspace({ canUseAssistant = true, canExpo = false, locale }: { canUseAssistant?: boolean; canExpo?: boolean; locale?: string }) {
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  // Desktop "Herramientas" dropdown (Git / Comparar / Exposición / Seguridad /
  // Mapa / Historial agrupados en un solo botón para reducir el ruido de la
  // toolbar). Mismo patrón que el menú "Acciones" móvil: cierre por clic-fuera
  // y Escape gestionado por el ciclo de vida del island React.
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  // Slice i18n perezoso — hook compartido (F-13); las cadenas del workspace
  // viven bajo `files.workspace`.
  const messages = useNamespaceMessages<WorkspaceMessages>(locale, "files", workspaceFallback, {
    pick: (files) => (files as Record<string, unknown> | undefined)?.workspace,
  });
  const t = (key: keyof WorkspaceMessages) => messages[key];

  // Los 11 items del menú "…" eran 11 <button> idénticos salvo id / icono /
  // etiquetas / atajo (F-24). Se declaran como datos y se renderizan con .map;
  // el markup resultante (incluidos los ids que el script extraído engancha) es
  // exactamente el mismo. `hidden: true` = arranca oculto y lo revela el script.
  const actionMenuItems: {
    id: string;
    icon: string;
    label: string;
    title: string;
    ariaLabel: string;
    hidden?: boolean;
    shortcut?: { id: string; keys: string };
  }[] = [
    { id: "btn-view-projects", icon: "ti-git-branch", label: t("projects"), title: t("projects"), ariaLabel: t("viewProjects"), shortcut: { id: "files-shortcut-projects-hint", keys: "Ctrl+P" } },
    { id: "btn-scan-projects", icon: "ti-reload", label: t("rescan"), title: t("rescanProjectsAlt"), ariaLabel: t("rescanProjectsAlt"), hidden: true, shortcut: { id: "files-shortcut-rescan-hint", keys: "Ctrl+Shift+R" } },
    { id: "btn-new-file", icon: "ti-plus", label: t("file"), title: t("newFile"), ariaLabel: t("newFile"), shortcut: { id: "files-shortcut-new-file-hint", keys: "Ctrl+N" } },
    { id: "btn-git", icon: "ti-git-branch", label: t("git"), title: t("git"), ariaLabel: t("git") },
    { id: "btn-compare", icon: "ti-git-compare", label: t("compareFoldersMenu"), title: t("compareFolders"), ariaLabel: t("compareFolders") },
    { id: "btn-malware", icon: "ti-shield-check", label: t("security"), title: t("security"), ariaLabel: t("security") },
    { id: "btn-exposure", icon: "ti-alert-triangle", label: t("webExposure"), title: t("webExposure"), ariaLabel: t("webExposure") },
    { id: "btn-project-map", icon: "ti-sitemap", label: t("projectMap"), title: t("projectMap"), ariaLabel: t("projectMap") },
    { id: "btn-history", icon: "ti-history", label: t("history"), title: t("changeHistory"), ariaLabel: t("changeHistory") },
    { id: "btn-upload", icon: "ti-upload", label: t("upload"), title: t("uploadFiles"), ariaLabel: t("uploadFiles"), shortcut: { id: "files-shortcut-upload-hint", keys: "Ctrl+U" } },
    { id: "btn-mkdir", icon: "ti-folder-plus", label: t("folder"), title: t("newFolder"), ariaLabel: t("newFolder"), shortcut: { id: "files-shortcut-new-folder-hint", keys: "Ctrl+Shift+N" } },
  ];

  const toolbarButtonBase =
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors";
  const toolbarButtonActive = "bg-accent text-foreground";
  const toolbarButtonInactive = "text-muted-foreground hover:bg-accent hover:text-foreground";
  const toolbarGroupTriggerBase =
    "inline-flex items-center justify-center gap-1.5 border-0 bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

  // Expose the assistant permission to the vanilla files script (index-script1)
  // so it can hide AI-related actions (e.g. "Abrir con agente IA").
  useEffect(() => {
    (window as unknown as { __lxpCanAssistant?: boolean }).__lxpCanAssistant = canUseAssistant;
  }, [canUseAssistant]);

  // Expose the Expo module gate so the files script can show "Create Expo app".
  useEffect(() => {
    (window as unknown as { __lxpCanExpo?: boolean }).__lxpCanExpo = canExpo;
  }, [canExpo]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setIsActionsMenuOpen(false);
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsActionsMenuOpen(false);
        setIsToolsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <div className="@container flex h-full min-w-0 flex-col overflow-hidden bg-card">
        <div id="files-browser" className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-border">
            {/* Folder tabs share an edge with the current folder. The editor's
                open-file list is a separate control at the right end. */}
            <div className="flex min-w-0 items-end gap-1 border-b border-border bg-muted/25 px-3 pt-2">
              <div id="files-manager-tabs" role="tablist" className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto scrollbar-none" aria-label={t("managerTabsAria")}></div>
              <button
                id="btn-new-files-manager-tab"
                type="button"
                className="mb-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                title={t("newManagerTab")}
                aria-label={t("newManagerTab")}
              >
                <i className="ti ti-plus text-sm"></i>
                <span className="hidden @lg:inline">{t("newTab")}</span>
              </button>
              <span className="mb-2 h-5 w-px shrink-0 bg-border" aria-hidden="true"></span>
              <button
                id="btn-open-files"
                type="button"
                aria-disabled="true"
                className="mb-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                title={t("openFilesTitle")}
                aria-label={t("openFilesTitle")}
              >
                <i className="ti ti-files text-sm"></i>
                <span className="hidden @lg:inline">{t("openFiles")}</span>
                <span
                  id="open-files-count"
                  className="hidden inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary"
                ></span>
              </button>
            </div>
            {/* Navigation follows the selected folder tab. */}
            <div className="flex w-full min-w-0 items-center gap-2 px-4 py-2.5">
              <button
                id="btn-back"
                type="button"
                className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
                title={t("prevFolder")}
                aria-label={t("prevFolder")}
                disabled
              >
                <i className="ti ti-arrow-left text-sm"></i>
              </button>
              <div className="relative flex h-9 min-w-0 flex-1 items-center rounded-lg border border-border bg-background transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 group/path">
                <i className="ti ti-folder-open shrink-0 pl-2.5 text-sm text-primary" aria-hidden="true"></i>
                <div
                  id="breadcrumb"
                  className="flex min-w-0 flex-1 cursor-text items-center gap-1 overflow-x-auto rounded px-2 py-1 text-sm transition-colors hover:bg-muted/30 scrollbar-none"
                  title={t("editPath")}
                >
                  <span className="text-muted-foreground">{t("root")}</span>
                </div>
                {/* Editable path input (toggled by clicking the breadcrumb) */}
                <input
                  id="path-edit-input"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t("pathPlaceholder")}
                  className="hidden h-8 min-w-0 flex-1 bg-transparent px-2 text-sm font-mono focus:outline-none"
                />
                {/* Autocomplete suggestions */}
                <div
                  id="path-suggest-list"
                  role="listbox"
                  aria-label={t("pathSuggestions")}
                  className="hidden absolute left-0 top-full z-40 mt-1 max-h-72 w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-2xl"
                ></div>
                <button
                  id="btn-copy-path"
                  type="button"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-r-lg border-l border-border px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  title={t("copyCurrentPath")}
                  aria-label={t("copyPath")}
                >
                  <i className="ti ti-copy text-sm"></i>
                  <span className="hidden text-xs @xl:inline">{t("copyPath")}</span>
                </button>
              </div>
            </div>

            <div id="files-main-toolbar" className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/10 px-4 py-2">
              <button
                id="btn-view-list"
                className={`${toolbarButtonBase} ${toolbarButtonActive} px-2.5`}
                title={t("viewList")}
                aria-label={t("viewList")}
              >
                <i className="ti ti-list text-sm"></i>
              </button>
              <button
                id="btn-view-grid"
                className={`${toolbarButtonBase} ${toolbarButtonInactive} px-2.5`}
                title={t("viewGrid")}
                aria-label={t("viewGrid")}
              >
                <i className="ti ti-grid-dots text-sm"></i>
              </button>
              {/* Divider: view-mode toggles ┃ view utilities */}
              <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-border sm:inline-block" aria-hidden="true"></span>
              <button
                id="btn-refresh"
                className={`${toolbarButtonBase} ${toolbarButtonInactive} px-2.5`}
                aria-label={t("refresh")}
                title={t("refresh")}
              >
                <i className="ti ti-refresh text-sm"></i>
              </button>
              <button
                id="btn-toggle-hidden"
                type="button"
                aria-pressed="false"
                className={`${toolbarButtonBase} ${toolbarButtonInactive} px-2.5`}
                aria-label={t("showHiddenFiles")}
                title={t("showHiddenFiles")}
              >
                <i className="ti ti-eye-off text-sm"></i>
              </button>

              {/* Right-aligned actions use the workspace width, which can be
                  narrow even on a desktop with the folder tree open. */}
              <div className="ml-auto flex items-center gap-2">
                <div className="hidden @3xl:flex items-center gap-2">
                  <button id="btn-projects-d" type="button" className={`${toolbarButtonBase} ${toolbarButtonInactive}`} title={t("projects")} aria-label={t("viewProjects")}>
                    <i className="ti ti-git-branch text-sm"></i>
                    <span>{t("projects")}</span>
                  </button>

                  {/* "Herramientas": un solo disparador que agrupa Git, Comparar,
                      Exposición, Seguridad, Mapa e Historial. Cada item conserva
                      su id `btn-*-d` original, así el reenvío de bind-toolbar.ts
                      (btn-*-d → botón real del menú) sigue funcionando sin
                      cambios. El menú se mantiene montado (toggle por clase
                      `hidden`, nunca desmontado) para no invalidar esos
                      listeners tras abrir/cerrar. */}
                  <div ref={toolsMenuRef} className="relative">
                    <button
                      id="btn-files-tools-menu-trigger"
                      type="button"
                      className={`${toolbarButtonBase} ${toolbarButtonInactive}`}
                      aria-haspopup="menu"
                      aria-expanded={isToolsMenuOpen}
                      aria-controls="files-tools-menu"
                      title={t("openToolsMenu")}
                      aria-label={t("openToolsMenu")}
                      onClick={() => setIsToolsMenuOpen((value) => !value)}
                    >
                      <i className="ti ti-tool text-sm"></i>
                      <span>{t("tools")}</span>
                      <i className="ti ti-chevron-down text-xs opacity-70"></i>
                    </button>

                    <div
                      id="files-tools-menu"
                      role="menu"
                      aria-label={t("filesToolsAria")}
                      className={`absolute right-0 top-full z-30 mt-2 min-w-56 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-2xl ${
                        isToolsMenuOpen ? "" : "hidden"
                      }`}
                    >
                      <button id="btn-git-d" type="button" role="menuitem" className={`flex ${ACTION_MENU_ITEM_CLASS}`} title={t("git")} aria-label={t("git")} onClick={() => setIsToolsMenuOpen(false)}>
                        <i className="ti ti-git-branch text-sm"></i>
                        <span>{t("git")}</span>
                      </button>
                      <button id="btn-compare-d" type="button" role="menuitem" className={`flex ${ACTION_MENU_ITEM_CLASS}`} title={t("compareFolders")} aria-label={t("compareFolders")} onClick={() => setIsToolsMenuOpen(false)}>
                        <i className="ti ti-git-compare text-sm"></i>
                        <span>{t("compareFolders")}</span>
                      </button>
                      <button id="btn-exposure-d" type="button" role="menuitem" className={`flex ${ACTION_MENU_ITEM_CLASS}`} title={t("webExposure")} aria-label={t("webExposure")} onClick={() => setIsToolsMenuOpen(false)}>
                        <i className="ti ti-alert-triangle text-sm"></i>
                        <span>{t("webExposure")}</span>
                      </button>
                      <button id="btn-malware-d" type="button" role="menuitem" className={`flex ${ACTION_MENU_ITEM_CLASS}`} title={t("security")} aria-label={t("security")} onClick={() => setIsToolsMenuOpen(false)}>
                        <i className="ti ti-shield-check text-sm"></i>
                        <span>{t("securityShort")}</span>
                      </button>
                      <button id="btn-project-map-d" type="button" role="menuitem" className={`flex ${ACTION_MENU_ITEM_CLASS}`} title={t("projectMap")} aria-label={t("projectMap")} onClick={() => setIsToolsMenuOpen(false)}>
                        <i className="ti ti-sitemap text-sm"></i>
                        <span>{t("projectMap")}</span>
                      </button>
                      <button id="btn-history-d" type="button" role="menuitem" className={`flex ${ACTION_MENU_ITEM_CLASS}`} title={t("changeHistory")} aria-label={t("changeHistory")} onClick={() => setIsToolsMenuOpen(false)}>
                        <i className="ti ti-history text-sm"></i>
                        <span>{t("changeHistory")}</span>
                      </button>
                    </div>
                  </div>

                  <button id="btn-new-file-d" type="button" className={`${toolbarButtonBase} ${toolbarButtonInactive}`} title={t("newFile")} aria-label={t("newFile")}>
                    <i className="ti ti-plus text-sm"></i>
                    <span>{t("file")}</span>
                  </button>
                  <button id="btn-upload-d" type="button" className={`${toolbarButtonBase} ${toolbarButtonInactive}`} title={t("uploadFiles")} aria-label={t("uploadFiles")}>
                    <i className="ti ti-upload text-sm"></i>
                    <span>{t("upload")}</span>
                  </button>
                  <button id="btn-mkdir-d" type="button" className={`${toolbarButtonBase} ${toolbarButtonInactive}`} title={t("newFolder")} aria-label={t("newFolder")}>
                    <i className="ti ti-folder-plus text-sm"></i>
                    <span>{t("folder")}</span>
                  </button>
                </div>

              <div ref={actionsMenuRef} className="relative shrink-0 @3xl:hidden">
                <ButtonGroup aria-label={t("filesActionsAria")} className="shrink-0">
                  <button
                    id="btn-files-actions-menu-trigger"
                    type="button"
                    className={`${toolbarGroupTriggerBase} px-3`}
                    aria-haspopup="menu"
                    aria-expanded={isActionsMenuOpen}
                    aria-controls="files-actions-menu"
                    aria-label={t("openActionsMenu")}
                    title={t("openActionsMenu")}
                    onClick={() => setIsActionsMenuOpen((value) => !value)}
                  >
                    <span>{t("actions")}</span>
                    <i className="ti ti-dots-vertical text-sm"></i>
                  </button>
                </ButtonGroup>

                <div
                  id="files-actions-menu"
                  role="menu"
                  aria-label={t("filesActionsAria")}
                  className={`absolute right-0 top-full z-30 mt-2 min-w-56 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-2xl ${
                    isActionsMenuOpen ? "" : "hidden"
                  }`}
                >
                    {actionMenuItems.map((item) => (
                      <button
                        key={item.id}
                        id={item.id}
                        type="button"
                        role="menuitem"
                        className={`${item.hidden ? "hidden" : "flex"} ${ACTION_MENU_ITEM_CLASS}`}
                        aria-label={item.ariaLabel}
                        title={item.title}
                        onClick={() => setIsActionsMenuOpen(false)}
                      >
                        <i className={`ti ${item.icon} text-sm`}></i>
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span id={item.shortcut.id} className="ml-auto text-[10px] text-muted-foreground">
                            {item.shortcut.keys}
                          </span>
                        )}
                      </button>
                    ))}
                    <div className="border-t border-border/70 px-3 py-2 text-[10px] leading-4 text-muted-foreground">
                      <div>{t("shortcutsHint")}</div>
                    </div>
                </div>
              </div>
              </div>
            </div>

          </div>

          <div id="bulk-bar" className="hidden flex-wrap items-center gap-3 border-b border-primary/30 bg-primary/5 px-4 py-2">
            <span id="bulk-count" className="text-xs font-medium text-primary"></span>
            <div className="flex flex-wrap gap-2 ml-auto">
              <button id="bulk-download" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                <i className="ti ti-download text-sm"></i> {t("bulkDownloadZip")}
              </button>
              <button id="bulk-compress" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                <i className="ti ti-archive text-sm"></i> {t("bulkCompressZip")}
              </button>
              <button id="bulk-delete" className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
                <i className="ti ti-trash text-sm"></i> {t("bulkDelete")}
              </button>
              <button id="bulk-clear" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors" title={t("bulkClear")}>
                <i className="ti ti-x text-sm"></i>
              </button>
            </div>
          </div>

          <div id="view-list" className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="h-9 px-3 w-8">
                    <input type="checkbox" id="check-all" className="rounded border-border" aria-label={t("selectAll")} />
                  </th>
                  <th className="h-9 px-2 text-left font-medium text-muted-foreground w-6"></th>
                  <th data-sort="name" className="fsort h-9 px-4 text-left font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground"><span className="inline-flex items-center gap-1">{t("colName")}<span className="fsort-ind text-[10px] opacity-0"></span></span></th>
                  <th data-sort="type" className="fsort fcol-type h-9 px-4 text-left font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground hidden xl:table-cell w-24"><span className="inline-flex items-center gap-1">{t("colType")}<span className="fsort-ind text-[10px] opacity-0"></span></span></th>
                  <th data-sort="size" className="fsort fcol-size h-9 px-4 text-left font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground hidden sm:table-cell w-28"><span className="inline-flex items-center gap-1">{t("colSize")}<span className="fsort-ind text-[10px] opacity-0"></span></span></th>
                  <th className="fcol-owner h-9 px-4 text-left font-medium text-muted-foreground hidden md:table-cell w-28">{t("colOwner")}</th>
                  <th className="fcol-group h-9 px-4 text-left font-medium text-muted-foreground hidden xl:table-cell w-28">{t("colGroup")}</th>
                  <th data-sort="modified" className="fsort fcol-modified h-9 px-4 text-left font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground hidden lg:table-cell w-40"><span className="inline-flex items-center gap-1">{t("colModified")}<span className="fsort-ind text-[10px] opacity-0"></span></span></th>
                  <th className="fcol-perms h-9 px-4 text-left font-medium text-muted-foreground hidden lg:table-cell w-28">{t("colPerms")}</th>
                </tr>
              </thead>
              <tbody id="file-tbody">
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <i className="ti ti-folder-open text-3xl block mb-2 mx-auto opacity-30"></i>
                    {t("selectDirectory")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div id="view-grid" className="hidden flex-1 overflow-y-auto p-4">
            <div id="file-grid" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3"></div>
          </div>

          {/* Text-in-files search results — replaces the listing while active. */}
          <div id="view-content-search" className="hidden flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <button
                id="content-search-back"
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <i className="ti ti-arrow-left text-sm"></i> {t("back")}
              </button>
              <i className="ti ti-file-search text-sm text-muted-foreground"></i>
              <span id="content-search-scope" className="truncate text-xs text-muted-foreground">—</span>
            </div>
            <div id="content-search-results" className="flex-1 overflow-y-auto px-2 py-2">
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">{t("typeAndEnter")}</div>
            </div>
          </div>

          <div id="view-projects" className="hidden flex flex-1 flex-col overflow-y-auto">
            <div id="projects-toolbar" className="hidden flex items-center justify-between gap-2 border-b border-border px-4 py-2">
              <span id="projects-count" className="text-xs text-muted-foreground"></span>
              <button
                id="btn-projects-rescan"
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={t("rescanProjects")}
              >
                <i className="ti ti-reload text-sm"></i> {t("rescan")}
              </button>
            </div>
            <div id="projects-loading" className="hidden flex flex-1 min-h-[240px] items-center justify-center">
              <div className="text-center space-y-4">
                <div className="inline-block animate-spin">
                  <i className="ti ti-loader text-4xl text-primary"></i>
                </div>
                <p className="text-sm text-muted-foreground">{t("scanningProjects")}</p>
              </div>
            </div>
            <div id="projects-empty" className="hidden flex flex-1 min-h-[240px] items-center justify-center p-8">
              <div className="text-center space-y-4 max-w-sm">
                <i className="ti ti-folder-search text-5xl text-muted-foreground/40 block mx-auto"></i>
                <p id="projects-empty-text" className="text-sm text-muted-foreground">{t("noProjects")}</p>
                <button
                  id="btn-projects-scan-cta"
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="ti ti-radar text-sm"></i> {t("scanProjects")}
                </button>
              </div>
            </div>
            <div id="projects-container" className="hidden grid gap-3 p-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"></div>
          </div>

          <div className="border-t border-border px-4 py-1.5 flex items-center justify-between">
            <span id="status-bar" className="text-xs text-muted-foreground">{t("ready")}</span>
            <span className="text-xs text-muted-foreground hidden" id="upload-drop-hint">
              <i className="ti ti-drag-drop text-sm"></i> {t("dropToUpload")}
            </span>
          </div>

          {/* AI assistant quick-ask — only when the user can use the assistant module */}
          {canUseAssistant && (
          <form id="files-ai-form" data-module-ai-footer-form className="border-t border-border bg-muted/20 px-3 py-2">
            <div id="files-ai-selection-notice" className="hidden mb-2 flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2" aria-live="polite">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
                <i className="ti ti-files text-base text-primary" aria-hidden="true"></i>
                <span id="files-ai-selection-count"></span>
              </span>
              <button id="bulk-attach-ai" type="button" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-default disabled:opacity-50" title={t("aiAttachSelectedHint")}>
                <i className="ti ti-paperclip text-sm" aria-hidden="true"></i>
                <span id="bulk-attach-ai-label">{t("aiAttachSelected")}</span>
              </button>
            </div>
            <div id="files-ai-attachments" className="hidden flex flex-wrap gap-1.5 pb-2" aria-label={t("aiSelectedAttachments")}></div>
            <div data-module-ai-footer-row className="flex items-center gap-2">
            <i className="ti ti-sparkles text-base text-primary shrink-0"></i>
            <input
              id="files-ai-input"
              data-module-ai-footer-input
              type="text"
              autoComplete="off"
              placeholder={t("aiAskPlaceholder")}
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
            />
            <button
              id="files-ai-send"
              type="submit"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <i className="ti ti-send text-sm"></i>
              <span className="hidden sm:inline">{t("ask")}</span>
            </button>
            </div>
          </form>
          )}

          <div id="files-route-loading" className="hidden absolute inset-0 z-20 items-center justify-center bg-card/85 backdrop-blur-[1px]">
            <div className="text-center space-y-4">
              <div className="inline-block animate-spin">
                <i className="ti ti-loader text-4xl text-primary"></i>
              </div>
              <p className="text-sm text-muted-foreground">{t("loadingPath")}</p>
            </div>
          </div>
        </div>
      </div>
        {/* Editor en su propio drawer derecho, encima del explorador. Monaco y
            sus pestañas permanecen montados mientras se abre y cierra. */}
        <dialog
          id="files-editor-panel"
          aria-hidden="true"
          data-lxp-module-settings
          data-lxp-modal-wide
          className="hidden min-h-0 flex-col overflow-hidden border-l border-border bg-card p-0"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <span id="editor-filename" className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
              {t("noFile")}
            </span>
            {/* In-file find bar (VS Code-style), to the left of Save. Wired by
                the extracted script files/editor-find.ts over Monaco. */}
            <div
              id="files-editor-find"
              className="flex shrink-0 items-center gap-0.5 rounded-lg border border-transparent bg-transparent px-1.5 py-1 transition-colors focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20"
              role="search"
            >
              <i className="ti ti-search text-xs text-muted-foreground" aria-hidden="true"></i>
              <input
                id="files-editor-find-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={t("findPlaceholder")}
                aria-label={t("findInputAria")}
                className="h-6 w-24 min-w-0 appearance-none border-0 bg-transparent px-1 text-xs shadow-none outline-none focus:outline-none placeholder:text-muted-foreground sm:w-40 aria-[invalid=true]:text-destructive"
              />
              <span
                id="files-editor-find-count"
                aria-label={t("findCountAria")}
                aria-live="polite"
                className="min-w-[3.25rem] text-right text-[10px] tabular-nums text-muted-foreground"
              ></span>
              <button
                id="files-editor-find-prev"
                type="button"
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                title={t("findPrevious")}
                aria-label={t("findPrevious")}
              >
                <i className="ti ti-chevron-up text-xs"></i>
              </button>
              <button
                id="files-editor-find-next"
                type="button"
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                title={t("findNext")}
                aria-label={t("findNext")}
              >
                <i className="ti ti-chevron-down text-xs"></i>
              </button>
              <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true"></span>
              <button
                id="files-editor-find-case"
                type="button"
                aria-pressed="false"
                className="rounded px-1 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={t("findCaseSensitive")}
                aria-label={t("findCaseSensitive")}
              >
                Aa
              </button>
              <button
                id="files-editor-find-word"
                type="button"
                aria-pressed="false"
                className="rounded px-1 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground underline decoration-1 underline-offset-2 transition-colors hover:bg-accent hover:text-foreground"
                title={t("findWholeWord")}
                aria-label={t("findWholeWord")}
              >
                ab
              </button>
              <button
                id="files-editor-find-regex"
                type="button"
                aria-pressed="false"
                className="rounded px-1 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={t("findRegex")}
                aria-label={t("findRegex")}
              >
                .*
              </button>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                id="btn-save"
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                disabled
              >
                <i className="ti ti-device-floppy text-sm"></i> {t("save")}
              </button>
              <button
                id="btn-diff"
                className="hidden inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                type="button"
                aria-pressed="false"
                title={t("viewDiffTitle")}
              >
                <i className="ti ti-git-compare text-sm"></i> Diff
              </button>
              <button id="btn-close-editor" className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title={t("closeEditor")}>
                <i className="ti ti-x text-sm"></i>
              </button>
            </div>
          </div>
          <div id="file-tabs" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/20 px-2 py-1.5" aria-label={t("filesTabsAria")}></div>
          <div className="relative min-h-0 flex-1">
            <div id="file-editor" className="absolute inset-0 bg-background" aria-label={t("editorAria")}></div>
              <div id="file-diff-panel" className="absolute inset-0 hidden flex-col bg-background">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <div className="min-w-0">
                    <span className="block text-xs font-medium text-muted-foreground">{t("diffView")}</span>
                    <span id="diff-filename" className="block truncate text-[11px] text-muted-foreground/80"></span>
                  </div>
                  <button
                    id="btn-close-diff"
                    className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    type="button"
                    aria-label={t("closeDiff")}
                  >
                    <i className="ti ti-x text-sm"></i>
                  </button>
                </div>
                <div id="file-diff-editor" className="min-h-[320px] flex-1 bg-background" aria-label={t("diffEditorAria")}></div>
              </div>
            </div>
            {/* AI editor bar — foot of the editor panel. Interacts with the file
                open in the active tab: ask a question or request a change; a
                returned edit is applied to the Monaco buffer (undoable, never to
                disk). Wired by the extracted script files/editor-ai.ts. Only
                rendered when the user can use the AI assistant module. */}
            {canUseAssistant && (
            <div id="files-editor-ai" className="shrink-0 border-t border-border bg-muted/20">
              <div id="files-editor-ai-panel" className="hidden border-b border-border/60">
                <div className="flex items-center justify-between px-3 pt-2">
                  <span className="text-[11px] font-medium text-muted-foreground">{t("aiEditorConversation")}</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      id="files-editor-ai-collapse"
                      type="button"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={t("aiEditorCollapse")}
                      title={t("aiEditorCollapse")}
                    >
                      <i className="ti ti-chevron-down text-xs"></i>
                    </button>
                    <button
                      id="files-editor-ai-clear"
                      type="button"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={t("aiEditorClear")}
                      title={t("aiEditorClear")}
                    >
                      <i className="ti ti-trash text-xs"></i>
                    </button>
                  </div>
                </div>
                <div
                  id="files-editor-ai-messages"
                  className="max-h-44 space-y-2 overflow-y-auto px-3 py-2"
                  aria-live="polite"
                  aria-label={t("aiEditorPanelAria")}
                ></div>
              </div>
              <form id="files-editor-ai-form" data-module-ai-footer-form className="px-3 py-2">
                <div data-module-ai-footer-row className="flex items-center gap-2">
                  <i className="ti ti-sparkles shrink-0 text-base text-primary" aria-hidden="true"></i>
                  <input
                    id="files-editor-ai-input"
                    data-module-ai-footer-input
                    type="text"
                    autoComplete="off"
                    placeholder={t("aiEditorPlaceholder")}
                    aria-label={t("aiEditorPlaceholder")}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  <i id="files-editor-ai-spinner" data-module-ai-footer-spinner className="ti ti-loader hidden shrink-0 animate-spin text-base text-primary" aria-hidden="true"></i>
                  <button
                    id="files-editor-ai-send"
                    type="submit"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                  >
                    <i className="ti ti-send text-sm"></i>
                    <span className="hidden sm:inline">{t("aiEditorSend")}</span>
                  </button>
                </div>
              </form>
            </div>
            )}
          </dialog>

      {/* Menú contextual (click derecho) del navegador Y del árbol izquierdo.
          Vive fuera de #files-browser para mantener su posición fija. */}
      <div
        id="files-context-menu"
        className="hidden fixed z-[100] min-w-[180px] rounded-lg border border-border bg-card py-1 shadow-2xl"
        role="menu"
      ></div>

      {/* Confirmación al cerrar el editor con cambios sin guardar */}
      <dialog
        id="dialog-editor-unsaved"
        className={`w-full max-w-sm ${DIALOG_CHROME}`}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <i className="ti ti-alert-triangle text-amber-500 text-base"></i>
            </div>
            <h3 className="text-base font-semibold">{t("unsavedTitle")}</h3>
          </div>
          <button
            id="editor-unsaved-close"
            type="button"
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <i className="ti ti-x text-lg"></i>
          </button>
        </div>
        <div className="px-6 py-4">
          <p id="editor-unsaved-message" className="text-sm text-muted-foreground">
            {t("unsavedMessage")}
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-border px-6 py-4">
          <button
            id="editor-unsaved-save"
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <i className="ti ti-device-floppy text-sm"></i> {t("saveAndExit")}
          </button>
          <button
            id="editor-unsaved-discard"
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            <i className="ti ti-logout text-sm"></i> {t("exitWithoutSaving")}
          </button>
          <button
            id="editor-unsaved-cancel"
            type="button"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            {t("cancel")}
          </button>
        </div>
      </dialog>
    </>
  );
}
