// Files page — toast submodule (code-move from index-script1.ts; no behavior change).
import { escapeHtml } from "./paths";
import { TOAST_LEGACY_MS } from "/scripts/extracted/lib/toast.js";

  export let toastTimer: ReturnType<typeof setTimeout> | null = null;
  export function showToast(msg: string, ok = true) {
    const toast = document.getElementById("toast");
    const msgEl = document.getElementById("toast-msg");
    if (!toast || !msgEl) return;
    if (toastTimer) clearTimeout(toastTimer);
    msgEl.textContent = msg;
    toast.className = `fixed bottom-4 right-4 z-50 max-w-xs rounded-xl border px-4 py-3 shadow-lg text-sm font-medium ${
      ok ? "border-emerald-500/30 bg-card text-emerald-500" : "border-destructive/30 bg-card text-destructive"
    }`;
    toastTimer = setTimeout(() => toast.classList.add("hidden"), TOAST_LEGACY_MS);
  }

  // Persistent toast with a spinner for background ops (no auto-hide).
  // Returns a closer that hides it; a later showToast() also replaces it.
  export function showLoadingToast(msg: string): () => void {
    const toast = document.getElementById("toast");
    const msgEl = document.getElementById("toast-msg");
    if (!toast || !msgEl) return () => {};
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    msgEl.innerHTML = `<span class="inline-flex items-center gap-2"><i class="ti ti-loader-2 animate-spin"></i>${escapeHtml(msg)}</span>`;
    toast.className = "fixed bottom-4 right-4 z-50 max-w-xs rounded-xl border px-4 py-3 shadow-lg text-sm font-medium border-border bg-card text-foreground";
    return () => { toast.classList.add("hidden"); msgEl.textContent = ""; };
  }

  export function setStatus(msg: string) {
    const el = document.getElementById("status-bar");
    if (el) el.textContent = msg;
  }

  export function setRouteLoading(loading: boolean) {
    const el = document.getElementById("files-route-loading");
    if (!el) return;
    el.classList.toggle("hidden", !loading);
    el.classList.toggle("flex", loading);
  }
