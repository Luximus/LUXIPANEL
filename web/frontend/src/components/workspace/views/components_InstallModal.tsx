// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/InstallModal.astro.
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
 * InstallModal — reusable dialog for installing module libraries / system
 * packages on the connected server while streaming the package-manager log.
 *
 * Markup only. Drive it from a page script with the shared helper:
 *   import { runInstall } from "/scripts/extracted/lib/install-modal.js";
 *   await runInstall({ id: "firewall", endpoint: "/api/firewall/install", body: {...} });
 *
 * The helper resolves elements by the `id` prop, so the same component can be
 * dropped into any module (firewall, bitninja, mail, …). Sudo prompting is
 * handled by the helper via the shared `withSudo` flow.
 *
 * Element id contract (derived from `id`):
 *   #dlg-<id>-install         the <dialog>
 *   #<id>-install-status      status line text
 *   #<id>-install-spinner     spinner shown while running
 *   #<id>-install-output      <pre> filled with the install log
 *   #<id>-install-close       close button (disabled while running)
 */
import ModalNavbar from "./components_ui_ModalNavbar";
import { DIALOG_CHROME } from "@/lib/ui-classes";
export default function components_InstallModal(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  interface Props {
    id: string;
    title: string;
    description?: string;
    icon?: string;
  }
  const { id, title, description, icon = "ti-download" } = Astro.props;

  return (
    <Fragment>
      <dialog
        id={`dlg-${id}-install`}
        className={`w-full max-w-2xl ${DIALOG_CHROME}`}
      >
        <ModalNavbar
          title={title}
          description={description}
          icon={icon}
          closeId={`${id}-install-close`}
        />

        <div className="flex flex-col gap-3 px-6 py-5">
          <div className="flex items-center gap-2 text-sm">
            <span id={`${id}-install-spinner`} className="hidden">
              <i className="ti ti-loader-2 animate-spin text-primary"></i>
            </span>
            <span
              id={`${id}-install-status`}
              className="text-muted-foreground"
            ></span>
          </div>
          <pre
            id={`${id}-install-output`}
            className="hidden max-h-80 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap"
          ></pre>
        </div>
      </dialog>
    </Fragment>
  );
}
