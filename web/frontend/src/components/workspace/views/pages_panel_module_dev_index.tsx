// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/module-dev/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

/**
 * Dev de módulos — /panel/module-dev
 *
 * "Mis módulos" del marketplace para el developer: estado de cada módulo
 * (reviewStatus de LP), timeline de eventos de revisión, acciones del ciclo
 * (enviar/reenviar/despublicar/reactivar), runner de tests e instalación
 * preview (Modo B). El alta SIEMPRE nace en el asistente IA (/mod vincular
 * <slug>) — esta página solo ofrece deep-links al chat (lxp:assistant:seed).
 *
 * Consume /api/module-dev/* (contrato §2 del flujo marketplace F1b).
 */
import PanelLayout from "../module-frame";
import ModalNavbar from "./components_ui_ModalNavbar";
import DataTable from "@/components/ui/DataTable";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import {
  buildModuleDevTableColumns,
  buildModuleDevTableFilters,
  buildModuleDevTableRowActions,
  buildModuleDevTableValueBadges,
} from "@/config/tables/module-dev-table-config";
import { getPageMessages } from "../view-context";
export default function pages_panel_module_dev_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["moduleDev", "components"]);
  const md = t.moduleDev;
  const mdAny: any = md;
  const dataTableI18n = (t.components as any).dataTable;
  const mdJson = JSON.stringify(md);

  return (
    <Fragment>
      <PanelLayout title={md.header.heading} activeModule="module-dev">
        <div slot="title-actions" className="flex items-center gap-2">

          <ViewSettingsModal
            id="module-dev-settings-modal"
            title={md.settingsUi.title}
            description={md.settingsUi.description}
            variant="drawer"
            hideFooter={true}
          >
            <section className="flex h-full min-h-0 w-full @container">
              <nav
                className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52"
                aria-label={md.settingsUi.title}
              >
                <button
                  type="button"
                  data-moduledev-settings-nav="table"
                  title={md.settingsUi.table}
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start bg-primary/10 text-primary"
                >
                  <i className="ti ti-table shrink-0 text-lg"></i>
                  <span className="hidden truncate @xl:inline">
                    {md.settingsUi.table}
                  </span>
                </button>
              </nav>
              <div
                id="moduledev-settings-body"
                className="min-w-0 flex-1 overflow-y-auto"
              >
                <section
                  data-moduledev-settings-panel="table"
                  className="space-y-5 px-1 py-4 @xl:px-6"
                >
                  <section className="space-y-2.5">
                    <h3 className="text-sm font-semibold">
                      {t.components.tableSettings.pagination}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {md.settingsUi.rowsPerPage}
                    </p>
                    <div className="inline-flex overflow-hidden rounded-lg border border-border">
                      {[10, 25, 50, 100].map((n: any) => (
                        <Fragment>
                          <button
                            type="button"
                            data-moduledev-pagesize={String(n)}
                            className="border-r border-border px-3 py-1.5 text-sm font-medium last:border-r-0 hover:bg-accent"
                          >
                            {n}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </section>
                  <section className="space-y-3 border-t border-border pt-5">
                    <h3 className="text-sm font-semibold">
                      {md.settingsUi.publicationFlow}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {md.settingsUi.publicationHint}
                    </p>
                    <div className="flex flex-col gap-2 text-xs">
                      <a
                        href="/panel/assistant"
                        className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                      >
                        {md.settingsUi.assistantProjects}
                      </a>
                      <a
                        href="/panel/codebase-graph"
                        className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                      >
                        {md.settingsUi.codeGraph}
                      </a>
                      <a
                        href="/panel/files"
                        className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                      >
                        {md.settingsUi.moduleFiles}
                      </a>
                    </div>
                  </section>
                  <section className="space-y-2.5">
                    <h3 className="text-sm font-semibold">
                      {t.components.tableSettings.visibleActions}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t.components.tableSettings.actionsHint}
                    </p>
                    <div className="space-y-1.5">
                      {buildModuleDevTableRowActions(mdAny).map((a: any) => (
                        <Fragment>
                          <label className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm">
                            <input
                              type="checkbox"
                              data-moduledev-action={a.id}
                              defaultChecked
                              className="h-4 w-4 rounded border-border"
                            />
                            <i
                              className={`ti ${a.icon ?? "ti-dots"} text-base text-muted-foreground`}
                            ></i>
                            <span>{a.label}</span>
                          </label>
                        </Fragment>
                      ))}
                    </div>
                  </section>
                </section>
              </div>
            </section>
          </ViewSettingsModal>
        </div>
        <div id="module-dev-root">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">{md.header.heading}</h2>
              <p className="text-sm text-muted-foreground">
                {md.header.subheading}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                id="md-refresh"
                title={md.actions.refresh}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <i className="ti ti-refresh text-sm"></i>
              </button>
              <button
                id="md-create"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
              >
                <i className="ti ti-sparkles text-base"></i> {md.actions.create}
              </button>
            </div>
          </div>

          <div
            id="md-local"
            className="mb-5 hidden rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground"
            role="status"
          >
            Este panel funciona en modo local. Puedes vincular proyectos,
            validar módulos, ejecutar tests e instalar previews. La publicación
            en el marketplace requiere vincular el panel a LP.
          </div>

          {/** Banner stale (LP no responde → datos de caché de instancia) */}
          <div
            id="md-stale"
            className="mb-5 hidden items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
          >
            <i className="ti ti-cloud-off text-base text-amber-600 dark:text-amber-400"></i>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {md.common.staleBanner}
              <span className="text-xs opacity-80">
                ({md.common.fetchedAt}: <span id="md-stale-at">—</span>)
              </span>
            </p>
          </div>

          {/** Mis módulos */}
          <section id="md-modules-section" className="mb-5 min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{md.table.title}</h3>
            </div>
            <DataTable
              scopedPreferences={true}
              i18n={dataTableI18n}
              tableId="module-dev-table"
              title={md.table.title}
              columns={buildModuleDevTableColumns(mdAny)}
              data={[]}
              filters={buildModuleDevTableFilters(mdAny)}
              rowActions={buildModuleDevTableRowActions(mdAny)}
              valueBadges={buildModuleDevTableValueBadges(mdAny)}
              selectable={false}
            />
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            {/** Vínculos del asistente (marketplace-link del target actual) */}
            <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">
                  {md.common.linksTitle}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {md.common.linksSubtitle}
                </p>
              </div>
              <div id="md-links" className="min-h-[6rem] p-1.5">
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {md.table.loading}
                </div>
              </div>
            </section>

            {/** Previews instaladas (Modo B, visibles solo para el dev) */}
            <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">
                  {md.common.previewsTitle}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {md.common.previewsSubtitle}
                </p>
              </div>
              <div id="md-previews" className="min-h-[6rem] p-1.5">
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {md.table.loading}
                </div>
              </div>
            </section>
          </div>
        </div>
      </PanelLayout>

      {/** Detalle del módulo: estado + timeline de eventos de revisión */}
      <dialog
        id="dlg-md-detail"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <h3
              id="md-detail-title"
              className="truncate font-mono text-base font-semibold"
            ></h3>
            <span id="md-detail-status" className="shrink-0"></span>
          </div>
          <button
            id="md-detail-x"
            className="text-muted-foreground hover:text-foreground"
          >
            <i className="ti ti-x text-lg"></i>
          </button>
        </div>
        <div
          id="md-detail-body"
          className="max-h-[60vh] overflow-y-auto px-6 py-4"
        >
          <p className="text-sm text-muted-foreground">{md.events.loading}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="md-detail-close"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {md.modals.btnClose}
          </button>
        </div>
      </dialog>

      {/** Enviar / Reenviar (pide la URL del PR) */}
      <dialog
        id="dlg-md-pr"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={md.modals.submitTitle}
          titleId="md-pr-title"
          closeId="md-pr-x"
        />
        <div className="px-6 py-4">
          <p
            className="mb-3 font-mono text-xs text-muted-foreground"
            id="md-pr-code"
          ></p>
          <label
            htmlFor="md-pr-url"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {md.modals.prUrlLabel}
          </label>
          <input
            id="md-pr-url"
            type="url"
            spellCheck="false"
            autoComplete="off"
            placeholder={md.modals.prUrlPlaceholder}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p
            id="md-pr-error"
            className="mt-2 hidden text-xs text-destructive"
          ></p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="md-pr-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {md.modals.btnCancel}
          </button>
          <button
            id="md-pr-save"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <i className="ti ti-send text-base"></i> {md.modals.btnConfirm}
          </button>
        </div>
      </dialog>

      {/** Confirmación (despublicar / reactivar) */}
      <dialog
        id="dlg-md-confirm"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title=""
          titleId="md-confirm-title"
          closeId="md-confirm-x"
        />
        <div className="px-6 py-4">
          <p id="md-confirm-body" className="text-sm text-muted-foreground"></p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="md-confirm-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {md.modals.btnCancel}
          </button>
          <button
            id="md-confirm-ok"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {md.modals.btnConfirm}
          </button>
        </div>
      </dialog>

      {/** Resultado (tests / validación / instalación preview) */}
      <dialog
        id="dlg-md-result"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar title="" titleId="md-result-title" closeId="md-result-x" />
        <div
          id="md-result-body"
          className="max-h-[60vh] overflow-y-auto px-6 py-4"
        ></div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="md-result-close"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {md.modals.btnClose}
          </button>
        </div>
      </dialog>

      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      {/** Strings i18n para el script extraído (renderizado dinámico) */}
      <script
        id="md-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: mdJson }}
      ></script>
    </Fragment>
  );
}
