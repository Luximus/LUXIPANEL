// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { mountModuleAiFooter } from "@/lib/module-ai-footer";

declare global {
  interface Window { __lxpModuleAiFooterInstalled?: boolean; }
}

if (!window.__lxpModuleAiFooterInstalled) {
  window.__lxpModuleAiFooterInstalled = true;
  let nativeFooter: HTMLElement | null = null;
  let nativeCleanup: (() => void) | null = null;
  let quickDrawer: HTMLElement | null = null;
  let quickObserver: MutationObserver | null = null;
  let quickDocument: Document | null = null;
  let quickCleanup: (() => void) | null = null;

  const syncNative = () => {
    const footer = document.getElementById("lxp-native-module-footer");
    if (footer === nativeFooter) return;
    nativeCleanup?.();
    nativeFooter = footer;
    nativeCleanup = footer ? mountModuleAiFooter(footer, document) : null;
  };

  const syncQuick = () => {
    const drawer = document.getElementById("workspace-quick-drawer");
    const footer = document.getElementById("workspace-quick-footer");
    const iframe = document.getElementById("workspace-quick-frame") as HTMLIFrameElement | null;
    let source: Document | null = null;
    try {
      if (drawer?.dataset.open === "true" && iframe?.contentDocument?.body && iframe.contentDocument.URL !== "about:blank") {
        source = iframe.contentDocument;
      }
    } catch { /* A cross-origin module cannot expose its form. */ }
    if (source === quickDocument) return;
    quickCleanup?.();
    quickDocument = source;
    quickCleanup = source && footer ? mountModuleAiFooter(footer, source) : null;
  };

  const syncShell = () => {
    syncNative();
    const drawer = document.getElementById("workspace-quick-drawer");
    if (drawer !== quickDrawer) {
      quickObserver?.disconnect();
      quickCleanup?.();
      quickCleanup = null;
      quickDocument = null;
      quickDrawer = drawer;
      if (drawer) {
        quickObserver = new MutationObserver(syncQuick);
        quickObserver.observe(drawer, { attributes: true, attributeFilter: ["data-open"] });
      }
    }
    syncQuick();
  };

  document.addEventListener("load", (event) => {
    if ((event.target as HTMLElement | null)?.id === "workspace-quick-frame") syncQuick();
  }, true);
  document.addEventListener("astro:page-load", syncShell);
  document.addEventListener("astro:after-swap", syncShell);
  syncShell();
}
