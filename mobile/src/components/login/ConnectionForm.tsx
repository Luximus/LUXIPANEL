import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Check, ChevronDown, Pencil, Server, Trash2 } from "lucide-react-native";
import { PanelText as Text } from "../ui/PanelText";
import { getThemeTokens } from "../../theme/colors";
import { connectionMessages } from "../../i18n/connections";
import { panelLoginMessages } from "../../i18n/panel-login";
import { LoginAction, LoginField, LoginNotice, type LoginNoticeTone } from "./LoginControls";
import type { StandaloneServer } from "../../storage/standaloneServers";

export type ConnectionFormProps = {
  dark: boolean; language: string; profiles: StandaloneServer[]; activeId?: string; editing?: string;
  name: string; url: string; busy: boolean; operation: "test" | "save" | null; notice: string; noticeTone: LoginNoticeTone;
  onName: (value: string) => void; onUrl: (value: string) => void; onClose: () => void;
  onEdit: (profile?: StandaloneServer) => void; onSelect: (profile: StandaloneServer) => void;
  onRemove: (profile: StandaloneServer) => void; onSave: () => void; onTest: () => void;
};

export function ConnectionSelector(p: Pick<ConnectionFormProps, "dark" | "language" | "profiles" | "activeId" | "busy" | "onSelect" | "onEdit" | "onRemove"> & { manage?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const colors = getThemeTokens(p.dark), c = connectionMessages(p.language);
  const rtl = p.language.startsWith("ar"), row = rtl ? "row-reverse" : "row";
  const selected = p.profiles.find(profile => profile.id === p.activeId);
  if (!p.profiles.length) return null;
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={c.selectServer} accessibilityState={{ expanded, disabled: p.busy }} disabled={p.busy}
      onPress={() => setExpanded(value => !value)} style={{ minHeight: 54, flexDirection: row, alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, borderColor: colors.border, backgroundColor: colors.bgSecondary, padding: 12 }}>
      <Server size={18} color={colors.brand} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 13 }}>{selected?.name ?? c.selectServer}</Text>
        {selected ? <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 11 }}>{selected.baseUrl.replace(/^https:\/\//i, "")}</Text> : null}
      </View>
      <ChevronDown size={16} color={colors.textMuted} style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }} />
    </Pressable>
    {expanded ? <View style={{ borderWidth: 1, borderRadius: 14, borderColor: colors.border, backgroundColor: colors.bgSecondary, padding: 4, gap: 4 }}>
      {p.profiles.map(profile => <View key={profile.id} style={{ flexDirection: row, alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={profile.name} accessibilityState={{ selected: profile.id === p.activeId, disabled: p.busy }} disabled={p.busy}
          onPress={() => { setExpanded(false); p.onSelect(profile); }} style={{ flex: 1, minHeight: 48, padding: 10, flexDirection: row, alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.textPrimary, fontSize: 13 }}>{profile.name}</Text>
            <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 11 }}>{profile.baseUrl.replace(/^https:\/\//i, "")}</Text></View>
          {profile.id === p.activeId ? <Check size={16} color={colors.brand} /> : null}
        </Pressable>
        {p.manage ? <>
          <Pressable accessibilityRole="button" accessibilityLabel={`${c.edit} ${profile.name}`} disabled={p.busy} onPress={() => { setExpanded(false); p.onEdit(profile); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Pencil size={17} color={colors.textSecondary} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${c.remove} ${profile.name}`} disabled={p.busy} onPress={() => p.onRemove(profile)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Trash2 size={17} color={colors.danger} /></Pressable>
        </> : null}
      </View>)}
    </View> : null}
  </View>;
}

export function ConnectionForm(p: ConnectionFormProps) {
  const colors = getThemeTokens(p.dark), c = connectionMessages(p.language), t = panelLoginMessages(p.language);
  const rtl = p.language.startsWith("ar");
  return <View testID="login-connection-form" style={{ gap: 16 }}>
    <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: rtl ? "right" : "left" }}>{c.deployed}</Text>
    <ConnectionSelector {...p} busy={p.operation !== null} manage />
    <LoginField label={c.name} colors={colors} rtl={rtl} value={p.name} editable={!p.busy} onChangeText={p.onName} autoCapitalize="sentences" autoComplete="off" />
    <LoginField label={c.url} colors={colors} value={p.url} editable={!p.busy} onChangeText={p.onUrl} keyboardType="url" autoComplete="url" placeholder="panel.example.com" returnKeyType="go" onSubmitEditing={p.onSave} />
    <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>{c.urlHint}</Text>
    {p.notice ? <LoginNotice message={p.notice} tone={p.noticeTone} colors={colors} /> : null}
    <LoginAction label={c.test} onPress={p.onTest} colors={colors} disabled={p.busy} busy={p.operation === "test"} />
    <LoginAction label={c.save} onPress={p.onSave} colors={colors} primary disabled={p.busy} busy={p.operation === "save"} />
    {p.editing ? <LoginAction label={c.cancelEdit} onPress={() => p.onEdit()} colors={colors} disabled={p.busy} /> : null}
    {p.profiles.length ? <LoginAction label={t.backToLogin} onPress={p.onClose} colors={colors} disabled={p.busy} /> : null}
  </View>;
}
