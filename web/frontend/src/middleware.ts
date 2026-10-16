import { isEmbeddedClientUA } from "@/lib/embedded-source";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Astro middleware - auth guards for SSR routes.
 *
 * Protected routes: /panel/*
 * Public routes: /login, /api/*  (backend handles its own auth)
 */

import { defineMiddleware, sequence } from "astro:middleware";
import { getSession } from "@/lib/auth";
import { getUiBootstrap } from "@/lib/ui-bootstrap";
import { seedLayoutContext } from "@/lib/layout-context";
const authenticatedRequest = Symbol("authenticated-request");
import { NO_CACHE_HEADER } from "@/lib/http-cache";
import { localeCookieName, parseLocale } from "@/i18n/config";

const PUBLIC_PATHS = ["/passkey-enroll", "/login", "/enter", "/favicon.svg"];
const API_PREFIX = "/api/";
const STATIC_ASSET_PREFIXES = ["/@", "/src/"];
const STATIC_ASSET_EXTENSIONS = /\.(css|js|mjs|map|json|ico|png|jpe?g|webp|svg|gif|woff2?|ttf|eot|txt|xml|webmanifest)$/i;
const ROOT_STATIC_ALIAS_PATHS = new Set([
  "/favicon.ico",
  "/logo_50.webp",
  "/logo_150.webp",
  "/logo_300.webp",
  "/manifest.webmanifest",
]);
const I18N_MANIFEST_PATH = "/i18n/manifest.json";
const NO_CACHE_EXACT_PATHS = new Set(["/sw.js", "/manifest.webmanifest"]);
const DISABLE_HTTP_CACHE = parseBool(process.env.DISABLE_HTTP_CACHE, true);
const PANEL_PATH_FALLBACK_PREFIXES = [
  "/assistant",
  "/backups",
  "/chat",
  "/cloudflare",
  "/codebase-graph",
  "/cron",
  "/databases",
  "/expo",
  "/nginx",
  "/docs",
  "/files",
  "/firewall",
  "/bitninja",
  "/hosting",
  "/mail",
  "/module-dev",
  "/project-map",
  "/modules",
  "/monitor",
  "/obsidian",
  "/openclaw",
  "/preferences",
  "/repository-store",
  "/server-alerts",
  "/servers",
  "/settings",
  "/terminal",
  "/users",
  "/webhooks",
];

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return !["false", "0", "no", "off"].includes(value.trim().toLowerCase());
}

function shouldDisableCache(pathname: string): boolean {
  if (!DISABLE_HTTP_CACHE) return false;
  if (pathname.startsWith("/scripts/extracted/")) return true;
  if (NO_CACHE_EXACT_PATHS.has(pathname)) return true;
  if (pathname.startsWith(API_PREFIX)) return true;

  const isStaticAsset =
    STATIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    STATIC_ASSET_EXTENSIONS.test(pathname);

  return !isStaticAsset && !pathname.startsWith("/_");
}

function applyNoCacheHeaders(response: Response): Response {
  if (!DISABLE_HTTP_CACHE) return response;
  response.headers.set("Cache-Control", NO_CACHE_HEADER);
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  applySecurityHeaders(response);
  return response;
}

// CSP + clickjacking headers.
// NOTA: `default-src 'self'` a secas (sin `script-src`) bloqueaba TODOS los
// scripts inline que Astro inyecta (view-transitions/`astro:transitions/client`,
// `define:vars`, event handlers, hidratación de islas) y los CDNs reales del
// panel → el panel no cargaba. Se añade `script-src` con `'unsafe-inline'` (Astro
// depende de inline; el endurecimiento por nonce/hash es tarea futura) + la
// allowlist de los orígenes que el panel usa de verdad: hCaptcha (login), xterm
// (terminal, jsdelivr) y la analítica (gtag / Cloudflare Insights).
const HCAPTCHA_SRC = "https://js.hcaptcha.com https://*.hcaptcha.com";
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://static.cloudflareinsights.com ${HCAPTCHA_SRC}`,
    `script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://static.cloudflareinsights.com ${HCAPTCHA_SRC}`,
    // Astro inyecta estilos runtime (theme/CSS-vars) inline; xterm sirve su CSS desde jsdelivr.
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    // `blob:` es imprescindible: el visor de Files descarga la imagen con los
    // headers de scope (fetch → blob → URL.createObjectURL) y la pinta como
    // `<img src="blob:…">`. Sin `blob:` aquí el navegador bloquea la imagen y el
    // modal abre en blanco (la descarga por `<a href>` no la afecta img-src).
    "img-src 'self' data: https: blob:",
    // Vídeo/audio del mismo visor también se reproducen desde object URLs; sin
    // `media-src` caían a default-src 'self' y quedaban bloqueados.
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src 'self' wss://api.luxisoft.com https://api.luxisoft.com https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com https://cloudflareinsights.com https://api.hcaptcha.com ${HCAPTCHA_SRC}`,
    // Project previews are explicit HTTPS URLs saved on an authorized AI project.
    // The browser still enforces each preview site's frame-ancestors/XFO policy.
    `frame-src 'self' https: ${HCAPTCHA_SRC} https://newassets.hcaptcha.com`,
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  // `microphone=(self)`: /panel/chat monta el SDK de Tolqia (audiollamadas con
  // traducción), que necesita getUserMedia. Solo mismo origen — ni geolocation
  // ni cámara, y ningún tercero.
  "Permissions-Policy": "geolocation=(), microphone=(self), camera=()",
};

function applySecurityHeaders(response: Response): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
}

function finalize(pathname: string, response: Response, noCache: boolean): Response {
  const r = noCache ? applyNoCacheHeaders(response) : applyStaticCacheHeaders(pathname, response);
  applySecurityHeaders(r);
  return r;
}

function applyStaticCacheHeaders(pathname: string, response: Response): Response {
  if (pathname === I18N_MANIFEST_PATH) {
    response.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return response;
  }

  if (pathname.startsWith("/i18n/") && pathname.endsWith(".json")) {
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return response;
  }

  return response;
}

function viewIdFromPath(pathname: string): string | null {
  const cleanPath = normalizePanelPublicPath(pathname);
  if (cleanPath === "/") return "panel.dashboard";
  if (!cleanPath.startsWith("/")) return null;

  const first = cleanPath.slice(1).split("/")[0]?.toLowerCase() ?? "";
  if (!first) return "panel.dashboard";

  // Dynamic modules use a distinct permission path; these view IDs are
  // intentionally not in backend VIEW_IDS (see role-permissions.service.ts).
  const map: Record<string, string> = {
    mail: "panel.mail",
    monitor: "panel.monitor",
    files: "panel.files",
    firewall: "panel.firewall",
    bitninja: "panel.bitninja",
    assistant: "panel.assistant",
    dns: "panel.dns",
    nginx: "panel.dns",
    backups: "panel.backups",
    cron: "panel.cron",
    databases: "panel.databases",
    expo: "panel.expo",
    cloudflare: "panel.cloudflare",
    obsidian: "panel.obsidian",
    webhooks: "panel.webhooks",
    users: "panel.users",
    modules: "panel.modules",
    settings: "panel.settings",
    preferences: "panel.preferences",
    hosting: "panel.hosting",
    openclaw: "panel.openclaw",
    "repository-store": "panel.repository-store",
    "module-dev": "panel.module-dev",
    "project-map": "panel.module-dev",
    "server-alerts": "panel.server-alerts",
    "codebase-graph": "panel.codebase-graph",
    servers: "panel.server-switcher",
    terminal: "terminal.view",
  };

  return map[first] ?? null;
}

function panelPathFromViewId(viewId: string): string | null {
  const map: Record<string, string> = {
    "panel.dashboard": "/",
    "panel.mail": "/mail",
    "panel.monitor": "/monitor",
    "panel.files": "/files",
    "panel.firewall": "/firewall",
    "panel.bitninja": "/bitninja",
    "panel.assistant": "/assistant",
    "panel.dns": "/nginx",
    "panel.backups": "/backups",
    "panel.cron": "/cron",
    "panel.databases": "/databases",
    "panel.expo": "/expo",
    "panel.cloudflare": "/cloudflare",
    "panel.obsidian": "/obsidian",
    "panel.webhooks": "/webhooks",
    "panel.users": "/users",
    "panel.modules": "/modules",
    "panel.settings": "/settings",
    "panel.preferences": "/preferences",
    "panel.hosting": "/hosting",
    "panel.openclaw": "/openclaw",
    "panel.repository-store": "/repository-store",
    "panel.module-dev": "/module-dev",
  };
  return map[viewId] ?? null;
}

function firstAllowedPanelPath(views: string[]): string | null {
  if (views.includes("*")) return "/";
  for (const view of views) {
    const path = panelPathFromViewId(view);
    if (path) return path;
  }
  return null;
}

function normalizePanelPublicPath(pathname: string): string {
  if (pathname === "/panel" || pathname === "/panel/") return "/";
  if (pathname.startsWith("/panel/")) {
    const clean = pathname.slice("/panel".length);
    return clean.startsWith("/") ? clean : `/${clean}`;
  }
  return pathname;
}

function isPanelPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PANEL_PATH_FALLBACK_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const authMiddleware = defineMiddleware(async (context, next) => {
  const requestUrl = new URL(context.request.url);
  const { pathname } = requestUrl;
  const noCache = shouldDisableCache(pathname);
  const isCacheBustedAsset = pathname.startsWith("/scripts/extracted/") || NO_CACHE_EXACT_PATHS.has(pathname);

  // Some edge/proxy paths only expose panel assets under /panel/*.
  // Keep root asset URLs backwards-compatible by internally rewriting them.
  if (ROOT_STATIC_ALIAS_PATHS.has(pathname)) {
    return context.rewrite(`/panel${pathname}${context.url.search}`);
  }

  // i18n assets must be matched BEFORE the generic static-asset early-return
  // below: they end in `.json` (a static extension) and would otherwise skip
  // the long-lived `immutable` header. The version-hashed namespace files are
  // content-addressed → safe to cache forever; the manifest stays short-lived
  // (handled inside applyStaticCacheHeaders) so a new deploy is picked up.
  if (pathname.startsWith("/i18n/")) {
    const response = await next();
    return applyStaticCacheHeaders(pathname, response);
  }

  if (
    !isCacheBustedAsset &&
    (STATIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      STATIC_ASSET_EXTENSIONS.test(pathname))
  ) {
    return next();
  }

  // Astro internals keep their normal cache behavior.
  if (pathname.startsWith("/_")) {
    return next();
  }

  if (pathname.startsWith(API_PREFIX)) {
    const response = await next();
    return applyNoCacheHeaders(response);
  }

  const requestedLocale = parseLocale(requestUrl.searchParams.get("lang"));
  if (requestedLocale && context.cookies.get(localeCookieName)?.value !== requestedLocale) {
    context.cookies.set(localeCookieName, requestedLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
    });
  }

  // Self-hosted: no LP-LICENSE-SERVER subdomain-entry resolution. Every host
  // falls straight through to the normal auth flow.

  // Some reverse-proxy / edge setups expose the panel under /panel/*
  // while forwarding public endpoints with that same prefix.
  // Normalize these paths internally so local routes still resolve.
  if (pathname === "/panel/login") {
    return applyNoCacheHeaders(context.redirect(`/login${context.url.search}`));
  }
  if (pathname === "/panel/api" || pathname.startsWith("/panel/api/")) {
    const rewrittenPath = pathname.replace(/^\/panel/, "");
    const response = await context.rewrite(`${rewrittenPath}${context.url.search}`);
    return finalize(pathname, response, noCache);
  }
  const isInternalRewrite = requestUrl.searchParams.has("__lxp_internal__");
  if ((pathname === "/panel" || pathname === "/panel/") && !isInternalRewrite) {
    return applyNoCacheHeaders(context.redirect(`/${context.url.search}`));
  }
  if (
    pathname.startsWith("/panel/") &&
    !pathname.startsWith("/panel/scripts/") &&
    !pathname.startsWith("/panel/_") &&
    !STATIC_ASSET_EXTENSIONS.test(pathname) &&
    !isInternalRewrite
  ) {
    const cleanPath = pathname.slice("/panel".length);
    return applyNoCacheHeaders(context.redirect(`${cleanPath}${context.url.search}`));
  }

  // Allow public paths.
  if (PUBLIC_PATHS.includes(pathname)) {
    const response = await next();
    return finalize(pathname, response, noCache);
  }

  const panelPublicPath = normalizePanelPublicPath(pathname);
  if (!isPanelPublicPath(panelPublicPath)) {
    const response = await next();
    return finalize(pathname, response, noCache);
  }

  const trusted = (context.locals as unknown as Record<symbol,unknown>)[authenticatedRequest];
  const bootstrap = trusted ? context.locals.uiBootstrap : await getUiBootstrap(context.request);
  const user = trusted ? context.locals.user : bootstrap?.user ?? await getSession(context.request);
  if (bootstrap) context.locals.uiBootstrap = bootstrap;
  if (!user) {
    return applyNoCacheHeaders(context.redirect("/login"));
  }

  if (user.github?.required && !user.github.connected) {
    return applyNoCacheHeaders(context.redirect("/connect-github"));
  }

  const requiredView = viewIdFromPath(panelPublicPath);
  if (requiredView && user.kind !== "admin") {
    const allowedViews = requiredView === "terminal.view"
      ? user.permissions?.actions ?? [] : user.permissions?.views ?? [];
    if (!allowedViews.includes(requiredView) && !allowedViews.includes("*")
      && !(requiredView === "terminal.view" && allowedViews.includes("terminal.*"))) {
      const fallbackPath = firstAllowedPanelPath(allowedViews);
      if (fallbackPath && fallbackPath !== panelPublicPath) {
        return applyNoCacheHeaders(context.redirect(fallbackPath));
      }
      return applyNoCacheHeaders(new Response("Forbidden", { status: 403 }));
    }
  }

  context.locals.user = user;
  (context.locals as unknown as Record<symbol,unknown>)[authenticatedRequest] = true;
  if (isInternalRewrite) {
    // The `__lxp_internal__` query param is panel-internal: strip it from the
    // rewritten URL so downstream handlers never see it. Auth still ran above.
    const sanitized = new URL(context.request.url);
    sanitized.searchParams.delete("__lxp_internal__");
    context.request = new Request(sanitized.toString(), context.request);
    if (bootstrap) seedLayoutContext(context.request, bootstrap.layout, bootstrap.targetId);
    const response = await next();
    return finalize(pathname, response, noCache);
  }
  const internalPath = panelPublicPath === "/" ? "/panel" : `/panel${panelPublicPath}`;
  // SECURITY: do NOT propagate a client-supplied `__lxp_internal__` — the
  // server sets its own value when it performs the internal rewrite below.
  const sanitizedSearch = new URLSearchParams(context.url.search);
  sanitizedSearch.delete("__lxp_internal__");
  sanitizedSearch.append("__lxp_internal__", "1");
  const internalSearch = `?${sanitizedSearch.toString()}`;
  const headers = new Headers(context.request.headers);
  const language = parseLocale(bootstrap?.preferences.language ?? null);
  if (language && !context.url.searchParams.has("lang") && !isEmbeddedClientUA(headers.get("user-agent"))) {
    const cookies = (headers.get("cookie") ?? "").split(";").filter(value => value.trim().split("=")[0] !== localeCookieName);
    cookies.push(`${localeCookieName}=${encodeURIComponent(language)}`);
    headers.set("cookie", cookies.join("; "));
    context.cookies.set(localeCookieName, language, {path:"/",sameSite:"lax",maxAge:31536000,httpOnly:false});
  }
  const rewriteRequest = new Request(new URL(`${internalPath}${internalSearch}`, context.url), {headers,method:"GET"});
  const response = await context.rewrite(rewriteRequest);
  return finalize(pathname, response, noCache);
});

// SSR errors reach the panel diagnostics importer through the frontend process log.
const diagnosticsMiddleware = defineMiddleware(async (context, next) => {
  try {
    const response = await next();
    if (response.status >= 500 && !context.url.pathname.startsWith("/api/telemetry/")) {
      console.error(JSON.stringify({ level: 50, time: Date.now(), module: context.url.pathname.split("/").filter(Boolean)[1] || "ssr", msg: `SSR ${context.url.pathname} → ${response.status}`, status: response.status }));
    }
    return response;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(JSON.stringify({ level: 50, time: Date.now(), module: "ssr", msg: err.message, err: { message: err.message, stack: err.stack } }));
    throw error;
  }
});
export const onRequest = sequence(diagnosticsMiddleware, authMiddleware);
