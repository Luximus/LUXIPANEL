// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/ModuleDepsBanner.astro.
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
 * ModuleDepsBanner — generic "required components not detected" banner for
 * module pages, mirroring the firewall `#fw-not-installed` pattern.
 *
 * Markup only. Drive it from the page script with the shared helper:
 *   import { initModuleDeps } from "/scripts/extracted/lib/module-deps.js";
 *   initModuleDeps({ module: "mail", onReady: loadEverything });
 *
 * The page loads the `deps` i18n namespace and passes it down:
 *   const t = await getMessages(locale, ["deps", ...]);
 *   <ModuleDepsBanner module="mail" t={t.deps} />
 *
 * Element id contract (derived from `module`):
 *   #deps-banner-<module>         root warning card (hidden by default)
 *   #deps-banner-title-<module>   heading (script swaps it in one-of mode)
 *   #deps-banner-desc-<module>    description (script swaps it in one-of mode)
 *   #deps-list-<module>           list of required deps (filled by the script;
 *                                 in requiresOneOf mode: the one-of candidates)
 *   #deps-install-<module>        "Install now" button
 *   #deps-optional-<module>       optional-components card (hidden by default)
 *   #deps-optional-list-<module>  list of optional deps (filled by the script)
 *   <InstallModal id=`deps-<module>`> shared install dialog
 *
 * Runtime texts the script needs are exposed as data-txt-* attributes on the
 * root so no client-side i18n is required.
 */
import InstallModal from "./components_InstallModal";
import type { Messages } from "../view-context";
export default function components_ModuleDepsBanner(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  interface Props {
    module: string;
    t: Messages["deps"];
  }
  const { module, t } = Astro.props;

  return (
    <Fragment>
      {/** Required components warning (hidden until the status check says otherwise) */}
      <div
        id={`deps-banner-${module}`}
        className="hidden mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400"
        data-module={module}
        data-txt-installing={t.banner.installing}
        data-txt-success={t.banner.success}
        data-txt-status-installed={t.banner.statusInstalled}
        data-txt-status-missing={t.banner.statusMissing}
        data-txt-status-optional={t.banner.statusOptional}
        data-txt-btn-install={t.banner.btnInstall}
        data-txt-check-error={t.banner.checkError}
        data-txt-one-of-title={t.banner.oneOfTitle}
        data-txt-one-of-description={t.banner.oneOfDescription}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="font-semibold flex items-center gap-2">
              <i className="ti ti-alert-triangle"></i>
              <span id={`deps-banner-title-${module}`}>{t.banner.title}</span>
            </p>
            <p className="mt-1" id={`deps-banner-desc-${module}`}>
              {t.banner.description}
            </p>
            <div id={`deps-list-${module}`} className="mt-3 space-y-1.5"></div>
          </div>
          <button
            id={`deps-install-${module}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <i className="ti ti-download"></i>
            <span>{t.banner.btnInstall}</span>
          </button>
        </div>
      </div>

      {/** Optional components (shown standalone when all required deps are present) */}
      <div
        id={`deps-optional-${module}`}
        className="hidden mb-6 rounded-xl border border-border bg-card p-4 text-sm"
      >
        <p className="font-semibold flex items-center gap-2">
          <i className="ti ti-puzzle text-primary"></i>
          <span>{t.banner.optionalTitle}</span>
        </p>
        <p className="mt-1 text-muted-foreground">
          {t.banner.optionalDescription}
        </p>
        <div
          id={`deps-optional-list-${module}`}
          className="mt-3 space-y-1.5"
        ></div>
      </div>

      <InstallModal
        id={`deps-${module}`}
        title={t.banner.modalTitle}
        description={t.banner.modalDescription}
      />
    </Fragment>
  );
}
