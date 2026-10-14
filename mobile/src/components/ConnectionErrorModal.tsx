import React from "react";
import { Text, View } from "react-native";
import { PlugZap } from "lucide-react-native";
import type { ConnectionErrorState } from "../features/app/viewModels";
import { formatMessage, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../theme/colors";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { styles } from "./ConnectionErrorModal.styles";

function normalizeMessage(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTechnicalConnectionMessage(value: string): boolean {
  const text = normalizeMessage(value);
  return [
    "net::err_",
    "timed out",
    "time out",
    "timeout",
    "network request failed",
    "failed to fetch",
    "websocket error",
    "connection refused",
    "connection reset",
    "name not resolved",
    "internet disconnected",
  ].some((pattern) => text.includes(pattern));
}

/**
 * Modal de reconexión UNIFICADO para las tres formas de perder la conexión:
 *  - servidor caído / fallo de carga del WebView  (kind="connection")
 *  - sin internet en mitad de una sesión          (kind="connection")
 *  - sesión SSO del panel caducada                (kind="session")
 *
 * Si `state.canRetry` es true muestra el botón "Reconectar" (con spinner mientras
 * `state.reconnecting`), que re-ejecuta la conexión y devuelve al usuario justo a
 * donde estaba. Si no, degrada al simple "Entendido" de aviso.
 */
export function ConnectionErrorModal({
  state,
  onClose,
  onReconnect,
  language,
}: {
  state: ConnectionErrorState;
  onClose: () => void;
  onReconnect?: () => void;
  language?: string;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  const isSession = state.kind === "session";
  const title = isSession ? t.connectionError.sessionTitle : t.connectionError.title;
  const description = state.panelName
    ? formatMessage(
        isSession ? t.connectionError.sessionDescription : t.connectionError.description,
        { name: state.panelName },
      )
    : isSession
      ? t.connectionError.sessionDescriptionNoName
      : t.connectionError.descriptionNoName;
  const detailMessage = state.message.trim();
  const hideDetail = !detailMessage
    || isTechnicalConnectionMessage(detailMessage)
    || normalizeMessage(detailMessage) === normalizeMessage(description)
    || normalizeMessage(detailMessage) === normalizeMessage(t.errors.connectionFailed);

  const footer = state.canRetry ? (
    <View style={styles.footerRow}>
      <Button
        label={t.connectionError.close}
        variant="secondary"
        onPress={onClose}
        disabled={state.reconnecting}
        style={styles.footerBtn}
      />
      <Button
        label={state.reconnecting ? t.connectionError.reconnecting : t.connectionError.reconnect}
        variant="primary"
        loading={state.reconnecting}
        onPress={onReconnect}
        style={styles.footerBtn}
      />
    </View>
  ) : (
    <Button label={t.connectionError.accept} variant="primary" onPress={onClose} />
  );

  return (
    <Modal visible={state.open} onClose={onClose} title={title} language={language} footer={footer}>
      <View style={styles.iconWrap}>
        <View style={[styles.iconCircle, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}>
          <PlugZap size={28} color={isSession ? tokens.brand : tokens.danger} />
        </View>
      </View>
      <Text style={{ color: tokens.textSecondary, fontSize: 15, lineHeight: 22, textAlign: "center" }}>
        {description}
      </Text>
      {!hideDetail ? (
        <View
          style={[
            styles.errorBox,
            {
              borderColor: withAlpha(tokens.warning, 0.35),
              backgroundColor: withAlpha(tokens.warning, 0.08),
            },
          ]}
        >
          <Text style={{ color: tokens.textPrimary, fontSize: 13, lineHeight: 19, textAlign: "center" }}>
            {detailMessage}
          </Text>
        </View>
      ) : null}
    </Modal>
  );
}
