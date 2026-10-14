// Mail page — DOM/i18n/format helpers + generic input modal (leaf-ish;
// imports nothing from siblings). openInputModal lives here (moved from the
// monolith's entry region) so accounts' bulk actions can reuse it without a
// cycle back to the entry.

// F-03/T-08: el trío i18n vive en el lib compartido; aquí solo el id del payload.
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { TOAST_LEGACY_MS } from "/scripts/extracted/lib/toast.js";

export const { loadI18n, t, fmt } = createPageI18n("mail-i18n");

export function callWin(name: string, ...args: any[]) {
  const fn = (window as any)[name];
  if (typeof fn === "function") fn(...args);
}

let _inputResolve: ((v: string | null) => void) | null = null;

let _inputBound = false;

function initInputModal() {
  if (_inputBound) return;
  const dlg = document.getElementById("dialog-input") as HTMLDialogElement | null;
  const form = document.getElementById("form-input") as HTMLFormElement | null;
  const cancelBtn = document.getElementById("input-dialog-cancel");
  const closeBtn = document.getElementById("input-dialog-close");
  if (!dlg || !form || !cancelBtn) return;
  _inputBound = true;

  const finish = (value: string | null) => {
    const resolve = _inputResolve;
    _inputResolve = null;
    if (dlg.open) dlg.close();
    resolve?.(value);
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const field = document.getElementById("input-dialog-field") as HTMLInputElement | null;
    finish(field?.value ?? "");
  });
  cancelBtn.addEventListener("click", () => finish(null));
  closeBtn?.addEventListener("click", () => finish(null));
  dlg.addEventListener("close", () => {
    if (_inputResolve) finish(null);
  });
}

export function openInputModal(opts: {
  title: string;
  label: string;
  value?: string;
  placeholder?: string;
  type?: "text" | "number" | "email";
}): Promise<string | null> {
  initInputModal();
  const dlg = document.getElementById("dialog-input") as HTMLDialogElement | null;
  const titleEl = document.getElementById("input-dialog-title");
  const labelEl = document.getElementById("input-dialog-label");
  const field = document.getElementById("input-dialog-field") as HTMLInputElement | null;
  if (!dlg || !titleEl || !labelEl || !field) {
    return Promise.resolve(window.prompt(opts.label, opts.value ?? "") );
  }
  titleEl.textContent = opts.title;
  labelEl.textContent = opts.label;
  field.type = opts.type ?? "text";
  field.value = opts.value ?? "";
  field.placeholder = opts.placeholder ?? "";
  return new Promise((resolve) => {
    _inputResolve = resolve;
    dlg.showModal();
    setTimeout(() => field.focus(), 50);
  });
}

export function getCheckedRadioValue(name: string): string {
  const checked = document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement | null;
  return checked?.value ?? "";
}

export function setCheckedRadioValue(name: string, value: string) {
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`) as HTMLInputElement | null;
  if (el) el.checked = true;
}

export function showToast(msg: string, ok = true) {
  const toast = document.getElementById("toast")!;
  const msgEl = document.getElementById("toast-msg")!;
  msgEl.textContent = msg;
  toast.className = `fixed bottom-4 right-4 z-50 max-w-xs rounded-xl border px-4 py-3 shadow-lg text-sm font-medium transition-all ${
    ok
      ? "border-emerald-500/30 bg-card text-emerald-500"
      : "border-destructive/30 bg-card text-destructive"
  }`;
  setTimeout(() => toast.classList.add("hidden"), TOAST_LEGACY_MS);
}

export function setToggleLoadingDialog(open: boolean, message?: string) {
  const dialog = document.getElementById("dialog-toggle-loading") as HTMLDialogElement | null;
  const text = document.getElementById("toggle-loading-text");
  if (!dialog || !text) return;

  if (message) {
    text.textContent = message;
  }

  if (open) {
    if (!dialog.open) dialog.showModal();
    return;
  }

  if (dialog.open) dialog.close();
}

export function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/\"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function parseLocalAndDomain(address: string): { localPart: string; domain: string } {
  const [localPart, domain] = address.split("@");
  return { localPart: localPart ?? "", domain: domain ?? "" };
}

export function fnv1aId(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash & 0x7fffffff;
}

export function formatStorage(mbValue: number): string {
  const mb = Number.isFinite(mbValue) ? Math.max(0, mbValue) : 0;
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb.toFixed(gb >= 10 ? 1 : 2)} GB`;
  }
  return `${mb.toFixed(mb >= 100 ? 0 : 2)} MB`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  if (value >= 1000) return `${value.toFixed(0)}%`;
  if (value >= 100) return `${value.toFixed(1)}%`;
  return `${value.toFixed(2)}%`;
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateTimeLocalValue(dateLike: string | Date | null | undefined): string {
  if (!dateLike) return "";
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function usageBarClass(percent: number, limitedQuota: boolean): string {
  if (!limitedQuota) return "bg-primary/70";
  if (percent >= 100) return "bg-destructive";
  if (percent >= 85) return "bg-amber-500";
  return "bg-emerald-500";
}

// F-02: era el escapador canónico de 5 caracteres, copiado.
export { escapeHtml } from "/scripts/extracted/lib/escape.js";
