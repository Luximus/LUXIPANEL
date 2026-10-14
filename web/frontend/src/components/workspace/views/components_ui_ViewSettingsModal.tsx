// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/ui/ViewSettingsModal.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { getMessages } from "../view-context";
import { localeFromRequest } from "../view-context";
import ModalNavbar from "./components_ui_ModalNavbar";
import { DIALOG_CHROME } from "@/lib/ui-classes";
export default function components_ui_ViewSettingsModal(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  interface Props {
    id: string;
    title: string;
    buttonLabel?: string;
    description?: string;
    hideFooter?: boolean;
    hideTrigger?: boolean;
    /** "drawer" = full-height flex body (left-nav layouts); "modal" = classic scroll body. */
    variant?: "modal" | "drawer";
  }
  const locale = localeFromRequest(Astro.request);
  const t = getMessages(locale, ["components"]);
  const vsm = t.components.viewSettingsModal;
  const {
    id,
    title,
    buttonLabel = vsm.buttonLabel,
    description = vsm.description,
    hideFooter = false,
    hideTrigger = false,
    variant = "modal",
  } = Astro.props;
  const isDrawer = variant === "drawer";
  const triggerId = `${id}-trigger`;
  const closeId = `${id}-close`;
  const cancelId = `${id}-cancel`;
  const hasFooterSlot = Astro.slots.has("footer");

  return (
    <Fragment>
      <div
        data-view-settings-modal
        data-dialog-id={id}
        data-trigger-id={triggerId}
        data-close-id={closeId}
        data-cancel-id={cancelId}
        className="contents"
      >
        {!hideTrigger && (
          <Fragment>
            <button
              type="button"
              id={triggerId}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label={buttonLabel}
              title={buttonLabel}
            >
              <i className="ti ti-settings text-sm"></i>
              <span>{buttonLabel}</span>
            </button>
          </Fragment>
        )}

        <dialog
          id={id}
          data-lxp-module-settings
          data-lxp-modal-wide={isDrawer ? "" : undefined}
          className={`w-[min(95vw,72rem)] max-w-5xl ${DIALOG_CHROME}`}
        >
          <ModalNavbar
            title={title}
            description={description}
            closeId={closeId}
            closeLabel={vsm.close}
          >
            <Fragment slot="actions">{slots["header-actions"]}</Fragment>
          </ModalNavbar>
          <div
            className={
              isDrawer
                ? "flex min-h-0 flex-1 overflow-hidden"
                : "max-h-[80vh] overflow-y-auto px-6 py-5"
            }
          >
            {slots["default"]}
          </div>
          {(!hideFooter || hasFooterSlot) && (
            <Fragment>
              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                {hasFooterSlot ? (
                  <Fragment>{slots["footer"]}</Fragment>
                ) : (
                  <Fragment>
                    <button
                      id={cancelId}
                      type="button"
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                    >
                      {vsm.close}
                    </button>
                  </Fragment>
                )}
              </div>
            </Fragment>
          )}
        </dialog>
      </div>
    </Fragment>
  );
}
