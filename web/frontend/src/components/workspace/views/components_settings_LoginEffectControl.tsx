// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/settings/LoginEffectControl.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Renders one settings control for a single react-bits effect prop, driven by
// the registry schema. The input id is `s-<scopedStorageKey-dashed>` and every
// field carries `layout-<scope>-bg-field` so the settings script auto-binds it
// (load/save) generically — no per-effect code. `scope` selects the persisted
// key family (login → layout_login_*, panel → layout_panel_*).
import type { LoginEffectProp } from "@/lib/login-effects/registry";
import {
  scopedStorageKey,
  type BackgroundScope,
} from "@/lib/login-effects/coerce";
import { getMessages } from "../view-context";
import { localeFromRequest } from "../view-context";
export default function components_settings_LoginEffectControl(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  interface Props {
    prop: LoginEffectProp;
    scope?: BackgroundScope;
  }
  const { prop, scope = "login" } = Astro.props;
  const locale = localeFromRequest(Astro.request);
  const t = getMessages(locale, ["settings"]);
  const id = "s-" + scopedStorageKey(prop.storageKey, scope).replace(/_/g, "-");
  const c = prop.control;
  const fieldClass = `layout-${scope}-bg-field`;
  const colorClass = `${fieldClass} h-9 w-full cursor-pointer rounded-lg border border-input bg-background p-1`;
  const textClass = `${fieldClass} w-full h-9 rounded-lg border border-input bg-background px-3 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20`;

  return (
    <Fragment>
      {(c === "color" || c === "rgb01") && (
        <Fragment>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor={id}>
              {prop.label}
            </label>
            <input id={id} type="color" className={colorClass} />
          </div>
        </Fragment>
      )}
      {c === "range" && (
        <Fragment>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor={id}>
              {prop.label}{" "}
              <output
                className="text-[11px] text-muted-foreground tabular-nums"
                data-range-output
              ></output>
            </label>
            <input
              id={id}
              type="range"
              min={prop.min}
              max={prop.max}
              step={prop.step}
              data-range-readout
              className={`${fieldClass} w-full accent-primary`}
            />
          </div>
        </Fragment>
      )}
      {c === "number" && (
        <Fragment>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor={id}>
              {prop.label}
            </label>
            <input id={id} type="number" step="any" className={textClass} />
          </div>
        </Fragment>
      )}
      {c === "checkbox" && (
        <Fragment>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
            <input
              id={id}
              type="checkbox"
              className={`${fieldClass} h-4 w-4 accent-primary`}
            />
            {prop.label}
          </label>
        </Fragment>
      )}
      {c === "text" && (
        <Fragment>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground" htmlFor={id}>
              {prop.label}
            </label>
            <input id={id} type="text" className={`${textClass} font-mono`} />
          </div>
        </Fragment>
      )}
      {c === "select" && (
        <Fragment>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor={id}>
              {prop.label}
            </label>
            <select id={id} className={`${textClass} cursor-pointer`}>
              {(prop.options ?? []).map((o: any) => (
                <Fragment>
                  <option value={o.value}>{o.label}</option>
                </Fragment>
              ))}
            </select>
          </div>
        </Fragment>
      )}
      {c === "json" && (
        <Fragment>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground" htmlFor={id}>
              {prop.label}{" "}
              <span className="text-[10px] opacity-70">
                {t.settings.imageList?.labelJson}
              </span>
            </label>
            <textarea
              id={id}
              rows={2}
              className={`${textClass} font-mono py-2 resize-y`}
              placeholder="[]"
            ></textarea>
          </div>
        </Fragment>
      )}
      {c === "items" && (
        // Image-URL list: add/remove entries one by one. The canonical value stays a
        // JSON array string in the hidden input (id=<scoped key>, bound by the
        // settings script) so coerce/render are unchanged; the row editor is wired
        // generically in index-script1.ts (initImageListEditors).
        <Fragment>
          <div className="space-y-2 sm:col-span-2" data-image-list-field>
            <label className="text-xs text-muted-foreground" htmlFor={id}>
              {prop.label}{" "}
              <span className="text-[10px] opacity-70">
                {t.settings.imageList?.labelUrls}
              </span>
            </label>
            <input id={id} type="hidden" className={fieldClass} />
            <div data-image-list-rows className="space-y-2"></div>
            <button
              type="button"
              data-image-list-add
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <i className="ti ti-plus text-sm"></i>
              {t.settings.imageList?.addButton}
            </button>
          </div>
        </Fragment>
      )}
    </Fragment>
  );
}
