// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/repository-store/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * GitHub repository store — /panel/repository-store
 * Misma UI que /panel/modules: header + tabs + stats + filtros pills + grid.
 * Filtros: Stack (padre) → Categorías (hijo, dependen del stack) → Estado.
 */
import PanelLayout from "../module-frame";
import RepositorySettingsDrawer from "./components_panel_repository_store_RepositorySettingsDrawer";
import { getPageMessages } from "../view-context";
export default function pages_panel_repository_store_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, [
    "repositoryStore",
    "settings",
    "components",
  ]);
  const rs = t.repositoryStore;
  interface StackCategory {
    id: string;
    label: string;
    icon: string;
  }
  interface Stack {
    id: string;
    label: string;
    icon: string;
    categories: StackCategory[];
  }
  // Single source of truth for the stack → categories tree.
  // The script reads `data-stack` / `data-category` to build the GitHub query.
  const STACKS: Stack[] = [
    {
      id: "all",
      label: t.repositoryStore.stacks.todos,
      icon: "ti-apps",
      categories: [
        {
          id: "all",
          label: t.repositoryStore.stacks.catTodos,
          icon: "ti-layout-grid",
        },
      ],
    },
    {
      id: "web",
      label: t.repositoryStore.stacks.web,
      icon: "ti-world",
      categories: [
        {
          id: "all",
          label: t.repositoryStore.stacks.catTodos,
          icon: "ti-layout-grid",
        },
        {
          id: "frontend",
          label: t.repositoryStore.stacks.catFrontend,
          icon: "ti-layout",
        },
        {
          id: "backend",
          label: t.repositoryStore.stacks.catBackend,
          icon: "ti-server-cog",
        },
        {
          id: "fullstack",
          label: t.repositoryStore.stacks.catFullstack,
          icon: "ti-stack-2",
        },
        {
          id: "framework",
          label: t.repositoryStore.stacks.catFrameworks,
          icon: "ti-components",
        },
        { id: "cms", label: t.repositoryStore.stacks.catCms, icon: "ti-edit" },
      ],
    },
    {
      id: "mobile",
      label: t.repositoryStore.stacks.movil,
      icon: "ti-device-mobile",
      categories: [
        {
          id: "all",
          label: t.repositoryStore.stacks.catTodos,
          icon: "ti-layout-grid",
        },
        {
          id: "ios",
          label: t.repositoryStore.stacks.catIos,
          icon: "ti-brand-apple",
        },
        {
          id: "android",
          label: t.repositoryStore.stacks.catAndroid,
          icon: "ti-brand-android",
        },
        {
          id: "react-native",
          label: t.repositoryStore.stacks.catReactNative,
          icon: "ti-brand-react-native",
        },
        {
          id: "flutter",
          label: t.repositoryStore.stacks.catFlutter,
          icon: "ti-brand-flutter",
        },
      ],
    },
    {
      id: "desktop",
      label: t.repositoryStore.stacks.desktop,
      icon: "ti-device-desktop",
      categories: [
        {
          id: "all",
          label: t.repositoryStore.stacks.catTodos,
          icon: "ti-layout-grid",
        },
        {
          id: "electron",
          label: t.repositoryStore.stacks.catElectron,
          icon: "ti-bolt",
        },
        {
          id: "tauri",
          label: t.repositoryStore.stacks.catTauri,
          icon: "ti-shield-checkered",
        },
        {
          id: "native",
          label: t.repositoryStore.stacks.catNativo,
          icon: "ti-cpu",
        },
      ],
    },
    {
      id: "videogame",
      label: t.repositoryStore.stacks.videojuegos,
      icon: "ti-device-gamepad-2",
      categories: [
        {
          id: "all",
          label: t.repositoryStore.stacks.catTodos,
          icon: "ti-layout-grid",
        },
        {
          id: "unity",
          label: t.repositoryStore.stacks.catUnity,
          icon: "ti-brand-unity",
        },
        {
          id: "unreal",
          label: t.repositoryStore.stacks.catUnreal,
          icon: "ti-cube",
        },
        {
          id: "godot",
          label: t.repositoryStore.stacks.catGodot,
          icon: "ti-rocket",
        },
        {
          id: "engine",
          label: t.repositoryStore.stacks.catMotores,
          icon: "ti-engine",
        },
      ],
    },
    {
      id: "ai",
      label: t.repositoryStore.stacks.aiMl,
      icon: "ti-brain",
      categories: [
        {
          id: "all",
          label: t.repositoryStore.stacks.catTodos,
          icon: "ti-layout-grid",
        },
        {
          id: "llm",
          label: t.repositoryStore.stacks.catLlm,
          icon: "ti-message-chatbot",
        },
        {
          id: "ml",
          label: t.repositoryStore.stacks.catMachineLearning,
          icon: "ti-chart-dots-2",
        },
        {
          id: "vision",
          label: t.repositoryStore.stacks.catVision,
          icon: "ti-eye",
        },
        {
          id: "nlp",
          label: t.repositoryStore.stacks.catNlp,
          icon: "ti-language",
        },
      ],
    },
    {
      id: "devops",
      label: t.repositoryStore.stacks.devops,
      icon: "ti-tool",
      categories: [
        {
          id: "all",
          label: t.repositoryStore.stacks.catTodos,
          icon: "ti-layout-grid",
        },
        {
          id: "containers",
          label: t.repositoryStore.stacks.catContenedores,
          icon: "ti-brand-docker",
        },
        {
          id: "iac",
          label: t.repositoryStore.stacks.catIac,
          icon: "ti-script",
        },
        {
          id: "ci-cd",
          label: t.repositoryStore.stacks.catCiCd,
          icon: "ti-git-merge",
        },
        {
          id: "monitoring",
          label: t.repositoryStore.stacks.catMonitoring,
          icon: "ti-activity",
        },
      ],
    },
    {
      id: "security",
      label: t.repositoryStore.stacks.seguridad,
      icon: "ti-shield-lock",
      categories: [
        {
          id: "all",
          label: t.repositoryStore.stacks.catTodos,
          icon: "ti-layout-grid",
        },
        { id: "auth", label: t.repositoryStore.stacks.catAuth, icon: "ti-key" },
        {
          id: "crypto",
          label: t.repositoryStore.stacks.catCrypto,
          icon: "ti-lock-square",
        },
        {
          id: "pentest",
          label: t.repositoryStore.stacks.catPentest,
          icon: "ti-bug",
        },
        {
          id: "scanner",
          label: t.repositoryStore.stacks.catScanner,
          icon: "ti-radar",
        },
      ],
    },
  ];
  Object.assign(context.scope.vars, { stacks: STACKS });
  return (
    <Fragment>
      <PanelLayout
        title={t.repositoryStore.pageTitle}
        activeModule="repository-store"
      >
        <div slot="title-actions" className="contents">
          <RepositorySettingsDrawer />
        </div>
        <div
          className="lxp-repository-store-page space-y-6 pt-5"
          id="repo-store-root"
        >
          {/** Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">
                {t.repositoryStore.pageTitle}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t.repositoryStore.header.subtitle}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <select
                id="repo-sort"
                className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-primary/60 sm:flex-none"
              >
                <option value="relevance">
                  {t.repositoryStore.sort.relevancia}
                </option>
                <option value="stars_desc">
                  {t.repositoryStore.sort.starsMayorAMenor}
                </option>
                <option value="stars_asc">
                  {t.repositoryStore.sort.starsMenorAMayor}
                </option>
                <option value="updated_desc">
                  {t.repositoryStore.sort.recienActualizados}
                </option>
              </select>
              <button
                id="repo-refresh"
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
                title={t.repositoryStore.header.refreshTitle}
              >
                <i className="ti ti-refresh"></i>
                <span className="hidden md:inline">
                  {t.repositoryStore.header.refreshLabel}
                </span>
              </button>
            </div>
          </div>

          {/** Rate-limit / token status card (read-only; token management moved to Ajustes → Credenciales) */}
          <div
            id="repo-rate-info"
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <i
                  id="repo-rate-icon"
                  className="ti ti-info-circle text-lg text-primary"
                ></i>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t.repositoryStore.rateCard.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rs.catalogUi.rateLimitHint}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span
                    id="repo-token-badge"
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium"
                  >
                    <i
                      id="repo-token-icon"
                      className="ti ti-circle-x text-[10px]"
                    ></i>
                    <span id="repo-token-state">
                      {t.repositoryStore.rateCard.sinToken}
                    </span>
                  </span>
                  <span id="repo-rate-meter" className="ml-2"></span>
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <a
                href="/panel/settings#cred-repository-store"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                <i className="ti ti-key"></i>
                {t.settings.credentials.title}
              </a>
            </div>
          </div>

          {/** Tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-border">
            <button
              id="tab-all"
              data-tab="all"
              className="repo-tab-btn inline-flex items-center gap-2 border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary transition-all hover:text-primary/80"
            >
              <span>{t.repositoryStore.tabs.todos}</span>
              <span
                id="tab-all-count"
                className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold"
              >
                —
              </span>
            </button>
            <button
              id="tab-saved"
              data-tab="saved"
              className="repo-tab-btn inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <span>{rs.settingsUi.saved}</span>
              <span
                id="tab-saved-count"
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
              >
                —
              </span>
            </button>
            <button
              id="tab-cloned"
              data-tab="cloned"
              className="repo-tab-btn inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <span>{rs.settingsUi.cloned}</span>
              <span
                id="tab-cloned-count"
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
              >
                —
              </span>
            </button>
            <button
              id="tab-update"
              data-tab="update"
              className="repo-tab-btn inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <span>{rs.settingsUi.updates}</span>
              <span
                id="tab-update-count"
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
              >
                —
              </span>
            </button>
          </div>

          {/** Stats card */}
          <div className="flex items-center gap-6 rounded-2xl border border-border bg-card px-5 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-primary"></span>
              <span className="text-muted-foreground">
                {t.repositoryStore.stats.resultados}
              </span>
              <span id="stat-results" className="font-semibold">
                —
              </span>
            </div>
            <div className="h-4 w-px bg-border"></div>
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-muted-foreground">
                {rs.catalogUi.clonedCount}
              </span>
              <span id="stat-cloned" className="font-semibold">
                —
              </span>
            </div>
            <div className="h-4 w-px bg-border"></div>
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span className="text-muted-foreground">
                {rs.catalogUi.verifiedUpdates}
              </span>
              <span id="stat-updates" className="font-semibold">
                —
              </span>
            </div>
            <div className="ml-auto hidden text-xs text-muted-foreground sm:block">
              {t.repositoryStore.stats.catalogoNote}
            </div>
          </div>

          {/** Sticky toolbar: search + Stack/Categoría/Estado filters stay pinned
         to the top of the scroll area while the results grid scrolls under it. */}
          <div className="sticky top-0 z-20 -mx-5 space-y-3 border-b border-border bg-background px-5 pb-4 pt-2">
            <div className="relative w-full sm:w-72">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none"></i>
              <input
                id="repo-search"
                type="search"
                placeholder={t.repositoryStore.header.searchPlaceholder}
                title={t.repositoryStore.header.searchTitle}
                className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/60"
              />
            </div>

            <div id="repo-catalog-filters" className="space-y-3">
              {/** Stack filter pills */}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {t.repositoryStore.filters.stackLabel}
                </span>
                <select
                  id="repo-stack-select"
                  aria-label={t.repositoryStore.filters.stackLabel}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-primary/60 md:hidden"
                >
                  {STACKS.map((s: any) => (
                    <Fragment>
                      <option value={s.id}>{s.label}</option>
                    </Fragment>
                  ))}
                </select>
                <div
                  id="repo-stack-pills"
                  className="hidden flex-wrap gap-2 md:flex"
                >
                  {STACKS.map((s: any, i: number) => (
                    <Fragment>
                      <button
                        type="button"
                        data-stack={s.id}
                        className={classList([
                          "stack-filter-btn inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                          i === 0
                            ? "border border-primary bg-primary text-primary-foreground"
                            : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                        ])}
                      >
                        <i className={`ti ${s.icon} text-sm`}></i>
                        <span>{s.label}</span>
                      </button>
                    </Fragment>
                  ))}
                </div>
              </div>

              {/** Category filter pills (dynamic per stack) */}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {t.repositoryStore.filters.categoriaLabel}
                </span>
                <select
                  id="repo-category-select"
                  aria-label={t.repositoryStore.filters.categoriaLabel}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-primary/60 md:hidden"
                >
                  {/** Options populated by the script based on the active stack */}
                </select>
                <div
                  id="repo-category-pills"
                  className="hidden flex-wrap gap-2 md:flex"
                >
                  {/** Populated by the script based on the active stack */}
                </div>
              </div>
            </div>
          </div>

          {/** Banner (rate limits / errors) */}
          <div
            id="repo-banner"
            className="hidden rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
          ></div>

          {/** Loading skeleton */}
          <div
            id="repo-loading"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {Array.from({ length: 6 }).map(() => (
              <Fragment>
                <div className="animate-pulse rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 shrink-0 rounded-xl bg-muted"></div>
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-4 w-32 rounded bg-muted"></div>
                      <div className="h-3 w-48 rounded bg-muted"></div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <div className="h-3 w-full rounded bg-muted"></div>
                    <div className="h-3 w-4/5 rounded bg-muted"></div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <div className="h-9 w-40 rounded-xl bg-muted"></div>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>

          {/** Grid */}
          <div
            id="repo-grid"
            className="hidden grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          ></div>

          {/** Empty */}
          <div
            id="repo-empty"
            className="hidden flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <i className="ti ti-search-off text-3xl text-muted-foreground"></i>
            </div>
            <p className="font-medium">{t.repositoryStore.empty.noRepos}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.repositoryStore.empty.tryAnother}
            </p>
          </div>
          <div
            id="repo-pagination"
            className="hidden items-center justify-center gap-3 text-sm"
          >
            <button
              id="repo-prev"
              type="button"
              className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
            >
              {t.components.dataTable.prev}
            </button>
            <span id="repo-page-label"></span>
            <button
              id="repo-next"
              type="button"
              className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
            >
              {t.components.dataTable.next}
            </button>
          </div>
        </div>
        <dialog
          id="repo-clone-dialog"
          className="w-[min(94vw,34rem)] rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl backdrop:bg-black/60"
        >
          <form id="repo-clone-form" className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {rs.catalogUi.cloneRepository}
                </h2>
                <p
                  id="repo-clone-name"
                  className="text-sm text-muted-foreground"
                ></p>
              </div>
              <button
                id="repo-clone-close"
                type="button"
                aria-label={t.components.modalNavbar.close}
                className="rounded-lg p-2 hover:bg-accent"
              >
                <i className="ti ti-x"></i>
              </button>
            </div>
            <label className="block text-xs text-muted-foreground">
              {rs.catalogUi.targetFolder}
              <input
                id="repo-clone-dest"
                required
                type="text"
                className="mt-1 w-full rounded-lg border border-border bg-background p-2 font-mono text-sm"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              {rs.catalogUi.method}
              <select
                id="repo-clone-transport"
                className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
              >
                <option value="https">HTTPS</option>
                <option value="ssh">SSH</option>
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              {rs.catalogUi.cloneHint}
            </p>
            <p
              id="repo-clone-error"
              className="hidden text-sm text-destructive"
            ></p>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {rs.catalogUi.cloneButton}
            </button>
          </form>
        </dialog>
      </PanelLayout>

      <script
        id="repository-store-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(t["repositoryStore"]),
        }}
      ></script>

      <style>{`{"\\n  main:has(> .lxp-repository-store-page) {\\n    padding-top: 0;\\n  }\\n"}`}</style>
    </Fragment>
  );
}
