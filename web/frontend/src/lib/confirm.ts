// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { acquireBodyPointerEvents, releaseBodyPointerEvents } from "./body-pointer-events-core";
import esComponents from "@/i18n/es/components";

// Translated strings for the confirm/alert/prompt modal dialogs.
// All keys are sourced from `components.confirmModal` in the locale files.
// Optional: when not provided, Spanish defaults from es/components.ts are used
// so SSR and standalone usage (no locale context) still work without breakage.
export interface ConfirmModalI18n {
  title: string;
  cancel: string;
  confirm: string;
  alertTitle: string;
  alertOk: string;
  promptTitle: string;
  promptCancel: string;
  promptOk: string;
}

const DEFAULT_CONFIRM_MODAL_I18N: ConfirmModalI18n = esComponents.confirmModal;

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
  /** Translated strings for the modal chrome (title/buttons). Optional. */
  i18n?: Partial<ConfirmModalI18n>;
}

// confirm.ts is bundled TWICE — once into the extracted page-script bundle
// (imported by scripts like monitor/watchdog via `/scripts/extracted/lib/
// confirm.js`) and once into the Astro/Vite island bundle (imported by React/
// Astro via `@/lib/confirm`). Each bundle is a SEPARATE module instance with its
// own top-level variables, but they share the same dialog DOM. With per-element
// binding only ONE bundle attaches the button listeners, yet the OTHER bundle may
// be the one that called openConfirm(). So the pending resolver MUST live in one
// place both bundles see — a slot on globalThis — otherwise the bound listener
// resolves its own (null) resolver and the opener's promise hangs forever.
type ResolverSlot = "confirm" | "alert" | "prompt";

interface ModalResolvers {
  confirm: ((v: boolean) => void) | null;
  alert: (() => void) | null;
  prompt: ((v: string | null) => void) | null;
}
const _modal: ModalResolvers = ((
  globalThis as unknown as { __lxpModalResolvers?: ModalResolvers }
).__lxpModalResolvers ??= { confirm: null, alert: null, prompt: null });

/**
 * Shared modal-lifecycle binding: marks the dialog as bound (idempotent across
 * SPA navigations), restores the body pointer-events flipped on by the opener
 * when the dialog closes, and falls back to the resolver captured on globalThis
 * if the user dismissed the dialog without clicking OK/Cancel (ESC, backdrop).
 *
 * Each modal type calls this once from its `init*Modal` and then binds its own
 * OK/Cancel/Form buttons. Keeping the close-event resolution here means the
 * per-modal init code is only the button-specific wiring.
 */
function bindDialogLifecycle(wrapper: HTMLDialogElement, slot: ResolverSlot): void {
  // Bind per-element, not via a module-level flag: Astro's ClientRouter replaces
  // <ConfirmModal /> (not transition:persist) on every SPA navigation, so a fresh
  // dialog node appears with no listeners. A module-level guard would skip
  // rebinding and leave the OK/Cancel buttons dead after the first navigation.
  if (wrapper.dataset.bound === "1") return;
  wrapper.dataset.bound = "1";

  wrapper.addEventListener("close", () => {
    // Restore the body pointer-events flipped on in open* (these native modals
    // can be summoned from inside a vaul drawer that left the body inert).
    releaseBodyPointerEvents();
    const pending = _modal[slot];
    if (pending) {
      _modal[slot] = null;
      // ESC / backdrop close → resolve as the "negative" outcome for each
      // dialog type (false / void / null).
      (pending as (v: unknown) => void)(
        slot === "alert" ? undefined : slot === "confirm" ? false : null,
      );
    }
  });
}

function initConfirmModal() {
  const wrapper = document.getElementById("confirm-modal-wrapper") as HTMLDialogElement | null;
  const cancelBtn = document.getElementById("confirm-modal-cancel");
  const closeBtn = document.getElementById("confirm-modal-close");
  const okBtn = document.getElementById("confirm-modal-ok");
  if (!wrapper || !cancelBtn || !okBtn) return;
  bindDialogLifecycle(wrapper, "confirm");

  cancelBtn.addEventListener("click", () => finishConfirm(false));
  closeBtn?.addEventListener("click", () => finishConfirm(false));
  okBtn.addEventListener("click", () => finishConfirm(true));
}

function finishConfirm(value: boolean) {
  const wrapper = document.getElementById("confirm-modal-wrapper") as HTMLDialogElement | null;
  _modal.confirm?.(value);
  _modal.confirm = null;
  wrapper?.close();
}

export function openConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  const wrapper = document.getElementById("confirm-modal-wrapper");
  const titleEl = document.getElementById("confirm-modal-title");
  const msgEl = document.getElementById("confirm-modal-message");
  const cancelBtn = document.getElementById("confirm-modal-cancel");
  const okBtn = document.getElementById("confirm-modal-ok");
  const iconWrap = document.getElementById("confirm-modal-icon-wrap");
  const iconEl = document.getElementById("confirm-modal-icon");
  const dialogEl = wrapper as HTMLDialogElement | null;

  if (!wrapper || !titleEl || !msgEl || !cancelBtn || !okBtn || !dialogEl) {
    console.warn("[openConfirm] Elements not found, using window.confirm");
    return Promise.resolve(window.confirm(message));
  }

  const i18n = { ...DEFAULT_CONFIRM_MODAL_I18N, ...options.i18n };
  titleEl.textContent = options.title ?? i18n.title;
  msgEl.textContent = message;
  cancelBtn.textContent = options.cancelText ?? i18n.cancel;

  if (options.variant === "danger") {
    okBtn.className =
      "inline-flex items-center justify-center rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors";
    okBtn.textContent = options.confirmText ?? i18n.confirm;
    if (iconWrap)
      iconWrap.className =
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10";
    if (iconEl) iconEl.className = "ti ti-alert-triangle text-destructive text-base";
  } else {
    okBtn.className =
      "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors";
    okBtn.textContent = options.confirmText ?? i18n.confirm;
    if (iconWrap)
      iconWrap.className =
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10";
    if (iconEl) iconEl.className = "ti ti-alert-triangle text-amber-500 text-base";
  }

  return new Promise((resolve) => {
    _modal.confirm = resolve;
    // Re-enable body pointer events so the dialog is clickable even when opened
    // over a vaul drawer (which leaves `body { pointer-events: none }`).
    if (!dialogEl.open) acquireBodyPointerEvents();
    dialogEl.showModal();
  });
}

// ── Alert modal (replaces window.alert) ──────────────────────────────────────

export interface AlertOptions {
  title?: string;
  okText?: string;
  variant?: "info" | "success" | "warning" | "danger";
  /** Translated strings for the modal chrome (title/buttons). Optional. */
  i18n?: Partial<ConfirmModalI18n>;
}

const ALERT_STYLES: Record<NonNullable<AlertOptions["variant"]>, { wrap: string; icon: string }> = {
  info: { wrap: "bg-primary/10", icon: "ti ti-info-circle text-primary text-base" },
  success: { wrap: "bg-emerald-500/10", icon: "ti ti-circle-check text-emerald-500 text-base" },
  warning: { wrap: "bg-amber-500/10", icon: "ti ti-alert-triangle text-amber-500 text-base" },
  danger: { wrap: "bg-destructive/10", icon: "ti ti-alert-triangle text-destructive text-base" },
};

function finishAlert() {
  const wrapper = document.getElementById("alert-modal-wrapper") as HTMLDialogElement | null;
  _modal.alert?.();
  _modal.alert = null;
  wrapper?.close();
}

function initAlertModal() {
  const wrapper = document.getElementById("alert-modal-wrapper") as HTMLDialogElement | null;
  const okBtn = document.getElementById("alert-modal-ok");
  const closeBtn = document.getElementById("alert-modal-close");
  if (!wrapper || !okBtn) return;
  bindDialogLifecycle(wrapper, "alert");
  okBtn.addEventListener("click", finishAlert);
  closeBtn?.addEventListener("click", finishAlert);
}

/** Replacement for `window.alert` — resolves when the user dismisses it. */
export function openAlert(message: string, options: AlertOptions = {}): Promise<void> {
  const wrapper = document.getElementById("alert-modal-wrapper");
  const titleEl = document.getElementById("alert-modal-title");
  const msgEl = document.getElementById("alert-modal-message");
  const okBtn = document.getElementById("alert-modal-ok");
  const iconWrap = document.getElementById("alert-modal-icon-wrap");
  const iconEl = document.getElementById("alert-modal-icon");
  const dialogEl = wrapper as HTMLDialogElement | null;

  if (!wrapper || !titleEl || !msgEl || !okBtn || !dialogEl) {
    console.warn("[openAlert] Elements not found, using window.alert");
    window.alert(message);
    return Promise.resolve();
  }

  initAlertModal();
  const style = ALERT_STYLES[options.variant ?? "info"];
  const i18n = { ...DEFAULT_CONFIRM_MODAL_I18N, ...options.i18n };
  titleEl.textContent = options.title ?? i18n.alertTitle;
  msgEl.textContent = message;
  okBtn.textContent = options.okText ?? i18n.alertOk;
  if (iconWrap)
    iconWrap.className = `flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.wrap}`;
  if (iconEl) iconEl.className = style.icon;

  return new Promise((resolve) => {
    _modal.alert = resolve;
    if (!dialogEl.open) acquireBodyPointerEvents();
    dialogEl.showModal();
  });
}

// ── Prompt modal (replaces window.prompt) ────────────────────────────────────

export interface PromptOptions {
  title?: string;
  okText?: string;
  cancelText?: string;
  placeholder?: string;
  defaultValue?: string;
  inputType?: "text" | "password" | "email" | "number" | "url";
  /** Translated strings for the modal chrome (title/buttons). Optional. */
  i18n?: Partial<ConfirmModalI18n>;
}

function finishPrompt(value: string | null) {
  const wrapper = document.getElementById("prompt-modal-wrapper") as HTMLDialogElement | null;
  const pending = _modal.prompt;
  _modal.prompt = null;
  wrapper?.close();
  pending?.(value);
}

function initPromptModal() {
  const wrapper = document.getElementById("prompt-modal-wrapper") as HTMLDialogElement | null;
  const form = document.getElementById("prompt-modal-form");
  const input = document.getElementById("prompt-modal-input") as HTMLInputElement | null;
  const cancelBtn = document.getElementById("prompt-modal-cancel");
  const closeBtn = document.getElementById("prompt-modal-close");
  if (!wrapper || !form || !input) return;
  bindDialogLifecycle(wrapper, "prompt");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    finishPrompt(input.value);
  });
  cancelBtn?.addEventListener("click", () => finishPrompt(null));
  closeBtn?.addEventListener("click", () => finishPrompt(null));
}

/** Replacement for `window.prompt` — resolves to the typed text, or null on cancel. */
export function openPrompt(message: string, options: PromptOptions = {}): Promise<string | null> {
  const wrapper = document.getElementById("prompt-modal-wrapper");
  const titleEl = document.getElementById("prompt-modal-title");
  const msgEl = document.getElementById("prompt-modal-message");
  const input = document.getElementById("prompt-modal-input") as HTMLInputElement | null;
  const cancelBtn = document.getElementById("prompt-modal-cancel");
  const okBtn = document.getElementById("prompt-modal-ok");
  const dialogEl = wrapper as HTMLDialogElement | null;

  if (!wrapper || !titleEl || !msgEl || !input || !dialogEl) {
    console.warn("[openPrompt] Elements not found, using window.prompt");
    return Promise.resolve(window.prompt(message, options.defaultValue ?? ""));
  }

  initPromptModal();
  const i18n = { ...DEFAULT_CONFIRM_MODAL_I18N, ...options.i18n };
  titleEl.textContent = options.title ?? i18n.promptTitle;
  msgEl.textContent = message;
  msgEl.classList.toggle("hidden", !message);
  input.type = options.inputType ?? "text";
  input.placeholder = options.placeholder ?? "";
  input.value = options.defaultValue ?? "";
  if (cancelBtn) cancelBtn.textContent = options.cancelText ?? i18n.promptCancel;
  if (okBtn) okBtn.textContent = options.okText ?? i18n.promptOk;

  return new Promise((resolve) => {
    _modal.prompt = resolve;
    if (!dialogEl.open) acquireBodyPointerEvents();
    dialogEl.showModal();
    // Focus + select after the dialog is shown.
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}

// Guard against SSR: this module is imported by React islands (ProjectModal,
// StatsTab, floating-terminal) that Astro renders server-side, where `document`
// is undefined. Only bind the lifecycle in the browser.
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initConfirmModal();
      initAlertModal();
      initPromptModal();
    });
  } else {
    initConfirmModal();
    initAlertModal();
    initPromptModal();
  }
  document.addEventListener("astro:after-swap", () => {
    initConfirmModal();
    initAlertModal();
    initPromptModal();
  });
}
