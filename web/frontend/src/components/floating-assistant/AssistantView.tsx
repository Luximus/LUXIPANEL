// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useRef, useState } from "react";
import { navigate } from "astro:transitions/client";
import { INTERNAL_ROUTE_CHANGED_EVENT, pathIsAgentMarket } from "@/lib/panel-routes";
import AssistantPanel, { type AssistantInitialOpen, type AssistantTab } from "./AssistantPanel";

function routeTab(): AssistantTab {
  return typeof window !== "undefined" && pathIsAgentMarket(window.location.pathname) ? "market" : "chat";
}

/** Dedicated assistant page. The chat stays mounted in the workspace shell. */
export default function AssistantView({ locale, initialOpen }: { locale: string; initialOpen?: AssistantInitialOpen | null }) {
  const [routeRequest, setRouteRequest] = useState(() => ({ tab: routeTab(), nonce: 0 }));
  const pendingNavigation = useRef<{ href: string } | null>(null);

  useEffect(() => {
    // The layout persists this island across Astro swaps: new SSR props alone
    // do not select the route. Also handle browser history and internal modules.
    const syncRoute = () => {
      setRouteRequest(previous => ({ tab: routeTab(), nonce: previous.nonce + 1 }));
    };
    document.addEventListener("astro:page-load", syncRoute);
    window.addEventListener("popstate", syncRoute);
    window.addEventListener(INTERNAL_ROUTE_CHANGED_EVENT, syncRoute);
    syncRoute();
    return () => {
      document.removeEventListener("astro:page-load", syncRoute);
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener(INTERNAL_ROUTE_CHANGED_EVENT, syncRoute);
    };
  }, []);

  const onNavigateTab = useCallback((tab: AssistantTab) => {
    // The drawer keeps its local navigation. Only this persistent view owns
    // route changes; opening a normal chat elsewhere must not close its module.
    if (tab !== "market" && tab !== "chat") return;
    if (tab === "chat" && !pathIsAgentMarket(window.location.pathname) && pendingNavigation.current?.href !== "/assistant/market") return;
    const href = tab === "market" ? "/assistant/market" : "/";
    if (pendingNavigation.current?.href === href || (pendingNavigation.current === null && routeTab() === tab)) return;
    const navigation = { href };
    pendingNavigation.current = navigation;
    const clearPending = () => { if (pendingNavigation.current === navigation) pendingNavigation.current = null; };
    void navigate(href).then(clearPending, () => {
      if (pendingNavigation.current !== navigation) return;
      clearPending();
      setRouteRequest(previous => ({ tab: routeTab(), nonce: previous.nonce + 1 }));
    });
  }, []);

  return <div className="lxp-project-preview-layout">
    <div className="lxp-project-preview-chat">
      <AssistantPanel locale={locale} variant="view" initialOpen={initialOpen ?? null}
        requestedTab={routeRequest.tab} requestNonce={routeRequest.nonce} onNavigateTab={onNavigateTab} />
    </div>
  </div>;
}
