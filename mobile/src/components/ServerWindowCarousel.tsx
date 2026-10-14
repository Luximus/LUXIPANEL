import React, { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Animated, Dimensions, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, type LayoutChangeEvent, type ViewToken } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "./PanelCardGrid.styles";
import {
  ChevronDown,
  ChevronUp,
  Database,
} from "lucide-react-native";
import type { PanelRow, ServerMetricsState } from "../features/app/viewModels";
import type { ServerModulePermissions } from "../api/client";
import { getPanelHost, getPanelSubdomainLabel } from "../features/app/utils";
import { formatMessage, getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { ServerCoverPane } from "./assistant/ServerCoverPane";
import { ServerWindowSkeleton } from "./skeletons";

/** Misma clave que el modo lista para que favoritos sigan sincronizados. */
export const FAVORITES_STORAGE_KEY = "lp.app.panel.favorites";

/** Set vacío estable (evita recrear en cada render cuando no llegan favoritos). */
const EMPTY_FAVORITES: Set<string> = new Set();

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

export function loadFavorites(): Promise<Set<string>> {
  return AsyncStorage.getItem(FAVORITES_STORAGE_KEY).then((raw) => {
    if (!raw) return new Set<string>();
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
}

export function persistFavorites(favs: Set<string>) {
  void AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favs)));
}

function AnimatedSlide({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);
  return <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export type ServerWindowCarouselProps = {
  data: PanelRow[];
  language?: string;
  onRowAction?: (actionId: string, row: PanelRow) => void;
  /** Abre el DRAWER CENTRAL "Más opciones" con los módulos del servidor (lo monta
   *  MainScreen como bottom-sheet independiente). */
  onOpenModulePicker?: (row: PanelRow, perms: ServerModulePermissions) => void;
  guestMode?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Métricas en vivo por panel para los puntos de estado, las stat y el asistente. */
  metrics?: Record<string, ServerMetricsState>;
  /** Reporta el panel del slide visible para que el contenedor lo sondee. */
  onActivePanelChange?: (panelId: string | null) => void;
  /** Panel cuya paleta YA está aplicada: los slides cuyo color aún no llegó muestran
   *  skeleton (para no pintar el contenido con el color anterior/base y luego saltar). */
  palettePanelId?: string | null;
  /** Panel al que el carousel debe desplazarse (p. ej. recién creado). */
  focusPanelId?: string | null;
  /** El carousel ya hizo foco en `focusPanelId` (para limpiarlo en el contenedor). */
  onFocusHandled?: () => void;
  /** Fuerza un refresco de métricas de un panel (botón del asistente). */
  onMetricsRefresh?: (panelId: string) => Promise<void> | void;
  /** Token de portal para el asistente IA embebido (omitido en invitado). */
  token?: string;
  /** Cuenta sin datos (saldo MB <= 0): bloquea el asistente embebido (usa SSH). */
  noData?: boolean;
  /** Bono mensual gratuito en MB (para el mensaje del estado "sin datos"). */
  freeGrantMb?: number;
  /** Favoritos (compartidos con el drawer): solo se usan para ORDENAR aquí; el
   *  toggle vive en la cabecera del tab Server del drawer izquierdo. */
  favorites?: Set<string>;
};

/**
 * Carousel de "window mockup" (una tarjeta servidor por slide, estilo pantalla
 * de ordenador) con stats CPU/RAM/disco en vivo y asistente IA embebido. Es la
 * adaptación RN del ServerWindowCarousel del desktop: FlatList horizontal con
 * paginado (swipe nativo) + indicador "X / Y" + flechas. El slide visible se
 * detecta con onViewableItemsChanged y se reporta por onActivePanelChange para
 * que el contenedor sondee SOLO ese panel. Favoritos primero (orden ya resuelto
 * por el contenedor); el toggle de favorito persiste en la misma clave que la
 * lista.
 */
export default function ServerWindowCarousel({
  data,
  language,
  onRowAction,
  onOpenModulePicker,
  guestMode = false,
  metrics,
  onActivePanelChange,
  palettePanelId,
  focusPanelId,
  onFocusHandled,
  onMetricsRefresh,
  token,
  noData,
  freeGrantMb,
  favorites,
  refreshing,
  onRefresh,
}: ServerWindowCarouselProps) {
  const t = getMessages(language);
  const tp = t.panelTable;
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  // Safe-area inferior: las flechas/indicador del carousel se anclan POR ENCIMA
  // de la barra de navegación de Android (la app es edge-to-edge abajo, así que
  // sin esto el botón de avanzar y los dots quedan tapados por los botones del
  // sistema). Ver imagen del reporte: navNext + footer pisados por el navbar.
  const insets = useSafeAreaInsets();
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const ns = noDataStrings(language);
  const noDataBody = (() => {
    const days = daysUntilNextMonthlyGrant();
    const mb = freeGrantMb ?? 50;
    return ns.body
      .replace("{days}", String(days))
      .replace("{unit}", days === 1 ? ns.day : ns.days)
      .replace("{mb}", String(mb));
  })();

  const favoriteSet = favorites ?? EMPTY_FAVORITES;

  const [carouselHeight, setCarouselHeight] = useState(Dimensions.get("window").height);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<PanelRow>>(null);
  const onActivePanelChangeRef = useRef(onActivePanelChange);
  onActivePanelChangeRef.current = onActivePanelChange;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActiveIndex(first.index);
    onActivePanelChangeRef.current?.((first?.item as PanelRow | undefined)?.id ?? null);
  });
  useEffect(() => () => onActivePanelChangeRef.current?.(null), []);

  // Favoritos primero (orden estable). El contenedor entrega `data` ya filtrada;
  // aquí sólo reordenamos para que los favoritos abran el carousel. El toggle y la
  // persistencia viven arriba (MainTab) / en el drawer.
  const ordered = useMemo(() => {
    const favs: PanelRow[] = [];
    const rest: PanelRow[] = [];
    for (const row of data) (favoriteSet.has(row.id) ? favs : rest).push(row);
    return [...favs, ...rest];
  }, [data, favoriteSet]);

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(ordered.length - 1, index));
    flatListRef.current?.scrollToOffset({ offset: clamped * carouselHeight, animated: true });
    setActiveIndex(clamped);
  };

  // Foco externo (p. ej. panel recién creado): desplaza el carousel a ese panel y
  // avisa al contenedor para que limpie la señal.
  const onFocusHandledRef = useRef(onFocusHandled);
  onFocusHandledRef.current = onFocusHandled;
  useEffect(() => {
    if (!focusPanelId) return;
    const idx = ordered.findIndex((r) => r.id === focusPanelId);
    if (idx >= 0) {
      flatListRef.current?.scrollToOffset({ offset: idx * carouselHeight, animated: true });
      setActiveIndex(idx);
      onActivePanelChangeRef.current?.(ordered[idx].id);
    }
    onFocusHandledRef.current?.();
  }, [focusPanelId, ordered, carouselHeight]);

  const renderItem = ({ item }: { item: PanelRow }) => {
    // Etiqueta corta del host de la URL de acceso (customDomain); sin URL
    // configurada cae al nombre del panel. (Managed *.luxipanel.com retirado.)
    const hostLabel = getPanelSubdomainLabel(getPanelHost(item.source));
    const panelSubdomain = (hostLabel !== "-" ? hostLabel : "") || item.nameLabel;
    const metricState = metrics?.[item.id];
    const logoUrl = item.brandingLogoUrl?.trim();
    // Skeleton mientras la PALETA de este panel aún no está aplicada (evita pintar el
    // pane con el color anterior/base y luego saltar al del panel). `undefined` =
    // sin feature (invitado) → nunca skeleton. El pane se mantiene MONTADO debajo
    // (no se pierde el estado del chat); solo lo tapa un skeleton opaco.
    const paletteLoading = palettePanelId !== undefined && palettePanelId !== item.id && !noData && !!token;

    return (
      <AnimatedSlide>
        <View style={{ width: "100%", height: carouselHeight }}>
          {/* La info del servidor (nombre/categoría/estado/IP/proveedor/stats/tags)
              vive ahora en el drawer izquierdo (tab "Server"); la window card es
              solo chat para maximizar el alto del asistente. */}
          {/* Sin contenedor: el chat ocupa TODO el ancho y alto (a fondo de pantalla). */}
          <View style={[styles.window, styles.windowBare]}>
            {noData ? (
              <View style={styles.windowScreen}>
                <View style={[styles.noDataBox, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
                  <Database size={30} color={tokens.textMuted} />
                  <Text style={[styles.noDataTitle, { color: tokens.textPrimary, textAlign }]}>{ns.title}</Text>
                  <Text style={[styles.noDataBody, { color: tokens.textMuted, textAlign }]}>{noDataBody}</Text>
                </View>
              </View>
            ) : token ? (
              <View style={{ flex: 1, minHeight: 0 }}>
                {/* La PORTADA ocupa todo el alto (fase A5: el chat ya no vive en
                    el slide; "Empezar conversación" navega a la pantalla `Chat`
                    vía la acción `open_chat`). */}
                <ServerCoverPane
                  panelId={item.id}
                  token={token}
                  language={language}
                  metricsState={metricState}
                  onMetricsRefresh={onMetricsRefresh}
                  noData={noData}
                  panelName={panelSubdomain}
                  logoUrl={logoUrl}
                  serverIp={item.source.serverIp ?? ""}
                  isOwner={(item.source.ownership ?? "owner") === "owner"}
                  ownerName={item.source.owner?.name ?? undefined}
                  onViewOwner={() => onRowAction?.("view_owner", item)}
                  isFavorite={favoriteSet.has(item.id)}
                  onToggleFavorite={() => onRowAction?.("favorite", item)}
                  onAudit={() => onRowAction?.("audit", item)}
                  onManageAccess={() => onRowAction?.("manage_access", item)}
                  onRequestOpenModulePicker={(perms) => onOpenModulePicker?.(item, perms)}
                  onStartChat={() => onRowAction?.("open_chat", item)}
                  onNewServer={() => onRowAction?.("new_server", item)}
                  onRegisterSshKey={() => onRowAction?.("register_ssh", item)}
                  onNewTerminal={() => onRowAction?.("open_terminal", item)}
                />
              </View>
            ) : null}
          </View>
          {/* Skeleton OPACO encima del pane (montado debajo) hasta que llegue el
              color del panel → el contenido aparece ya con su paleta, sin flash. */}
          {paletteLoading ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.bgPrimary }]} pointerEvents="none">
              <ServerWindowSkeleton />
            </View>
          ) : null}
        </View>
      </AnimatedSlide>
    );
  };

  return (
    <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setCarouselHeight(e.nativeEvent.layout.height)}>
      <FlatList
        ref={flatListRef}
        data={ordered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: carouselHeight, offset: carouselHeight * index, index })}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewabilityConfig}
        // Deslizar hacia abajo en el PRIMER slide (tope de la lista) recarga la
        // lista de paneles del carousel. El RefreshControl de una FlatList vertical
        // solo dispara en el tope, así que naturalmente aplica solo al primero.
        refreshControl={
          onRefresh
            ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />
            : undefined
        }
      />
      {ordered.length > 1 ? (
        <>
          <Pressable
            onPress={() => goTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            accessibilityLabel={tp.metrics.prevAria}
            style={[styles.navBtn, styles.navPrev, { bottom: insets.bottom + 12, backgroundColor: tokens.bgCard, borderColor: tokens.border, opacity: activeIndex === 0 ? 0.4 : 1 }]}
          >
            <ChevronUp size={20} color={tokens.textPrimary} />
          </Pressable>
          <Pressable
            onPress={() => goTo(activeIndex + 1)}
            disabled={activeIndex >= ordered.length - 1}
            accessibilityLabel={tp.metrics.nextAria}
            style={[styles.navBtn, styles.navNext, { bottom: insets.bottom + 12, backgroundColor: tokens.bgCard, borderColor: tokens.border, opacity: activeIndex >= ordered.length - 1 ? 0.4 : 1 }]}
          >
            <ChevronDown size={20} color={tokens.textPrimary} />
          </Pressable>
          <View style={[styles.carouselFooter, { bottom: insets.bottom + 10 }]} pointerEvents="none">
            <Text style={[styles.carouselCount, { color: tokens.textMuted }]}>
              {formatMessage(tp.metrics.position, { current: Math.min(activeIndex + 1, ordered.length), total: ordered.length })}
            </Text>
            <View style={[styles.dotsRow, { flexDirection: rowDirection }]}>
              {ordered.map((row, i) => (
                <View key={row.id} style={[styles.dot, { backgroundColor: i === activeIndex ? tokens.brand : tokens.border, width: i === activeIndex ? 16 : 6 }]} />
              ))}
            </View>
          </View>
        </>
      ) : null}

    </View>
  );
}
