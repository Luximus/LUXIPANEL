import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { Columns2, Columns3, Grid2x2, Grid3x3, RefreshCw, Search, Server, Settings, Square, X, type LucideIcon } from "lucide-react";
import type {
  DataTableFilterConfig,
  DataTableQuickActionConfig,
  DataTableRowActionConfig,
} from "./DataTable";
import ServerWindowCarousel from "./ServerWindowCarousel";
import { Tooltip } from "./ui/Tooltip";
import { formatMessage, getMessages } from "../i18n";
import type { PanelRow, ServerMetricsState } from "../features/app/viewModels";
// Importadas como assets de Vite (no rutas absolutas en /public): así la URL se
// reescribe relativa al `base: "./"` y la imagen carga también en el build
// empaquetado de Electron (file://), donde un `/cloud-*.png` absoluto fallaba.
import cloudComputingLight from "../assets/cloud-computing-ligth.png";
import cloudComputingDark from "../assets/cloud-computing-dark.png";

type PanelCardGridProps = {
  data: PanelRow[];
  filters?: DataTableFilterConfig<PanelRow>[];
  rowActions?: DataTableRowActionConfig<PanelRow>[];
  quickActions?: DataTableQuickActionConfig<PanelRow>[];
  language?: string;
  onRowAction?: (actionId: string, row: PanelRow) => void;
  sidebarHeader?: ReactNode;
  /** Cabecera de la COLUMNA izquierda (botón Consumo + barra de saldo): se apila
   *  encima del listado de servidores para que el lateral de tabs gane todo el
   *  alto de la franja a su derecha. */
  serversHeader?: ReactNode;
  topLeftActions?: ReactNode;
  /** Acciones contextuales (New/Importar/Exportar) renderizadas en una fila
   *  ENCIMA del buscador (antes vivían en la barra intermedia superior). */
  aboveSearchActions?: ReactNode;
  loading?: boolean;
  /** CTA del estado vacío: muestra el botón de nube "Nueva conexión" centrado. */
  onCreateConnection?: () => void;
  /** Refresca la lista; se pinta como botón solo-icono en la esquina superior. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Métricas en vivo (CPU/RAM/disco) por panel, para las stat del carousel. */
  metrics?: Record<string, ServerMetricsState>;
  /** Reporta el panel del slide visible para que el contenedor lo sondee. */
  onActivePanelChange?: (panelId: string | null) => void;
  /** Fuerza un refresco de métricas de un panel (p.ej. tras aprobar la huella). */
  onMetricsRefresh?: (panelId: string) => Promise<void> | void;
  /** Panel a enfocar en el carousel (p.ej. desde una notificación). */
  focusPanelId?: string | null;
  onFocusHandled?: () => void;
  /** Token de portal para el asistente IA embebido (omitido en invitado). */
  token?: string;
  /** Cuenta sin datos (MB <= 0): bloquea el asistente IA embebido en cada panel. */
  noData?: boolean;
  /** Bono mensual gratuito en MB (mensaje del estado "sin datos"). */
  freeGrantMb?: number;
  /** Tema activo: elige la imagen de nube del CTA vacío (light/dark). */
  isDark?: boolean;
};

const FAVORITES_STORAGE_KEY = "lp.panel.favorites";

/** Paneles por slide del carousel: pasos del ciclo + icono de grilla por cantidad. */
const PER_SLIDE_STEPS: number[] = [1, 2, 3, 4, 6];
const PER_SLIDE_KEY = "lp.panel.perSlide";
const PER_SLIDE_ICON: Record<number, LucideIcon> = {
  1: Square, 2: Columns2, 3: Columns3, 4: Grid2x2, 6: Grid3x3,
};

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function persistFavorites(favs: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favs)));
  } catch {
    // ignore quota / privacy mode errors
  }
}

/**
 * Permite al panel lateral (ServersConfigPanel) colapsarse a sí mismo desde
 * dentro de su fila de tabs. Con el drawer de configuración el contexto queda
 * sin proveedor (default `null`): el cierre vive en la cabecera del drawer, así
 * que el panel ya no pinta su propio botón de colapsar. Se conserva el export
 * porque ServersConfigPanel sigue importándolo.
 */
export const AsideCollapseContext = createContext<(() => void) | null>(null);

function normalizeText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).join(" ").toLowerCase();
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase();
}

function normalizeSelectValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  const text = String(value ?? "").trim();
  return text ? [text] : [];
}

export default function PanelCardGrid({
  data,
  filters = [],
  rowActions = [],
  quickActions = [],
  language,
  onRowAction,
  sidebarHeader,
  serversHeader,
  topLeftActions,
  aboveSearchActions,
  loading,
  onCreateConnection,
  onRefresh,
  refreshing,
  metrics,
  onActivePanelChange,
  onMetricsRefresh,
  focusPanelId,
  onFocusHandled,
  token,
  noData,
  freeGrantMb,
  isDark,
}: PanelCardGridProps) {
  const t = getMessages(language);
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [revealedIps, setRevealedIps] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [logoFailed, setLogoFailed] = useState<Record<string, boolean>>({});

  // Drawer lateral derecho de configuración (reemplaza el split de 2 columnas):
  // la lista de servidores ocupa todo el ancho y la configuración (Blog/SSH/
  // Categorías&Tags/Integraciones/API) se abre bajo demanda con el botón ⚙ junto
  // a "Actualizar".
  const [drawerOpen, setDrawerOpen] = useState(false);

  const searchBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    persistFavorites(favorites);
  }, [favorites]);

  // Top bar (filters + buttons) entrance — runs once on mount.
  useEffect(() => {
    const node = searchBarRef.current;
    if (!node) return;
    const items = node.querySelectorAll<HTMLElement>(":scope > *");
    if (items.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.from(items, {
        opacity: 0,
        y: -8,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.05,
      });
    }, node);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filterOptions = useMemo(() => {
    const map = new Map<string, Array<{ label: string; value: string }>>();
    for (const filter of filters) {
      if (filter.type !== "select") continue;
      if (filter.options?.length) {
        map.set(filter.id, filter.options);
        continue;
      }
      const values = new Map<string, string>();
      for (const row of data) {
        for (const value of normalizeSelectValues(row[filter.accessorKey])) {
          const normalized = value.toLowerCase();
          if (!values.has(normalized)) values.set(normalized, value);
        }
      }
      map.set(
        filter.id,
        Array.from(values.entries())
          .sort((a, b) => a[1].localeCompare(b[1], "es"))
          .map(([value, label]) => ({ value, label })),
      );
    }
    return map;
  }, [data, filters]);

  const filteredRows = useMemo(() => {
    return data.filter((row) => {
      for (const filter of filters) {
        const filterValue = (filterState[filter.id] ?? "").trim().toLowerCase();
        if (!filterValue) continue;
        if (filter.type === "select") {
          const rowValues = normalizeSelectValues(row[filter.accessorKey]).map((item) => item.toLowerCase());
          if (!rowValues.includes(filterValue)) return false;
          continue;
        }
        const sourceValue = normalizeText(row[filter.accessorKey]);
        if (!sourceValue.includes(filterValue)) return false;
      }
      return true;
    });
  }, [data, filters, filterState]);

  // Favoritos primero: definen el orden de los slides del carousel.
  const sortedRows = useMemo(() => {
    const favs: PanelRow[] = [];
    const rest: PanelRow[] = [];
    for (const row of filteredRows) {
      (favorites.has(row.id) ? favs : rest).push(row);
    }
    return [...favs, ...rest];
  }, [filteredRows, favorites]);

  // Paneles por slide del carousel (1·2·3·4·6). Opciones limitadas a la cantidad
  // de paneles; con 1 permitimos previsualizar todas las densidades. Persiste.
  const [perSlide, setPerSlide] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const saved = Number(window.localStorage.getItem(PER_SLIDE_KEY));
    return PER_SLIDE_STEPS.includes(saved) ? saved : 1;
  });
  const slideOptions = useMemo(() => {
    const count = sortedRows.length;
    if (count <= 1) return PER_SLIDE_STEPS;
    return PER_SLIDE_STEPS.filter((n) => n <= count);
  }, [sortedRows.length]);
  useEffect(() => {
    if (!slideOptions.includes(perSlide)) setPerSlide(slideOptions[slideOptions.length - 1] ?? 1);
  }, [slideOptions, perSlide]);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(PER_SLIDE_KEY, String(perSlide));
  }, [perSlide]);
  const cyclePerSlide = () => {
    setPerSlide((cur) => {
      const i = slideOptions.indexOf(cur);
      return slideOptions[(i + 1) % slideOptions.length] ?? 1;
    });
  };
  // El botón previsualiza la SIGUIENTE vista (icono + tooltip): si ahora muestra
  // 1, indica que al pulsar pasará a 2, etc. (cicla y vuelve a 1).
  const nextPerSlide = slideOptions[(slideOptions.indexOf(perSlide) + 1) % slideOptions.length] ?? perSlide;
  const PerSlideIcon = PER_SLIDE_ICON[nextPerSlide] ?? Grid2x2;

  function handleFilterChange(filterId: string, value: string) {
    setFilterState((current) => ({ ...current, [filterId]: value }));
  }

  function toggleIp(rowId: string) {
    setRevealedIps((current) => ({ ...current, [rowId]: !current[rowId] }));
  }

  function handleAction(actionId: string, row: PanelRow) {
    onRowAction?.(actionId, row);
  }

  const textFilters = filters.filter((filter) => filter.type !== "select");
  const selectFilters = filters.filter((filter) => filter.type === "select");

  const refreshButton = onRefresh ? (
    <Tooltip tip={refreshing ? t.dashboard.refreshing : t.dashboard.refresh} position="bottom">
      <button
        type="button"
        className="btn btn-square btn-outline h-10 min-h-0 w-10 shrink-0 px-0 text-base-content dark:text-white"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label={refreshing ? t.dashboard.refreshing : t.dashboard.refresh}
      >
        <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
      </button>
    </Tooltip>
  ) : null;

  // Botón ⚙ solo-icono que abre el drawer de configuración (solo cuando hay
  // contenido de configuración, es decir, no en modo invitado).
  const settingsButton = sidebarHeader ? (
    <Tooltip tip={t.titleBar.fabConfig} position="bottom">
      <button
        type="button"
        className="btn btn-square btn-outline h-10 min-h-0 w-10 shrink-0 px-0 text-base-content dark:text-white"
        onClick={() => setDrawerOpen(true)}
        aria-label={t.titleBar.fabConfig}
      >
        <Settings size={16} />
      </button>
    </Tooltip>
  ) : null;

  // Botón de paneles/slide del carousel (a la izquierda de ⚙): cicla 1·2·3·4·6
  // y su icono de grilla indica la cantidad actual.
  const gridLabel = formatMessage(t.dashboard.gridView, { count: nextPerSlide });
  const gridButton = sortedRows.length >= 1 ? (
    <Tooltip tip={gridLabel} position="bottom">
      <button
        type="button"
        className="btn btn-square btn-outline h-10 min-h-0 w-10 shrink-0 px-0 text-base-content dark:text-white"
        onClick={cyclePerSlide}
        aria-label={gridLabel}
      >
        <PerSlideIcon size={16} />
      </button>
    </Tooltip>
  ) : null;

  const searchBar = textFilters.length > 0 || selectFilters.length > 0 || topLeftActions || refreshButton || settingsButton || gridButton ? (
    <div ref={searchBarRef} className="flex flex-nowrap items-center gap-2 [&_.btn]:h-10 [&_.btn]:min-h-0 [&_.input]:h-10 [&_.input]:min-h-0 [&_.select]:h-10 [&_.select]:min-h-0">
      {topLeftActions}
      {textFilters.map((filter) => (
        <label key={filter.id} className="input input-bordered flex min-w-0 flex-1 items-center gap-2 !bg-white text-sm !text-slate-700 dark:border-zinc-700 dark:!bg-zinc-800 dark:!text-zinc-100">
          <span className="opacity-60">
            <Search size={16} />
          </span>
          <input
            className="grow bg-transparent !text-slate-700 placeholder:!text-slate-400 dark:!text-zinc-100 dark:placeholder:!text-zinc-400"
            placeholder={filter.label}
            value={filterState[filter.id] ?? ""}
            onChange={(event) => handleFilterChange(filter.id, event.target.value)}
          />
        </label>
      ))}
      {selectFilters.map((filter) => (
        <select
          key={filter.id}
          className="select select-bordered w-auto min-w-[150px] shrink-0 !bg-white text-sm !text-slate-700 dark:border-zinc-700 dark:!bg-zinc-800 dark:!text-zinc-100"
          value={filterState[filter.id] ?? ""}
          onChange={(event) => handleFilterChange(filter.id, event.target.value)}
        >
          <option value="">{filter.label}</option>
          {(filterOptions.get(filter.id) ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ))}
      {refreshButton || settingsButton || gridButton ? (
        <div className="ms-auto flex items-center gap-2">
          {refreshButton}
          {gridButton}
          {settingsButton}
        </div>
      ) : null}
    </div>
  ) : null;

  const quickActionsBlock = quickActions.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {quickActions
        .filter((action) => action.requiresSelection !== true)
        .map((action) => (
          <button
            key={action.id}
            type="button"
            className={`btn btn-sm text-sm text-base-content dark:text-white ${
              action.variant === "primary" ? "btn-primary" : action.variant === "danger" ? "btn-error" : "btn-outline"
            }`}
            onClick={() => action.onClick?.([])}
          >
            {action.icon ? <span className="inline-flex items-center">{action.icon}</span> : null}
            {action.label}
          </button>
        ))}
    </div>
  ) : null;

  const serversMain = (
    <main className="dashboard-split__main">
        {serversHeader ? <div className="dashboard-split__main-header">{serversHeader}</div> : null}
        <div className="dashboard-panel dashboard-panel--servers">
          {aboveSearchActions ? <div className="mb-2">{aboveSearchActions}</div> : null}
          {searchBar}
          <div className="dashboard-panel__scroll">
            {loading ? (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <article key={`skeleton-${idx}`} className="panel-card flex flex-col gap-3">
                    <header className="flex items-center gap-3">
                      <div className="skeleton h-10 w-10 rounded-lg shrink-0"></div>
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="skeleton h-3 w-3/4"></div>
                        <div className="skeleton h-2 w-1/2"></div>
                      </div>
                      <div className="skeleton h-6 w-6 rounded-full shrink-0"></div>
                    </header>
                    <div className="flex items-center gap-2">
                      <div className="skeleton h-3 w-8"></div>
                      <div className="skeleton h-3 grow"></div>
                      <div className="skeleton h-5 w-5 rounded-sm shrink-0"></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="skeleton h-5 w-16 rounded-full"></div>
                      <div className="skeleton h-5 w-20 rounded-full"></div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                      <div className="skeleton h-8 w-24 rounded-md"></div>
                      <div className="skeleton h-8 w-16 rounded-md"></div>
                      <div className="skeleton h-8 w-8 rounded-md ms-auto"></div>
                    </div>
                  </article>
                ))}
              </div>
            ) : sortedRows.length === 0 ? (
              onCreateConnection ? (
                <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-5 py-12 text-center">
                  <Tooltip tip={t.dashboard.newConnection} position="bottom">
                  <button
                    type="button"
                    onClick={onCreateConnection}
                    aria-label={t.dashboard.newConnection}
                    className="lp-cloud-cta group relative grid place-items-center rounded-full border border-base-300/70 bg-base-100/80 p-3 shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900/70"
                  >
                    <span className="pointer-events-none absolute inset-0 rounded-full bg-primary/10 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"></span>
                    {/* Una sola imagen elegida por el tema (como en la app). Antes
                        eran dos <img> con `hidden`/`dark:block`, pero ese toggle
                        dependía de la cascada y en dark dejaba ambas ocultas. */}
                    <img
                      src={isDark ? cloudComputingDark : cloudComputingLight}
                      alt=""
                      width={128}
                      height={128}
                      className="relative h-28 w-28 rounded-full object-cover"
                    />
                  </button>
                  </Tooltip>
                  <p className="text-sm font-semibold text-base-content/70">{t.dashboard.newConnection}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-base-300 bg-base-100/60 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-base-300/70 bg-base-200/60 text-base-content/40 dark:border-zinc-700 dark:bg-zinc-800/50">
                    <Server size={26} />
                  </span>
                  <p className="max-w-sm text-sm font-medium text-base-content/70">
                    {formatMessage(t.dataTable.noResultsFor, { title: t.dashboard.panelsTableTitle })}
                  </p>
                </div>
              )
            ) : (
              <ServerWindowCarousel
                rows={sortedRows}
                language={language}
                rowActions={rowActions}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                revealedIps={revealedIps}
                onToggleIp={toggleIp}
                onAction={handleAction}
                logoFailed={logoFailed}
                onLogoError={(id) => setLogoFailed((current) => ({ ...current, [id]: true }))}
                metrics={metrics}
                onActivePanelChange={onActivePanelChange}
                onMetricsRefresh={onMetricsRefresh}
                token={token}
                noData={noData}
                freeGrantMb={freeGrantMb}
                perSlide={perSlide}
                focusPanelId={focusPanelId}
                onFocusHandled={onFocusHandled}
              />
            )}
          </div>
        </div>
      </main>
  );

  // Drawer lateral derecho de configuración: overlay FIJO hermano del contenido
  // (igual que AssistantDrawer), NO envuelve el árbol principal. El contenido se
  // monta solo cuando el drawer está abierto (lazy: ServersConfigPanel pide su
  // data al cambiar de tab). El cierre vive en la cabecera (X) y en el backdrop.
  const drawer = sidebarHeader ? (
    <>
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-[1304] bg-black/40"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}
      <aside
        className={`lp-config-drawer flex flex-col border-s border-base-300 bg-base-100 shadow-2xl dark:border-zinc-700 ${drawerOpen ? "is-open" : ""}`}
        aria-hidden={!drawerOpen}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-base-300 px-4 py-3 dark:border-zinc-700">
          <span className="text-sm font-bold text-base-content dark:text-white">{t.titleBar.fabConfig}</span>
          <button
            type="button"
            className="btn btn-square btn-ghost btn-sm"
            onClick={() => setDrawerOpen(false)}
            aria-label={t.dashboard.collapsePanel}
            title={t.dashboard.collapsePanel}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {drawerOpen ? sidebarHeader : null}
          {drawerOpen ? quickActionsBlock : null}
        </div>
      </aside>
    </>
  ) : null;

  // La lista de servidores ocupa todo el ancho; la configuración se abre en el
  // drawer lateral derecho bajo demanda.
  return (
    <div className="dashboard-single">
      {serversMain}
      {drawer}
    </div>
  );
}
