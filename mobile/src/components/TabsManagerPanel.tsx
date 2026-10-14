import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Pencil, Plus, Server, X } from "lucide-react-native";
import type { AppTab } from "../features/app/types";
import { useInlineEditCancel } from "../hooks/useInlineEditCancel";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";

function localizeAutoLabel(t: ReturnType<typeof getMessages>, autoLabel: string): string {
  if (autoLabel === "Servers") return t.titleBar.fabServers;
  if (autoLabel === "Support") return t.titleBar.fabSupport;
  if (autoLabel === "Security") return t.titleBar.fabSecurity;
  return autoLabel;
}

/**
 * Panel "Pestañas" del drawer derecho (reemplaza al antiguo modal de pestañas del
 * navbar). Lista cada pestaña como una FILA con formato de botón: icono/logo de
 * servidor + título + botón editar (renombrar inline) + botón cerrar. Incluye un
 * botón "Nueva pestaña". La pestaña fija "Servers" SÍ se puede renombrar pero NO
 * se puede cerrar (no muestra el botón cerrar). Seleccionar una fila la activa y
 * cierra el drawer (`onAfterSelect`).
 */
export function TabsManagerPanel({
  language,
  tabs,
  activeTabId,
  onSelectTab,
  onSelectServers,
  onCloseTab,
  onRenameTab,
  onOpenNewTab,
  canOpenNewTab,
  onAfterSelect,
}: {
  language: string;
  tabs: AppTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onSelectServers: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onRenameTab: (tabId: string, label: string) => void;
  onOpenNewTab: () => void;
  canOpenNewTab: boolean;
  /** Cierra el drawer tras seleccionar una pestaña (para ver el destino). */
  onAfterSelect: () => void;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  // Rename inline en curso: atrás de Android u ocultar el teclado lo cancelan
  // (descartan el borrador) en vez de cerrar el drawer.
  useInlineEditCancel(editingTabId !== null, () => setEditingTabId(null));

  // Etiquetas con deduplicado: la 1ª "backend" queda "backend"; las siguientes
  // con el mismo nombre quedan "backend (1)", "backend (2)"… Cada pestaña (incluida
  // la fija) usa su `customLabel` si la editaron, o su `autoLabel` (nombre del panel
  // si entró/inició conversación, "Servers" si no). Espejo del modal de pestañas.
  const tabDisplayLabels = (() => {
    const counts = new Map<string, number>();
    const labels = new Map<string, string>();
    for (const tab of tabs) {
      const base = tab.customLabel?.trim() || localizeAutoLabel(t, tab.autoLabel);
      const seen = counts.get(base) ?? 0;
      counts.set(base, seen + 1);
      labels.set(tab.id, seen === 0 ? base : `${base} (${seen})`);
    }
    return labels;
  })();

  const selectTab = (tab: AppTab) => {
    if (tab.fixed) onSelectServers(tab.id);
    else onSelectTab(tab.id);
    onAfterSelect();
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {tabs.map((tab) => {
        const baseLabel = tab.customLabel?.trim() || localizeAutoLabel(t, tab.autoLabel);
        const label = tabDisplayLabels.get(tab.id) ?? baseLabel;
        const isActive = activeTabId === tab.id;
        const isEditing = editingTabId === tab.id;
        const canClose = !tab.fixed && tabs.length > 1;
        return (
          <View
            key={tab.id}
            style={[
              styles.row,
              {
                flexDirection: rowDirection,
                borderColor: isActive ? tokens.brand : tokens.border,
                backgroundColor: isActive ? tokens.brandDim : tokens.bgCardSolid,
              },
            ]}
          >
            <Pressable
              style={[styles.rowMain, { flexDirection: rowDirection }]}
              onPress={() => selectTab(tab)}
              accessibilityLabel={label}
            >
              <View style={[styles.iconWrap, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}>
                <Server size={16} color={isActive ? tokens.brand : tokens.textSecondary} />
              </View>
              {isEditing ? (
                <TextInput
                  value={draftLabel}
                  autoFocus
                  selectTextOnFocus
                  onChangeText={setDraftLabel}
                  onBlur={() => { onRenameTab(tab.id, draftLabel); setEditingTabId(null); }}
                  onSubmitEditing={() => { onRenameTab(tab.id, draftLabel); setEditingTabId(null); }}
                  style={[styles.input, { borderColor: tokens.borderStrong, color: tokens.textPrimary, backgroundColor: tokens.bgInput, textAlign }]}
                />
              ) : (
                <Text
                  numberOfLines={1}
                  style={[styles.label, { color: isActive ? tokens.textPrimary : tokens.textSecondary, textAlign }]}
                >
                  {label}
                </Text>
              )}
            </Pressable>

            {/* Editar (renombrar inline): disponible también en la pestaña fija. */}
            <Pressable
              hitSlop={6}
              onPress={() => {
                if (isEditing) { onRenameTab(tab.id, draftLabel); setEditingTabId(null); return; }
                setEditingTabId(tab.id);
                setDraftLabel(baseLabel);
              }}
              accessibilityLabel={t.common.edit}
              style={[styles.iconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgSecondary }]}
            >
              <Pencil size={15} color={tokens.textMuted} />
            </Pressable>
            {canClose ? (
              <Pressable
                hitSlop={6}
                onPress={() => onCloseTab(tab.id)}
                accessibilityLabel={t.titleBar.close}
                style={[styles.iconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgSecondary }]}
              >
                <X size={15} color={tokens.textMuted} />
              </Pressable>
            ) : null}
          </View>
        );
      })}

      </ScrollView>

      {/* "Nueva conexión" FIJO al fondo del tab (no hace scroll con la lista). El
          drawer ya reserva el safe-area inferior (paddingBottom: insets.bottom),
          así que el botón queda por encima de la barra de botones de Android. */}
      {canOpenNewTab ? (
        <View style={[styles.footer, { borderTopColor: tokens.border, backgroundColor: tokens.bgPrimary }]}>
          <Pressable
            onPress={onOpenNewTab}
            accessibilityLabel={t.titleBar.newTab}
            style={[styles.newTabBtn, { flexDirection: rowDirection, backgroundColor: tokens.brand }]}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={styles.newTabLabel}>{t.titleBar.newTab}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default TabsManagerPanel;

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 12, gap: 8 },
  // Footer fijo con el botón "Nueva conexión" (no hace scroll con la lista).
  footer: { padding: 12, paddingTop: 10, borderTopWidth: 1 },
  row: {
    alignItems: "center",
    gap: 8,
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  rowMain: { flex: 1, alignItems: "center", gap: 10, height: "100%" },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, fontSize: 15, fontWeight: "700" },
  input: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: "600",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  newTabBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 12,
  },
  newTabLabel: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
});
