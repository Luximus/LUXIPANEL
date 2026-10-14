import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Copy, Plus, RefreshCw, Settings2, ShieldCheck, Trash2, X } from "lucide-react-native";
import type { TicketRow } from "../features/app/viewModels";
import { formatMessage, getLocaleDirection, getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { useEnterAnimation } from "../hooks/useEnterAnimation";
import { getThemeTokens } from "../theme/colors";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { IconButton } from "../components/ui/IconButton";
import { LoginBackground } from "../components/LoginBackground";
import { SupportSettingsModal, type SupportViewSettings } from "../components/SupportSettingsModal";
import { StaffTicketsModal } from "../components/StaffTicketsModal";
import { styles } from "./SupportScreen.styles";

function AnimatedTicketCard({ index, children }: { index: number; children: React.ReactNode }) {
  const anim = useEnterAnimation({ delay: Math.min(index, 8) * 50, duration: 380, fromY: 12 });
  return <Animated.View style={anim.style}>{children}</Animated.View>;
}

const STATUS_COLORS: Record<string, string> = {
  open: "#f472b6",
  in_progress: "#f43f5e",
  resolved: "#10b981",
  closed: "#94a3b8",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f43f5e",
  medium: "#f472b6",
  low: "#fecaca",
};

type StatusFilter = "all" | "open" | "in_progress" | "resolved" | "closed";
type PriorityFilter = "all" | "critical" | "high" | "medium" | "low";

export function SupportScreen({
  language,
  openTicketsCount,
  totalTickets,
  busyTickets,
  ticketRows,
  onRefreshTickets,
  onTicketRowAction,
  onGoServers,
  onGoSupport,
  onGoSecurity,
  onGoPayments,
  onOpenNewTicket,
  searchValue,
  onSearchChange,
  openFiltersSignal = 0,
  onFilterCountChange,
  isAdmin = false,
  token,
}: {
  isDark?: boolean;
  language: string;
  openTicketsCount: number;
  totalTickets: number;
  busyTickets: boolean;
  ticketRows: TicketRow[];
  onRefreshTickets: () => void;
  onTicketRowAction: (actionId: string, row: TicketRow) => void | Promise<void>;
  onGoServers: () => void;
  onGoSupport: () => void;
  onGoSecurity: () => void;
  onGoPayments?: () => void;
  onOpenNewTicket: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  openFiltersSignal?: number;
  onFilterCountChange?: (count: number) => void;
  /** Admin de tickets (staff): solo se muestra a cuentas admin. */
  isAdmin?: boolean;
  /** Token Bearer para las llamadas de staff (requerido si isAdmin). */
  token?: string;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const direction = getLocaleDirection(language);
  const rtl = direction === "rtl";
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const headerAnim = useEnterAnimation({ duration: 450, fromY: -12 });
  const centerCtaAnim = useEnterAnimation({ duration: 420, delay: 160, fromY: 8 });
  const fabAnim = useEnterAnimation({ duration: 400, delay: 200, fromY: 16 });
  const [searchLocal, setSearchLocal] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateRangeInput, setDateRangeInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const showStaff = isAdmin && Boolean(token);
  const [viewSettings, setViewSettings] = useState<SupportViewSettings>({
    sortBy: "newest",
    showStatus: true,
    showPriority: true,
    showCreatedAt: true,
    showResponseState: true,
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deleteTicketModal, setDeleteTicketModal] = useState<{
    open: boolean;
    row: TicketRow | null;
    saving: boolean;
    error: string;
  }>({
    open: false,
    row: null,
    saving: false,
    error: "",
  });
  const [pulse] = useState(() => new Animated.Value(1));
  const lastFilterSignal = useRef(openFiltersSignal);
  const search = searchValue ?? searchLocal;
  const setSearch = onSearchChange ?? setSearchLocal;
  const filtersTitle = t.support.filtersTitle;
  const centerCtaSourceDark = require("../../assets/cloud-computing-dark.png");
  const centerCtaSourceLight = require("../../assets/cloud-computing-ligth.png");
  const centerCtaAssetDark = useMemo(() => Image.resolveAssetSource(centerCtaSourceDark), []);
  const centerCtaAssetLight = useMemo(() => Image.resolveAssetSource(centerCtaSourceLight), []);
  const hasTicketRecords = ticketRows.length > 0;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const statusOptions = useMemo(
    () => [
      { value: "all", label: t.ticketTable.filters.allStatuses },
      { value: "open", label: t.ticketTable.statusBadges.open },
      { value: "in_progress", label: t.ticketTable.statusBadges.in_progress },
      { value: "resolved", label: t.ticketTable.statusBadges.resolved },
      { value: "closed", label: t.ticketTable.statusBadges.closed },
    ],
    [t],
  );

  const priorityOptions = useMemo(
    () => [
      { value: "all", label: t.ticketTable.filters.allPriorities },
      { value: "critical", label: t.ticketTable.priorityBadges.critical },
      { value: "high", label: t.ticketTable.priorityBadges.high },
      { value: "medium", label: t.ticketTable.priorityBadges.medium },
      { value: "low", label: t.ticketTable.priorityBadges.low },
    ],
    [t],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const normalizedRange = dateRangeInput.trim();
    const rangeMatch = normalizedRange.match(/^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/);
    const fromDate = rangeMatch ? new Date(`${rangeMatch[1]}T00:00:00`) : null;
    const toDate = rangeMatch ? new Date(`${rangeMatch[2]}T23:59:59`) : null;
    const hasValidRange = Boolean(
      fromDate && toDate
      && !Number.isNaN(fromDate.getTime())
      && !Number.isNaN(toDate.getTime()),
    );
    const rows = ticketRows.filter((row) => {
      if (s && !row.searchBlob.includes(s)) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (priorityFilter !== "all" && row.priority !== priorityFilter) return false;
      if (hasValidRange) {
        const createdAt = new Date(row.createdAtLabel);
        if (Number.isNaN(createdAt.getTime())) return false;
        if (createdAt < fromDate! || createdAt > toDate!) return false;
      }
      return true;
    });
    const priorityWeight: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...rows].sort((a, b) => {
      if (viewSettings.sortBy === "priority") {
        return (priorityWeight[a.priority] ?? 999) - (priorityWeight[b.priority] ?? 999);
      }
      const at = new Date(a.createdAtLabel).getTime();
      const bt = new Date(b.createdAtLabel).getTime();
      if (viewSettings.sortBy === "oldest") return at - bt;
      return bt - at;
    });
  }, [ticketRows, search, statusFilter, priorityFilter, dateRangeInput, viewSettings.sortBy]);

  const hasDateRangeFilter = /^\d{4}-\d{2}-\d{2}\s*-\s*\d{4}-\d{2}-\d{2}$/.test(dateRangeInput.trim());
  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (priorityFilter !== "all" ? 1 : 0) + (hasDateRangeFilter ? 1 : 0);
  React.useEffect(() => {
    onFilterCountChange?.(activeFilterCount);
  }, [activeFilterCount, onFilterCountChange]);
  React.useEffect(() => {
    if (openFiltersSignal > lastFilterSignal.current) {
      setFiltersOpen(true);
    }
    lastFilterSignal.current = openFiltersSignal;
  }, [openFiltersSignal]);

  const closeDeleteTicketModal = () => {
    if (deleteTicketModal.saving) return;
    setDeleteTicketModal({ open: false, row: null, saving: false, error: "" });
  };

  const confirmDeleteTicket = async () => {
    if (!deleteTicketModal.row) return;
    setDeleteTicketModal((current) => ({ ...current, saving: true, error: "" }));
    try {
      await onTicketRowAction("delete_ticket", deleteTicketModal.row);
      setDeleteTicketModal({ open: false, row: null, saving: false, error: "" });
    } catch (error) {
      const fallback = t.support.deleteTicketError;
      const message = error instanceof Error ? (error.message || fallback) : fallback;
      setDeleteTicketModal((current) => ({ ...current, saving: false, error: message }));
    }
  };

  const copyToClipboard = async (key: string, value: string) => {
    if (!value) return;
    try {
      await Clipboard.setStringAsync(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1200);
    } catch {
      /* noop */
    }
  };

  const HeroHeader = (
    <Animated.View style={[styles.header, headerAnim.style]}>
      <View style={[styles.hero, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>
        <View style={[styles.heroTop, { flexDirection: rowDirection }]}>
          <View style={styles.heroText}>
            <Text style={[styles.eyebrow, { color: tokens.textMuted, textAlign }]}>{t.support.eyebrow}</Text>
            <Text style={[styles.title, { color: tokens.textPrimary, textAlign }]}>{t.support.title}</Text>
            <Text style={[styles.subtitle, { color: tokens.textMuted, textAlign }]}>{t.support.subtitle}</Text>
          </View>
          <View style={[styles.heroActions, { flexDirection: rowDirection }]}>
            <IconButton
              shape="round"
              size={42}
              variant="secondary"
              onPress={onRefreshTickets}
              disabled={busyTickets}
              accessibilityLabel={t.support.refresh}
              icon={busyTickets ? <ActivityIndicator size="small" color={tokens.brand} /> : <RefreshCw size={18} />}
            />
            {showStaff ? (
              <IconButton
                shape="round"
                size={42}
                variant="secondary"
                onPress={() => setStaffOpen(true)}
                accessibilityLabel={t.support.staffTickets}
                icon={<ShieldCheck size={18} />}
              />
            ) : null}
            <IconButton
              shape="round"
              size={42}
              variant="secondary"
              onPress={() => setSettingsOpen(true)}
              accessibilityLabel={t.dataTableSettings.titleConfigure}
              icon={<Settings2 size={18} />}
            />
          </View>
        </View>
        <View style={[styles.heroDivider, { backgroundColor: tokens.border }]} />

        <View style={[styles.glanceRow, { flexDirection: rowDirection }]}>
          <View style={[styles.glanceCard, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
            <Text style={[styles.glanceLabel, { color: tokens.textMuted, textAlign }]}>{t.support.openTickets}</Text>
            <Text style={[styles.glanceValue, { color: tokens.textPrimary, textAlign }]}>{openTicketsCount}</Text>
            <Text style={[styles.glanceMeta, { color: tokens.textMuted, textAlign }]}>{t.support.unresolved}</Text>
          </View>
          <View style={[styles.glanceCard, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
            <Text style={[styles.glanceLabel, { color: tokens.textMuted, textAlign }]}>{t.support.totalTickets}</Text>
            <Text style={[styles.glanceValue, { color: tokens.textPrimary, textAlign }]}>{totalTickets}</Text>
            <Text style={[styles.glanceMeta, { color: tokens.textMuted, textAlign }]}>{t.support.fromSystem}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.emptyDivider, { backgroundColor: tokens.border }]} />
    </Animated.View>
  );

  const renderItem = ({ item, index }: { item: TicketRow; index: number }) => {
    const statusColor = STATUS_COLORS[item.status] ?? tokens.textMuted;
    const priorityColor = PRIORITY_COLORS[item.priority] ?? tokens.textMuted;
    const statusLabel = (t.ticketTable.statusBadges as Record<string, string>)[item.status] ?? item.status;
    const priorityLabel = (t.ticketTable.priorityBadges as Record<string, string>)[item.priority] ?? item.priority;
    const titleCopyKey = `${item.id}:title`;

    return (
      <AnimatedTicketCard index={index}>
      <Pressable
        onPress={() => onTicketRowAction("view_ticket", item)}
        onLongPress={() => setDeleteTicketModal({ open: true, row: item, saving: false, error: "" })}
        delayLongPress={280}
        style={[styles.card, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}
      >
        <View style={[styles.cardTitleRow, { flexDirection: rowDirection }]}>
          <Text numberOfLines={2} style={[styles.cardTitle, { color: tokens.textPrimary, flex: 1, textAlign }]}>
            {item.title}
          </Text>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              void copyToClipboard(titleCopyKey, item.title);
            }}
            style={[
              styles.iconBtn,
              {
                borderColor: copiedKey === titleCopyKey ? tokens.success : tokens.border,
              },
            ]}
            accessibilityLabel={t.common.copy}
          >
            <Copy size={14} color={copiedKey === titleCopyKey ? tokens.success : tokens.textMuted} />
          </Pressable>
        </View>
        {(viewSettings.showStatus || viewSettings.showPriority) ? (
          <View style={[styles.badges, { flexDirection: rowDirection }]}>
            {viewSettings.showStatus ? (
              <View style={[styles.badge, { backgroundColor: `${statusColor}22`, flexDirection: rowDirection }]}>
                <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            ) : null}
            {viewSettings.showPriority ? (
              <View style={[styles.badge, { backgroundColor: `${priorityColor}22`, flexDirection: rowDirection }]}>
                <View style={[styles.badgeDot, { backgroundColor: priorityColor }]} />
                <Text style={[styles.badgeText, { color: priorityColor }]}>{priorityLabel}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {viewSettings.showCreatedAt ? (
          <Text style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>
            {t.ticketTable.columns.date}: {item.createdAtLabel}
          </Text>
        ) : null}
        {viewSettings.showResponseState ? (
          <Text style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>
            {item.responseStateLabel}
          </Text>
        ) : null}
      </Pressable>
      </AnimatedTicketCard>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: "transparent", direction }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LoginBackground theme={theme} />
      {HeroHeader}
      <View style={styles.content}>
        {filtered.length === 0 ? (
          <View style={styles.emptyCentered}>
            {busyTickets ? (
              <View style={styles.empty}>
                <ActivityIndicator color={tokens.brand} />
                <Text style={{ color: tokens.textMuted, marginTop: 8, textAlign }}>{t.support.loadingTickets}</Text>
              </View>
            ) : (
              <Animated.View style={centerCtaAnim.style}>
                <Animated.View style={{ transform: [{ scale: pulse }] }}>
                  {theme === "dark" ? (
                    <Pressable
                      key="support-cta-dark"
                      onPress={onOpenNewTicket}
                      style={[styles.centerCtaBtn, styles.centerCtaBtnDark]}
                      accessibilityLabel={t.support.newTicket}
                      android_ripple={{ color: "transparent" }}
                    >
                      <Image
                        source={centerCtaSourceDark}
                        style={{ width: centerCtaAssetDark.width, height: centerCtaAssetDark.height, borderRadius: 999 }}
                        resizeMode="cover"
                        fadeDuration={0}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      key="support-cta-light"
                      onPress={onOpenNewTicket}
                      style={[styles.centerCtaBtn, styles.centerCtaBtnLight]}
                      accessibilityLabel={t.support.newTicket}
                      android_ripple={{ color: "transparent" }}
                    >
                      <Image
                        source={centerCtaSourceLight}
                        style={{ width: centerCtaAssetLight.width, height: centerCtaAssetLight.height, borderRadius: 999 }}
                        resizeMode="cover"
                        fadeDuration={0}
                      />
                    </Pressable>
                  )}
                </Animated.View>
              </Animated.View>
            )}
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={(
              <View style={[styles.section, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>
                <Text style={[styles.sectionTitle, { color: tokens.textPrimary, textAlign }]}>{t.support.myTickets}</Text>
                <Text style={[styles.sectionSub, { color: tokens.textMuted, textAlign }]}>{t.support.ticketsHistory}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            refreshing={busyTickets}
            onRefresh={onRefreshTickets}
          />
        )}
      </View>
      {hasTicketRecords ? (
        <Animated.View style={[styles.fabAddWrap, rtl ? styles.fabAddWrapRtl : null, fabAnim.style]} pointerEvents="box-none">
          <IconButton
            shape="round"
            size={52}
            variant="primary"
            onPress={onOpenNewTicket}
            accessibilityLabel={t.support.newTicket}
            icon={<Plus size={20} />}
            style={styles.fabAdd}
          />
        </Animated.View>
      ) : null}
      
      <Modal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={filtersTitle}
        language={language}
        footer={(
          <Button
            variant="primary"
            onPress={() => setFiltersOpen(false)}
            label={t.common.apply}
          />
        )}
      >
        <View style={styles.modalFilters}>
          <Select
            value={statusFilter}
            options={statusOptions}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
          <Select
            value={priorityFilter}
            options={priorityOptions}
            onChange={(v) => setPriorityFilter(v as PriorityFilter)}
          />
          <View style={styles.dateFilterWrap}>
            <Text style={[styles.dateFilterLabel, { color: tokens.textSecondary }]}>
              {t.support.dateRange}
            </Text>
            <TextInput
              value={dateRangeInput}
              onChangeText={setDateRangeInput}
              placeholder={t.support.dateRangePlaceholder}
              placeholderTextColor={tokens.textMuted}
              style={[styles.dateFilterInput, { color: tokens.textPrimary, borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      </Modal>
      <SupportSettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        language={language}
        settings={viewSettings}
        onChange={setViewSettings}
      />
      <Modal
        visible={deleteTicketModal.open}
        onClose={closeDeleteTicketModal}
        title={t.support.deleteTicketTitle}
        language={language}
        footer={(
          <>
            <Button
              label={t.common.cancel}
              variant="ghost"
              onPress={closeDeleteTicketModal}
              disabled={deleteTicketModal.saving}
              icon={<X size={15} />}
            />
            <Button
              label={deleteTicketModal.saving ? t.support.deleting : t.common.delete}
              variant="danger"
              onPress={() => void confirmDeleteTicket()}
              loading={deleteTicketModal.saving}
              disabled={deleteTicketModal.saving}
              icon={<Trash2 size={15} color="#fff" />}
            />
          </>
        )}
      >
        <Text style={[styles.deleteTicketText, { color: tokens.textSecondary, textAlign }]}>
          {formatMessage(t.support.deleteTicketConfirm, { title: deleteTicketModal.row?.title ?? "" })}
        </Text>
        {deleteTicketModal.error ? (
          <Text style={[styles.deleteTicketError, { color: tokens.danger, textAlign }]}>
            {deleteTicketModal.error}
          </Text>
        ) : null}
      </Modal>

      {showStaff ? (
        <StaffTicketsModal
          visible={staffOpen}
          onClose={() => setStaffOpen(false)}
          token={token as string}
          language={language}
          onChanged={onRefreshTickets}
        />
      ) : null}

    </KeyboardAvoidingView>
  );
}
