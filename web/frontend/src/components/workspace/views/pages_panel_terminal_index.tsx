// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/terminal/index.astro.
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
 * /panel/terminal — vista de página dedicada del Terminal.
 *
 * Renderiza el MISMO componente compartido que el drawer flotante global
 * (`TerminalPanel`, vía `TerminalView`), de modo que ambos modos mantienen
 * paridad automática. No aparece en el menú lateral (no está en MODULE_META);
 * el FAB del terminal se oculta mientras se está en esta ruta. El JS vanilla,
 * el CSS de xterm, `#dialog-snippet` y `#lxp-terminal-pocket` los carga
 * `FloatingTerminal.astro` desde PanelLayout, incluso en el iframe del módulo.
 */
import PanelLayout from "../module-frame";
import TerminalView from "@/components/floating-terminal/TerminalView";
import { getMessages } from "../view-context";
import { localeFromRequest } from "../view-context";
export default function pages_panel_terminal_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const locale = localeFromRequest(Astro.request);
  const t = getMessages(locale, ["terminal"]);
  const user = Astro.locals.user;
  if (
    user?.kind !== "admin" &&
    !(
      user?.hostingPolicy?.runtime &&
      user.hostingPolicy.state === "ready" &&
      user.hostingPolicy.security?.shell === "jailed" &&
      user.permissions?.actions.includes("terminal.open")
    )
  )
    return Astro.redirect("/panel");

  return (
    <Fragment>
      <PanelLayout
        title={t.terminal.pageTitle}
        activeModule=""
        titleInActions
        fullBleed
      >
        <div slot="title-actions" className="flex min-w-0 items-center gap-3">
          <h1
            id="panel-topbar-title"
            data-panel-title
            className="shrink-0 text-base font-semibold"
          >
            {t.terminal.pageTitle}
          </h1>
          <button
            id="terminal-page-settings-trigger"
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-accent"
            title={t.terminal.sidebar.tabConfig}
            aria-label={t.terminal.sidebar.tabConfig}
          >
            <i className="ti ti-settings text-sm" aria-hidden="true"></i>
            <span>{t.terminal.sidebar.tabConfig}</span>
          </button>
        </div>
        <div className="h-full min-h-0">
          <TerminalView locale={locale} />
        </div>
      </PanelLayout>
    </Fragment>
  );
}
