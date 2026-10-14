import React from "react";
import { Pressable, Text, View } from "react-native";
import { FormSheet } from "./ui/FormSheet";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { getLocaleTextAlign, getMessages } from "../i18n";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { styles } from "./SupportSettingsModal.styles";

export type SupportViewSettings = {
  sortBy: "newest" | "oldest" | "priority";
  showStatus: boolean;
  showPriority: boolean;
  showCreatedAt: boolean;
  showResponseState: boolean;
};

export function SupportSettingsModal({
  visible,
  onClose,
  language,
  settings,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  language: string;
  settings: SupportViewSettings;
  onChange: (next: SupportViewSettings) => void;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const textAlign = getLocaleTextAlign(language);

  return (
    <FormSheet visible={visible} onClose={onClose} title={t.dataTableSettings.titleConfigure} language={language}>
      <View style={styles.body}>
        <Text style={{ color: tokens.textPrimary, fontWeight: "800", textAlign }}>{t.support.viewSettings.heading}</Text>
        <Select
          value={settings.sortBy}
          options={[
            { value: "newest", label: t.support.viewSettings.sortNewest },
            { value: "oldest", label: t.support.viewSettings.sortOldest },
            { value: "priority", label: t.support.viewSettings.sortPriority },
          ]}
          onChange={(v) => onChange({ ...settings, sortBy: v as SupportViewSettings["sortBy"] })}
        />
        <ToggleRow
          label={t.support.viewSettings.showStatus}
          value={settings.showStatus}
          onToggle={() => onChange({ ...settings, showStatus: !settings.showStatus })}
          color={tokens.textPrimary}
          textAlign={textAlign}
        />
        <ToggleRow
          label={t.support.viewSettings.showPriority}
          value={settings.showPriority}
          onToggle={() => onChange({ ...settings, showPriority: !settings.showPriority })}
          color={tokens.textPrimary}
          textAlign={textAlign}
        />
        <ToggleRow
          label={t.support.viewSettings.showCreatedAt}
          value={settings.showCreatedAt}
          onToggle={() => onChange({ ...settings, showCreatedAt: !settings.showCreatedAt })}
          color={tokens.textPrimary}
          textAlign={textAlign}
        />
        <ToggleRow
          label={t.support.viewSettings.showResponseState}
          value={settings.showResponseState}
          onToggle={() => onChange({ ...settings, showResponseState: !settings.showResponseState })}
          color={tokens.textPrimary}
          textAlign={textAlign}
        />
        <Button
          variant="primary"
          onPress={onClose}
          label={t.dataTableSettings.closeButton}
          style={{ alignSelf: "stretch", marginTop: 2 }}
        />
      </View>
    </FormSheet>
  );
}

function ToggleRow({ label, value, onToggle, color, textAlign }: { label: string; value: boolean; onToggle: () => void; color: string; textAlign: "left" | "right" }) {
  return (
    <Pressable style={styles.toggleRow} onPress={onToggle}>
      <Text style={{ flex: 1, color, textAlign }}>{label}</Text>
      <View style={[styles.pill, value ? styles.pillOn : styles.pillOff]}>
        <Text style={styles.pillLabel}>{value ? "ON" : "OFF"}</Text>
      </View>
    </Pressable>
  );
}


