// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/ui/ModalNavbar.astro.
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
 * ModalNavbar — shared modal/dialog header that mirrors the panel topbar
 * (PanelLayout.astro): a compact h-14 row with an optional icon-only
 * chevron-left "back" button, a font-semibold title (the description is
 * exposed as a native `title` tooltip, NOT rendered as a subtitle), a pill
 * actions cluster (slot) and a ✕ close button on the right.
 *
 * Drop-in replacement for the old
 *   <div class="flex items-center justify-between border-b border-border px-6 py-4">
 *     <h3 class="text-base font-semibold">…</h3>
 *     <button id="…-close">…</button>
 *   </div>
 * header blocks used across the module dialogs.
 *
 * IMPORTANT — script contract: pass the SAME `closeId`/`titleId`/`backId`
 * the extracted scripts (src/scripts/extracted/pages/panel/<mod>/) hook, so
 * open/close wiring and dynamic title updates keep working. The close button
 * keeps the canonical classes so existing selectors still match.
 *
 * Props:
 *   title       modal title (font-semibold, truncated).
 *   titleId?    id kept on the <h3> (scripts that rewrite the title).
 *   description? shown as the native `title` tooltip on the heading.
 *   icon?       optional leading Tabler icon class (e.g. "ti-folder-key").
 *   showBack?   render the icon-only chevron-left back button (default false).
 *   backId?     id for the back button (script hook).
 *   backHref?   if set, back is an <a href>; otherwise a <button type=button>.
 *   backLabel?  aria-label/title for back (defaults to i18n "Volver").
 *   closeId?    id for the ✕ close button (script hook).
 *   closeLabel? aria-label for close (defaults to i18n "Cerrar").
 *
 * Slots:
 *   leading     custom markup rendered in the left icon slot (before the
 *               title). Use it when the icon needs its own id/wrap that a
 *               script mutates (e.g. the confirm/alert colored icon circle).
 *               Takes precedence over the `icon` prop.
 *   actions     pill-style actions rendered left of the ✕ (right cluster).
 */
import { getMessages } from "../view-context";
import { localeFromRequest } from "../view-context";
export default function components_ui_ModalNavbar(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  interface Props {
    title: string;
    titleId?: string;
    description?: string;
    icon?: string;
    showBack?: boolean;
    backId?: string;
    backHref?: string;
    backLabel?: string;
    closeId?: string;
    closeLabel?: string;
  }
  const locale = localeFromRequest(Astro.request);
  const t = getMessages(locale, ["components"]);
  const nav = t.components.modalNavbar;
  const {
    title,
    titleId,
    description,
    icon,
    showBack = false,
    backId,
    backHref,
    backLabel = nav.back,
    closeId,
    closeLabel = nav.close,
  } = Astro.props;
  const hasActions = Astro.slots.has("actions");
  const hasLeading = Astro.slots.has("leading");

  return (
    <Fragment>
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        {showBack &&
          (backHref ? (
            <Fragment>
              <a
                id={backId}
                href={backHref}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={backLabel}
                title={backLabel}
              >
                <i className="ti ti-chevron-left text-lg"></i>
              </a>
            </Fragment>
          ) : (
            <Fragment>
              <button
                id={backId}
                type="button"
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={backLabel}
                title={backLabel}
              >
                <i className="ti ti-chevron-left text-lg"></i>
              </button>
            </Fragment>
          ))}

        <div className="flex min-w-0 items-center gap-2">
          {hasLeading ? (
            <Fragment>{slots["leading"]}</Fragment>
          ) : (
            icon && (
              <Fragment>
                <i className={`ti ${icon} shrink-0 text-lg text-primary`}></i>
              </Fragment>
            )
          )}
          <h3
            id={titleId}
            className="truncate text-base font-semibold"
            title={description}
          >
            {title}
          </h3>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hasActions && <Fragment>{slots["actions"]}</Fragment>}
          <button
            id={closeId}
            type="button"
            className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label={closeLabel}
          >
            <i className="ti ti-x text-lg"></i>
          </button>
        </div>
      </div>
    </Fragment>
  );
}
