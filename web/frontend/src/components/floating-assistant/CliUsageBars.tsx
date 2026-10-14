import { afterPrimaryReady } from "@/lib/startup-state";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { assistantStatsApi, type CliQuota, type UsageSummary } from "./assistant-api";
import { formatAssistantMessage, mergeNamespaces, useAssistantI18n } from "./i18n";
import { fmtTokens } from "@/lib/format";

type CliUsageBarsMessages = {
  sourceReal: string;
  sourceEstimated: string;
  sourceTokens: string;
  cliUsage: string;
  session5h: string;
  week: string;
  sessionHours: string;
  resetSameDay: string;
  resetOtherDay: string;
  unavailable: string;
  retry: string;
};

// Type-only fallback string shape; actual strings live in the i18n locale files
// (assistant.cliUsageBars.*) and are deep-merged at runtime via mergeNamespaces.
const cliUsageBarsFallback: CliUsageBarsMessages = {
  sourceReal: "",
  sourceEstimated: "",
  sourceTokens: "",
  cliUsage: "",
  session5h: "",
  week: "",
  sessionHours: "",
  resetSameDay: "",
  resetOtherDay: "",
  unavailable: "",
  retry: "",
};

/**
 * Compact usage progress bars shown below the provider tabs while a CLI
 * provider is active.
 *
 * Preferred source = the provider's REAL account quota (Claude's `/usage`:
 * session ≈5h + weekly utilization, with reset times), fetched live from the
 * connected server. When that's unavailable (non-claude provider, box not
 * logged in, fetch failed) we fall back to local token estimates against
 * display budgets — clearly labelled as estimates.
 *
 * Refetches on mount, on provider change, and whenever a chat turn finishes
 * (the `lxp:assistant:usage-updated` window event dispatched by the engine).
 */
export function CliUsageBars({ provider, variant = "compact" }: { provider: string; variant?: "compact" | "rail" }) {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    cliUsageBars?: Partial<CliUsageBarsMessages>;
  };
  const m = mergeNamespaces(cliUsageBarsFallback, i18n.cliUsageBars);
  const [quota, setQuota] = useState<CliQuota | null>(null);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [dailyShare, setDailyShare] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  // True while the FIRST real-quota fetch (with its retry budget) is still in
  // flight and we have no real numbers yet. The real-quota fetch can be slow or
  // momentarily fail (SSH blip, OAuth token refresh, provider rate-limit), and
  // on a miss `reload` immediately sets the local-estimate fallback — which
  // would flash a misleading "0% · 1.7k/10M (estimated tokens)" bar over the
  // real account usage. While `resolving` we show a skeleton instead, so the
  // estimate only surfaces once the retries are genuinely exhausted.
  const [resolving, setResolving] = useState(true);
  // True once the retry budget is exhausted and we have NOTHING to show for
  // this provider — no real quota AND no local estimate either. Drives the
  // warning container + manual retry button instead of rendering blank (the
  // old `return null` silently hid the failure).
  const [failed, setFailed] = useState(false);
  // The provider this bar is CURRENTLY for. A `cliQuota`/`summary` fetch is
  // async, and switching the active CLI provider (claude→minimax→codex) while
  // one is still in flight would otherwise let the older request's `setQuota`
  // land AFTER the new provider already rendered — painting e.g. claude's
  // numbers onto the minimax bar (the "mixing" the user saw). Every fetch
  // re-checks this ref after awaiting and drops its result if we've moved on.
  const activeProviderRef = useRef(provider);
  activeProviderRef.current = provider;
  // Last real account quota we managed to fetch, kept per-provider. The
  // real-quota fetch depends on a live SSH exec to the box (which the shared
  // SSH connection can momentarily refuse when its channels are saturated) and
  // on a non-expired CLI OAuth token — so a `null` is frequently a transient
  // blip, not "no quota". We keep showing the last good numbers across blips
  // instead of flapping back to the local token estimates on every miss.
  const lastQuotaRef = useRef<{ provider: string; quota: CliQuota } | null>(null);

  // Returns true when we ended up showing a REAL account quota (vs. the local
  // estimate fallback). The caller uses this to decide whether to keep retrying.
  const reload = useCallback(async (fresh = false): Promise<boolean> => {
    try {
      const q = await assistantStatsApi.cliQuota(provider, fresh).catch(() => null);
      // Provider switched while this request was in flight → drop the stale
      // result so it can't overwrite the now-active provider's bar. Also reject
      // a payload whose own `provider` field doesn't match what we asked for
      // (defence in depth against a mismatched/cached response).
      if (activeProviderRef.current !== provider) return false;
      if (q && q.provider === provider) {
        lastQuotaRef.current = { provider, quota: q };
        setQuota(q);
        setSummary(null);
        setFailed(false);
        return true;
      }
      // cliQuota came back null. If we've already shown a real quota for this
      // provider, keep it (transient SSH/token blip) rather than downgrading to
      // estimates. Only fall back to estimates when we never had a real quota.
      const prev = lastQuotaRef.current;
      if (prev && prev.provider === provider) {
        setQuota(prev.quota);
        setSummary(null);
        setFailed(false);
        return true;
      }
      // No real quota for this provider — try the local token estimate as a
      // last resort. If even that throws we have genuinely nothing: flag
      // `failed` so the warning + retry container renders instead of a blank.
      try {
        const s = await assistantStatsApi.summary(provider, "cli");
        if (activeProviderRef.current !== provider) return false;
        setQuota(null);
        // No Codex quota and no recorded turns is unknown usage, not 0%.
        const emptyCodex = provider === "codex" && s.session.count === 0 && s.weekly.count === 0;
        setSummary(emptyCodex ? null : s);
        setFailed(emptyCodex);
      } catch {
        if (activeProviderRef.current !== provider) return false;
        setQuota(null);
        setSummary(null);
        setFailed(true);
      }
      return false;
    } catch {
      /* fail-quiet — bars just don't render */
      return false;
    }
  }, [provider]);

  // One refresh at a time. A null quota is a valid unavailable reading, not
  // a reason to launch four more requests while showing the estimate.
  const mountedRef = useRef(false);
  const pendingRef = useRef<{ provider: string; task: Promise<void> } | null>(null);
  const refresh = useCallback((fresh = false): Promise<void> => {
    if (pendingRef.current?.provider === provider) return pendingRef.current.task;
    const task = reload(fresh).then(() => {
      if (mountedRef.current && activeProviderRef.current === provider) setResolving(false);
    }).finally(() => { if (pendingRef.current?.task === task) pendingRef.current = null; });
    pendingRef.current = { provider, task };
    return task;
  }, [reload, provider]);
  const manualRetry = useCallback(() => {
    setFailed(false);
    setResolving(true);
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    mountedRef.current = true;
    setQuota(null);setSummary(null);setFailed(false);setResolving(true);
    const cancelStartup = afterPrimaryReady(() => void refresh(), 2200);
    let update: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = () => {
      if (update) clearTimeout(update);
      update = setTimeout(() => {
        if (document.visibilityState !== "hidden") void refresh(true);
      }, 2500);
    };
    const onVisible = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    window.addEventListener("lxp:assistant:usage-updated", onUpdate);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh();
    }, 60_000);
    return () => {
      mountedRef.current = false;
      cancelStartup();
      if (update) clearTimeout(update);
      clearInterval(timer);
      window.removeEventListener("lxp:assistant:usage-updated", onUpdate);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, provider]);

  // The account API exposes a session and a week, but no daily quota. Show the
  // share of locally recorded CLI usage from today within the last seven UTC
  // calendar days, keeping an unknown reading as "—".
  useEffect(() => {
    if (variant !== "rail") return;
    let cancelled = false;
    const loadDaily = async () => {
      try {
        const rows = await assistantStatsApi.daily({ provider, mode: "cli" });
        if (cancelled || activeProviderRef.current !== provider) return;
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)).toISOString().slice(0, 10);
        const recent = rows.filter((row) => row.day >= firstDay && row.day <= today);
        const weekTotal = recent.reduce((sum, row) => sum + row.total, 0);
        const todayTotal = recent.find((row) => row.day === today)?.total ?? 0;
        setDailyShare(weekTotal > 0 ? clampPct(todayTotal / weekTotal * 100) : null);
      } catch {
        if (!cancelled && activeProviderRef.current === provider) setDailyShare(null);
      }
    };
    setDailyShare(null);
    const cancelStartup = afterPrimaryReady(() => void loadDaily(), 2800);
    let update: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = () => {
      if (update) clearTimeout(update);
      update = setTimeout(() => { if (document.visibilityState !== "hidden") void loadDaily(); }, 2500);
    };
    window.addEventListener("lxp:assistant:usage-updated", onUpdate);
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") void loadDaily(); }, 60_000);
    return () => {
      cancelled = true;
      cancelStartup();
      window.removeEventListener("lxp:assistant:usage-updated", onUpdate);
      window.clearInterval(timer);
      if (update) clearTimeout(update);
    };
  }, [provider, variant]);

  // Initial fetch still in flight with no real numbers yet → skeleton, not the
  // misleading estimate flash. Once a real quota lands (kept across blips via
  // `lastQuotaRef`) `quota` is truthy and we render normally even while a later
  // background refresh is in flight.
  if (variant === "rail") {
    const weekUsed = quota?.sevenDay ? clampPct(quota.sevenDay.utilization)
      : summary?.budgets.weekly ? clampPct(summary.weekly.totalTokens / summary.budgets.weekly * 100) : null;
    const row = (label: string, icon: string, value: number | null, tone: string, hint: string) =>
      <div className={`lxp-server-kpi lxp-server-kpi-${tone}`} title={hint} key={label}>
        <div className="lxp-server-kpi-head">
          <span className="lxp-server-kpi-icon"><i className={`ti ${icon}`} aria-hidden="true" /></span>
          <span>{label}</span>
        </div>
        <span className="lxp-server-kpi-meter" role="meter" aria-label={`Uso CLI ${label.toLowerCase()}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === null ? undefined : Math.round(value)}><span style={{ "--kpi-value": `${value ?? 0}%` } as CSSProperties} /></span>
        <strong className="lxp-server-kpi-value">{value === null ? "—" : `${Math.round(value)}%`}</strong>
      </div>;
    return <div className="lxp-cli-gauges">
      <div className="lxp-cli-gauge-grid">
        {row("Diario", "ti-calendar-time", dailyShare, "teal", `Consumo CLI de hoy como parte de los últimos siete días · ${provider}`)}
        {row("Semanal", "ti-calendar-week", weekUsed, "violet", `${quota?.sevenDay ? "Uso de cuota semanal de la cuenta" : "Estimación de uso semanal"} · ${provider}`)}
      </div>
    </div>;
  }

  if (resolving && !quota) {
    return (
      <div className="shrink-0 border-b border-border bg-muted/10 px-3 py-1.5 space-y-1">
        <div className="flex w-full items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          <i className="ti ti-gauge text-[10px]" aria-hidden></i>
          {m.cliUsage} · {provider}
          <i className="ti ti-loader-2 ml-1 animate-spin text-[10px] opacity-60" aria-hidden></i>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-16 shrink-0 animate-pulse rounded bg-muted-foreground/15" />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-muted-foreground/25" />
          </div>
          <span className="hidden h-2 w-28 shrink-0 animate-pulse rounded bg-muted-foreground/15 sm:inline-block" />
          <span className="h-2 w-10 shrink-0 animate-pulse rounded bg-muted-foreground/15 sm:hidden" />
        </div>
      </div>
    );
  }

  // Retries exhausted with nothing to show (no real quota, no estimate): show
  // an explicit warning + a manual retry button instead of rendering blank, so
  // the user knows the reading failed and can re-trigger it.
  if (failed && !quota && !summary) {
    return (
      <div className="shrink-0 border-b border-border bg-amber-500/10 px-3 py-2 space-y-1.5">
        <div className="flex w-full items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          <i className="ti ti-gauge text-[10px]" aria-hidden></i>
          {m.cliUsage} · {provider}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300">
            <i className="ti ti-alert-triangle text-[12px]" aria-hidden></i>
            {formatAssistantMessage(m.unavailable, { provider })}
          </span>
          <button
            type="button"
            onClick={manualRetry}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:text-amber-200"
          >
            <i className="ti ti-refresh text-[11px]" aria-hidden></i>
            {m.retry}
          </button>
        </div>
      </div>
    );
  }

  const rows = quota ? quotaRows(quota, m) : summary ? estimateRows(summary, m) : null;
  if (!rows) return null;

  const visibleRows = expanded ? rows : rows.slice(0, 1);
  const sourceLabel = quota
    ? m.sourceReal
    : summary?.estimated
      ? m.sourceEstimated
      : m.sourceTokens;

  return (
    <div className="shrink-0 border-b border-border bg-muted/10 px-3 py-1.5 space-y-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70 hover:text-muted-foreground"
        aria-expanded={expanded}
      >
        <i className="ti ti-gauge text-[10px]" aria-hidden></i>
        {m.cliUsage} · {provider}
        <span className="font-normal normal-case opacity-60">({sourceLabel})</span>
        <i
          className={`ti ti-chevron-down ml-auto text-[11px] transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        ></i>
      </button>
      {visibleRows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[10px] text-muted-foreground">{r.label}</span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${accentFor(r.pct ?? 0)} transition-[width] duration-500`}
              style={{ width: `${r.pct ?? 0}%` }}
            />
          </div>
          {/* Móvil: solo %. Escritorio: % + detalle (reinicio o tokens). */}
          <span className="w-10 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground/80 sm:hidden">
            {r.pct === null ? "—" : `${Math.round(r.pct)}%`}
          </span>
          <span className="hidden w-28 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground/80 sm:inline">
            {r.pct === null ? "—" : `${Math.round(r.pct)}%`}{r.detail ? ` · ${r.detail}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

interface BarRow {
  label: string;
  /** 0–100 fill. */
  pct: number | null;
  /** Trailing detail on desktop (reset time, or token tally). */
  detail?: string;
}

/** Account API reports utilization; the topbar shows the percentage left. */
function quotaRows(q: CliQuota, m: CliUsageBarsMessages): BarRow[] {
  const session: BarRow = { label: m.session5h, pct: q.fiveHour ? clampPct(100 - q.fiveHour.utilization) : null, detail: fmtReset(q.fiveHour?.resetsAt ?? null, m) };
  const week: BarRow = { label: m.week, pct: q.sevenDay ? clampPct(100 - q.sevenDay.utilization) : null, detail: fmtReset(q.sevenDay?.resetsAt ?? null, m) };
  // The compact topbar shows one row. Put the reported window first.
  return !q.fiveHour && q.sevenDay ? [week, session] : [session, week];
}

/** Local estimate fallback → tokens remaining against display budgets. */
function estimateRows(s: UsageSummary, m: CliUsageBarsMessages): BarRow[] {
  const row = (label: string, used: number, budget: number): BarRow => ({
    label,
    pct: budget > 0 ? clampPct(100 - (used / budget) * 100) : null,
    detail: budget > 0 ? `${fmtTokens(Math.max(0, budget - used))} / ${fmtTokens(budget)}` : undefined,
  });
  return [
    row(formatAssistantMessage(m.sessionHours, { hours: s.sessionHours }), s.session.totalTokens, s.budgets.session),
    row(m.week, s.weekly.totalTokens, s.budgets.weekly),
  ];
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** More allowance left is healthy; near exhaustion turns amber/red. */
function accentFor(pct: number): string {
  if (pct <= 10) return "bg-red-500";
  if (pct <= 30) return "bg-amber-500";
  return "bg-emerald-500";
}

/** ISO reset → "reinicia 14:50" (today) or "reinicia mar 28, 22:00". */
function fmtReset(iso: string | null, m: CliUsageBarsMessages): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return formatAssistantMessage(m.resetSameDay, { time });
  const day = d.toLocaleDateString([], { weekday: "short", day: "numeric" });
  return formatAssistantMessage(m.resetOtherDay, { day, time });
}
