import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Pressable, Text, TextInput, View, type ViewToken } from "react-native";
import { styles } from "./PanelCardGrid.styles";
import { Cpu, HardDrive, MemoryStick, Search, Server, SlidersHorizontal, Star } from "lucide-react-native";
import type { PanelRow, ServerMetricsState } from "../features/app/viewModels";
import type { ServerModulePermissions } from "../api/client";
import { getPanelHost, getPanelSubdomainLabel } from "../features/app/utils";
import { getLocaleDirection, getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { useEnterAnimation } from "../hooks/useEnterAnimation";
import { getThemeTokens } from "../theme/colors";
import { Select } from "./ui/Select";
import { FormSheet } from "./ui/FormSheet";
import { Button } from "./ui/Button";
import ServerWindowCarousel, { loadFavorites, persistFavorites } from "./ServerWindowCarousel";
import { ServerWindowSkeleton, ListPanelSkeleton } from "./skeletons";

export type PanelCardGridProps = {
  data: PanelRow[];
  language?: string;
  /** "carousel" monta los window-cards con asistente embebido; "list" la lista plana. */
  viewMode?: "carousel" | "list";
  onRowAction?: (actionId: string, row: PanelRow) => void;
  /** Abre el drawer central "Más opciones" con los módulos activos del servidor. */
  onOpenModulePicker?: (row: PanelRow, perms: ServerModulePermissions) => void;
  /** Abre una herramienta (chat/terminal) como webview que despliega el drawer flotante. */
  loading?: boolean;
  ListHeaderComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  guestMode?: boolean;
  externalSearch?: string;
  onExternalSearchChange?: (value: string) => void;
  externalFiltersOpenSignal?: number;
  onActiveFilterCountChange?: (count: number) => void;
  hideInternalControls?: boolean;
  emptyComponent?: React.ReactElement | null;
  /** Métricas en vivo (CPU/RAM/disco/datos) por panel, para los chips/stats. */
  metrics?: Record<string, ServerMetricsState>;
  /** Favoritos compartidos (gestionados arriba): el carousel solo los usa para ordenar. */
  favorites?: Set<string>;
  /** Reporta el panel visible para que el contenedor lo sondee. */
  onActivePanelChange?: (panelId: string | null) => void;
  /** Panel cuya paleta ya está aplicada (carousel: skeleton hasta tener el color). */
  palettePanelId?: string | null;
  /** Panel al que el carousel debe desplazarse (p. ej. recién creado). */
  focusPanelId?: string | null;
  /** El carousel ya hizo foco en `focusPanelId` (para limpiarlo). */
  onFocusHandled?: () => void;
  /** Fuerza un refresco de métricas de un panel (botón del asistente del carousel). */
  onMetricsRefresh?: (panelId: string) => Promise<void> | void;
  /** Token de portal para el asistente IA embebido del carousel (omitido en invitado). */
  token?: string;
  /** Cuenta sin datos (saldo MB <= 0): bloquea el asistente embebido del carousel. */
  noData?: boolean;
  /** Bono mensual gratuito en MB (para el mensaje del estado "sin datos" del carousel). */
  freeGrantMb?: number;
};

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

type ThemeTokens = ReturnType<typeof getThemeTokens>;
type PanelMessages = ReturnType<typeof getMessages>["panelTable"];

/** Chip compacto de una métrica (CPU/RAM/Disco) para la fila de la lista. */
function MetricChip({
  kind,
  state,
  tokens,
  tp,
}: {
  kind: "cpu" | "ram" | "disk";
  state: ServerMetricsState | undefined;
  tokens: ThemeTokens;
  tp: PanelMessages;
}) {
  const Icon = kind === "cpu" ? Cpu : kind === "ram" ? MemoryStick : HardDrive;
  const label = kind === "cpu" ? tp.metrics.cpu : kind === "ram" ? tp.metrics.ram : tp.metrics.disk;
  const live = state?.status === "ok" ? (kind === "cpu" ? state.metrics.cpu : kind === "ram" ? state.metrics.ram : state.metrics.disk) : null;
  const clamped = live ? Math.max(0, Math.min(100, live.percent)) : null;
  const color = clamped == null ? tokens.textMuted : clamped >= 90 ? tokens.danger : clamped >= 70 ? tokens.warning : tokens.success;
  const value = state?.status === "loading" ? "···" : clamped == null ? "—" : `${Math.round(clamped)}%`;
  return (
    <View style={[styles.listMetricChip, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
      <Icon size={12} color={tokens.textMuted} />
      <Text style={[styles.listMetricText, { color: tokens.textMuted }]}>{label}</Text>
      <Text style={[styles.listMetricText, { color }]}>{value}</Text>
    </View>
  );
}

function AnimatedCard({ index, children }: { index: number; children: React.ReactNode }) {
  const anim = useEnterAnimation({ delay: Math.min(index, 8) * 45, duration: 360, fromY: 12 });
  return <Animated.View style={anim.style}>{children}</Animated.View>;
}

type SshFilter = "all" | "ssh_active" | "ssh_inactive";

export default function PanelCardGrid({
  data,
  language,
  viewMode = "list",
  onRowAction,
  onOpenModulePicker,
  loading,
  ListHeaderComponent,
  ListFooterComponent,
  refreshing,
  onRefresh,
  guestMode = false,
  externalSearch,
  onExternalSearchChange,
  externalFiltersOpenSignal = 0,
  onActiveFilterCountChange,
  hideInternalControls = false,
  emptyComponent = null,
  metrics,
  favorites: favoritesProp,
  onActivePanelChange,
  palettePanelId,
  focusPanelId,
  onFocusHandled,
  onMetricsRefresh,
  token,
  noData,
  freeGrantMb,
}: PanelCardGridProps) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const direction = getLocaleDirection(language);
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const [searchLocal, setSearchLocal] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sshFilter, setSshFilter] = useState<SshFilter>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersTitle = t.panelTable.filtersTitle;
  const stickyAnim = useEnterAnimation({ duration: 400, delay: 80, fromY: 8 });

  const onActivePanelChangeRef = useRef(onActivePanelChange);
  onActivePanelChangeRef.current = onActivePanelChange;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    onActivePanelChangeRef.current?.((first?.item as PanelRow | undefined)?.id ?? null);
  });
  useEffect(() => () => onActivePanelChangeRef.current?.(null), []);

  const search = externalSearch ?? searchLocal;
  const setSearch = onExternalSearchChange ?? setSearchLocal;
  const lastExternalFilterSignal = useRef(externalFiltersOpenSignal);

  // En modo carousel los favoritos los gestiona/persiste ServerWindowCarousel;
  // aquí sólo los leemos para ordenarlos (favoritos primero). En modo lista, esta
  // pantalla es la dueña y persiste sus cambios. Evita que ambos escriban la misma
  // clave a la vez (clobbering del valor más reciente).
  useEffect(() => {
    void loadFavorites().then(setFavorites);
  }, []);

  useEffect(() => {
    if (viewMode === "list") persistFavorites(favorites);
  }, [favorites, viewMode]);

  useEffect(() => {
    if (externalFiltersOpenSignal > lastExternalFilterSignal.current) {
      setFiltersOpen(true);
    }
    lastExternalFilterSignal.current = externalFiltersOpenSignal;
  }, [externalFiltersOpenSignal]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row) => {
      if (row.categoryLabel) set.add(row.categoryLabel);
    });
    const opts = [{ value: "all", label: t.panelTable.filters.allCategories }];
    Array.from(set).sort().forEach((c) => opts.push({ value: c, label: c }));
    return opts;
  }, [data, t]);

  const sshOptions = useMemo(
    () => [
      { value: "all", label: t.panelTable.filters.sshState },
      { value: "ssh_active", label: t.panelTable.badges.active },
      { value: "ssh_inactive", label: t.panelTable.badges.inactive },
    ],
    [t],
  );

  const providerOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row) => {
      if (row.providerLabel) set.add(row.providerLabel);
    });
    const opts = [{ value: "all", label: t.panelTable.filters.allProviders }];
    Array.from(set).sort().forEach((p) => opts.push({ value: p, label: p }));
    return opts;
  }, [data, t]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const filteredRows = data.filter((row) => {
      if (s && !row.searchBlob.includes(s)) return false;
      if (categoryFilter !== "all" && row.categoryLabel !== categoryFilter) return false;
      if (sshFilter !== "all" && row.sshState !== sshFilter) return false;
      if (providerFilter !== "all" && row.providerLabel !== providerFilter) return false;
      return true;
    });
    return [...filteredRows].sort((a, b) => {
      const favA = favorites.has(a.id) ? 1 : 0;
      const favB = favorites.has(b.id) ? 1 : 0;
      if (favA !== favB) return favB - favA;
      const sshActiveA = a.sshState === "ssh_active" ? 1 : 0;
      const sshActiveB = b.sshState === "ssh_active" ? 1 : 0;
      if (sshActiveA !== sshActiveB) return sshActiveB - sshActiveA;
      return a.nameLabel.localeCompare(b.nameLabel, language ?? "es");
    });
  }, [data, favorites, search, categoryFilter, sshFilter, providerFilter, language]);

  const activeFilterCount = (categoryFilter !== "all" ? 1 : 0) + (sshFilter !== "all" ? 1 : 0) + (providerFilter !== "all" ? 1 : 0);

  useEffect(() => {
    onActiveFilterCountChange?.(activeFilterCount);
  }, [activeFilterCount, onActiveFilterCountChange]);

  const toggleFavorite = (id: string) =>
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderItem = ({ item, index }: { item: PanelRow; index: number }) => {
    const isFav = favorites.has(item.id);
    // Etiqueta corta del host de la URL de acceso (customDomain); sin URL
    // configurada cae al nombre del panel. (Managed *.luxipanel.com retirado.)
    const hostLabel = getPanelSubdomainLabel(getPanelHost(item.source));
    const panelSubdomain = (hostLabel !== "-" ? hostLabel : "") || item.nameLabel;
    const status = item.serverStatus;
    const showStatusPill = status !== "unknown";
    const statusColor = status === "active" ? tokens.success : status === "inactive" ? tokens.danger : tokens.warning;
    const statusLabel = status === "active"
      ? t.panelTable.statusActive
      : status === "inactive"
        ? t.panelTable.statusNoResponse
        : t.panelTable.statusChecking;
    const statePillBg = status === "active"
      ? "rgba(34, 197, 94, 0.16)"
      : status === "inactive"
        ? "rgba(239, 68, 68, 0.16)"
        : "rgba(245, 158, 11, 0.16)";
    const metricState = metrics?.[item.id];
    const traffic = metricState?.status === "ok" ? metricState.metrics.traffic.usedBytes : null;

    return (
      <AnimatedCard index={index}>
        <Pressable
          onPress={() => onRowAction?.("connect", item)}
          android_ripple={{ color: tokens.brandDim }}
          style={[styles.listCard, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}
        >
          <View style={[styles.listHeadRow, { flexDirection: rowDirection }]}>
            <View style={[styles.listLogo, { backgroundColor: tokens.brandDim, borderColor: tokens.borderBrand }]}>
              <Server size={16} color={tokens.brandLight} />
            </View>
            <View style={styles.listTitleWrap}>
              <Text numberOfLines={1} style={[styles.listTitle, { color: tokens.textPrimary, textAlign }]}>{panelSubdomain}</Text>
              <Text numberOfLines={1} style={[styles.listSubtitle, { color: tokens.textMuted, textAlign }]}>
                {item.categoryLabel || t.panelTable.fallbacks.noCategory}
                {item.serverIpMasked ? ` · ${item.serverIpMasked}` : ""}
              </Text>
            </View>
            {showStatusPill ? (
              <View style={[styles.statePill, { backgroundColor: statePillBg, borderColor: statusColor }]}>
                <Text style={[styles.statePillText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => toggleFavorite(item.id)}
              accessibilityLabel={isFav ? t.panelTable.actions.favoriteRemove : t.panelTable.actions.favoriteAdd}
              hitSlop={8}
            >
              <Star size={18} color={isFav ? tokens.warning : tokens.textMuted} fill={isFav ? tokens.warning : "transparent"} />
            </Pressable>
          </View>

          <View style={[styles.listMetricsRow, { flexDirection: rowDirection }]}>
            <MetricChip kind="cpu" state={metricState} tokens={tokens} tp={t.panelTable} />
            <MetricChip kind="ram" state={metricState} tokens={tokens} tp={t.panelTable} />
            <MetricChip kind="disk" state={metricState} tokens={tokens} tp={t.panelTable} />
            {traffic != null ? (
              <View style={[styles.listMetricChip, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
                <Text style={[styles.listMetricText, { color: tokens.textMuted }]}>{t.panelTable.metrics.traffic}</Text>
                <Text style={[styles.listMetricText, { color: tokens.textSecondary }]}>{formatBytes(traffic)}</Text>
              </View>
            ) : null}
          </View>

          {item.tags.length > 0 ? (
            <View style={[styles.badges, { flexDirection: rowDirection }]}>
              {item.tags.slice(0, 6).map((tag, idx) => (
                <View key={`${tag}-${idx}`} style={[styles.tagBadge, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}>
                  <Text style={[styles.tagText, { color: tokens.textSecondary }]}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.listActionsRow, { flexDirection: rowDirection }]}>
            <View style={{ flex: 1 }}>
              <Button variant="primary" size="sm" label={t.panelTable.actions.connect} onPress={() => onRowAction?.("connect", item)} />
            </View>
            {item.canEdit !== false ? (
              <View style={{ flex: 1 }}>
                <Button variant="secondary" size="sm" label={t.panelTable.actions.edit} onPress={() => onRowAction?.("edit", item)} />
              </View>
            ) : null}
            {item.canEdit !== false ? (
              <View style={{ flex: 1 }}>
                <Button variant="secondary" size="sm" label={t.audit.action} onPress={() => onRowAction?.("audit", item)} />
              </View>
            ) : null}
          </View>
        </Pressable>
      </AnimatedCard>
    );
  };

  return (
    <View style={{ flex: 1, direction }}>
      <View style={{ flex: 1 }}>
        {/* Skeleton SOLO en la carga inicial (aún sin datos). En un refresco con
            datos ya presentes se conserva el carousel y su RefreshControl, para no
            reemplazar contenido cargado por un skeleton en cada pull-to-refresh. */}
        {loading && data.length === 0 ? (
          viewMode === "carousel" ? <ServerWindowSkeleton /> : <ListPanelSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          (emptyComponent ?? <View style={styles.empty} />)
        ) : viewMode === "carousel" ? (
          <ServerWindowCarousel
            data={filtered}
            language={language}
            guestMode={guestMode}
            onRowAction={onRowAction}
            onOpenModulePicker={onOpenModulePicker}
            refreshing={refreshing}
            onRefresh={onRefresh}
            metrics={metrics}
            favorites={favoritesProp ?? favorites}
            onActivePanelChange={onActivePanelChange}
            palettePanelId={palettePanelId}
            focusPanelId={focusPanelId}
            onFocusHandled={onFocusHandled}
            onMetricsRefresh={onMetricsRefresh}
            token={token}
            noData={noData}
            freeGrantMb={freeGrantMb}
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={ListHeaderComponent}
            ListFooterComponent={ListFooterComponent}
            contentContainerStyle={[styles.listContent, hideInternalControls ? styles.listContentNoBottomBar : null]}
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewRef.current}
            viewabilityConfig={viewabilityConfig}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </View>

      {!hideInternalControls ? (
        <Animated.View style={[styles.bottomBar, { backgroundColor: tokens.bgPrimary, borderTopColor: tokens.border }, stickyAnim.style]}>
          <View style={[styles.controlsRow, { flexDirection: rowDirection }]}>
            <View style={[styles.searchBox, guestMode ? styles.searchBoxFull : null, { borderColor: tokens.border, backgroundColor: tokens.bgInput, flexDirection: rowDirection }]}>
              <Search size={16} color={tokens.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t.panelTable.filters.search}
                placeholderTextColor={tokens.textMuted}
                style={[styles.searchInput, { color: tokens.textPrimary, direction, textAlign }]}
                autoCapitalize="none"
              />
            </View>
            {!guestMode ? (
              <Pressable
                onPress={() => setFiltersOpen(true)}
                style={[styles.filterBtn, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
                accessibilityLabel={t.dataTable.configure}
              >
                <SlidersHorizontal size={18} color={activeFilterCount > 0 ? tokens.brand : tokens.textSecondary} />
                {activeFilterCount > 0 ? (
                  <View style={[styles.filterBadge, { backgroundColor: tokens.brand }]}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {!guestMode ? (
        <FormSheet
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title={filtersTitle}
          language={language}
          footer={
            <View style={[styles.filterFooter, { flexDirection: rowDirection }]}>
              <Button
                variant="secondary"
                label={t.common.clear}
                onPress={() => { setCategoryFilter("all"); setSshFilter("all"); setProviderFilter("all"); }}
                disabled={activeFilterCount === 0}
                style={styles.filterFooterBtn}
              />
              <Button variant="primary" label={t.common.apply} onPress={() => setFiltersOpen(false)} style={styles.filterFooterBtn} />
            </View>
          }
        >
          <View style={styles.modalFilters}>
            <Select value={categoryFilter} options={categoryOptions} onChange={setCategoryFilter} />
            <Select value={sshFilter} options={sshOptions} onChange={(v) => setSshFilter(v as SshFilter)} />
            <Select value={providerFilter} options={providerOptions} onChange={setProviderFilter} />
          </View>
        </FormSheet>
      ) : null}
    </View>
  );
}
