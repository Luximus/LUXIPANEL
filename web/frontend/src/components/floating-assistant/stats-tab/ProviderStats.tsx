import { DATATABLE_EVENTS } from "@/lib/datatable-events";
import { resolveTargetScope } from "@/lib/api-client";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useState, useRef } from "react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableI18n,
  type DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import {
  assistantProjectsApi,
  assistantStatsApi,
  assistantUsersApi,
  assistantChatsApi,
  type AssistantChatOption,
  type AssistantProject,
  type AssistantProviderId,
  type AssistantUserOption,
  type UsageCost,
  type UsageDaily,
  type UsageRecord,
  type UsageSavings,
  type UsageStatsFilter,
} from "../assistant-api";
import { useAssistantI18n } from "../i18n";
import { SearchableSelect } from "../SearchableSelect";
import { Stat } from "./atoms";
import { CostDelta, StatDelta } from "./deltas";
import { HistoryDataTable } from "./HistoryDataTable";
import { UsageChart } from "./charts";
import { fmtUsd, compact, previousPeriodFilter, type UsageChartType } from "./helpers";

export function ProviderStats({
  provider,
  dataTableI18n,
}: {
  provider: AssistantProviderId;
  dataTableI18n?: DataTableI18n | null;
}) {
  const t = useAssistantI18n().statsTab;
  const [models, setModels] = useState<string[]>([]);
  const [projects, setProjects] = useState<AssistantProject[]>([]);
  const [series, setSeries] = useState<UsageDaily[]>([]);
  const [rows, setRows] = useState<UsageRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [historyQuery,setHistoryQuery]=useState<{pageSize:number;model?:string;mode?:"api"|"cli";sortBy?:UsageStatsFilter["sortBy"];sort?:"asc"|"desc"}>(()=>{try{const size=JSON.parse(localStorage.getItem(`lxp:data-table:prefs:assistant-history-${provider}`) ?? "{}").pageSize;return {pageSize:[10,25,50,100].includes(size) ? size : 10};}catch{return {pageSize:10};}});
  const [historyVersion,setHistoryVersion]=useState(0);
  const [targetVersion,setTargetVersion]=useState(0);
  const [historyError,setHistoryError]=useState<string|null>(null);
  const [historyTotals,setHistoryTotals]=useState<{input:number;output:number;total:number}|null>(null);
  const historyGeneration=useRef(0), historyPending=useRef(false), historyRequest=useRef<UsageStatsFilter>({});
  useEffect(()=>{
    const query=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(detail?.tableId!==`assistant-history-${provider}`) return;
      const sort=detail.sortDefinitions?.[0];
      const next: typeof historyQuery={pageSize:detail.pageSize || 10,model:detail.filters?.model || undefined,mode:detail.filters?.mode || undefined,sortBy:sort?.key,sort:sort ? sort.desc ? "desc" : "asc" : undefined};
      setHistoryQuery(previous=>JSON.stringify(previous)===JSON.stringify(next) ? previous : next);
    };
    window.addEventListener(DATATABLE_EVENTS.QUERY,query);
    return ()=>{historyGeneration.current++;window.removeEventListener(DATATABLE_EVENTS.QUERY,query);};
  },[provider]);
  const loadMoreHistory=async(pageSize=historyQuery.pageSize)=>{
    if(historyPending.current || rows.length>=total) return;
    const run=historyGeneration.current, scope=resolveTargetScope();historyPending.current=true;setLoading(true);setHistoryError(null);
    try {
      const page=await assistantStatsApi.usage({...historyRequest.current,offset:rows.length,limit:pageSize*2});
      if(run!==historyGeneration.current || scope!==resolveTargetScope()) return;
      setRows(previous=>[...new Map([...previous,...page.items].map(row=>[row.id ?? `${row.ts}:${row.model}:${row.mode}`,row])).values()]);setTotal(page.total);
    } catch(error) {if(run===historyGeneration.current)setHistoryError(error instanceof Error ? error.message : String(error));}
    finally {if(run===historyGeneration.current){historyPending.current=false;setLoading(false);}}
  };
  const [savings, setSavings] = useState<UsageSavings | null>(null);
  const [cost, setCost] = useState<UsageCost | null>(null);
  // Previous-period aggregates used to render the "from X, ↑Y%" pills on the
  // KPI cards. Null while the prior-period query is in flight.
  const [prevWindow, setPrevWindow] = useState<{ input: number; output: number; total: number; usd: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<UsageChartType>("bar");

  const [model, setModel] = useState("");
  const [from, setFrom] = useState("");
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("desc");

  // Options backing the user + chat comboboxes. Users come from the distinct
  // `userId`s already seen in the usage ledger (provider-scoped). Chats come
  // from the conversation list and re-filter when the project changes so the
  // picker never shows chats that don't belong to the selected project.
  const [userOptions, setUserOptions] = useState<AssistantUserOption[]>([]);
  const [chatOptions, setChatOptions] = useState<AssistantChatOption[]>([]);

  useEffect(() => {
    assistantStatsApi.models().then(setModels).catch(() => undefined);
    assistantProjectsApi.list().then(setProjects).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    assistantUsersApi
      .list(provider)
      .then((opts) => {
        if (cancelled) return;
        setUserOptions(opts);
        // Drop the current user selection if the list no longer contains it
        // (provider changed → distinct userIds may have shrunk).
        if (userId && !opts.some((o) => o.id === userId)) setUserId("");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // userId is read here only to validate; we don't want to refetch on every
    // selection. Re-fetch when the provider changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // Reload the chat list whenever the provider or the project changes. An
  // empty `projectId` means "all projects"; a special "none" sentinel means
  // chats without a project (mirrors the backend route).
  useEffect(() => {
    let cancelled = false;
    const projFilter = projectId === "" ? undefined : projectId === "none" ? null : projectId;
    assistantChatsApi
      .list({ provider, projectId: projFilter })
      .then((opts) => {
        if (cancelled) return;
        setChatOptions(opts);
        if (conversationId && !opts.some((o) => o.id === conversationId)) setConversationId("");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, projectId]);

  const reload = useCallback(async () => {
    const run=++historyGeneration.current, scope=resolveTargetScope();
    setHistoryVersion(previous=>previous+1);
    historyPending.current=true;setLoading(true);setHistoryError(null);
    const f: UsageStatsFilter = {
      provider,
      model: model || undefined,
      from: from || undefined,
      userId: userId || undefined,
      projectId: projectId || undefined,
      conversationId: conversationId || undefined,
      sort,
      limit: historyQuery.pageSize*2,
    };
    historyRequest.current={...f,model:historyQuery.model || f.model,mode:historyQuery.mode,sortBy:historyQuery.sortBy,sort:historyQuery.sort || f.sort};
    // Same filter as the current period except date window: same length ending
    // the day before `from` (or the previous 30 days when no `from` is set).
    const prevF = previousPeriodFilter(from, {
      provider,
      model: model || undefined,
      userId: userId || undefined,
      projectId: projectId || undefined,
      conversationId: conversationId || undefined,
    });
    try {
      const [s, u, sv, co, pu, pc] = await Promise.all([
        assistantStatsApi.daily(f),
        assistantStatsApi.usage(historyRequest.current),
        assistantStatsApi.savings(f),
        assistantStatsApi.cost(f),
        assistantStatsApi.usage({ ...prevF, limit: 1 }),
        assistantStatsApi.cost(prevF),
      ]);
      if(run!==historyGeneration.current || scope!==resolveTargetScope()) return;
      setHistoryTotals(u.totals ?? null);
      setSeries(s);
      setRows(u.items);
      setTotal(u.total);
      setSavings(sv);
      setCost(co);
      const prev = pu.totals ?? pu.items.reduce(
        (acc, r) => {
          acc.input += r.inputTokens;
          acc.output += r.outputTokens;
          acc.total += r.totalTokens;
          return acc;
        },
        { input: 0, output: 0, total: 0 },
      );
      setPrevWindow({ ...prev, usd: pc.totalUsd });
    } catch (error) {
      if(run===historyGeneration.current)setHistoryError(error instanceof Error ? error.message : String(error));
      // Keep previous-period data on transient failure so the pills don't
      // flicker; just clear the loader.
    } finally {
      if(run===historyGeneration.current){historyPending.current=false;setLoading(false);}
    }
  }, [provider, model, from, userId, projectId, conversationId, sort, historyQuery,targetVersion]);

  useEffect(()=>{
    const changed=()=>{historyGeneration.current++;historyPending.current=false;setRows([]);setTotal(0);setHistoryTotals(null);setTargetVersion(previous=>previous+1);};
    window.addEventListener("luxipanel:target-changed",changed);
    return ()=>window.removeEventListener("luxipanel:target-changed",changed);
  },[]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totals = historyTotals ?? rows.reduce(
    (acc, r) => {
      acc.input += r.inputTokens;
      acc.output += r.outputTokens;
      acc.total += r.totalTokens;
      return acc;
    },
    { input: 0, output: 0, total: 0 },
  );

  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-2 text-xs @2xl:grid-cols-3">
        <label className="block">
          <span className="text-muted-foreground">{t.model}</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none">
            <option value="">{t.all}</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground">{t.fromDate}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-muted-foreground">{t.sort}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as "asc" | "desc")} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none">
            <option value="desc">{t.newest}</option>
            <option value="asc">{t.oldest}</option>
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground">{t.project}</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none">
            <option value="">{t.all}</option>
            <option value="none">{t.noProject}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground">{t.userId}</span>
          <SearchableSelect
            value={userId}
            onChange={setUserId}
            options={userOptions.map((u) => ({ id: u.id, label: u.username }))}
            placeholder={t.selectUser}
            searchAriaLabel={t.searchUsers}
            noMatchesLabel={t.noMatches}
            clearLabel={t.clearSelection}
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground">{t.chatId}</span>
          <SearchableSelect
            value={conversationId}
            onChange={setConversationId}
            options={chatOptions.map((c) => ({ id: c.id, label: c.title }))}
            placeholder={t.selectChat}
            searchAriaLabel={t.searchChats}
            noMatchesLabel={t.noMatches}
            clearLabel={t.clearSelection}
            disabled={loading && chatOptions.length === 0}
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatDelta
          label={t.inputTokens}
          current={totals.input}
          prev={prevWindow?.input ?? null}
          t={t}
        />
        <StatDelta
          label={t.outputTokens}
          current={totals.output}
          prev={prevWindow?.output ?? null}
          t={t}
        />
        <StatDelta
          label={t.total}
          current={totals.total}
          prev={prevWindow?.total ?? null}
          highlight
          t={t}
        />
      </div>

      {/* Costo API estimado (estilo ClaudeBar): tokens × precio por modelo → USD */}
      {cost && cost.models.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="mb-2 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">{t.costApiTitle}</p>
              <p className="text-[10px] text-muted-foreground">{t.costApiDescription}</p>
              {prevWindow !== null && prevWindow.usd > 0 && (
                <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                  {(t.deltaFrom ?? "vs {prev}").replace("{prev}", fmtUsd(prevWindow.usd))}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-xl font-bold tabular-nums text-foreground">{fmtUsd(cost.totalUsd)}</p>
              <CostDelta current={cost.totalUsd} prev={prevWindow?.usd ?? null} t={t} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/50 text-left">
                  <th className="py-1 pr-2 font-medium">{t.model}</th>
                  <th className="py-1 px-2 font-medium text-right">{t.in}</th>
                  <th className="py-1 px-2 font-medium text-right">{t.out}</th>
                  <th className="py-1 pl-2 font-medium text-right">{t.usd}</th>
                </tr>
              </thead>
              <tbody>
                {cost.models.map((m) => (
                  <tr key={`${m.provider}|${m.model}|${m.mode}`} className="border-b border-border/30">
                    <td className="py-1 pr-2">
                      <span className="font-medium text-foreground">{m.model}</span>
                      {m.mode === "cli" && <span className="ml-1 rounded bg-muted px-1 text-[9px] text-muted-foreground">cli</span>}
                      {!m.known && <span className="ml-1 text-[9px] text-amber-500" title={t.costApiDefaultRateTooltip}>≈</span>}
                    </td>
                    <td className="py-1 px-2 text-right tabular-nums text-muted-foreground">{compact(m.inputTokens)}</td>
                    <td className="py-1 px-2 text-right tabular-nums text-muted-foreground">{compact(m.outputTokens)}</td>
                    <td className="py-1 pl-2 text-right tabular-nums font-medium text-foreground">{fmtUsd(m.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground/70">
            {t.costApiFootnote}
          </p>
        </div>
      )}

      {savings && savings.savedTokens > 0 && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="mb-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {(t.headroomSavedPct ?? "{pct}% ahorrado con Headroom").replace(
              "{pct}",
              String(Math.round((savings.savedTokens / Math.max(1, savings.rawInput)) * 100)),
            )}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t.headroomRaw} value={savings.rawInput} />
            <Stat label={t.headroomSent} value={savings.sentInput} />
            <Stat label={t.headroomSaved} value={savings.savedTokens} highlight />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium">{t.dailyUsage}</p>
          <div className="inline-flex overflow-hidden rounded-md border border-border text-[11px]">
            <button
              type="button"
              onClick={() => setChartType("bar")}
              className={`inline-flex items-center gap-1 px-2 py-0.5 ${chartType === "bar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
              aria-label={t.chartBar}
              title={t.chartBar}
            >
              <i className="ti ti-chart-bar text-xs" aria-hidden></i>
              <span className="hidden sm:inline">{t.chartBar}</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType("line")}
              className={`inline-flex items-center gap-1 border-l border-border px-2 py-0.5 ${chartType === "line" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
              aria-label={t.chartLine}
              title={t.chartLine}
            >
              <i className="ti ti-chart-line text-xs" aria-hidden></i>
              <span className="hidden sm:inline">{t.chartLine}</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType("heatmap")}
              className={`inline-flex items-center gap-1 border-l border-border px-2 py-0.5 ${chartType === "heatmap" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
              aria-label={t.chartHeatmap}
              title={t.chartHeatmap}
            >
              <i className="ti ti-layout-grid text-xs" aria-hidden></i>
              <span className="hidden sm:inline">{t.chartHeatmap}</span>
            </button>
          </div>
        </div>
        {series.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">{loading ? t.loading : t.noDataForFilters}</p>
        ) : (
          <UsageChart series={series} type={chartType} rangeFrom={from || null} />
        )}
        {chartType === "heatmap" && series.length > 0 && (
          <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
            <span>{t.heatmapLess}</span>
            <div className="flex gap-0.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(244,63,94,0.10)" }} />
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(244,63,94,0.25)" }} />
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(244,63,94,0.45)" }} />
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(244,63,94,0.70)" }} />
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(244,63,94,1)" }} />
            </div>
            <span>{t.heatmapMore}</span>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
          <span className="text-xs font-medium">{t.history} ({total})</span>
          <button type="button" onClick={() => void reload()} className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-accent">
            <i className="ti ti-refresh mr-1" aria-hidden></i>
            {t.refresh}
          </button>
        </div>
        <HistoryDataTable
          rows={rows}
          loading={loading}
          models={models}
          provider={provider}
          t={t}
          pageWindowSource={{version:historyVersion,total,totals:historyTotals ? {inputTokens:historyTotals.input,outputTokens:historyTotals.output,totalTokens:historyTotals.total} : undefined,hasMore:rows.length<total,loading,error:historyError,onLoadMore:rows.length ? loadMoreHistory : ()=>void reload()}}
          dataTableI18n={dataTableI18n}
        />
      </div>
    </div>
  );
}

/** Format a USD amount: more decimals for sub-dollar estimates. */
