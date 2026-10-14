// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared formatting helpers used across the assistant UI.
 *
 * These were duplicated in 4-5 files (ChatPane.tsx, DashboardTab.tsx,
 * TeamTaskBoard.tsx, CliUsageBars.tsx) with cosmetic differences that surfaced
 * in the audit. We centralize the most-used variants here so the call sites
 * can simply import + drop the local copy.
 *
 * All helpers are pure (no DOM access, no i18n) so they're safe to import from
 * both client and SSR and from any extracted script.
 */

/** Human-friendly elapsed/duration: "820 ms", "3.4 s", "1 m 12 s". */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(secs < 10 ? 1 : 0)} s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m} m ${String(s).padStart(2, "0")} s`;
}

/**
 * Accept either a number of seconds OR milliseconds (negative or absurd values
 * are normalized to 0). Mirrors `formatDuration` semantics; included so call
 * sites that store their timer in seconds don't need to multiply.
 */
export function formatDurationFlexible(secondsOrMs: number): string {
  if (!Number.isFinite(secondsOrMs) || secondsOrMs < 0) return formatDuration(0);
  return formatDuration(secondsOrMs);
}

/**
 * Compact token count: 1234 → "1,234", 12345 → "12.3k". Mirrors the original
 * ChatPane.tsx formatter used by the context-usage bar.
 */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n < 10000) return Math.round(n).toLocaleString();
  return `${(n / 1000).toFixed(n < 100000 ? 1 : 0)}k`;
}

export interface FmtTokensOptions {
  /** Suffix for the "thousands" bucket. `"k"` (default) or `"K"` (stats tab). */
  kilo?: string;
  /** `"auto"` (default: drop the decimal from 10k / 10M up) or a fixed count. */
  decimals?: "auto" | number;
}

/**
 * "1.2k" / "1.5M" — same flavor as the variant in CliUsageBars/TeamTaskBoard
 * for token-callout style where `12,345` is replaced by `12.3k`.
 *
 * `options` exists so the historical per-file copies keep producing the EXACT
 * same string: the team board / stats tab always used one decimal and the stats
 * tab spelled the thousands suffix uppercase.
 */
export function fmtTokens(n: number, options: FmtTokensOptions = {}): string {
  const { kilo = "k", decimals = "auto" } = options;
  if (!Number.isFinite(n)) return "0";
  const digits = (threshold: number) => (decimals === "auto" ? (n >= threshold ? 0 : 1) : decimals);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(digits(10_000_000))}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(digits(10_000))}${kilo}`;
  return String(Math.round(n));
}

export interface FmtDurationOptions {
  /** Text for anything below one second. Defaults to `"<1s"`. */
  lessThanSecond?: string;
}

/**
 * Short duration used in tight callouts: "<1s", "5s", "2m 12s", "1h 5m". Mirrors
 * the TeamTaskBoard / CliUsageBars variant. For the more verbose
 * "820 ms / 3.4 s / 1 m 12 s" form, see `formatDuration`.
 *
 * `lessThanSecond` lets a localized call site swap the sub-second literal
 * without re-implementing the whole ladder.
 */
export function fmtDuration(ms: number, options: FmtDurationOptions = {}): string {
  if (!Number.isFinite(ms) || ms < 1000) return options.lessThanSecond ?? "<1s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Byte units, ordered by power of 1024. */
export const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;
export type ByteUnit = (typeof BYTE_UNITS)[number];

export interface FmtBytesOptions {
  /**
   * How many decimals to print:
   *   - `"auto"` (default) — 0 for plain bytes, 1 below 100 units, 0 above,
   *     always 1 for TB. This is the historical `fmtBytes` behavior.
   *   - `"trim2"` — round to 2 decimals and drop trailing zeros
   *     (`Math.round(v * 100) / 100`), used by the DataTable column totals.
   *   - a number — fixed decimals for every unit above bytes (bytes stay whole).
   */
  decimals?: "auto" | "trim2" | number;
  /** String returned for a zero / negative / non-finite input. `"0 B"` default. */
  zero?: string;
  /** Append `/s` to the unit (throughput readouts). */
  perSecond?: boolean;
  /** Force a unit instead of picking the largest that fits (e.g. always MB). */
  unit?: ByteUnit;
}

function fmtByteValue(v: number, unitIndex: number, decimals: "auto" | "trim2" | number): string {
  if (decimals === "trim2") return String(Math.round(v * 100) / 100);
  if (decimals === "auto") {
    if (unitIndex === 0) return String(Math.round(v));
    if (unitIndex >= BYTE_UNITS.length - 1) return v.toFixed(1);
    return v.toFixed(v >= 100 ? 0 : 1);
  }
  return unitIndex === 0 ? String(Math.round(v)) : v.toFixed(decimals);
}

/**
 * Pretty-print a byte count (base 1024). Single source of truth for the ~12
 * divergent copies the audit found (T-07): the options exist ONLY so each
 * historical call site keeps emitting the exact same string it used to.
 *
 *   fmtBytes(n)                                  → "195 KB"  (canonical)
 *   fmtBytes(n, { decimals: 1 })                 → "195.3 KB" (assistant storage)
 *   fmtBytes(n, { decimals: "trim2" })           → "195.31 KB" (DataTable totals)
 *   fmtBytes(n, { unit: "MB", decimals: 1 })     → "0.2 MB"   (attachment limits)
 *   fmtBytes(n, { perSecond: true })             → "195 KB/s" (monitor charts)
 *   fmtBytes(n, { zero: "—" })                   → "—"        (backups/databases)
 */
export function fmtBytes(n: number, options: FmtBytesOptions = {}): string {
  const { decimals = "auto", zero = "0 B", perSecond = false, unit } = options;
  if (!Number.isFinite(n) || n <= 0) return zero;
  const suffix = perSecond ? "/s" : "";
  let index = unit ? BYTE_UNITS.indexOf(unit) : 0;
  if (!unit) {
    while (index < BYTE_UNITS.length - 1 && n >= 1024 ** (index + 1)) index++;
  }
  return `${fmtByteValue(n / 1024 ** index, index, decimals)} ${BYTE_UNITS[index]}${suffix}`;
}

export interface DateStampOptions {
  /** BCP-47 tag; only the primary subtag is used (`"es-ES"` → `"es"`). */
  locale?: string;
  /** Day rendering for non-today dates. `"numeric"` (default) or `"2-digit"`. */
  day?: "numeric" | "2-digit";
  /** Also print the year when the date is not from the current year. */
  yearWhenDifferent?: boolean;
}

/**
 * "Today → time, otherwise day + month" timestamp (F-19). Empty string for a
 * missing/invalid date. Falls back to a trimmed ISO rendering if the runtime
 * rejects the locale.
 */
export function formatDateStamp(iso: string | null | undefined, options: DateStampOptions = {}): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const { locale, day = "numeric", yearWhenDifferent = false } = options;
  const lang = locale ? locale.split("-")[0] : undefined;
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  try {
    if (sameDay) {
      return new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" }).format(date);
    }
    const sameYear = date.getFullYear() === now.getFullYear();
    return new Intl.DateTimeFormat(lang, {
      day,
      month: "short",
      ...(yearWhenDifferent && !sameYear ? { year: "numeric" as const } : {}),
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return sameDay ? date.toISOString().slice(11, 16) : date.toISOString().slice(0, 16).replace("T", " ");
  }
}

export interface InitialsOptions {
  /** Which word supplies the second letter: `"second"` (default) or `"last"`. */
  from?: "second" | "last";
  /** Returned when the name has no usable word. `"?"` by default. */
  empty?: string;
}

/**
 * Up-to-2-character initials for an avatar (F-21). One word → its first two
 * letters; several words → first letter of the first word plus the first letter
 * of the second (or the last, for the messenger flavor).
 */
export function initialsFrom(name: string | null | undefined, options: InitialsOptions = {}): string {
  const { from = "second", empty = "?" } = options;
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return empty;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const second = from === "last" ? parts[parts.length - 1] : parts[1];
  return (parts[0][0] + second[0]).toUpperCase();
}
