// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/cron/ScheduleBuilder.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

export default function components_cron_ScheduleBuilder(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  // SPDX-License-Identifier: AGPL-3.0-only
  // Copyright (C) 2026 LUXISOFT
  /**
   * Friendly cron schedule builder. Renders a frequency selector + contextual
   * fields; the JS in the cron page (`setupBuilder`) reads `data-prefix` to wire
   * it up, compute the cron expression into the hidden input and show a live
   * human description. Reused by both the script-job and AI-agent dialogs.
   */
  interface Props {
    prefix: string;
    t: any;
    /** Offer "no schedule" (run only manually or chained from another job). */
    allowNone?: boolean;
  }
  const { prefix, t, allowNone = false } = Astro.props;
  const b = t.cron.builder;

  return (
    <Fragment>
      <div className="schedule-builder space-y-2" data-prefix={prefix}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {b.frequency}
            </label>
            <select
              data-role="freq"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              defaultValue="daily"
            >
              {allowNone && (
                <Fragment>
                  <option value="none">{b.none}</option>
                </Fragment>
              )}
              <option value="minutes">{b.everyNMinutes}</option>
              <option value="hourly">{b.hourly}</option>
              <option value="daily">{b.daily}</option>
              <option value="weekly">{b.weekly}</option>
              <option value="monthly">{b.monthly}</option>
              <option value="advanced">{b.advanced}</option>
            </select>
          </div>
          <div data-role="freq-extra" className="space-y-1"></div>
        </div>

        <input type="hidden" data-role="schedule" />
        <div
          data-role="preview"
          className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs"
        >
          <i className="ti ti-calendar-time text-sm"></i>
          <span data-role="preview-text" className="text-muted-foreground">
            —
          </span>
          <code
            data-role="preview-expr"
            className="ml-auto font-mono text-[11px] text-primary"
          ></code>
        </div>
      </div>
    </Fragment>
  );
}
