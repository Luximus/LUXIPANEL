// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Frontmatter helpers shared by every `.astro` page (E-01 + E-11).
 *
 * The underscore prefix keeps Astro from turning this module into a route
 * (`src/pages/_*` is never built), so it can live next to its consumers.
 *
 * E-01 — 39 pages opened with the SAME three lines verbatim:
 *
 *     import { getMessages } from '@/i18n';
 *     import { localeFromCookieHeader as getLocaleFromCookie } from '@/i18n/server';
 *     const locale = getLocaleFromCookie(Astro.request.headers.get("cookie"));
 *     const t = await getMessages(locale, ['<ns>', …]);
 *
 * Only the namespace array ever differed. `getPageMessages(Astro, [...])`
 * collapses it to one line and keeps the locale-resolution policy in one place.
 *
 * E-11 — the access guards were hand-written per page in three shapes. The two
 * canonical ones now live here as `moduleAccessRedirect` / `adminRedirect`; they
 * return a `Response` to `return` (Astro frontmatter cannot early-return from a
 * helper), so the call site reads:
 *
 *     const denied = moduleAccessRedirect(Astro, "openclaw");
 *     if (denied) return denied;
 *
 * NOTE: the underlying primitives (`getMessages`, `localeFromCookieHeader`,
 * `isAdmin`) stay in `@/i18n` and `@/lib/auth` — this module only removes the
 * copy-paste, it does not re-implement them.
 */
import { getMessages, type Messages, type NamespaceName } from "@/i18n";
import { localeFromRequest } from "@/i18n/server";
import { isAdmin, type SessionUser } from "@/lib/auth";

/**
 * Minimal slice of the Astro global these helpers touch. `redirect` is declared
 * with ONLY the path parameter on purpose: Astro types the optional status as a
 * union of literal redirect codes, and under `strictFunctionTypes` a wider
 * `status?: number` would make `Astro` unassignable to this shape.
 */
type AstroPageLike = {
  request: Request;
  redirect: (path: string) => Response;
  locals: { user?: SessionUser | null };
};

/** Resolve the request locale for SSR pages. */
export function getPageLocale(astro: Pick<AstroPageLike, "request">) {
  return localeFromRequest(astro.request);
}

/**
 * Load a page's i18n slice for the request locale. Drop-in for the three-line
 * `locale` + `getMessages` preamble.
 */
export function getPageMessages(
  astro: Pick<AstroPageLike, "request">,
  namespaces: readonly NamespaceName[],
): Promise<Messages> {
  return getMessages(getPageLocale(astro), namespaces);
}

/**
 * Guard for a module-scoped page: admins always pass, everyone else needs the
 * module in their grant list. Returns the redirect to `return`, or `null`.
 */
export function moduleAccessRedirect(astro: AstroPageLike, moduleId: string): Response | null {
  const user = astro.locals.user;
  const userModules = new Set(user?.modules ?? []);
  if (!user || (user.kind !== "admin" && !userModules.has(moduleId))) {
    return astro.redirect("/");
  }
  return null;
}

/** Guard for an admin-only page. Returns the redirect to `return`, or `null`. */
export function adminRedirect(astro: AstroPageLike): Response | null {
  const user = astro.locals.user;
  if (!user || !isAdmin(user)) return astro.redirect("/");
  return null;
}
