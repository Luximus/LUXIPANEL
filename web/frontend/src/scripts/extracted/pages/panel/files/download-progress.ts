// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { DownloadProgress } from "./download";

const ID = "files-download-progress";
const STYLE_ID = `${ID}-style`;
const CSS = `
.lxp-file-download{flex:none;min-width:0;margin:12px 16px;padding:14px 16px;border:1px solid var(--border,#e1e7ef);border-left:3px solid var(--primary,#151c2c);border-radius:10px;background:var(--card,#fff);color:var(--foreground,#171d2c);font:inherit;box-sizing:border-box}
.lxp-file-download-row{display:flex;align-items:center;gap:12px;min-width:0}
.lxp-file-download-icon{flex:none;color:var(--primary,#151c2c)}
.lxp-file-download-file{flex:1;min-width:0}
.lxp-file-download-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;line-height:1.5}
.lxp-file-download-state{display:block;overflow-wrap:anywhere;font-size:11px;line-height:1.6;color:var(--muted-foreground,#64748b)}
.lxp-file-download-percent{flex:none;font-size:20px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.04em}
.lxp-file-download-action{flex:none;border:1px solid var(--border,#e1e7ef);border-radius:6px;padding:6px 10px;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer}
.lxp-file-download-action:hover{background:var(--muted,#f1f5f9)}
.lxp-file-download-action:focus-visible{outline:2px solid var(--primary,#151c2c);outline-offset:3px}
.lxp-file-download-track{height:7px;margin-top:12px;border-radius:99px;background:var(--muted,#f1f5f9);overflow:hidden}
.lxp-file-download-fill{width:0;height:100%;border-radius:inherit;background:var(--primary,#151c2c);transition:width .18s ease-out}
.lxp-file-download[data-indeterminate=true] .lxp-file-download-fill{width:35%;animation:lxp-download-indeterminate 1.5s ease-in-out infinite}
.lxp-file-download-meta{display:flex;justify-content:space-between;gap:12px;margin-top:6px;color:var(--muted-foreground,#64748b);font-size:11px;line-height:1.5;font-variant-numeric:tabular-nums}
.lxp-file-download[data-phase=error]{border-left-color:var(--destructive,#dc2626)}
.lxp-file-download[data-phase=error] .lxp-file-download-fill{background:var(--destructive,#dc2626)}
.lxp-file-download[data-phase=error] .lxp-file-download-state{color:var(--destructive,#dc2626)}
.lxp-file-download[data-phase=cancelled]{opacity:.75}
.lxp-file-download-floating{position:fixed;bottom:20px;right:20px;z-index:70;width:min(440px,calc(100vw - 32px));margin:0;box-shadow:0 8px 28px #0002}
@keyframes lxp-download-indeterminate{from{transform:translateX(-110%)}to{transform:translateX(290%)}}
@media(max-width:480px){.lxp-file-download{margin:10px;padding:12px}.lxp-file-download-row{gap:9px}.lxp-file-download-percent{font-size:18px}.lxp-file-download-icon{display:none}.lxp-file-download-floating{bottom:12px;right:12px;margin:0;width:calc(100vw - 24px)}}
@media(prefers-reduced-motion:reduce){.lxp-file-download-fill{transition:none}.lxp-file-download[data-indeterminate=true] .lxp-file-download-fill{animation:none}}
`;

function bytes(value: number): string {
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function showDownloadProgress(options: {
  name: string;
  downloading: string;
  retrying: string;
  cancelled: string;
  cancelLabel: string;
  closeLabel: string;
  onCancel: () => void;
}) {
  document.getElementById(ID)?.remove();
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
  }
  const panel = document.createElement("section");
  panel.id = ID;
  panel.className = "lxp-file-download";
  panel.setAttribute("aria-label", options.name);
  panel.setAttribute("aria-busy", "true");
  panel.dataset.phase = "running";
  panel.dataset.indeterminate = "true";
  // File names and translated messages are assigned as text, never HTML.
  panel.innerHTML = `<div class="lxp-file-download-row"><svg class="lxp-file-download-icon" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></svg><div class="lxp-file-download-file"><strong class="lxp-file-download-name"></strong><span class="lxp-file-download-state" role="status" aria-live="polite"></span></div><strong class="lxp-file-download-percent" aria-hidden="true">…</strong><button class="lxp-file-download-action" type="button"></button></div><div class="lxp-file-download-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div class="lxp-file-download-fill"></div></div><div class="lxp-file-download-meta"><span data-bytes>0 B</span><span data-rate></span></div>`;
  const name = panel.querySelector<HTMLElement>(".lxp-file-download-name")!;
  const state = panel.querySelector<HTMLElement>(".lxp-file-download-state")!;
  const percent = panel.querySelector<HTMLElement>(".lxp-file-download-percent")!;
  const track = panel.querySelector<HTMLElement>(".lxp-file-download-track")!;
  const fill = panel.querySelector<HTMLElement>(".lxp-file-download-fill")!;
  const action = panel.querySelector<HTMLButtonElement>("button")!;
  const count = panel.querySelector<HTMLElement>("[data-bytes]")!;
  const rate = panel.querySelector<HTMLElement>("[data-rate]")!;
  name.textContent = options.name;
  name.title = options.name;
  track.setAttribute("aria-label", options.name);
  state.textContent = options.downloading;
  action.textContent = options.cancelLabel;
  const host = document.getElementById("files-browser");
  const anchor = document.getElementById("bulk-bar");
  if (host && anchor?.parentElement === host) host.insertBefore(panel, anchor);
  else if (host) host.prepend(panel);
  else { panel.classList.add("lxp-file-download-floating"); document.body.append(panel); }
  const started = Date.now();
  let active = true;
  function finish(message: string, success: boolean, phase = success ? "complete" : "error") {
    active = false;
    panel.dataset.phase = phase;
    panel.dataset.indeterminate = "false";
    panel.setAttribute("aria-busy", "false");
    state.textContent = message;
    action.textContent = options.closeLabel;
    if (success) { fill.style.width = "100%"; percent.textContent = "100%"; track.setAttribute("aria-valuenow", "100"); }
  }
  action.addEventListener("click", () => {
    if (!active) { panel.remove(); return; }
    finish(options.cancelled, false, "cancelled");
    options.onCancel();
  });
  return {
    update({ received, total }: DownloadProgress) {
      if (!active || !panel.isConnected) return;
      panel.dataset.phase = "running";
      state.textContent = options.downloading;
      const known = total !== null && total > 0;
      panel.dataset.indeterminate = String(!known);
      const value = known ? Math.min(100, Math.max(0, Math.floor(received / total * 100))) : null;
      percent.textContent = value === null ? "…" : `${value}%`;
      if (value === null) track.removeAttribute("aria-valuenow");
      else { track.setAttribute("aria-valuenow", String(value)); fill.style.width = `${value}%`; }
      count.textContent = known ? `${bytes(received)} / ${bytes(total)}` : bytes(received);
      track.setAttribute("aria-valuetext", count.textContent);
      const seconds = (Date.now() - started) / 1000;
      rate.textContent = seconds >= .5 && received > 0 ? `${bytes(received / seconds)}/s` : "";
    },
    retry() { if (active) { panel.dataset.phase = "retrying"; state.textContent = options.retrying; } },
    finish,
    remove() { active = false; panel.remove(); },
  };
}
