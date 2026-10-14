// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/ui/SettingsSectionLayout.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

export default function components_ui_SettingsSectionLayout(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  // SPDX-License-Identifier: AGPL-3.0-only
  // Copyright (C) 2026 LUXISOFT
  interface Section {
    id: string;
    label: string;
    icon: string;
  }
  interface Props {
    id: string;
    label: string;
    sections: Section[];
  }
  const { id, label, sections } = Astro.props;

  return (
    <Fragment>
      <div
        data-lxp-settings-sections
        className="flex h-full min-h-0 w-full @container"
      >
        <nav
          role="tablist"
          aria-orientation="vertical"
          aria-label={label}
          className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52"
        >
          {sections.map((section: any, index: number) => (
            <Fragment>
              <button
                id={`${id}-tab-${section.id}`}
                type="button"
                role="tab"
                data-lxp-settings-tab={section.id}
                aria-controls={`${id}-panel-${section.id}`}
                aria-selected={index === 0 ? "true" : "false"}
                tabIndex={index === 0 ? 0 : -1}
                title={section.label}
                className={classList([
                  "flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  index === 0
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                ])}
              >
                <i
                  className={`ti ${section.icon} shrink-0 text-lg`}
                  aria-hidden="true"
                ></i>
                <span className="hidden truncate @xl:inline">
                  {section.label}
                </span>
              </button>
            </Fragment>
          ))}
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
          {slots["default"]}
        </div>
      </div>
    </Fragment>
  );
}
