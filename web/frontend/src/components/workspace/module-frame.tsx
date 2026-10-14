// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from "react";
import { splitSlots } from "./view-context";
export default function ModuleFrame({
  children,
  activeModule,
  flush = false,
  fullBleed = false,
}: {
  children: ReactNode;
  title?: string;
  activeModule?: string;
  flush?: boolean;
  fullBleed?: boolean;
  titleInActions?: boolean;
}) {
  const slots = splitSlots(children);
  return (
    <>
      <div data-module-toolbar>
        {slots["title-actions"]}
        {activeModule === "mail" && !slots["title-actions"] && (
          <button id="mail-settings-modal-trigger" type="button">
            <i className="ti ti-settings" aria-hidden />
          </button>
        )}
      </div>
      <main
        data-panel-content
        className={`min-h-0 min-w-0 flex-1 ${flush || fullBleed ? "" : "p-4 lg:p-6"}`}
      >
        {slots.default}
      </main>
    </>
  );
}
