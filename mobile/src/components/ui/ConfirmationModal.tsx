import { localizeServerError } from '../../lib/server-error-localization';
import { nativeText, translatedInterfaceText } from '../../i18n/native-text';
import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ShieldCheck, Trash2, X } from "lucide-react-native";
import { ScopedNativeModal } from "../../screens/main/native-module-context";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../theme/colors";
import { getLocaleDirection, getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";
import { PanelText as Text } from "./PanelText";
import { Button } from "./Button";

export type ConfirmationModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  language?: string;
  danger?: boolean;
  submitting?: boolean;
  error?: string;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/** A topmost confirmation keeps its parent drawer, form and draft mounted. */
export function ConfirmationModal({ visible, title, message, confirmLabel, cancelLabel, language = loadSessionState().language,
  danger = true, submitting = false, error, children, onConfirm, onCancel }: ConfirmationModalProps) {
  const tokens = getThemeTokens(useTheme().theme === "dark");
  const accent = danger ? tokens.danger : tokens.brand;
  const Icon = danger ? Trash2 : ShieldCheck;
  const textAlign = getLocaleTextAlign(language);
  const pending = useRef(false);
  const [waiting, setWaiting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => { setLocalError(null); }, [visible, title, message]);
  const busy = submitting || waiting;
  const shownError = error || localError;
  const submit = async () => {
    if (pending.current || submitting) return;
    pending.current = true; setWaiting(true); setLocalError(null);
    try { await onConfirm(); }
    catch (cause) { setLocalError(cause instanceof Error ? cause.message : getMessages(language).common.error); }
    finally { pending.current = false; setWaiting(false); }
  };
  const close = () => { if (!pending.current && !busy) onCancel(); };
  return <ScopedNativeModal visible={visible} transparent animationType="fade" layer="confirmation" onRequestClose={close}>
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[s.overlay, { backgroundColor: tokens.bgOverlay }]}>
        <Pressable testID="confirmation-backdrop" style={StyleSheet.absoluteFill} onPress={(event) => { event.stopPropagation(); close(); }}
          disabled={busy} accessible={false} />
        <View testID="confirmation-card" accessibilityViewIsModal style={[s.card, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border, direction: getLocaleDirection(language) }]}>
          <View style={[s.accent, { backgroundColor: accent }]} />
          <View style={[s.header, { flexDirection: getLocaleRowDirection(language) }]}>
            <View style={[s.icon, { backgroundColor: withAlpha(accent, 0.12), borderColor: withAlpha(accent, 0.22) }]}>
              <Icon size={25} color={accent} />
            </View>
            <Pressable testID="confirmation-close" accessibilityRole="button" accessibilityLabel={getMessages(language).common.close}
              accessibilityState={{ disabled: busy }} disabled={busy} onPress={(event) => { event.stopPropagation(); close(); }}
              style={[s.close, { backgroundColor: tokens.bgSecondary, opacity: busy ? 0.4 : 1 }]}>
              <X size={19} color={tokens.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={s.scroll} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={[s.title, { color: tokens.textPrimary, textAlign }]}>{nativeText(title, undefined, language)}</Text>
            {!!message && <Text style={[s.message, { color: tokens.textSecondary, textAlign }]}>{translatedInterfaceText(message, language) ?? message}</Text>}
            {children}
            {!!shownError && <View style={[s.error, { backgroundColor: withAlpha(tokens.danger, 0.1), borderColor: withAlpha(tokens.danger, 0.2) }]}>
              <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[s.message, { color: tokens.danger, textAlign }]}>{localizeServerError(shownError, language)}</Text>
            </View>}
          </ScrollView>
          <View style={[s.footer, { borderTopColor: tokens.border, flexDirection: getLocaleRowDirection(language) }]}>
            <Button label={nativeText(cancelLabel, undefined, language)} variant="secondary" disabled={busy} onPress={close} style={s.button} />
            <Button label={nativeText(confirmLabel, undefined, language)} variant={danger ? "danger" : "primary"} loading={busy}
              onPress={() => void submit()} icon={<Icon size={17} />} style={s.button} />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  </ScopedNativeModal>;
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 440, maxHeight: "90%", borderWidth: 1, borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 18 },
  accent: { height: 3 },
  header: { padding: 22, paddingBottom: 16, alignItems: "flex-start", justifyContent: "space-between" },
  icon: { width: 54, height: 54, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  close: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: 22, paddingBottom: 24, gap: 14 },
  title: { fontSize: 21, lineHeight: 28, fontWeight: "700" },
  message: { fontSize: 14, lineHeight: 22 },
  footer: { borderTopWidth: 1, padding: 18, gap: 10 },
  button: { flex: 1, minHeight: 48, borderRadius: 14 },
  error: { borderWidth: 1, padding: 12, borderRadius: 12 },
});
