// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/module-dev/LogsDrawer.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import LogsPanel from "@/components/module-dev/LogsPanel";
export default function components_module_dev_LogsDrawer(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  interface Props {
    labels: Record<string, string>;
  }
  const { labels: L } = Astro.props;

  return (
    <Fragment>
      <button
        type="button"
        id="module-dev-logs-modal-trigger"
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={L.title}
      >
        <i className="ti ti-report-analytics text-base" aria-hidden="true"></i>
        <span>{L.title}</span>
      </button>
      <ViewSettingsModal
        id="module-dev-logs-modal"
        title={L.title}
        description={L.description}
        variant="drawer"
        hideFooter={true}
        hideTrigger={true}
      >
        <button
          slot="header-actions"
          type="button"
          id="md-logs-settings"
          title={L.settings}
          aria-label={L.settings}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <i className="ti ti-settings text-lg" aria-hidden="true"></i>
        </button>
        <LogsPanel labels={L} />
      </ViewSettingsModal>
    </Fragment>
  );
}
