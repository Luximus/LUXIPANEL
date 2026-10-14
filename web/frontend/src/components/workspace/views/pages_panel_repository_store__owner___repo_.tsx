// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/repository-store/[owner]/[repo].astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import PanelLayout from "../module-frame";
import RepositorySettingsDrawer from "./components_panel_repository_store_RepositorySettingsDrawer";
import { getPageMessages } from "../view-context";
export default function pages_panel_repository_store__owner___repo_(
  props: any,
) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["repositoryStore"]);
  const owner = decodeURIComponent(Astro.params.owner ?? "");
  const repo = decodeURIComponent(Astro.params.repo ?? "");
  const fullName =
    owner && repo
      ? `${owner}/${repo}`
      : t.repositoryStore.settingsUi.repository;
  Object.assign(context.scope.vars, { fullName });
  return (
    <Fragment>
      <PanelLayout
        title={t.repositoryStore.detail.pageTitle.replace("{name}", fullName)}
        activeModule="repository-store"
      >
        <div slot="title-actions" className="contents">
          <RepositorySettingsDrawer />
        </div>
        <div
          className="lxp-repository-detail-page space-y-6"
          data-full-name={fullName}
          id="repo-detail-root"
        >
          <div className="sticky top-0 z-20 -mx-5 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-5 py-3">
            <a
              href="/panel/repository-store"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <i className="ti ti-arrow-left"></i>
              {t.repositoryStore.detail.volverAStore}
            </a>
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="detail-install"
                className="hidden inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <i className="ti ti-download"></i>
                {t.repositoryStore.detailUi.save}
              </button>
              <button
                id="detail-update"
                className="hidden inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                <i className="ti ti-refresh"></i>
                {t.repositoryStore.catalogUi.cloneButton}
              </button>
              <button
                id="detail-uninstall"
                className="hidden inline-flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <i className="ti ti-trash"></i>
                {t.repositoryStore.detailUi.removeSaved}
              </button>
            </div>
          </div>

          <div
            id="detail-error"
            className="hidden rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          ></div>

          <section
            id="detail-loading"
            className="animate-pulse rounded-2xl border border-border bg-card p-6"
          >
            <div className="h-4 w-24 rounded bg-muted"></div>
            <div className="mt-3 h-7 w-2/3 rounded bg-muted"></div>
            <div className="mt-2 h-4 w-full rounded bg-muted"></div>
            <div className="mt-1 h-4 w-4/5 rounded bg-muted"></div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map(() => (
                <Fragment>
                  <div className="h-16 rounded-xl bg-muted"></div>
                </Fragment>
              ))}
            </div>
          </section>

          <section id="detail-content" className="hidden space-y-4">
            <article className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 id="repo-title" className="text-2xl font-semibold"></h1>
                    <span
                      id="repo-status"
                      className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                    ></span>
                  </div>
                  <p
                    id="repo-description"
                    className="mt-2 text-sm text-muted-foreground"
                  ></p>
                </div>
                <a
                  id="repo-github-link"
                  href="#"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <i className="ti ti-brand-github"></i>
                  {t.repositoryStore.detail.verEnGitHub}
                </a>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-border p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.repositoryStore.detail.stars}
                  </dt>
                  <dd id="repo-stars" className="mt-1 text-lg font-semibold">
                    -
                  </dd>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.repositoryStore.detail.forks}
                  </dt>
                  <dd id="repo-forks" className="mt-1 text-lg font-semibold">
                    -
                  </dd>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.repositoryStore.detail.issuesAbiertas}
                  </dt>
                  <dd id="repo-issues" className="mt-1 text-lg font-semibold">
                    -
                  </dd>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.repositoryStore.detail.watchers}
                  </dt>
                  <dd id="repo-watchers" className="mt-1 text-lg font-semibold">
                    -
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold">
                {t.repositoryStore.detail.infoTitle}
              </h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.repositoryStore.detail.lenguajePrincipal}
                  </p>
                  <p id="repo-language" className="mt-1 text-sm font-medium">
                    -
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.repositoryStore.detail.licencia}
                  </p>
                  <p id="repo-license" className="mt-1 text-sm font-medium">
                    -
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.repositoryStore.detail.creado}
                  </p>
                  <p id="repo-created" className="mt-1 text-sm font-medium">
                    -
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.repositoryStore.detail.ultimoPush}
                  </p>
                  <p id="repo-pushed" className="mt-1 text-sm font-medium">
                    -
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t.repositoryStore.detail.temasCategorias}
                </p>
                <div
                  id="repo-topics"
                  className="mt-2 flex flex-wrap gap-2"
                ></div>
              </div>
            </article>

            <article className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold">
                {t.repositoryStore.detailUi.serverCopies}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.repositoryStore.detailUi.checkHint}
              </p>
              <div id="detail-clones" className="mt-4 space-y-3"></div>
            </article>

            {/** README */}
            <article className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <i className="ti ti-file-text text-base text-primary"></i>
                <h2 className="text-base font-semibold">README.md</h2>
              </div>
              <div id="readme-loading" className="space-y-2 animate-pulse">
                <div className="h-4 w-1/3 rounded bg-muted"></div>
                <div className="h-3 w-full rounded bg-muted"></div>
                <div className="h-3 w-5/6 rounded bg-muted"></div>
                <div className="h-3 w-4/6 rounded bg-muted"></div>
              </div>
              <div
                id="readme-empty"
                className="hidden rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground"
              >
                <i className="ti ti-file-off text-2xl text-muted-foreground/60"></i>
                <p className="mt-2">{t.repositoryStore.detail.sinReadme}</p>
              </div>
              <div
                id="readme-error"
                className="hidden rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              ></div>
              <div id="readme-content" className="hidden markdown-body"></div>
            </article>
          </section>

          <style>{`{"\\n      @import \\"../../../../styles/extracted/pages/panel/repository-store/[owner]/[repo]-style1.css\\";\\n    "}`}</style>
        </div>
      </PanelLayout>

      <script
        id="repositoryStore-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(t["repositoryStore"]),
        }}
      ></script>

      <style>{`{"\\n  main:has(> .lxp-repository-detail-page) {\\n    padding-top: 0;\\n  }\\n"}`}</style>
    </Fragment>
  );
}
