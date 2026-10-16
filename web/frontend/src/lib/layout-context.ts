// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import {
  buildLayoutCss,
  buildLogoMap,
  normalizeLayoutSettings,
  type LayoutSettingsMap,
} from "@/lib/layout-branding";
import { getBackendUrl } from "@/lib/server-env";

export type LayoutRuntimeContext = {
  layoutSettings: LayoutSettingsMap;
  layoutCss: string;
  layoutLogoMap: Record<string, string>;
  themeColorLight: string;
  themeColorDark: string;
};

// Per-request memo: a single page render can call this from several layouts
// (BaseLayout + PanelLayout, both with the same Astro.request). Keying by the
// Request object dedupes the `/api/public/layout` fetch without leaking across
// requests (WeakMap entries are GC'd with the request).
const layoutContextByRequest = new WeakMap<Request, Promise<LayoutRuntimeContext>>();
// Opening a module drawer immediately follows a workspace render. Both need
// the same layout settings, so reuse the result for a short window. Scope by
// cookie, host and endpoint to separate the active server from the login brand.
const SHARED_LAYOUT_TTL_MS = 5_000;
const SHARED_LAYOUT_MAX_ENTRIES = 256;
const layoutContextByVisitor = new Map<string, { expiresAt: number; promise: Promise<LayoutRuntimeContext> }>();

function layoutEndpoint(request: Request): string {
  const pathname = new URL(request.url).pathname;
  const publicPage = ["/login", "/passkey-enroll", "/enter", "/connect-github"].includes(pathname);
  return !publicPage && /(?:^|;\s*)luxipanel_session=/.test(request.headers.get("cookie") ?? "")
    ? "ui/layout" : "public/layout";
}

export function loadLayoutRuntimeContext(request: Request, bootstrap?: {layout:Record<string,string>;targetId:string}): Promise<LayoutRuntimeContext> {
  if (bootstrap) seedLayoutContext(request, bootstrap.layout, bootstrap.targetId);
  const cached = layoutContextByRequest.get(request);
  if (cached) return cached;
  const key = JSON.stringify([
    getBackendUrl(),
    request.headers.get("host") ?? "",
    request.headers.get("x-forwarded-host") ?? "",
    request.headers.get("cookie") ?? "",
    request.headers.get("x-bridge-session-id") ?? "",
    layoutEndpoint(request),
  ]);
  const now = Date.now();
  const shared = layoutContextByVisitor.get(key);
  if (shared && shared.expiresAt > now) {
    layoutContextByRequest.set(request, shared.promise);
    return shared.promise;
  }
  if (shared) layoutContextByVisitor.delete(key);
  const promise = loadLayoutRuntimeContextUncached(request).then(({ context, fetched }) => {
    if (!fetched && layoutContextByVisitor.get(key)?.promise === promise) layoutContextByVisitor.delete(key);
    return context;
  });
  layoutContextByVisitor.set(key, { expiresAt: now + SHARED_LAYOUT_TTL_MS, promise });
  while (layoutContextByVisitor.size > SHARED_LAYOUT_MAX_ENTRIES) {
    layoutContextByVisitor.delete(layoutContextByVisitor.keys().next().value!);
  }
  layoutContextByRequest.set(request, promise);
  return promise;
}

async function loadLayoutRuntimeContextUncached(request: Request): Promise<{ context: LayoutRuntimeContext; fetched: boolean }> {
  const backendUrl = getBackendUrl();
  let layoutSettings = normalizeLayoutSettings(null);
  let fetched = false;

  try {
    const res = await fetch(`${backendUrl}/api/${layoutEndpoint(request)}`, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        host: request.headers.get("host") ?? "",
        "x-forwarded-host": request.headers.get("host") ?? "",
        ...(layoutEndpoint(request) === "ui/layout" && request.headers.get("x-bridge-session-id")
          ? { "X-Bridge-Session-Id": request.headers.get("x-bridge-session-id")! } : {}),
      },
      // Bound the SSR fetch: a hung backend would otherwise pin this render
      // (called from BaseLayout + PanelLayout on every navigation) until the
      // Astro worker is exhausted. On abort we fall through to safe defaults.
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const json = await res.json() as {
        ok?: boolean;
        data?: Record<string, unknown>;
        targetId?: string;
      };
      if (json.ok && json.data) {
        layoutSettings = normalizeLayoutSettings(json.data);
        layoutSettings.__branding_scope = json.targetId ?? "local";
        fetched = true;
      }
    }
  } catch {
    layoutSettings = normalizeLayoutSettings(null);
  }

  return { context: {
    layoutSettings,
    layoutCss: buildLayoutCss(layoutSettings),
    layoutLogoMap: { ...buildLogoMap(layoutSettings), __scope: layoutSettings.__branding_scope ?? "local" },
    themeColorLight: layoutSettings.layout_light_background,
    themeColorDark: layoutSettings.layout_dark_background,
  }, fetched };
}

export function parseLayoutNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseLayoutBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function seedLayoutContext(request: Request, raw: Record<string,string>, targetId: string): void {
 const layoutSettings=normalizeLayoutSettings(raw);
 layoutSettings.__branding_scope=targetId;
 layoutContextByRequest.set(request,Promise.resolve({layoutSettings,layoutCss:buildLayoutCss(layoutSettings),
 layoutLogoMap:{...buildLogoMap(layoutSettings),__scope:targetId},themeColorLight:layoutSettings.layout_light_background,themeColorDark:layoutSettings.layout_dark_background}));
}
