import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import styles from "./ServerWindowCarousel.module.css";
import {
  Activity,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  Edit3,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  KeyRound,
  Link as LinkIcon,
  MemoryStick,
  Server,
  Star,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import type { DataTableRowActionConfig } from "./DataTable";
import ServerAssistantPane from "./ServerAssistantPane";
import { formatMessage, getMessages } from "../i18n";
import type { PanelRow, ServerMetricsState } from "../features/app/viewModels";

// i18n inline (es/en) del estado "sin datos" que reemplaza el asistente + las
// métricas de la window cuando la cuenta se quedó sin saldo. {days}/{unit}/{mb}.
const NODATA_STRINGS: Record<string, { title: string; body: string; day: string; days: string }> = {
  es: {
    title: "Sin datos disponibles",
    body: "Recarga tus datos o espera {days} {unit} para tu próxima recarga gratuita mensual de {mb} MB.",
    day: "día",
    days: "días",
  },
  en: {
    title: "No data available",
    body: "Recharge your data or wait {days} {unit} for your next free monthly grant of {mb} MB.",
    day: "day",
    days: "days",
  },
};
function noDataStrings(language?: string) {
  return NODATA_STRINGS[(language ?? "es").slice(0, 2)] ?? NODATA_STRINGS.es;
}
// Días que faltan para la próxima recarga gratuita mensual = hasta el día 1 del
// mes siguiente (el bono se reinicia por mes calendario; ver freeGrantPeriod).
function daysUntilNextMonthlyGrant(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 86_400_000));
}

const ICON_ONLY_ACTION_IDS = new Set(["delete", "edit"]);

function actionIcon(actionId: string) {
  if (actionId.includes("delete")) return <Trash2 size={15} />;
  if (actionId.includes("edit")) return <Edit3 size={15} />;
  if (actionId.includes("connect")) return <LinkIcon size={15} />;
  if (actionId.includes("assign")) return <KeyRound size={15} />;
  return null;
}

/** 12345678 → "1.2 MB". Used for RAM/disk subtitles. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** Color de la barra según uso: verde < 70%, ámbar 70-90%, rojo > 90%. */
function usageTone(percent: number): "ok" | "warn" | "crit" {
  if (percent >= 90) return "crit";
  if (percent >= 70) return "warn";
  return "ok";
}

type Messages = ReturnType<typeof getMessages>;

function MetricStat({
  kind,
  state,
  t,
}: {
  kind: "cpu" | "ram" | "disk" | "traffic";
  state: ServerMetricsState | undefined;
  t: Messages["panelTable"];
}) {
  const icon = kind === "cpu" ? <Cpu size={15} />
    : kind === "ram" ? <MemoryStick size={15} />
      : kind === "disk" ? <HardDrive size={15} />
        : <ArrowDownUp size={15} />;
  const label = kind === "cpu" ? t.metrics.cpu
    : kind === "ram" ? t.metrics.ram
      : kind === "disk" ? t.metrics.disk
        : t.metrics.traffic;
  const header = <span className="server-stat__label">{icon}<span>{label}</span></span>;

  if (!state || state.status === "loading") {
    return (
      <div className="server-stat">
        {header}
        <span className="server-stat__value skeleton h-6 w-14 rounded-md" aria-hidden />
        <span className="server-stat__sub opacity-60">{t.metrics.loading}</span>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="server-stat server-stat--muted">
        {header}
        <span className="server-stat__value">—</span>
        <span className="server-stat__sub">{t.metrics.unavailable}</span>
      </div>
    );
  }

  const m = state.metrics;

  // Datos consumidos: viene de la DB, siempre disponible (aunque el host esté caído).
  if (kind === "traffic") {
    return (
      <div className="server-stat">
        {header}
        <span className="server-stat__value">{formatBytes(m.traffic.usedBytes)}</span>
        <span className="server-stat__sub">{t.metrics.dataConsumed}</span>
      </div>
    );
  }

  const live = kind === "cpu" ? m.cpu : kind === "ram" ? m.ram : m.disk;
  if (!live) {
    return (
      <div className="server-stat server-stat--muted">
        {header}
        <span className="server-stat__value">—</span>
        <span className="server-stat__sub">{t.metrics.unavailable}</span>
      </div>
    );
  }
  const clamped = Math.max(0, Math.min(100, live.percent));
  const sub = kind === "cpu"
    ? formatMessage(t.metrics.cores, { count: m.cpu!.cores })
    : kind === "ram"
      ? `${formatBytes(m.ram!.usedBytes)} / ${formatBytes(m.ram!.totalBytes)}`
      : `${formatBytes(m.disk!.usedBytes)} / ${formatBytes(m.disk!.totalBytes)}`;

  return (
    <div className="server-stat">
      {header}
      <span className="server-stat__value">{Math.round(clamped)}%</span>
      <span className="server-stat__bar" aria-hidden>
        <span className={`server-stat__bar-fill is-${usageTone(clamped)} ${styles.barFill}`} style={{ ['--bar-w' as string]: `${clamped}%` }} />
      </span>
      <span className="server-stat__sub">{sub}</span>
    </div>
  );
}

type ServerWindowCarouselProps = {
  rows: PanelRow[];
  language?: string;
  rowActions: DataTableRowActionConfig<PanelRow>[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  revealedIps: Record<string, boolean>;
  onToggleIp: (id: string) => void;
  onAction: (actionId: string, row: PanelRow) => void;
  logoFailed: Record<string, boolean>;
  onLogoError: (id: string) => void;
  metrics?: Record<string, ServerMetricsState>;
  onActivePanelChange?: (panelId: string | null) => void;
  onMetricsRefresh?: (panelId: string) => Promise<void> | void;
  /** Token de portal para el asistente IA embebido (omitido en invitado). */
  token?: string;
  /** Cuenta sin datos (MB <= 0): bloquea el asistente IA embebido. */
  noData?: boolean;
  /** Bono mensual gratuito en MB (para el mensaje del estado "sin datos"). */
  freeGrantMb?: number;
  /** Paneles por slide (1·2·3·4·6). Agrupa las filas en páginas-grilla. */
  perSlide?: number;
  /** Panel a enfocar: el carousel desplaza a su slide y llama onFocusHandled. */
  focusPanelId?: string | null;
  onFocusHandled?: () => void;
};

/** Columnas de la grilla por slide según paneles/slide (4 → 2×2, 6 → 3×2). */
function gridColsFor(perSlide: number): number {
  return perSlide === 4 ? 2 : perSlide === 6 ? 3 : perSlide;
}

/**
 * Carousel de "window mockup": una tarjeta servidor/panel por slide, como una
 * pantalla de ordenador, con stats en vivo de CPU/RAM/disco. Navegación:
 * botones laterales, swipe táctil (scroll-snap nativo) y flechas ←/→ (con
 * inversión en RTL). El índice activo se detecta con IntersectionObserver y se
 * reporta vía onActivePanelChange para que el contenedor sondee sólo el visible.
 */
export default function ServerWindowCarousel({
  rows,
  language,
  rowActions,
  favorites,
  onToggleFavorite,
  revealedIps,
  onToggleIp,
  onAction,
  logoFailed,
  metrics,
  onActivePanelChange,
  onMetricsRefresh,
  token,
  noData,
  freeGrantMb,
  perSlide = 1,
  focusPanelId,
  onFocusHandled,
}: ServerWindowCarouselProps) {
  const t = getMessages(language);
  const ns = noDataStrings(language);
  const noDataBody = (() => {
    const days = daysUntilNextMonthlyGrant();
    const mb = freeGrantMb ?? 50;
    return ns.body
      .replace("{days}", String(days))
      .replace("{unit}", days === 1 ? ns.day : ns.days)
      .replace("{mb}", String(mb));
  })();
  const tp = t.panelTable;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Agrupa las filas en páginas de `perSlide` paneles; cada página es un slide
  // con su grilla. perSlide=1 ⇒ una ventana a pantalla completa (original).
  const per = Math.max(1, perSlide || 1);
  const gridCols = gridColsFor(per);
  const gridRows = Math.ceil(per / gridCols);
  const pages: PanelRow[][] = [];
  for (let i = 0; i < rows.length; i += per) pages.push(rows.slice(i, i + per));
  const total = pages.length;
  const safeIndex = Math.min(activeIndex, Math.max(0, total - 1));
  const activePage = pages[safeIndex] ?? [];
  // Ids de la página activa (separados por coma): el contenedor sondea TODOS.
  const activeKey = activePage.map((r) => r.id).join(",");

  // Al cambiar paneles/slide vuelve al inicio (el índice viejo puede caer fuera).
  useEffect(() => { setActiveIndex(0); }, [per]);

  // Reporta los paneles visibles al contenedor (que los sondea cada 30s).
  useEffect(() => {
    onActivePanelChange?.(activeKey || null);
    return () => onActivePanelChange?.(null);
  }, [activeKey, onActivePanelChange]);

  // Detecta el slide visible por intersección con el track (root del scroll).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index ?? "-1");
          if (index < 0) continue;
          if (!best || entry.intersectionRatio > best.ratio) best = { index, ratio: entry.intersectionRatio };
        }
        if (best) setActiveIndex(best.index);
      },
      { root: track, threshold: [0.5, 0.75, 1] },
    );
    for (const slide of slideRefs.current) {
      if (slide) observer.observe(slide);
    }
    return () => observer.disconnect();
  }, [total]);

  // Entrada suave al montar / cambiar el set de filas.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const ctx = gsap.context(() => {
      gsap.from(node, { opacity: 0, y: 12, duration: 0.4, ease: "power2.out" });
    }, node);
    return () => ctx.revert();
  }, [total]);

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(total - 1, index));
    const slide = slideRefs.current[clamped];
    slide?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActiveIndex(clamped);
  }, [total]);

  // Foco externo (p.ej. desde una notificación): desplaza al slide que contiene
  // el panel pedido y limpia la señal. Espera a que haya filas cargadas (total>0)
  // para no limpiar el foco antes de tiempo al montar.
  useEffect(() => {
    if (!focusPanelId || total === 0) return;
    const idx = pages.findIndex((page) => page.some((r) => r.id === focusPanelId));
    if (idx >= 0) goTo(idx);
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPanelId, total]);

  // Navegación CÍCLICA: avanzar desde el último vuelve al primero y viceversa.
  const goRelative = useCallback((delta: number) => {
    if (total <= 0) return;
    const next = (((safeIndex + delta) % total) + total) % total;
    goTo(next);
  }, [goTo, safeIndex, total]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    // En RTL la flecha izquierda avanza y la derecha retrocede.
    const isRtl = typeof document !== "undefined" && (document.documentElement.dir === "rtl");
    const forward = isRtl ? event.key === "ArrowLeft" : event.key === "ArrowRight";
    event.preventDefault();
    goRelative(forward ? 1 : -1);
  }, [goRelative]);

  if (total === 0) return null;

  return (
    <div
      ref={rootRef}
      className="server-carousel"
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="server-carousel__nav server-carousel__nav--prev lp-icon-btn tooltip tooltip-bottom"
        onClick={() => goRelative(-1)}
        disabled={total <= 1}
        aria-label={tp.metrics.prevAria}
        data-tip={tp.metrics.prevAria}
      >
        <ChevronLeft size={18} className="lp-rtl-flip" />
      </button>

      <div ref={trackRef} className="server-carousel__track">
        {pages.map((pageRows, pageIndex) => (
          <div
            key={pageIndex}
            ref={(node) => { slideRefs.current[pageIndex] = node; }}
            data-index={pageIndex}
            className="server-carousel__slide"
          >
            <div
              className="server-carousel__grid"
              data-per={per}
              style={{
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
              }}
            >
              {pageRows.map((row) => {
          const visibleActions = rowActions.filter((action) => (action.visible ? action.visible(row) : true));
          // Editar (izquierda, junto a favorito) y Eliminar (extremo derecho de la
          // fila) como botones-tarjeta.
          const editAction = visibleActions.find((action) => action.id === "edit");
          const deleteAction = visibleActions.find((action) => action.id === "delete");
          // Badge "compartido por X": solo en paneles compartidos (no dueño).
          const sharedOwnerName = (row.source.ownership ?? "owner") !== "owner" ? (row.source.owner?.name ?? null) : null;
          const sharedByLabel = (language ?? "es").startsWith("en") ? "Shared by" : "Compartido por";
          // Solo el creador puede revelar la IP; al compartido le queda enmascarada.
          const isOwner = (row.source.ownership ?? "owner") === "owner";
          const ipRevealed = isOwner && Boolean(revealedIps[row.id]);
          const ipDisplay = ipRevealed ? row.source.serverIp || row.serverIpMasked : row.serverIpMasked;
          const status = row.serverStatus;
          const statusLabel = status === "active"
            ? tp.statusActive
            : status === "inactive"
              ? tp.statusNoResponse
              : tp.statusChecking;
          const statusIconColor = status === "active" ? "#10b981" : status === "inactive" ? "#ef4444" : "#f59e0b";
          const logoUrl = row.brandingLogoUrl?.trim();
          const showLogo = Boolean(logoUrl && !logoFailed[row.id]);
          const isFav = favorites.has(row.id);
          const metricState = metrics?.[row.id];

          return (
            <article key={row.id} className="server-window">
                <header className="server-window__bar">
                  {/* Favorito: tarjeta-botón compacta a la izquierda (icono solo). */}
                  <button
                    type="button"
                    className={`server-window__action-card ${isFav ? "is-active" : ""}`}
                    onClick={() => onToggleFavorite(row.id)}
                    aria-label={isFav ? tp.actions.favoriteRemove : tp.actions.favoriteAdd}
                    title={isFav ? tp.actions.favoriteRemove : tp.actions.favoriteAdd}
                  >
                    <Star size={20} fill={isFav ? "currentColor" : "none"} />
                  </button>
                  {/* Info-stats: la tarjeta "Panel" (logo + nombre) se movió al
                      título del asistente; quedan categoría/estado/IP/proveedor. */}
                  <div className="join join-vertical sm:join-horizontal server-info-stats server-window__stats">
                    <div className="stat join-item">
                      <div className="stat-figure"><Tag size={16} /></div>
                      <div className="stat-title">{tp.columns.category}</div>
                      <div className="stat-value" title={row.categoryLabel}>
                        <span className="server-info-stats__v">{row.categoryLabel || tp.fallbacks.noCategory}</span>
                      </div>
                    </div>
                    {status !== "unknown" ? (
                      <div className="stat join-item">
                        <div className={`stat-figure ${styles.statusColor}`} style={{ ['--status-color' as string]: statusIconColor }}><Activity size={16} /></div>
                        <div className="stat-title">{tp.columns.license}</div>
                        <div className={`stat-value ${styles.statusColor}`} style={{ ['--status-color' as string]: statusIconColor }}>
                          <span className="server-info-stats__v">{statusLabel}</span>
                        </div>
                      </div>
                    ) : null}
                    <div className="stat join-item">
                      <div className="stat-figure"><Globe size={16} /></div>
                      <div className="stat-title">{tp.columns.ip}</div>
                      <div className="stat-value">
                        <span className="server-info-stats__v">
                          <span className="font-mono">{ipDisplay || "-"}</span>
                          {isOwner ? (
                            <button
                              type="button"
                              className="lp-icon-btn tooltip tooltip-top"
                              aria-label={tp.actions.toggleIp}
                              data-tip={tp.actions.toggleIp}
                              onClick={() => onToggleIp(row.id)}
                            >
                              {ipRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          ) : null}
                        </span>
                      </div>
                    </div>
                    {row.providerLabel ? (
                      <div className="stat join-item">
                        <div className="stat-figure"><Server size={16} /></div>
                        <div className="stat-title">{tp.providerLabel}</div>
                        <div className="stat-value" title={row.providerLabel}>
                          <span className="server-info-stats__v">{row.providerLabel}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {/* Badge "compartido por X" → abre el perfil público del dueño. */}
                  {sharedOwnerName ? (
                    <button
                      type="button"
                      className="badge badge-outline gap-1 h-8 cursor-pointer border-base-300"
                      onClick={() => onAction("view_owner", row)}
                      title={`${sharedByLabel} ${sharedOwnerName}`}
                    >
                      <Users size={12} />
                      <span className="max-w-[120px] truncate">{sharedByLabel} {sharedOwnerName}</span>
                    </button>
                  ) : null}
                  {/* Editar + Eliminar: tarjetas-botón compactas a la derecha;
                      editar a la izquierda de eliminar. */}
                  {editAction ? (
                    <button
                      type="button"
                      className="server-window__action-card"
                      onClick={() => onAction(editAction.id, row)}
                      aria-label={editAction.label}
                      title={editAction.label}
                    >
                      <Edit3 size={20} />
                    </button>
                  ) : null}
                  {deleteAction ? (
                    <button
                      type="button"
                      className="server-window__action-card server-window__action-card--danger"
                      onClick={() => onAction(deleteAction.id, row)}
                      aria-label={deleteAction.label}
                      title={deleteAction.label}
                    >
                      <Trash2 size={20} />
                    </button>
                  ) : null}
                </header>

                <div className="server-window__screen">
                  {noData ? (
                    <div className="server-assistant-nodata">
                      <Database size={30} className="server-assistant-nodata__icon" aria-hidden />
                      <p className="server-assistant-nodata__title">{ns.title}</p>
                      <p className="server-assistant-nodata__body">{noDataBody}</p>
                      <button
                        type="button"
                        className="lp-modal-btn lp-modal-btn--primary lp-modal-btn--sm mt-3"
                        onClick={() => onAction("recharge_data", row)}
                      >
                        <span>{t.dashboard.lowDataCta}</span>
                        <ChevronRight size={14} className="lp-rtl-flip" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* x4 y x6: el chat se deshabilita (ventanas pequeñas); solo
                          quedan las métricas. 1·2·3: chat normal. */}
                      {token && per < 4 ? (
                        <ServerAssistantPane panelId={row.id} token={token} language={language} metricsState={metricState} onMetricsRefresh={onMetricsRefresh} noData={noData} panelName={row.accessSubdomain || row.nameLabel} logoUrl={showLogo ? logoUrl : undefined} perSlide={per} />
                      ) : null}

                      <div className="server-stats server-stats--compact">
                        <MetricStat kind="cpu" state={metricState} t={tp} />
                        <MetricStat kind="ram" state={metricState} t={tp} />
                        <MetricStat kind="disk" state={metricState} t={tp} />
                        <MetricStat kind="traffic" state={metricState} t={tp} />
                      </div>
                    </>
                  )}

                  {/* Tags + botones inferiores (Entrar a panel / Auditoría) en la
                      MISMA fila: tags a la izquierda, botones a la derecha. */}
                  <div className="server-window__footer">
                    {row.tags.length > 0 ? (
                      <div className="server-window__tags">
                        {row.tags.slice(0, 6).map((tag, idx) => (
                          <span
                            key={`${tag}-${idx}`}
                            className="badge dt-badge border border-slate-300 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-white"
                          >
                            {tag}
                          </span>
                        ))}
                        {row.tags.length > 6 ? (
                          <span className="badge dt-badge border border-slate-300 bg-slate-200 text-slate-700 dark:border-white/15 dark:bg-white/15 dark:text-white">
                            +{row.tags.length - 6}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="server-window__actions">
                      {visibleActions
                        .filter((action) => !ICON_ONLY_ACTION_IDS.has(action.id))
                        // Sin datos: ocultar "Entrar a panel de control" (connect) y
                        // "Auditoría" (audit) — requieren conexión/datos. Editar y
                        // borrar (icon actions) se mantienen.
                        .filter((action) => !(noData && (action.id === "connect" || action.id === "audit")))
                        .map((action) => {
                          const isDanger = action.variant === "danger";
                          const variantClass = action.id === "connect"
                            ? "btn-primary text-white"
                            : isDanger
                              ? "btn-error text-white"
                              : "btn-outline text-base-content dark:text-white";
                          return (
                            <button
                              key={action.id}
                              type="button"
                              className={`btn btn-sm min-w-0 ${variantClass}`}
                              onClick={() => onAction(action.id, row)}
                            >
                              {actionIcon(action.id)}
                              <span className="truncate">{action.label}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </article>
                );
              })}
              {Array.from({ length: Math.max(0, per - pageRows.length) }).map((_, ghostIdx) => (
                <div key={`ghost-${ghostIdx}`} className="server-window server-window--ghost" aria-hidden />
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="server-carousel__nav server-carousel__nav--next lp-icon-btn tooltip tooltip-bottom"
        onClick={() => goRelative(1)}
        disabled={total <= 1}
        aria-label={tp.metrics.nextAria}
        data-tip={tp.metrics.nextAria}
      >
        <ChevronRight size={18} className="lp-rtl-flip" />
      </button>

      <div className="server-carousel__indicator">
        <span className="server-carousel__count">
          {formatMessage(tp.metrics.position, { current: safeIndex + 1, total })}
        </span>
        <div className="server-carousel__dots">
          {pages.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`server-carousel__dot ${index === safeIndex ? "is-active" : ""}`}
              onClick={() => goTo(index)}
              aria-label={`${index + 1}`}
              aria-current={index === safeIndex}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
