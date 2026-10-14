// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Project Map — full-screen drawer (files module "Mapa" button).
 *
 * Opened via the window event `lxp:project-map:open` with `{ path }`. The user
 * picks an enabled AI provider from the assistant module; that provider builds a
 * friendly, non-technical map of the project, shown as tabs. Each tab is a
 * "body part" of the project explained in plain language plus a Mermaid diagram;
 * all tabs together form the complete map.
 *
 * The map is cached per project path under LUXIPANEL_CONFIG_DIR on the
 * connected server, so reopening is instant — only "Regenerar" spends tokens.
 */

import { useCallback, useEffect, useRef, useState, type WheelEvent } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { ViewTransition, useViewDirection } from "@/components/ui/ViewTransition";
import { api } from "@/lib/api-client";
import esFiles from "@/i18n/es/files";
import { useNamespaceMessages } from "@/lib/use-namespace-messages";
import {
  assistantApi,
  PROVIDER_META,
  PROVIDER_ORDER,
  type AssistantConfigState,
  type AssistantProviderId,
} from "@/components/floating-assistant/assistant-api";
import { ProviderIcon } from "@/components/floating-assistant/ProviderIcon";
import { currentMermaidTheme, getMermaid, nextMermaidId, normalizeMermaidSvg } from "@/lib/mermaid";

// Spanish fallback for the strings this drawer renders: the `projectMapDrawer.*`
// group of the ES source bundle itself (F-05) — antes era una copia verbatim.
// Las traducciones reales se cargan en diferido con `useNamespaceMessages`.
const drawerFallback = esFiles.projectMapDrawer;

type DrawerMessages = typeof drawerFallback;

interface ProjectMapTab {
  id: string;
  title: string;
  plainExplanation: string;
  mermaid: string;
}
interface ProjectMap {
  project: { name: string; type: string; summary: string };
  tabs: ProjectMapTab[];
  provider: AssistantProviderId;
  generatedAt: string;
}

interface UsableProvider {
  id: AssistantProviderId;
  label: string;
  mode: "api" | "cli";
}

function usableProviders(config: AssistantConfigState | null): UsableProvider[] {
  if (!config) return [];
  const out: UsableProvider[] = [];
  for (const id of PROVIDER_ORDER) {
    const slot = config.providers[id];
    if (!slot) continue;
    const ok =
      (slot.mode === "api" && slot.api?.hasApiKey) ||
      (slot.mode === "cli" && slot.cli?.installed && slot.cli?.loggedIn);
    if (ok) out.push({ id, label: PROVIDER_META[id].label, mode: slot.mode });
  }
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Renders one Mermaid diagram, centered in its container, with a floating
 * toolbar: zoom out / 100% (reset) / zoom in (the "lupa") + fullscreen. Default
 * zoom is 100% (natural size). Zooming resizes the SVG (so the layout grows and
 * the diagram stays centered via auto-margins, scrollable when bigger) and keeps
 * the viewport centered on the same point.
 */
function DiagramStage({ code, t }: { code: string; t: (key: keyof DrawerMessages) => string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const naturalRef = useRef(0);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState(false);
  const [isFs, setIsFs] = useState(false);

  // Render the diagram (once per code — the component is keyed per tab). Default
  // size = the SVG's natural width (100%); zoom is applied separately.
  useEffect(() => {
    let cancelled = false;
    const theme = currentMermaidTheme();
    setError(false);
    void (async () => {
      try {
        const mermaid = await getMermaid(theme);
        const { svg } = await mermaid.render(nextMermaidId("pm-diagram"), code);
        if (cancelled || !svgRef.current) return;
        svgRef.current.innerHTML = svg;
        const el = svgRef.current.querySelector("svg");
        if (el) {
          naturalRef.current = normalizeMermaidSvg(el); // 100%
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Apply zoom by resizing the SVG itself (keeps its layout size correct, so the
  // auto-margins keep it centered and overflow scrolls cleanly).
  useEffect(() => {
    const el = svgRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (el && naturalRef.current) el.style.width = `${naturalRef.current * scale}px`;
  }, [scale]);

  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const setZoom = (next: number) => {
    const cont = scrollRef.current;
    setScale((prev) => {
      const ns = clamp(Math.round(next * 100) / 100, 0.3, 4);
      if (cont && ns !== prev) {
        // Keep the viewport centered on the same point while zooming.
        const ratio = ns / prev;
        requestAnimationFrame(() => {
          cont.scrollLeft = (cont.scrollLeft + cont.clientWidth / 2) * ratio - cont.clientWidth / 2;
          cont.scrollTop = (cont.scrollTop + cont.clientHeight / 2) * ratio - cont.clientHeight / 2;
        });
      }
      return ns;
    });
  };
  const toggleFs = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapRef.current?.requestFullscreen();
    } catch {
      /* fullscreen denied — ignore */
    }
  };
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(scale + (e.deltaY < 0 ? 0.1 : -0.1));
    }
  };

  const btn = "rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <div ref={wrapRef} className="relative h-full w-full bg-background">
      {/* Toolbar */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-card/90 p-1 shadow-sm backdrop-blur">
        <button type="button" className={btn} onClick={() => setZoom(scale - 0.15)} title={t("zoomOut")} aria-label={t("zoomOut")}>
          <i className="ti ti-zoom-out text-base" />
        </button>
        <button
          type="button"
          className="min-w-12 rounded-md px-1.5 py-1 text-center text-xs font-medium tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setZoom(1)}
          title={t("resetZoom")}
        >
          {Math.round(scale * 100)}%
        </button>
        <button type="button" className={btn} onClick={() => setZoom(scale + 0.15)} title={t("zoomIn")} aria-label={t("zoomIn")}>
          <i className="ti ti-zoom-in text-base" />
        </button>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <button type="button" className={btn} onClick={() => void toggleFs()} title={isFs ? t("exitFullscreen") : t("fullscreen")} aria-label={t("fullscreen")}>
          <i className={`ti ${isFs ? "ti-arrows-minimize" : "ti-arrows-maximize"} text-base`} />
        </button>
      </div>

      {error ? (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-lg rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            {t("diagramError")}
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] opacity-70">{code}</pre>
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex h-full w-full overflow-auto p-4" onWheel={onWheel}>
          <div ref={svgRef} className="m-auto [&_svg]:block" />
        </div>
      )}
    </div>
  );
}

type Phase = "idle" | "loading" | "empty" | "generating" | "ready" | "error";

export function ProjectMapDrawer({ locale }: { locale?: string }) {
  // Slice i18n perezoso — hook compartido (F-13); las cadenas de este drawer
  // viven bajo `files.projectMapDrawer`.
  const messages = useNamespaceMessages<DrawerMessages>(locale, "files", drawerFallback, {
    pick: (files) => (files as Record<string, unknown> | undefined)?.projectMapDrawer,
  });
  const t = (key: keyof DrawerMessages) => messages[key];

  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const [config, setConfig] = useState<AssistantConfigState | null>(null);
  const [provider, setProvider] = useState<AssistantProviderId | "">("");
  const [map, setMap] = useState<ProjectMap | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [explOpen, setExplOpen] = useState(true);
  const pollRef = useRef<number | null>(null);

  const providers = usableProviders(config);

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadCached = useCallback(async (targetPath: string) => {
    const res = await api.get<{ map: ProjectMap | null }>("/api/ai/project-map", {
      params: { path: targetPath },
    });
    const cached = res.ok ? res.data?.map ?? null : null;
    if (cached) {
      setMap(cached);
      setActiveTab(cached.tabs[0]?.id ?? "");
      setPhase("ready");
    } else {
      setMap(null);
      setPhase("empty");
    }
  }, []);

  // Open via the files module's "Mapa" button.
  useEffect(() => {
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ path?: string }>).detail || {};
      const target = (detail.path || "").trim();
      if (!target) return;
      setPath(target);
      setOpen(true);
      setError("");
      setPhase("loading");
      void (async () => {
        try {
          const cfg = await assistantApi.getConfig();
          setConfig(cfg);
          const usable = usableProviders(cfg);
          const preferred =
            usable.find((p) => p.id === cfg.activeProvider)?.id ?? usable[0]?.id ?? "";
          setProvider(preferred);
          await loadCached(target);
        } catch {
          setConfig(null);
          setError(t("errorLoadConfig"));
          setPhase("error");
        }
      })();
    };
    window.addEventListener("lxp:project-map:open", onOpen as EventListener);
    return () => window.removeEventListener("lxp:project-map:open", onOpen as EventListener);
  }, [loadCached]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const generate = useCallback(async () => {
    if (!provider || !path) return;
    stopPoll();
    setError("");
    setPhase("generating");
    const start = await api.post<{ jobId: string }>("/api/ai/project-map/generate", {
      path,
      providerId: provider,
    });
    if (!start.ok || !start.data?.jobId) {
      setError(start.error || t("errorStartGeneration"));
      setPhase("error");
      return;
    }
    const jobId = start.data.jobId;
    pollRef.current = window.setInterval(async () => {
      const st = await api.get<{ state: string; error?: string | null }>(
        "/api/ai/project-map/status",
        { params: { jobId } },
      );
      if (!st.ok) return; // transient; keep polling
      const state = st.data?.state;
      if (state === "done") {
        stopPoll();
        await loadCached(path);
      } else if (state === "error") {
        stopPoll();
        setError(st.data?.error || t("errorGenerationFailed"));
        setPhase("error");
      } else if (state === "unknown") {
        // Job lost (e.g. backend restart) — fall back to whatever got cached.
        stopPoll();
        await loadCached(path);
      }
    }, 2500);
  }, [provider, path, stopPoll, loadCached]);

  const close = useCallback(() => {
    stopPoll();
    setOpen(false);
  }, [stopPoll]);

  const current = map?.tabs.find((t) => t.id === activeTab) ?? map?.tabs[0] ?? null;
  // Transición de vista entre tabs del mapa (preset motion.css), direccional
  // según el orden de las pestañas.
  const tabDirection = useViewDirection(current?.id ?? "", map?.tabs.map((t) => t.id) ?? []);
  const generating = phase === "generating";

  const providerPicker = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-muted-foreground">{t("providerLabel")}</label>
      <select
        value={provider}
        onChange={(e) => setProvider(e.target.value as AssistantProviderId)}
        disabled={generating || providers.length === 0}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
      >
        {providers.length === 0 && <option value="">{t("noProviders")}</option>}
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
            {p.mode === "cli" ? " · CLI" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void generate()}
        disabled={generating || !provider}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {generating ? (
          <i className="ti ti-loader-2 animate-spin text-sm" />
        ) : (
          <i className="ti ti-sparkles text-sm" />
        )}
        {map ? t("regenerate") : t("generateMap")}
      </button>
    </div>
  );

  return (
    <Drawer open={open} onOpenChange={setOpen} dismissible={false} modal={false}>
      <DrawerContent
        className="!h-[var(--lxp-vvh,100dvh)] !max-h-[var(--lxp-vvh,100dvh)] !mt-0 !rounded-none !border-t-0 flex flex-col bg-card"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <i className="ti ti-sitemap text-lg text-primary" />
              <h2 className="text-base font-semibold">{t("title")}</h2>
              {map?.provider && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  <ProviderIcon id={map.provider} className="text-[12px]" />
                  {PROVIDER_META[map.provider]?.label ?? map.provider}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={path}>
              {path || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={t("closeMap")}
          >
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-2.5 md:flex-row md:items-center md:justify-between">
          {providerPicker}
          {map && (
            <span className="text-[11px] text-muted-foreground">
              {t("generatedAt").replace("{date}", new Date(map.generatedAt).toLocaleString())}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {phase === "loading" && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <i className="ti ti-loader-2 mr-2 animate-spin" /> {t("loading")}
            </div>
          )}

          {phase === "error" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <i className="ti ti-alert-triangle text-3xl text-destructive" />
              <p className="max-w-md text-sm text-muted-foreground">{error}</p>
              {provider && (
                <button
                  type="button"
                  onClick={() => void generate()}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  {t("retry")}
                </button>
              )}
            </div>
          )}

          {(phase === "empty" || (phase === "generating" && !map)) && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              {generating ? (
                <>
                  <i className="ti ti-loader-2 text-3xl text-primary animate-spin" />
                  <p className="max-w-md text-sm text-muted-foreground">
                    {t("generatingDesc")}
                  </p>
                </>
              ) : providers.length === 0 ? (
                <>
                  <i className="ti ti-robot-off text-3xl text-muted-foreground" />
                  <p className="max-w-md text-sm text-muted-foreground">
                    {t("noProvidersConfigured")}
                  </p>
                </>
              ) : (
                <>
                  <i className="ti ti-map-2 text-3xl text-primary" />
                  <p className="max-w-md text-sm text-muted-foreground">
                    {t("emptyDesc")}
                  </p>
                </>
              )}
            </div>
          )}

          {map && (phase === "ready" || (phase === "generating" && map)) && (
            <div className="flex h-full min-h-0 flex-col">
              {map.project.summary && (
                <p className="shrink-0 border-b border-border bg-muted/20 px-4 py-2.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{map.project.name || t("projectDefaultName")}</span>
                  {map.project.type ? ` · ${map.project.type}` : ""} — {map.project.summary}
                </p>
              )}
              {/* Tabs */}
              <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/10 px-3 py-1.5">
                {map.tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out ${
                      (current?.id ?? "") === t.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
              {/* Active tab: collapsible explanation + diagram filling the rest */}
              {current && (
                <ViewTransition viewKey={current.id} direction={tabDirection} className="flex min-h-0 flex-1 flex-col">
                  <div className="shrink-0 border-b border-border">
                    <button
                      type="button"
                      onClick={() => setExplOpen((o) => !o)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-accent/40"
                    >
                      <h3 className="truncate text-sm font-semibold">{current.title}</h3>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        {explOpen ? t("hideExplanation") : t("showExplanation")} {t("explanationSuffix")}
                        <i className={`ti ${explOpen ? "ti-chevron-up" : "ti-chevron-down"}`} />
                      </span>
                    </button>
                    {explOpen && current.plainExplanation && (
                      <p className="max-h-44 overflow-auto whitespace-pre-line px-4 pb-3 text-sm leading-relaxed text-muted-foreground">
                        {current.plainExplanation}
                      </p>
                    )}
                  </div>
                  <div className="min-h-0 flex-1">
                    <DiagramStage key={current.id} code={current.mermaid} t={t} />
                  </div>
                </ViewTransition>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
