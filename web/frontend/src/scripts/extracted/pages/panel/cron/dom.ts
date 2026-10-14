// Cron page — shared DOM / i18n / pagination helpers.
// Leaf module: imports nothing from the other cron submodules.
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { showToast as showSharedToast } from "/scripts/extracted/lib/toast.js";

  // i18n trio (F-03/T-08) from the shared lib; only the payload id stays here.
  export const { loadI18n, t, fmt } = createPageI18n("cron-i18n");

  export { $, dlg, openDialog, closeDialog } from "/scripts/extracted/lib/dom.js";
  export const inputCls = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  /** F-04: shared toast, kept at cron's historical 3000 ms auto-hide. */
  export function showToast(msg: string, ok = true) {
    showSharedToast(msg, ok, { durationMs: 3000 });
  }
  // Was: only escaped & < > → quotes passed through and broke out of quoted
  // attributes / single-quoted JS strings in on*= handlers (stored XSS via an
  // agent name). escapeHtml covers the full five-char set (safe for element
  // text and quoted attribute values). JS-STRING handler args must ALSO use
  // escapeJsAttr — see agents.ts.
  export const esc = escapeHtml;
  export const norm = (s: unknown) => String(s ?? "").toLowerCase();

  // ---------------------------------------------------------------------------
  // Pagination (shared by both lists)
  // ---------------------------------------------------------------------------
  export const PAGE_SIZE = 10;

  /** Clamp + slice a list for the current page; returns rows + footer HTML. */
  export function paginate<T>(list: T[], page: number): { page: number; slice: T[]; total: number; totalPages: number } {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const p = Math.min(Math.max(1, page), totalPages);
    return { page: p, slice: list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), total, totalPages };
  }

  export function pagerHtml(page: number, totalPages: number, total: number, goFn: string): string {
    if (totalPages <= 1) return "";
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);
    const btn = (target: number, icon: string, disabled: boolean) =>
      `<button type="button" ${disabled ? "disabled" : ""} onclick="${goFn}(${target})" class="rounded-md border border-border px-2 py-1 hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"><i class="ti ti-${icon}"></i></button>`;
    return `<div class="flex items-center justify-between px-5 py-2.5 text-xs text-muted-foreground bg-muted/20">
      <span>${from}–${to} / ${total}</span>
      <div class="flex items-center gap-2">
        ${btn(page - 1, "chevron-left", page <= 1)}
        <span>${page} / ${totalPages}</span>
        ${btn(page + 1, "chevron-right", page >= totalPages)}
      </div>
    </div>`;
  }
