import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Check, Pencil, Plus, Server, Trash2, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PanelText as Text } from "../ui/PanelText";
import { getThemeTokens, withAlpha } from "../../theme/colors";
import { connectionMessages } from "../../i18n/connections";
import { LoginAction, LoginField, LoginNotice, type LoginNoticeTone } from "./LoginControls";
import type { StandaloneServer } from "../../storage/standaloneServers";

export function ConnectionDrawer(p: {
  visible: boolean; dark: boolean; language: string; profiles: StandaloneServer[]; activeId?: string; editing?: string;
  name: string; url: string; busy: boolean; operation: "test" | "save" | null; notice: string; noticeTone: LoginNoticeTone;
  onName: (value: string) => void; onUrl: (value: string) => void; onClose: () => void; onEdit: (profile?: StandaloneServer) => void;
  onSelect: (profile: StandaloneServer) => void; onRemove: (profile: StandaloneServer) => void; onSave: () => void; onTest: () => void;
}) {
  const colors = getThemeTokens(p.dark), c = connectionMessages(p.language), insets = useSafeAreaInsets();
  const rtl = p.language.startsWith("ar"), row = rtl ? "row-reverse" : "row";
  const icon = (label: string, node: React.ReactNode, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    disabled={disabled} onPress={action} style={({ pressed }) => [styles.icon, { opacity: disabled ? 0.4 : pressed ? 0.55 : 1 }]}>{node}</Pressable>;
  return <Modal visible={p.visible} transparent animationType="fade" onRequestClose={p.onClose}>
    <KeyboardAvoidingView style={{ flex: 1, alignItems: rtl ? "flex-start" : "flex-end" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable accessibilityLabel={c.close} accessibilityRole="button" onPress={p.onClose} style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgOverlay }]} />
      <View style={[styles.drawer, { backgroundColor: colors.bgPrimary, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, borderColor: colors.border }]}>
        <View style={[styles.header, { flexDirection: row, borderColor: colors.border }]}>
          <View style={[styles.hero, { backgroundColor: colors.brandDim }]}><Server size={21} color={colors.brand} /></View>
          <Text accessibilityRole="header" style={{ flex: 1, fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>{c.connections}</Text>
          {icon(c.close, <X size={20} color={colors.textSecondary} />, p.onClose)}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: rtl ? "right" : "left" }}>{c.deployed}</Text>
          {p.profiles.length ? <View style={{ gap: 10 }}>
            {p.profiles.map(profile => {
              const selected = profile.id === p.activeId;
              return <View key={profile.id} style={[styles.profile, { flexDirection: row, backgroundColor: colors.bgCardSolid, borderColor: selected ? withAlpha(colors.brand, 0.5) : colors.border }]}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => p.onSelect(profile)} style={{ flex: 1, minHeight: 54, flexDirection: row, alignItems: "center", gap: 10 }}>
                  <Server size={19} color={selected ? colors.brand : colors.textMuted} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>{profile.name}</Text>
                    <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 11 }}>{profile.baseUrl.replace(/^https:\/\//i, "")}</Text>
                  </View>
                  {selected ? <Check size={16} color={colors.brand} /> : null}
                </Pressable>
                {icon(`${c.edit} ${profile.name}`, <Pencil size={17} color={colors.textSecondary} />, () => p.onEdit(profile), p.busy)}
                {icon(`${c.remove} ${profile.name}`, <Trash2 size={17} color={colors.danger} />, () => p.onRemove(profile), p.busy)}
              </View>;
            })}
          </View> : null}
          <View style={[styles.form, { backgroundColor: colors.bgCardSolid, borderColor: colors.border }]}>
            <View style={{ flexDirection: row, alignItems: "center", gap: 10 }}>
              {p.editing ? <Pencil size={18} color={colors.brand} /> : <Plus size={19} color={colors.brand} />}
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{p.editing ? c.edit : c.add}</Text>
            </View>
            <LoginField label={c.name} colors={colors} rtl={rtl} value={p.name} editable={!p.busy} onChangeText={p.onName} autoCapitalize="sentences" autoComplete="off" />
            <LoginField label={c.url} colors={colors} value={p.url} editable={!p.busy} onChangeText={p.onUrl} keyboardType="url" autoComplete="url" placeholder="panel.example.com"
              returnKeyType="go" onSubmitEditing={p.onSave} />
            <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>{c.urlHint}</Text>
            {p.notice ? <LoginNotice message={p.notice} tone={p.noticeTone} colors={colors} /> : null}
            <LoginAction label={c.test} onPress={p.onTest} colors={colors} disabled={p.busy} busy={p.operation === "test"} />
            <LoginAction label={c.save} onPress={p.onSave} colors={colors} primary disabled={p.busy} busy={p.operation === "save"} />
            {p.editing ? <LoginAction label={c.cancelEdit} onPress={() => p.onEdit()} colors={colors} disabled={p.busy} /> : null}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({
  drawer: { width: "100%", maxWidth: 460, flex: 1, borderStartWidth: 1 },
  header: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  hero: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  icon: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  profile: { borderWidth: 1, borderRadius: 16, paddingStart: 12, paddingEnd: 2, alignItems: "center", gap: 2 },
  form: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 18 },
});
