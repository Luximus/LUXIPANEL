import React from "react";
import { Pressable, Text, View } from "react-native";
import { KeyRound, Link as LinkIcon } from "lucide-react-native";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { FormSheet } from "./ui/FormSheet";
import { Button } from "./ui/Button";
import { styles } from "./ConnectMethodModal.styles";

export type ConnectMethodState = {
  open: boolean;
  panelId: string | null;
  panelName: string;
  hasSavedSsh: boolean;
};

/**
 * Drawer de formularios "¿cómo conectar?" — réplica del de desktop/frontend. Siempre que el
 * panel tenga SSH guardada se ofrece elegir entre usar esas credenciales o
 * ingresar usuario + llave local manual. Si hay >1 SSH asignada, tras elegir
 * "guardada" el host abre el selector de cuenta (ConnectSshKeyModal).
 */
export function ConnectMethodModal({
  state,
  onClose,
  onUseSaved,
  onUseLocalKey,
  language,
}: {
  state: ConnectMethodState;
  onClose: () => void;
  onUseSaved: () => void;
  onUseLocalKey: () => void;
  language?: string;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const title = state.panelName
    ? `${t.panelTable.actions.connect} · ${state.panelName}`
    : t.panelTable.actions.connect;

  return (
    <FormSheet
      visible={state.open}
      onClose={onClose}
      title={title}
      language={language}
      footer={<Button label={t.common.cancel} variant="ghost" onPress={onClose} />}
    >
      <Text style={[styles.desc, { color: tokens.textMuted, textAlign }]}>
        {t.connectMethod.description}
      </Text>

      {state.hasSavedSsh ? (
        <Pressable
          onPress={onUseSaved}
          style={[styles.option, { borderColor: tokens.border, backgroundColor: tokens.bgInput, flexDirection: rowDirection }]}
        >
          <View style={[styles.optionIcon, { backgroundColor: tokens.brandDim }]}>
            <LinkIcon size={18} color={tokens.brand} />
          </View>
          <View style={styles.optionBody}>
            <Text style={[styles.optionTitle, { color: tokens.textPrimary, textAlign }]}>{t.connectMethod.savedTitle}</Text>
            <Text style={[styles.optionSub, { color: tokens.textMuted, textAlign }]}>
              {t.connectMethod.savedSub}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onUseLocalKey}
        style={[styles.option, { borderColor: tokens.border, backgroundColor: tokens.bgInput, flexDirection: rowDirection }]}
      >
        <View style={[styles.optionIcon, { backgroundColor: tokens.brandDim }]}>
          <KeyRound size={18} color={tokens.brand} />
        </View>
        <View style={styles.optionBody}>
          <Text style={[styles.optionTitle, { color: tokens.textPrimary, textAlign }]}>{t.connectMethod.localTitle}</Text>
          <Text style={[styles.optionSub, { color: tokens.textMuted, textAlign }]}>
            {t.connectMethod.localSub}
          </Text>
        </View>
      </Pressable>
    </FormSheet>
  );
}

export default ConnectMethodModal;
