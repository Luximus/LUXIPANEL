/**
 * admin-shared — helpers y componentes compartidos por las secciones de
 * AdminScreen (Usuarios/Roles/Productos/Módulos), extraídos sin cambio de
 * comportamiento: shell de sección, tarjeta, badge, icono de acción, modal de
 * confirmación, etiqueta de campo, fila de toggle y caja de error.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from "react-native";
import { Search, Plus } from "lucide-react-native";
import { styles } from "./AdminScreen.styles";
import { getMessages, getLocaleTextAlign } from "../i18n";
import { getThemeTokens } from "../theme/colors";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";

export type ThemeTokens = ReturnType<typeof getThemeTokens>;

// ── Helpers compartidos ──────────────────────────────────────────────────────

export function useListLoader<T>(load: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setItems(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { items, setItems, busy, error, setError, refresh };
}

export function SectionShell({
  tokens,
  language,
  busy,
  error,
  empty,
  emptyLabel,
  retryLabel,
  onRetry,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onNew,
  children,
}: {
  tokens: ThemeTokens;
  language: string;
  busy: boolean;
  error: string;
  empty: boolean;
  emptyLabel: string;
  retryLabel: string;
  onRetry: () => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  onNew?: () => void;
  children: React.ReactNode;
}) {
  const textAlign = getLocaleTextAlign(language);
  return (
    <View style={styles.sectionRoot}>
      <View style={[styles.searchRow]}>
        <View style={[styles.searchWrap, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
          <Search size={15} color={tokens.textMuted} />
          <TextInput
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
            placeholderTextColor={tokens.textMuted}
            autoCapitalize="none"
            style={[styles.searchInput, { color: tokens.textPrimary, textAlign }]}
          />
        </View>
        {onNew ? (
          <Pressable onPress={onNew} style={[styles.newBtn, { backgroundColor: tokens.brand }]} accessibilityLabel="+">
            <Plus size={20} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      {busy ? (
        <View style={styles.center}><ActivityIndicator color={tokens.brand} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: tokens.danger, textAlign, marginBottom: 10 }}>{error}</Text>
          <Button variant="primary" label={retryLabel} onPress={onRetry} />
        </View>
      ) : empty ? (
        <View style={styles.center}><Text style={{ color: tokens.textMuted, textAlign }}>{emptyLabel}</Text></View>
      ) : (
        children
      )}
    </View>
  );
}

export function Card({ tokens, children }: { tokens: ThemeTokens; children: React.ReactNode }) {
  return <View style={[styles.card, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>{children}</View>;
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function ActionIcon({
  icon,
  color,
  onPress,
}: {
  icon: React.ReactElement<{ size?: number; color?: string }>;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.actionIcon}>
      {React.cloneElement(icon, { size: 17, color })}
    </Pressable>
  );
}

export function ConfirmModal({
  state,
  language,
  tokens,
  onCancel,
  onConfirm,
}: {
  state: { open: boolean; title: string; message: string; busy: boolean };
  language: string;
  tokens: ThemeTokens;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = getMessages(language).admin;
  return (
    <Modal
      visible={state.open}
      onClose={onCancel}
      title={state.title}
      language={language}
      footer={
        <>
          <Button label={t.cancel} variant="ghost" onPress={onCancel} disabled={state.busy} />
          <Button label={t.delete} variant="danger" onPress={onConfirm} loading={state.busy} disabled={state.busy} />
        </>
      }
    >
      <Text style={{ color: tokens.textSecondary, fontSize: 14, lineHeight: 21 }}>{state.message}</Text>
    </Modal>
  );
}

export function FieldLabel({ tokens, language, children }: { tokens: ThemeTokens; language: string; children: string }) {
  return (
    <Text style={[styles.fieldLabel, { color: tokens.textMuted, textAlign: getLocaleTextAlign(language) }]}>{children}</Text>
  );
}

export function ToggleRow({
  tokens,
  language,
  label,
  value,
  onValueChange,
  disabled,
}: {
  tokens: ThemeTokens;
  language: string;
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: tokens.textPrimary, textAlign: getLocaleTextAlign(language), flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: tokens.brand, false: tokens.border }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

export function FormError({ tokens, message }: { tokens: ThemeTokens; message: string }) {
  return (
    <View style={[styles.errorBox, { borderColor: tokens.danger, backgroundColor: tokens.bgSecondary }]}>
      <Text style={{ color: tokens.danger, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

