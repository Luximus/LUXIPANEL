// Obsidian page — generic input dialog (new note / new folder / rename).
import { $ } from "./dom";

// ── Generic input dialog (new note / new folder / rename) ───────────────────
export let inputResolve: ((value: string | null) => void) | null = null;

export function askInput(title: string, label: string, initial = ""): Promise<string | null> {
  const dlg = $("dlg-obs-input") as HTMLDialogElement | null;
  const input = $("obs-input-value") as HTMLInputElement | null;
  if (!dlg || !input) return Promise.resolve(null);
  // Settle a dangling promise from a previous (Esc-closed) dialog first.
  inputResolve?.(null);
  inputResolve = null;
  const titleEl = $("obs-input-title");
  const labelEl = $("obs-input-label");
  if (titleEl) titleEl.textContent = title;
  if (labelEl) labelEl.textContent = label;
  input.value = initial;
  if (!dlg.open) dlg.showModal();
  setTimeout(() => input.focus(), 50);
  return new Promise((resolve) => {
    inputResolve = resolve;
  });
}

export function settleInput(value: string | null) {
  // Resolve BEFORE closing so the dialog's `close` event (which settles null
  // for Esc/backdrop dismissals) finds the promise already settled.
  inputResolve?.(value);
  inputResolve = null;
  ($("dlg-obs-input") as HTMLDialogElement | null)?.close();
}

// Extracted from the former bindOnce `close` listener so `inputResolve` stays
// private to this module (an imported binding can't be reassigned elsewhere).
export function cancelPendingInput() {
  if (inputResolve) {
    inputResolve(null);
    inputResolve = null;
  }
}
