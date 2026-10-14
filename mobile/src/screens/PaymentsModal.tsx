import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { styles } from "./PaymentsScreen.styles";
import { CreditCard, Settings2, Check, BadgePercent } from "lucide-react-native";
import { getAdminPayments, type PaymentRow, type AdminPaymentRow } from "../api/client";
import {
  getTokenBalance, getTokenPacks, createTokenCheckout,
  type TokenBalance, type TokenPack,
} from "../api/billing";
import { beginPurchaseLaunch, useIapState } from "../features/iap/purchase-lifecycle";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { useEnterAnimation } from "../hooks/useEnterAnimation";
import { getThemeTokens } from "../theme/colors";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { IconButton } from "../components/ui/IconButton";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { DateRangeCalendar } from "../components/ui/DateRangeCalendar";
import { CardGridSkeleton, ListPanelSkeleton } from "../components/skeletons";

const STATUS_COLORS: Record<string, string> = {
  approved: "#10b981",
  pending: "#f59e0b",
  declined: "#ef4444",
  refunded: "#94a3b8",
  voided: "#94a3b8",
  error: "#ef4444",
};

const PLATFORM_COLORS: Record<string, string> = {
  app: "#6366f1",
  web: "#0ea5e9",
  desktop: "#8b5cf6",
  admin: "#f59e0b",
};

type StatusFilter = "all" | "approved" | "pending" | "declined" | "refunded" | "voided" | "error";
type PlatformFilter = "all" | "app" | "web" | "desktop" | "admin";
// El modal de compras conserva Tokens / Historial. El modelo por datos (MB) fue
// retirado; Pagos (desembolso) es un modal independiente (`PayoutsModal`).
type Tab = "tokens" | "history";

type WalletSnapshot = { tokenBalance: TokenBalance | null; packs: TokenPack[] };
// Cache en memoria por token: el saldo (tokens/packs) se consulta una sola
// vez al entrar a Pagos. Al re-entrar se hidrata de aquí; se recarga solo al
// comprar (tokenPurchaseSignal) o con el botón de refrescar (force).
const walletCache = new Map<string, WalletSnapshot>();
const walletLoaded = new Set<string>();

function AnimatedCard({ index, children }: { index: number; children: React.ReactNode }) {
  const anim = useEnterAnimation({ delay: Math.min(index, 8) * 50, duration: 380, fromY: 12 });
  return <Animated.View style={anim.style}>{children}</Animated.View>;
}

export function PaymentsPanel({
  visible,
  language,
  token,
  payments,
  busy,
  onRefresh,
  onBuyTokenPack,
  iapReady,
  tokenPurchaseSignal,
  isAdmin,
}: {
  /** El panel está visible (dispara la carga del saldo). */
  visible: boolean;
  language: string;
  token: string;
  payments: PaymentRow[];
  busy: boolean;
  onRefresh: () => void;
  /** Compra de pack de tokens por IAP (móvil). Si no se provee, usa checkout web. */
  onBuyTokenPack?: (pack: TokenPack) => void;
  iapReady?: boolean;
  /** Se incrementa al acreditar tokens por IAP; dispara recarga del saldo. */
  tokenPurchaseSignal?: number;
  /** Admin: oculta la pestaña de compra (Tokens); solo ve Historial. */
  isAdmin?: boolean;
}) {
  const t = getMessages(language);
  const s = t.payments;
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);

  const [activeTab, setActiveTab] = useState<Tab>(isAdmin ? "history" : "tokens");
  // Admin no tiene pestañas de compra: si cae en Tokens, lo llevamos a Historial.
  useEffect(() => {
    if (isAdmin && activeTab === "tokens") setActiveTab("history");
  }, [isAdmin, activeTab]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  // Rango de fechas elegido en el calendario (en vez de texto). `rangeEnd` es
  // null mientras solo se haya tocado un extremo.
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(() => walletCache.get(token)?.tokenBalance ?? null);
  const [packs, setPacks] = useState<TokenPack[]>(() => walletCache.get(token)?.packs ?? []);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [buyingPackId, setBuyingPackId] = useState("");
  // Compra IAP lanzándose ahora mismo (hoja de la tienda abriéndose): apaga TODOS
  // los botones "Comprar" hasta que la tienda responda. Ver `beginPurchaseLaunch`.
  const { launchingId } = useIapState();
  const iapLaunching = launchingId !== null;

  // ── Historial de compras de TODOS los usuarios (vista admin) ──
  const [adminPays, setAdminPays] = useState<AdminPaymentRow[] | null>(null);
  const [adminPaysBusy, setAdminPaysBusy] = useState(false);
  // Un fallo de red dejaba `adminPays = []`, que la vista pinta como "no hay
  // pagos": el admin creía que el historial estaba VACÍO cuando en realidad la
  // consulta había fallado, y sin forma de reintentar salvo cerrar el modal.
  const [adminPaysError, setAdminPaysError] = useState("");
  const loadAdminPays = useCallback(async () => {
    if (!token) return;
    setAdminPaysBusy(true);
    setAdminPaysError("");
    try {
      setAdminPays(await getAdminPayments(token));
    } catch (err) {
      setAdminPaysError(err instanceof Error && err.message ? err.message : s.loadError);
    } finally {
      setAdminPaysBusy(false);
    }
  }, [token, s.loadError]);
  useEffect(() => {
    if (visible && activeTab === "history" && isAdmin) void loadAdminPays();
  }, [visible, activeTab, isAdmin, loadAdminPays]);

  const loadWallets = useCallback(async (force = false) => {
    if (!token) return;
    // Carga una sola vez; al re-entrar se reutiliza el cache. Se fuerza tras una
    // compra (tokenPurchaseSignal) o desde el botón de refrescar.
    if (!force && walletLoaded.has(token)) return;
    setWalletBusy(true);
    setWalletError("");
    try {
      const [b, p] = await Promise.all([
        getTokenBalance(token),
        getTokenPacks(token, "mobile"),
      ]);
      setTokenBalance(b);
      setPacks(p);
      walletLoaded.add(token);
      walletCache.set(token, { tokenBalance: b, packs: p });
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : s.loadError);
    } finally {
      setWalletBusy(false);
    }
  }, [token, s.loadError]);

  useEffect(() => {
    if (visible) void loadWallets();
  }, [visible, loadWallets]);

  // Al abrir la Tienda, refresca el historial de pagos (`onRefresh` →
  // refreshPayments) para que la pestaña Historial no dependa de un
  // pull-to-refresh manual.
  useEffect(() => {
    if (visible) onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Recarga el saldo cuando una compra IAP de tokens se acredita.
  useEffect(() => {
    if (tokenPurchaseSignal) void loadWallets(true);
  }, [tokenPurchaseSignal, loadWallets]);

  const buyPack = useCallback(async (pack: TokenPack) => {
    if (!token) return;
    // Móvil: IAP nativo (App Store / Play). El controller valida vía
    // /portal/tokens/iap/verify y acredita los tokens.
    if (onBuyTokenPack) {
      // Un segundo toque lanzaría una SEGUNDA hoja de compra (en iOS, StoreKit
      // encola ambos pagos → doble cobro). El cerrojo del ciclo IAP solo deja una
      // compra en vuelo y se suelta cuando la tienda responde.
      if (!beginPurchaseLaunch(`pack:${pack.id}`)) return;
      onBuyTokenPack(pack);
      return;
    }
    // Fallback (p.ej. sin IAP disponible): checkout web (Wompi).
    setBuyingPackId(pack.id);
    try {
      const res = await createTokenCheckout(token, pack.id);
      const checkout = res.checkout as { wompiUrl?: string; url?: string } | null;
      const url = checkout?.wompiUrl ?? checkout?.url;
      if (url) await Linking.openURL(url).catch(() => {});
    } catch {
      /* el usuario puede reintentar */
    } finally {
      setBuyingPackId("");
    }
  }, [token, onBuyTokenPack]);

  const statusOptions = useMemo(() => [
    { value: "all", label: t.payments.allStatuses },
    { value: "approved", label: t.payments.statusApproved },
    { value: "pending", label: t.payments.statusPending },
    { value: "declined", label: t.payments.statusDeclined },
    { value: "refunded", label: t.payments.statusRefunded },
    { value: "voided", label: t.payments.statusVoided },
    { value: "error", label: t.payments.statusError },
  ], [t]);

  const platformOptions = useMemo(() => [
    { value: "all", label: t.payments.allPlatforms },
    { value: "app", label: t.payments.platformApp },
    { value: "web", label: t.payments.platformWeb },
    { value: "desktop", label: t.payments.platformDesktop },
    { value: "admin", label: t.payments.platformAdmin },
  ], [t]);

  const filteredPayments = useMemo(() => {
    // Rango por calendario: inicio inclusivo (00:00) y fin inclusivo (23:59:59).
    // Con un único extremo elegido se filtra ese día concreto.
    const fromDate = rangeStart ? new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0) : null;
    const endBase = rangeEnd ?? rangeStart;
    const toDate = endBase ? new Date(endBase.getFullYear(), endBase.getMonth(), endBase.getDate(), 23, 59, 59) : null;
    const hasValidRange = Boolean(fromDate && toDate);
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (platformFilter !== "all" && p.purchasePlatform !== platformFilter) return false;
      if (hasValidRange) {
        const createdAt = new Date(p.createdAt);
        if (Number.isNaN(createdAt.getTime())) return false;
        if (createdAt < fromDate! || createdAt > toDate!) return false;
      }
      return true;
    });
  }, [payments, statusFilter, platformFilter, rangeStart, rangeEnd]);

  const refreshAll = useCallback(() => {
    onRefresh();
    void loadWallets(true);
  }, [onRefresh, loadWallets]);

  const navTabs = useMemo(() => [
    ...(isAdmin
      ? []
      : [
          { key: "tokens" as const, label: s.tabTokens },
        ]),
    { key: "history" as const, label: s.tabHistory },
  ], [isAdmin, s.tabHistory, s.tabTokens]);

  // Botón de filtros del historial: vive en la MISMA fila que las pestañas
  // (Tokens/Historial) y solo aparece en "Historial". El refresco es por
  // "tirar para refrescar" (pull-to-refresh) en cada lista/scroll.
  const filterButton = activeTab === "history" ? (
    <IconButton
      shape="round"
      size={36}
      variant="secondary"
      onPress={() => setFiltersOpen(true)}
      accessibilityLabel={t.payments.filterStatus}
      icon={<Settings2 size={18} />}
    />
  ) : null;

  // Tarjetas "glance": solo título + valor (sin 3ª línea meta, que ocupaba
  // espacio innecesario).
  const renderStat = (label: string, value: string | number) => (
    <View style={[styles.glanceCard, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
      <Text style={[styles.glanceLabel, { color: tokens.textMuted, textAlign }]}>{label}</Text>
      <Text style={[styles.glanceValue, { color: tokens.textPrimary, textAlign }]} numberOfLines={1}>{value}</Text>
    </View>
  );

  // Tarjeta de paquete espejo del `lp-plan-card` de /desktop: chip con punto,
  // nombre, tagline, precio grande, subtítulo, lista de features con check y
  // botón de compra (outline por defecto, relleno cuando es la destacada).
  const renderPlanCard = (opts: {
    key: string;
    index: number;
    badge: string;
    name: string;
    tagline?: string | null;
    price: string;
    /** Precio base tachado (cuando hay descuento). */
    basePrice?: string | null;
    discountPercent?: number;
    sub?: string | null;
    features?: string[];
    highlight?: boolean;
    buyLabel: string;
    buyDisabled?: boolean;
    onBuy: () => void;
  }) => (
    <AnimatedCard key={opts.key} index={opts.index}>
      <View
        style={[
          styles.planCard,
          { backgroundColor: tokens.bgCard, borderColor: opts.highlight ? tokens.borderBrand : tokens.border },
          opts.highlight ? [styles.planCardHighlight, { shadowColor: tokens.brandGlow }] : null,
        ]}
      >
        <View style={[styles.planBadge, { backgroundColor: tokens.brandDim, flexDirection: rowDirection }]}>
          <View style={[styles.planBadgeDot, { backgroundColor: tokens.brand }]} />
          <Text style={[styles.planBadgeText, { color: tokens.brandLight }]}>{opts.badge}</Text>
        </View>
        <Text style={[styles.planName, { color: tokens.textPrimary, textAlign }]}>{opts.name}</Text>
        {opts.tagline ? (
          <Text style={[styles.planTagline, { color: tokens.textMuted, textAlign }]}>{opts.tagline}</Text>
        ) : null}
        <View style={styles.planPriceWrap}>
          {opts.discountPercent && opts.discountPercent > 0 ? (
            <View style={[styles.planDiscountRow, { flexDirection: rowDirection }]}>
              <View style={[styles.planDiscountBadge, { flexDirection: rowDirection }]}>
                <BadgePercent size={12} color="#b45309" />
                <Text style={styles.planDiscountBadgeText}>-{opts.discountPercent}%</Text>
              </View>
              {opts.basePrice ? (
                <Text style={[styles.planStrike, { color: tokens.textMuted }]}>{opts.basePrice}</Text>
              ) : null}
            </View>
          ) : null}
          <Text style={[styles.planPrice, { color: tokens.textPrimary, textAlign }]}>{opts.price}</Text>
          {opts.sub ? <Text style={[styles.planSub, { color: tokens.textMuted, textAlign }]}>{opts.sub}</Text> : null}
        </View>
        {opts.features && opts.features.length > 0 ? (
          <View style={styles.planFeatures}>
            {opts.features.map((feat, fi) => (
              <View key={fi} style={[styles.planFeature, { flexDirection: rowDirection }]}>
                <Check size={16} color={tokens.brand} />
                <Text style={[styles.planFeatureText, { color: tokens.textSecondary, textAlign }]}>{feat}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Pressable
          onPress={opts.onBuy}
          disabled={opts.buyDisabled}
          style={[
            styles.planBuyBtn,
            opts.highlight
              ? { backgroundColor: tokens.brand, borderColor: tokens.brand }
              : { backgroundColor: "transparent", borderColor: tokens.brand },
            opts.buyDisabled ? { opacity: 0.6 } : null,
          ]}
        >
          <CreditCard size={15} color={opts.highlight ? "#fff" : tokens.brand} />
          <Text style={[styles.planBuyText, { color: opts.highlight ? "#fff" : tokens.brand }]}>{opts.buyLabel}</Text>
        </Pressable>
      </View>
    </AnimatedCard>
  );

  const renderPaymentCard = ({ item, index }: { item: PaymentRow; index: number }) => {
    const statusColor = STATUS_COLORS[item.status] ?? tokens.textMuted;
    const platformColor = PLATFORM_COLORS[item.purchasePlatform ?? "web"] ?? tokens.textMuted;
    const statusLabel = (t.payments as Record<string, string>)[`status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`] ?? item.status;
    const platformLabel = (t.payments as Record<string, string>)[`platform${(item.purchasePlatform ?? "web").charAt(0).toUpperCase() + (item.purchasePlatform ?? "web").slice(1)}`] ?? (item.purchasePlatform ?? "web");
    return (
      <AnimatedCard index={index}>
        <View style={[styles.card, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>
          <Text numberOfLines={1} style={[styles.cardTitle, { color: tokens.textPrimary, textAlign }]}>
            {item.product?.name ?? item.tier ?? "-"}
          </Text>
          <View style={[styles.badges, { flexDirection: rowDirection }]}>
            <View style={[styles.badge, { backgroundColor: `${statusColor}22`, flexDirection: rowDirection }]}>
              <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${platformColor}22`, flexDirection: rowDirection }]}>
              <View style={[styles.badgeDot, { backgroundColor: platformColor }]} />
              <Text style={[styles.badgeText, { color: platformColor }]}>{platformLabel}</Text>
            </View>
          </View>
          <Text style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>
            {t.payments.colAmount}: {item.amountUsd != null ? `$${item.amountUsd.toFixed(2)} USD` : "-"}
          </Text>
          <Text style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>
            {t.payments.colDate}: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
          </Text>
          <Text style={[styles.cardRef, { color: tokens.textMuted, textAlign }]}>{item.reference}</Text>
        </View>
      </AnimatedCard>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Pestañas + botón de filtros en la MISMA fila. El `SegmentedControl`
          (pills, sin icono) es el mismo que los sub-tabs del tab "Perfil"; el botón
          de filtros se alinea al final y solo aparece en "Historial". */}
      <View style={[styles.tabsWrap, styles.tabsRow, { borderBottomColor: tokens.border, flexDirection: rowDirection }]}>
        <View style={styles.tabsRowSegments}>
          <SegmentedControl
            scroll
            items={navTabs}
            value={activeTab}
            onChange={(k) => setActiveTab(k as Tab)}
          />
        </View>
        {filterButton}
      </View>
      <View style={styles.modalContentPane}>
      <View style={styles.content}>
        {walletError && activeTab !== "history" ? (
          <View style={[styles.emptyWrap, { gap: 10 }]}>
            <Text style={{ color: tokens.textMuted, textAlign }}>{walletError}</Text>
            <Button variant="primary" label={s.retry} onPress={() => void loadWallets(true)} />
          </View>
        ) : null}

        {activeTab === "tokens" && !walletError ? (
          walletBusy ? (
            <CardGridSkeleton count={4} />
          ) : (
            <ScrollView
              contentContainerStyle={styles.plansContent}
              refreshControl={<RefreshControl refreshing={walletBusy} onRefresh={refreshAll} tintColor={tokens.brand} colors={[tokens.brand]} />}
            >
              {tokenBalance ? (
                <View style={[styles.glanceRow, { flexDirection: rowDirection }]}>
                  {renderStat(s.tokenBalance, tokenBalance.available)}
                  {renderStat(s.tokenEarned, tokenBalance.earned)}
                </View>
              ) : null}
              <Text style={[styles.sectionTitle, { color: tokens.textSecondary, textAlign }]}>{s.packs}</Text>
              {packs.length === 0 ? (
                <Text style={{ color: tokens.textMuted, textAlign }}>{s.noPacks}</Text>
              ) : (
                packs.map((pack, index) => {
                  // Destaca la tarjeta central de la lista de packs.
                  const highlight = packs.length >= 3 && index === Math.floor(packs.length / 2);
                  const price = pack.amountUsd != null
                    ? `$${pack.amountUsd.toFixed(2)} USD`
                    : pack.amountCop != null ? `$${pack.amountCop.toLocaleString()} COP` : "—";
                  const basePrice = pack.discountPercent > 0
                    ? (pack.baseAmountUsd != null ? `$${pack.baseAmountUsd.toFixed(2)} USD` : pack.baseAmountCop != null ? `$${pack.baseAmountCop.toLocaleString()} COP` : null)
                    : null;
                  const sub = pack.amountUsd != null && pack.amountCop != null
                    ? `${s.singlePayment} · $${pack.amountCop.toLocaleString()} COP`
                    : s.singlePayment;
                  return renderPlanCard({
                    key: pack.id,
                    index,
                    badge: `${pack.tokenAmount} ${s.tokens}`,
                    name: pack.name,
                    tagline: s.tokenTagline,
                    price,
                    basePrice,
                    discountPercent: pack.discountPercent,
                    sub,
                    features: [s.featTokensAssistant, s.featTokensTools, s.featTokensNoExpiry],
                    highlight,
                    buyLabel: s.buy,
                    buyDisabled: buyingPackId === pack.id
                      || (Boolean(onBuyTokenPack) && (iapReady === false || iapLaunching)),
                    onBuy: () => void buyPack(pack),
                  });
                })
              )}
            </ScrollView>
          )
        ) : null}

        {/* Historial admin: compras de TODOS los usuarios. */}
        {activeTab === "history" && isAdmin ? (
          adminPaysBusy ? (
            <ListPanelSkeleton rows={6} />
          ) : adminPaysError ? (
            <View style={[styles.emptyWrap, { gap: 10 }]}>
              <Text style={{ color: tokens.textMuted, textAlign }}>{adminPaysError}</Text>
              <Button variant="primary" label={s.retry} onPress={() => void loadAdminPays()} />
            </View>
          ) : !adminPays || adminPays.length === 0 ? (
            <View style={styles.emptyWrap}><Text style={{ color: tokens.textMuted, textAlign }}>{t.payments.noPayments}</Text></View>
          ) : (
            <FlatList
              data={adminPays}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const statusColor = STATUS_COLORS[item.status] ?? tokens.textMuted;
                const statusLabel = (t.payments as Record<string, string>)[`status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`] ?? item.status;
                return (
                  <View style={[styles.card, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>
                    <Text numberOfLines={1} style={[styles.cardTitle, { color: tokens.textPrimary, textAlign }]}>{item.customerName || item.customerEmail || "—"}</Text>
                    {item.customerEmail ? <Text style={[styles.cardRef, { color: tokens.textMuted, textAlign }]}>{item.customerEmail}</Text> : null}
                    <View style={[styles.badges, { flexDirection: rowDirection }]}>
                      <View style={[styles.badge, { backgroundColor: `${statusColor}22`, flexDirection: rowDirection }]}>
                        <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                    </View>
                    <Text style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>{item.productName ?? item.tier ?? "-"}</Text>
                    <Text style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>{t.payments.colAmount}: {item.amountUsd != null ? `$${item.amountUsd.toFixed(2)} USD` : "-"}</Text>
                    <Text style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>{t.payments.colDate}: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}</Text>
                    <Text style={[styles.cardRef, { color: tokens.textMuted, textAlign }]}>{item.reference}</Text>
                  </View>
                );
              }}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              refreshing={adminPaysBusy}
              onRefresh={() => void loadAdminPays()}
            />
          )
        ) : null}

        {activeTab === "history" && !isAdmin ? (
          busy ? (
            // Carga inicial o refresco del historial: skeleton mientras vuelven los pagos.
            <ListPanelSkeleton rows={6} />
          ) : filteredPayments.length === 0 ? (
            <View style={styles.emptyWrap}><Text style={{ color: tokens.textMuted, textAlign }}>{t.payments.noPayments}</Text></View>
          ) : (
            <FlatList
              data={filteredPayments}
              keyExtractor={(item) => item.id}
              renderItem={renderPaymentCard}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              refreshing={busy}
              onRefresh={onRefresh}
            />
          )
        ) : null}
      </View>
      </View>

      <Modal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={s.filtersTitle}
        language={language}
        footer={(
          <Button variant="primary" label={s.applyFilters} onPress={() => setFiltersOpen(false)} />
        )}
      >
        <View style={styles.modalFilters}>
          {/* Estados + Plataformas en la MISMA fila (cada selector mitad del ancho). */}
          <View style={[styles.filterSelectRow, { flexDirection: rowDirection }]}>
            <Select value={statusFilter} options={statusOptions} onChange={(v) => setStatusFilter(v as StatusFilter)} style={styles.filterSelectCol} />
            <Select value={platformFilter} options={platformOptions} onChange={(v) => setPlatformFilter(v as PlatformFilter)} style={styles.filterSelectCol} />
          </View>
          <View style={styles.dateFilterWrap}>
            <Text style={[styles.dateFilterLabel, { color: tokens.textSecondary }]}>
              {s.dateRange}
            </Text>
            <DateRangeCalendar
              start={rangeStart}
              end={rangeEnd}
              language={language}
              onChange={(from, to) => { setRangeStart(from); setRangeEnd(to); }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
