import { localizeServerError } from '../lib/server-error-localization';
import React from "react";
import { Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import type { ConnectLocalKeyState } from "../features/app/viewModels";
import { formatMessage, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { FormSheet } from "./ui/FormSheet";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { styles } from "./ConnectLocalKeyModal.styles";

const MAX_KEY_BYTES = 32 * 1024;

export function ConnectLocalKeyModal({
  state,
  setState,
  close,
  submit,
  language,
}: {
  state: ConnectLocalKeyState;
  setState: React.Dispatch<React.SetStateAction<ConnectLocalKeyState>>;
  close: () => void;
  submit: () => void;
  language?: string;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  const usernameRef = React.useRef<TextInput>(null);
  const privateKeyRef = React.useRef<TextInput>(null);
  const [invalidField, setInvalidField] = React.useState<"username" | "privateKey" | null>(null);

  function patch(values: Partial<ConnectLocalKeyState>) {
    setState((current) => ({ ...current, ...values }));
  }

  // Valida obligatorios y enfoca el primero que falte (usuario primero).
  function onSubmit() {
    if (!state.username.trim()) {
      setInvalidField("username");
      patch({ error: t.connectLocalKey.usernameRequired });
      usernameRef.current?.focus();
      return;
    }
    if (!state.privateKey.trim()) {
      setInvalidField("privateKey");
      patch({ error: t.connectLocalKey.privateKeyRequired });
      privateKeyRef.current?.focus();
      return;
    }
    setInvalidField(null);
    submit();
  }

  async function pickFromDevice() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        // Do NOT keep a copy in the app cache: the key must not be stored.
        copyToCacheDirectory: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (typeof asset.size === "number" && asset.size > MAX_KEY_BYTES) {
        patch({ error: t.connectLocalKey.fileTooLarge });
        return;
      }
      const text = await FileSystem.readAsStringAsync(asset.uri);
      patch({ privateKey: text.trim(), error: "" });
    } catch {
      patch({ error: t.connectLocalKey.fileReadFailed });
    }
  }

  return (
    <FormSheet
      visible={state.open}
      onClose={close}
      title={t.connectLocalKey.title}
      language={language}
      footer={(
        <>
          <Button label={t.common.cancel} variant="ghost" onPress={close} disabled={state.busy} />
          <Button
            label={state.busy ? t.connectLocalKey.connecting : t.connectLocalKey.connect}
            variant="primary"
            onPress={onSubmit}
            disabled={state.busy}
          />
        </>
      )}
    >
      <View style={styles.container}>
        <Text style={[styles.hint, { color: tokens.textMuted }]}>
          {formatMessage(t.connectLocalKey.hint, {
            panelName: state.panelName ? formatMessage(t.connectLocalKey.hintWith, { panelName: state.panelName }) : "",
          })}
        </Text>

        <Input
          ref={usernameRef}
          label={t.connectLocalKey.sshUserLabel}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t.connectLocalKey.sshUserPlaceholder}
          value={state.username}
          editable={!state.busy}
          error={invalidField === "username" ? " " : undefined}
          onChangeText={(value) => {
            if (invalidField === "username") setInvalidField(null);
            patch({ username: value.trim() });
          }}
        />

        <Input
          ref={privateKeyRef}
          label={t.connectLocalKey.privateKeyLabel}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t.connectLocalKey.privateKeyPlaceholder}
          value={state.privateKey}
          editable={!state.busy}
          error={invalidField === "privateKey" ? " " : undefined}
          onChangeText={(value) => {
            if (invalidField === "privateKey") setInvalidField(null);
            patch({ privateKey: value });
          }}
          style={styles.keyInput}
        />

        <Button
          label={t.connectLocalKey.pickFile}
          variant="ghost"
          onPress={() => void pickFromDevice()}
          disabled={state.busy}
        />

        <Input
          label={t.connectLocalKey.passphraseLabel}
          secureTextEntry
          secureToggle
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t.connectLocalKey.passphrasePlaceholder}
          value={state.passphrase}
          editable={!state.busy}
          onChangeText={(value) => patch({ passphrase: value })}
        />

        {state.error ? (
          <Text style={[styles.error, { color: tokens.danger }]}>{localizeServerError(state.error)}</Text>
        ) : null}
      </View>
    </FormSheet>
  );
}

