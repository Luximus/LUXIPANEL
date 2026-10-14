// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import {
  DEFAULT_LOCALE,
  localeCookieName,
  localeDir,
  parseLocale,
  type LocaleCode,
} from "./config";
import { getMessages } from "./index";
import type { Messages } from "./types";

type CookieJar = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, opts?: Record<string, unknown>): void;
};

type AstroLike = {
  cookies: CookieJar;
  request: Request;
  url: URL;
};

export type ResolvedLocale = {
  locale: LocaleCode;
  dir: "ltr" | "rtl";
  t: Messages;
};

function cookieLocale(cookieHeader: string | null): LocaleCode | null {
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(";")) {
    const [name, value] = cookie.trim().split("=");
    if (name !== localeCookieName || !value) continue;
    try { return parseLocale(decodeURIComponent(value)); } catch { return null; }
  }
  return null;
}

/** Same resolution order for page content, document language and API UI. */
export function localeFromRequest(request: Request): LocaleCode {
  const query = parseLocale(new URL(request.url).searchParams.get("lang"));
  if (query) return query;
  const saved = cookieLocale(request.headers.get("cookie"));
  if (saved) return saved;
  for (const part of (request.headers.get("accept-language") ?? "").split(",")) {
    const preferred = parseLocale(part);
    if (preferred) return preferred;
  }
  return DEFAULT_LOCALE;
}

// Precedence: ?lang= query → lxp-locale cookie → Accept-Language → default.
export async function resolveLocale(context: AstroLike): Promise<ResolvedLocale> {
  const queryLocale = parseLocale(context.url.searchParams.get("lang"));
  const savedLocale = parseLocale(context.cookies.get(localeCookieName)?.value);
  const locale = localeFromRequest(context.request);

  if (queryLocale && queryLocale !== savedLocale) {
    context.cookies.set(localeCookieName, queryLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
    });
  }

  return { locale, dir: localeDir(locale), t: await getMessages(locale) };
}

// Lightweight variant for spots that only have the raw Cookie header.
export function localeFromCookieHeader(cookieHeader: string | null): LocaleCode {
  return cookieLocale(cookieHeader) ?? DEFAULT_LOCALE;
}
