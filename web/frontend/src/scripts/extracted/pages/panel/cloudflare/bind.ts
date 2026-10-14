// Cloudflare page — static control binding (delegated → survives SPA swaps).
import { state } from "./state";
import type { Tab } from "./state";
import { $ } from "./dom";
import { setTab } from "./tabs";
import { saveToken, testToken, clearToken } from "./config";
import { openDnsDialog, saveDnsRecord, updateDnsPriorityVisibility } from "./dns";
import { purgeAll, purgeUrls } from "./cache";
import { openAccessDialog, saveAccessRule } from "./access";
import { selectZone } from "./zones";
import { changeSetting } from "./settings";

// ── Bind static controls (delegated → survives SPA swaps) ────────────────────
export function bindOnce() {
  if ((window as any).__lxpCfBound) return;
  (window as any).__lxpCfBound = true;

  document.addEventListener("click", (e) => {
    const el = e.target as HTMLElement | null;
    if (!el) return;

    const tabBtn = el.closest<HTMLButtonElement>(".cf-tab");
    if (tabBtn?.dataset.tab) {
      setTab(tabBtn.dataset.tab as Tab);
      return;
    }

    const btn = el.closest<HTMLButtonElement>("button[id]");
    if (!btn) return;
    switch (btn.id) {
      case "cf-go-config":
        if (!document.getElementById("cf-pane-config")) {
          const url = new URL(location.href);
          url.searchParams.set("workspaceView", "config");
          location.assign(url.pathname + url.search);
          break;
        }
        setTab("config");
        break;
      // Config (token)
      case "cf-token-save":
        void saveToken();
        break;
      case "cf-token-test":
        void testToken();
        break;
      case "cf-token-clear":
        void clearToken();
        break;
      // DNS dialog
      case "cf-dns-add":
        openDnsDialog("create");
        break;
      case "cf-dns-use-ip": {
        const input = $("cf-dns-content") as HTMLInputElement | null;
        if (input && state.serverIp) input.value = state.serverIp;
        break;
      }
      case "cf-dns-save":
        void saveDnsRecord();
        break;
      case "cf-dns-cancel":
      case "cf-dns-x":
        ($("dlg-cf-dns") as HTMLDialogElement | null)?.close();
        break;
      // Cache
      case "cf-purge-all":
        void purgeAll();
        break;
      case "cf-purge-urls-btn":
        void purgeUrls();
        break;
      // Access rules dialog
      case "cf-access-add":
        openAccessDialog();
        break;
      case "cf-access-save":
        void saveAccessRule();
        break;
      case "cf-access-cancel":
      case "cf-access-x":
        ($("dlg-cf-access") as HTMLDialogElement | null)?.close();
        break;
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target as HTMLElement | null;
    if (!el?.id) return;
    switch (el.id) {
      case "cf-zone":
        selectZone((el as HTMLSelectElement).value);
        break;
      case "cf-dns-type":
        updateDnsPriorityVisibility();
        break;
      case "cf-ssl-mode":
        void changeSetting("ssl", (el as HTMLSelectElement).value);
        break;
      case "cf-security-level":
        void changeSetting("security_level", (el as HTMLSelectElement).value);
        break;
      case "cf-always-https":
        void changeSetting("always_use_https", (el as HTMLInputElement).checked ? "on" : "off");
        break;
      case "cf-dev-mode":
        void changeSetting("development_mode", (el as HTMLInputElement).checked ? "on" : "off");
        break;
    }
  });
}
