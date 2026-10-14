import { nativeText } from '../../i18n/native-text';
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react-native";
import { ScopedNativeModal } from "../../screens/main/native-module-context";
import { PanelText as Text } from "../ui/PanelText";
import { Select } from "../ui/Select";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getMessages } from "../../i18n";
import { Checkbox } from "./server-table-cells";

/** The web wrench opens this column/order dialog, independently of module settings. */
export function TableColumnDialog({ visible, onClose, language, columns, hidden, onToggle, onMove, pageSize, pageSizes, onPageSize }: {
  visible: boolean; onClose: () => void; language: string;
  columns: { id: string; header: string; hideable?: boolean }[];
  hidden: Set<string>; onToggle: (id: string) => void; onMove: (id: string, direction: -1 | 1) => void;
  pageSize: number; pageSizes: number[]; onPageSize: (value: string) => void;
}) {
  const tokens = getThemeTokens(useTheme().theme === "dark");
  const es = language.startsWith("es"), t = getMessages(language);
  if (!visible) return null;
  return <ScopedNativeModal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <View style={[styles.overlay, { backgroundColor: tokens.bgOverlay }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t.common.close} />
      <View testID="table-column-dialog" accessibilityViewIsModal style={[styles.card, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
        <View style={[styles.header, { borderBottomColor: tokens.border }]}>
          <Text style={{ color: tokens.textPrimary, fontSize: 16, fontWeight: "600", flex: 1 }}>{t.serverTable.configureTitle}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.common.close} onPress={onClose} style={styles.close}><X size={18} color={tokens.textMuted} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}>
          <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "500" }}>{es ? nativeText("Columnas y orden") : nativeText("Columns and order")}</Text>
          {columns.map((col, index) => <View key={col.id} style={[styles.row, { backgroundColor: tokens.bgPrimary, borderColor: tokens.border }]}>
            <GripVertical size={14} color={tokens.textMuted} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Checkbox on={!hidden.has(col.id)} onPress={() => { if (col.hideable !== false) onToggle(col.id); }} tokens={tokens} />
              <Pressable disabled={col.hideable === false} onPress={() => onToggle(col.id)} style={{ flex: 1 }}><Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{col.header}</Text></Pressable>
            </View>
            {([-1, 1] as const).map(direction => {
              const disabled = direction < 0 ? index === 0 : index === columns.length - 1;
              const Icon = direction < 0 ? ArrowUp : ArrowDown;
              return <Pressable key={direction} accessibilityRole="button" accessibilityLabel={`${nativeText(direction < 0 ? "Subir" : "Bajar", undefined, language)} ${col.header}`} disabled={disabled} onPress={() => onMove(col.id, direction)} style={[styles.move, { borderColor: tokens.border, opacity: disabled ? 0.35 : 1 }]}><Icon size={13} color={tokens.textSecondary} /></Pressable>;
            })}
          </View>)}
          <Text style={{ color: tokens.textPrimary, fontSize: 13, marginTop: 4 }}>{es ? nativeText("Resultados por página") : nativeText("Results per page")}</Text>
          <Select value={String(pageSize)} options={pageSizes.map(size => ({ value: String(size), label: String(size) }))} onChange={onPageSize} accessibilityLabel={t.serverTable.perPage} />
        </ScrollView>
      </View>
    </View>
  </ScopedNativeModal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  card: { width: "100%", maxWidth: 672, maxHeight: "85%", borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1 },
  close: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  row: { minHeight: 58, padding: 8, borderWidth: 1, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  move: { width: 28, height: 30, justifyContent: "center", alignItems: "center", borderWidth: 1, borderRadius: 4 },
});
