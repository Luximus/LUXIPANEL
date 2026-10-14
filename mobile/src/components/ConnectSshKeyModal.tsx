import React from "react";
import { Pressable, Text, View } from "react-native";
import type { SshKeySummary } from "../api/client";
import { getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { FormSheet } from "./ui/FormSheet";
import { Button } from "./ui/Button";
import { styles } from "./ConnectSshKeyModal.styles";

export function ConnectSshKeyModal({
  open,
  onClose,
  onConfirm,
  keys,
  selectedKeyId,
  setSelectedKeyId,
  language,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  keys: SshKeySummary[];
  selectedKeyId: string;
  setSelectedKeyId: (next: string) => void;
  language?: string;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  // Selección obligatoria: si no hay llave elegida, resalta la lista en rojo.
  const [invalid, setInvalid] = React.useState(false);

  React.useEffect(() => {
    if (!open) setInvalid(false);
  }, [open]);

  const handleConfirm = () => {
    if (!selectedKeyId) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onConfirm();
  };

  return (
    <FormSheet
      visible={open}
      onClose={onClose}
      title={t.panelEditor.panelKeysLabel}
      language={language}
      footer={(
        <>
          <Button label={t.common.cancel} variant="ghost" onPress={onClose} />
          <Button label={t.panelTable.actions.connect} variant="primary" onPress={handleConfirm} />
        </>
      )}
    >
      <Text style={[styles.hint, { color: tokens.textMuted }]}>
        {t.panelEditor.panelKeysHint}
      </Text>
      <View style={[styles.list, { borderColor: invalid ? tokens.danger : tokens.border, backgroundColor: tokens.bgInput }]}>
        {keys.map((key) => {
          const selected = selectedKeyId === key.id;
          return (
            <Pressable
              key={key.id}
              onPress={() => { setInvalid(false); setSelectedKeyId(key.id); }}
              style={[
                styles.row,
                { borderColor: tokens.border },
                selected ? { backgroundColor: tokens.brandDim } : null,
              ]}
            >
              <View style={[styles.radio, { borderColor: tokens.border, backgroundColor: selected ? tokens.brand : "transparent" }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.primary, { color: tokens.textPrimary }]}>
                  {key.linuxUsername || t.panelEditor.noSshUser}
                </Text>
                {key.fingerprint ? (
                  <Text style={[styles.secondary, { color: tokens.textMuted }]}>{key.fingerprint}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {invalid ? (
        <Text style={[styles.error, { color: tokens.danger }]}>{t.errors.selectSshKey}</Text>
      ) : null}
    </FormSheet>
  );
}
