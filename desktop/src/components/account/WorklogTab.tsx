import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../../api/client";
import {
  worklogStrings,
  worklogCategoryLabel,
  worklogLevelLabel,
  WORKLOG_LEVEL_COLOR,
} from "./worklogStrings";

// ── Contrato del backend (espejo de frontend/src/lib/portal-worklog.ts) ──────
type PeriodType = "day" | "week" | "month" | "year" | "lustrum" | "decade";
interface CategoryCount { category: string; count: number; }
interface WorklogOverview {
  totalActions: number;
  firstActivityAt: string | null;
  categories: CategoryCount[];
  stacks: { stack: string; count: number }[];
  panels: { panelId: string | null; panelName: string | null; count: number }[];
  levels: { level: string; count: number }[];
}
interface WorklogMetrics {
  sessions?: number; actions?: number; mb?: number; durationMin?: number; aiRuns?: number;
}
interface WorklogEntry {
  id: string;
  periodType: PeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  panelId: string | null;
  panelName: string | null;
  linuxUsername: string | null;
  summary: string | null;
  highlights: string[] | null;
  categories: CategoryCount[] | null;
  stacks: string[] | null;
  metrics: WorklogMetrics | null;
  aiGenerated: boolean;
}

const LEVELS: { value: string; key: "levelAll" | "levelDay" | "levelWeek" | "levelMonth" | "levelYear" | "levelLustrum" | "levelDecade" }[] = [
  { value: "", key: "levelAll" },
  { value: "day", key: "levelDay" },
  { value: "week", key: "levelWeek" },
  { value: "month", key: "levelMonth" },
  { value: "year", key: "levelYear" },
  { value: "lustrum", key: "levelLustrum" },
  { value: "decade", key: "levelDecade" },
];

function fmtMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;
  return `${Math.round(mb)} MB`;
}

/**
 * Pestaña "Bitácora" del modal de cuenta (espejo de la Bitácora / Hoja de vida
 * de web): tarjetas glance + perfil técnico (categorías y stacks) + timeline de
 * entradas filtrable por nivel de agregación. Lee `/portal/worklog/overview` y
 * `/portal/worklog/entries`; 403 → estado vacío con mensaje (no truena).
 */
export function WorklogTab({
  language,
  token,
  userId,
}: {
  language: string;
  token: string;
  /** Si se pasa, muestra la bitácora PÚBLICA de ese usuario; sin él, la propia. */
  userId?: string;
}) {
  const s = worklogStrings(language);
  const [overview, setOverview] = useState<WorklogOverview | null>(null);
  const [entries, setEntries] = useState<WorklogEntry[]>([]);
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localeDate = useCallback((iso: string | null, opts: Intl.DateTimeFormatOptions): string => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(language === "en" ? "en" : language, { ...opts, timeZone: "UTC" });
    } catch {
      return "—";
    }
  }, [language]);

  const periodLabel = useCallback((e: WorklogEntry): string => {
    const start = new Date(e.periodStart);
    const end = new Date(e.periodEnd);
    switch (e.periodType) {
      case "day":
        return localeDate(e.periodStart, { day: "numeric", month: "short", year: "numeric" });
      case "week": {
        const m = /W(\d{1,2})/i.exec(e.periodKey ?? "");
        const weekNo = m ? Number(m[1]) : "";
        return `${s.week} ${weekNo} · ${localeDate(e.periodStart, { day: "numeric", month: "short" })}`;
      }
      case "month":
        return localeDate(e.periodStart, { month: "long", year: "numeric" });
      case "year":
        return String(start.getUTCFullYear());
      case "lustrum":
      case "decade":
        return `${start.getUTCFullYear()}–${end.getUTCFullYear()}`;
      default:
        return e.periodKey ?? "";
    }
  }, [localeDate, s.week]);

  const metricsLabel = useCallback((m: WorklogMetrics | null): string => {
    if (!m) return "";
    const parts: string[] = [];
    if (typeof m.actions === "number") parts.push(`${m.actions} ${m.actions === 1 ? s.unitAction : s.unitActions}`);
    if (typeof m.sessions === "number") parts.push(`${m.sessions} ${m.sessions === 1 ? s.unitSession : s.unitSessions}`);
    if (typeof m.mb === "number") parts.push(fmtMb(m.mb));
    if (typeof m.durationMin === "number") parts.push(`${m.durationMin} ${s.unitMin}`);
    if (typeof m.aiRuns === "number" && m.aiRuns > 0) parts.push(`${m.aiRuns} ${m.aiRuns === 1 ? s.unitAiRun : s.unitAiRuns}`);
    return parts.join(" · ");
  }, [s]);

  const load = useCallback(async (lvl: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (lvl) qs.set("level", lvl);
      qs.set("limit", "100");
      // Base: propia (/portal/worklog) o de otro usuario (/portal/users/:id/worklog).
      const base = userId ? `/portal/users/${encodeURIComponent(userId)}/worklog` : "/portal/worklog";
      const [ov, en] = await Promise.all([
        request<{ ok: boolean; data: WorklogOverview }>(`${base}/overview`, token),
        request<{ ok: boolean; data: { entries: WorklogEntry[] } }>(`${base}/entries?${qs.toString()}`, token),
      ]);
      setOverview(ov.data ?? null);
      const list = en.data?.entries ?? [];
      list.sort((a, b) => (a.periodStart < b.periodStart ? 1 : a.periodStart > b.periodStart ? -1 : 0));
      setEntries(list);
    } catch (err) {
      setOverview(null);
      setEntries([]);
      // El backend no expone el status en el error (mensaje plano); un 403 de
      // permiso llega con el texto "...permiso..." → lo tratamos como prohibido.
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      setError(/permis|forbidden|worklog\.view/.test(msg) ? s.forbidden : s.loadError);
    } finally {
      setLoading(false);
    }
  }, [token, userId, s.forbidden, s.loadError]);

  useEffect(() => {
    if (!token) return;
    void load(level);
  }, [token, level, load]);

  const realPanels = useMemo(() => (overview?.panels ?? []).filter((p) => p.panelId || p.panelName), [overview]);
  const cats = useMemo(() => [...(overview?.categories ?? [])].sort((a, b) => b.count - a.count), [overview]);
  const stacks = useMemo(() => [...(overview?.stacks ?? [])].sort((a, b) => b.count - a.count).slice(0, 16), [overview]);

  const glance = (label: string, value: string | number, meta: string) => (
    <div className="rounded-xl border border-base-300 bg-base-200/40 px-4 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-1 text-2xl font-black leading-tight">{value}</p>
      <p className="mt-0.5 text-xs opacity-60">{meta}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Tarjetas glance */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {glance(s.statTotalActions, overview?.totalActions ?? 0, s.statTotalActionsMeta)}
        {glance(s.statActiveSince, localeDate(overview?.firstActivityAt ?? null, { day: "numeric", month: "short", year: "numeric" }), s.statActiveSinceMeta)}
        {glance(s.statStacks, overview?.stacks.length ?? 0, s.statStacksMeta)}
        {glance(s.statServers, realPanels.length, s.statServersMeta)}
      </div>

      {/* Perfil técnico */}
      <div>
        <p className="mb-2 text-sm font-bold opacity-80">{s.techProfile}</p>
        {cats.length === 0 && stacks.length === 0 ? (
          <p className="text-sm opacity-60">{loading ? s.loading : s.empty}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {cats.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide opacity-50">{s.workAreas}</p>
                <div className="flex flex-wrap gap-1.5">
                  {cats.map((c) => {
                    const meta = worklogCategoryLabel(c.category, language);
                    return (
                      <span key={c.category} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: meta.color, backgroundColor: `${meta.color}1a` }}>
                        {meta.label}
                        <span className="font-extrabold" style={{ color: meta.color }}>{c.count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {stacks.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide opacity-50">{s.stacksTech}</p>
                <div className="flex flex-wrap gap-1.5">
                  {stacks.map((st) => (
                    <span key={st.stack} className="inline-flex items-center gap-1.5 rounded-full border border-base-300 bg-base-200/60 px-2.5 py-1 text-xs font-semibold opacity-90">
                      {st.stack}
                      <span className="opacity-60">{st.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Bitácora: filtro de nivel + timeline */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold opacity-80">{s.title}</p>
          <div className="flex flex-wrap gap-1">
            {LEVELS.map((lv) => (
              <button
                key={lv.value || "all"}
                type="button"
                onClick={() => setLevel(lv.value)}
                className={`btn btn-xs rounded-full ${level === lv.value ? "btn-primary" : "btn-ghost border border-base-300"}`}
              >
                {s[lv.key]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-10"><span className="loading loading-spinner loading-md text-primary" /></div>
        ) : error ? (
          <p className="py-6 text-sm opacity-60">{error}</p>
        ) : entries.length === 0 ? (
          <p className="py-6 text-sm opacity-60">{s.empty}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {entries.map((e) => {
              const levelColor = WORKLOG_LEVEL_COLOR[e.periodType] ?? "#9ca3af";
              const host = e.linuxUsername ? `${e.linuxUsername}@${e.panelName ?? "—"}` : (e.panelName ?? "");
              const metricParts = metricsLabel(e.metrics);
              return (
                <li
                  key={e.id}
                  className="rounded-xl border border-base-300 bg-base-200/40 p-3"
                  style={{ borderInlineStartWidth: 4, borderInlineStartColor: levelColor }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold">{periodLabel(e)}</span>
                    <span className="rounded-full border px-2 py-0.5 text-[10px] font-extrabold" style={{ color: levelColor, borderColor: levelColor, backgroundColor: `${levelColor}1a` }}>
                      {worklogLevelLabel(s, e.periodType)}
                    </span>
                    {host ? <span className="text-xs opacity-60">{host}</span> : null}
                  </div>
                  {e.summary ? <p className="mt-1.5 text-sm opacity-90">{e.summary}</p> : null}
                  {e.highlights && e.highlights.length > 0 ? (
                    <ul className="mt-1.5 list-disc ps-5 text-xs opacity-80">
                      {e.highlights.map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  ) : null}
                  {(e.categories?.length || e.stacks?.length) ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(e.categories ?? []).map((c) => {
                        const meta = worklogCategoryLabel(c.category, language);
                        return (
                          <span key={`c-${c.category}`} className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: meta.color, backgroundColor: `${meta.color}1a` }}>
                            {meta.label}
                          </span>
                        );
                      })}
                      {(e.stacks ?? []).map((st) => (
                        <span key={`s-${st}`} className="rounded-full border border-base-300 bg-base-200/60 px-2 py-0.5 text-[11px] font-semibold opacity-90">{st}</span>
                      ))}
                    </div>
                  ) : null}
                  {metricParts || e.aiGenerated ? (
                    <p className="mt-1.5 text-[11px] font-semibold opacity-60">
                      {metricParts}{metricParts && e.aiGenerated ? " · " : ""}{e.aiGenerated ? s.aiSummary : ""}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

export default WorklogTab;
