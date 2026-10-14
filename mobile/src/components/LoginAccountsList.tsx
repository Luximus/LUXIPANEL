import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import { styles } from "./LoginAccountsList.styles";
import type { AccountProvider, SavedAccount } from "../storage/savedAccounts";
import { getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { Avatar } from "./ui/Avatar";
import { ProviderBadge } from "./ui/ProviderBadge";

export function LoginAccountsList({
  accounts,
  loading,
  language,
  onSelect,
  onRemove,
  onReorder,
  addProviders,
  onAddProvider,
  compact = false,
  variant = "full",
  expanded: expandedProp,
  onToggleExpanded,
}: {
  accounts: SavedAccount[];
  loading: boolean;
  language?: string;
  onSelect: (account: SavedAccount) => void;
  onRemove: (email: string) => void;
  onReorder: (emailsInOrder: string[]) => void;
  /** "Add account" buttons rendered inside the selector, one per provider. */
  addProviders?: AccountProvider[];
  onAddProvider?: (provider: AccountProvider) => void;
  compact?: boolean;
  /** "full" = trigger + dropdown juntos (default). "trigger" = solo la cabecera
   *  (para ponerla en una fila estrecha). "panel" = solo el desplegable (para
   *  renderizarlo a ancho completo aparte). En trigger/panel el estado de abierto
   *  lo controla el padre via `expanded`/`onToggleExpanded`. */
  variant?: "full" | "trigger" | "panel";
  expanded?: boolean;
  onToggleExpanded?: () => void;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  const hasAccounts = accounts.length > 0;
  const providers = addProviders ?? [];
  const canAdd = providers.length > 0 && !!onAddProvider;
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = expandedProp !== undefined ? expandedProp : internalExpanded;
  const toggleExpanded = onToggleExpanded ?? (() => setInternalExpanded((value) => !value));

  if (!hasAccounts && !canAdd) return null;

  const addLabel = (provider: AccountProvider): string => {
    switch (provider) {
      case "apple": return t.login.appleAddAccount;
      case "github": return t.login.githubAddAccount;
      case "microsoft": return t.login.microsoftAddAccount;
      default: return t.login.googleAddAccount;
    }
  };

  const previewAccounts = accounts.slice(0, 4);
  const extraCount = Math.max(0, accounts.length - previewAccounts.length);

  const moveAccount = (email: string, direction: -1 | 1) => {
    const order = accounts.map((entry) => entry.email);
    const idx = order.indexOf(email);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    onReorder(order);
  };

  if (compact) {
    return (
      <View style={[styles.compactList, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={accounts.length > 2}
          contentContainerStyle={styles.compactContent}
        >
          {accounts.map((account, idx) => (
            <View
              key={account.email}
              style={[
                styles.compactRow,
                idx > 0 && { borderTopWidth: 1, borderTopColor: tokens.border },
              ]}
            >
              <ProviderBadge provider={account.provider} size={16} borderColor={tokens.border} />
              <Avatar
                photoURL={account.photoURL}
                displayName={account.displayName || account.email}
                size={28}
              />
              <Pressable
                disabled={loading}
                onPress={() => onSelect(account)}
                style={styles.compactLabels}
              >
                <Text numberOfLines={1} style={[styles.compactName, { color: tokens.textPrimary }]}>
                  {account.displayName || account.email.split("@")[0]}
                </Text>
                <Text numberOfLines={1} style={[styles.compactEmail, { color: tokens.textMuted }]}>
                  {account.email}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onRemove(account.email)}
                accessibilityLabel={t.login.removeAccountAria}
                style={styles.compactRemoveBtn}
              >
                <Trash2 size={14} color={tokens.danger} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {variant !== "panel" ? (
      <Pressable
        disabled={loading}
        onPress={toggleExpanded}
        style={[
          styles.header,
          { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border },
        ]}
      >
        {hasAccounts ? (
          <View style={styles.previewRow}>
            {previewAccounts.map((account, idx) => (
              <View key={account.email} style={[styles.avatarOverlap, { marginLeft: idx === 0 ? 0 : -10 }]}>
                <Avatar photoURL={account.photoURL} displayName={account.displayName || account.email} size={32} />
              </View>
            ))}
            {extraCount > 0 ? (
              <View
                style={[
                  styles.extraBadge,
                  {
                    backgroundColor: tokens.bgSecondary,
                    borderColor: tokens.border,
                  },
                ]}
              >
                <Text style={{ color: tokens.textPrimary, fontWeight: "800", fontSize: 11 }}>
                  +{extraCount}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.addIconWrap, styles.headerAddIcon, { backgroundColor: tokens.brand }]}>
            <Plus size={16} color="#ffffff" />
          </View>
        )}
        <View style={styles.headerLabels}>
          <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
            {hasAccounts ? t.login.savedAccounts : t.login.addAccount}
          </Text>
          {hasAccounts ? (
            <Text style={[styles.headerCount, { color: tokens.textMuted }]}>
              {accounts.length}{" "}
              {accounts.length === 1
                ? t.login.accountsAvailableOne
                : t.login.accountsAvailableMany}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.chevron, { color: tokens.textMuted }]}>{expanded ? "▴" : "▾"}</Text>
      </Pressable>
      ) : null}

      {expanded && variant !== "trigger" ? (
        <View
          style={[
            styles.list,
            { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border },
          ]}
        >
          {canAdd ? (
            <View style={[styles.addRow, accounts.length > 0 && { borderBottomWidth: 1, borderBottomColor: tokens.border }]}>
              {providers.map((provider) => (
                <Pressable
                  key={provider}
                  disabled={loading}
                  onPress={() => onAddProvider?.(provider)}
                  accessibilityLabel={addLabel(provider)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.addIconBtn,
                    { borderColor: tokens.border, backgroundColor: tokens.bgSecondary },
                    pressed ? { opacity: 0.6 } : null,
                  ]}
                >
                  <ProviderBadge provider={provider} size={26} borderColor={tokens.border} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {accounts.map((account, idx) => (
            <View
              key={account.email}
              style={[
                styles.row,
                idx > 0 && { borderTopWidth: 1, borderTopColor: tokens.border },
              ]}
            >
              <View style={styles.reorderCol}>
                <Pressable
                  onPress={() => moveAccount(account.email, -1)}
                  hitSlop={6}
                  disabled={idx === 0}
                  style={{ opacity: idx === 0 ? 0.3 : 1 }}
                >
                  <Text style={[styles.reorderIcon, { color: tokens.textMuted }]}>▴</Text>
                </Pressable>
                <Pressable
                  onPress={() => moveAccount(account.email, 1)}
                  hitSlop={6}
                  disabled={idx === accounts.length - 1}
                  style={{ opacity: idx === accounts.length - 1 ? 0.3 : 1 }}
                >
                  <Text style={[styles.reorderIcon, { color: tokens.textMuted }]}>▾</Text>
                </Pressable>
              </View>
              <ProviderBadge provider={account.provider} size={18} borderColor={tokens.border} />
              <Avatar
                photoURL={account.photoURL}
                displayName={account.displayName || account.email}
                size={36}
              />
              <Pressable
                disabled={loading}
                onPress={() => onSelect(account)}
                style={styles.rowLabels}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.rowName, { color: tokens.textPrimary }]}
                >
                  {account.displayName || account.email.split("@")[0]}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.rowEmail, { color: tokens.textMuted }]}
                >
                  {account.email}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onRemove(account.email)}
                accessibilityLabel={t.login.removeAccountAria}
                style={[styles.removeBtn, { borderColor: tokens.border }]}
              >
                <Trash2 size={16} color={tokens.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

