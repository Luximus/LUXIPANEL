import {
  initializeChatNotifications,
  useIncomingRing,
} from "../lib/server-chat-notifications";
import { useEffect, useState } from "react";
import React from "react";
import { Text, TextInput, View } from "react-native";
import { Button } from "./ui/Button";
import {
  initializeServerCalls,
  useServerCall,
  reportCallError,
  acceptServerCall,
  rejectServerCall,
  endServerCall,
  muteServerCall,
  translateServerCall,
} from "../lib/server-calls";
import { serverUserText } from "../i18n/server-user-messages";
import { loadSessionState } from "../lib/session-state";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
/** Above module hosts; closing a drawable never owns this audio session. */
export function ServerCallHost() {
  useEffect(() => {
    const calls = initializeServerCalls(),
      notifications = initializeChatNotifications();
    return () => {
      notifications();
      calls();
    };
  }, []);
  const [minimized, setMinimized] = useState(false);
  const call = useServerCall(),
    t = serverUserText(loadSessionState().language),
    { theme } = useTheme(),
    colors = getThemeTokens(theme === "dark");
  useIncomingRing(Boolean(call?.incoming && call.ringtone));
  if (!call) return null;
  const action = (operation: () => Promise<unknown>) => {
    void operation().catch(reportCallError);
  };
  return (
    <View
      accessibilityRole="summary"
      style={{
        position: "absolute",
        top: 60,
        left: 12,
        right: 12,
        zIndex: 30000,
        elevation: 30,
        padding: 14,
        gap: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgCardSolid,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
        {call.incoming ? t("chat.call.incoming") : t("chat.call.rowActive")}
      </Text>
      <Button
        variant="ghost"
        size="sm"
        label={t(minimized ? "chat.call.expand" : "chat.call.minimize")}
        onPress={() => setMinimized((value) => !value)}
      />
      {call.incoming ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label={t("chat.call.accept")}
            onPress={() => action(acceptServerCall)}
          />
          <Button
            variant="danger"
            label={t("chat.call.reject")}
            onPress={() => action(rejectServerCall)}
          />
        </View>
      ) : (
        <>
          <Text style={{ color: colors.textMuted }}>
            {call.status === "connecting"
              ? t("chat.call.connecting")
              : call.error
                ? t("chat.call.error")
                : call.session?.call.participants
                    .map((person) => person.displayName)
                    .join(", ")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              variant="ghost"
              label={t(call.muted ? "chat.call.unmute" : "chat.call.mute")}
              onPress={muteServerCall}
            />
            <Button
              variant="danger"
              label={t("chat.call.hangUp")}
              onPress={() => action(endServerCall)}
            />
          </View>
          {!minimized && (
            <>
              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <TextInput
                  accessibilityLabel={t("chat.settings.calls.language")}
                  value={call.lang}
                  onChangeText={(lang) =>
                    translateServerCall(lang, call.translate)
                  }
                  style={{
                    color: colors.textPrimary,
                    minWidth: 60,
                    padding: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                />
                <Button
                  variant="ghost"
                  label={`${call.translate ? "✓ " : ""}${t("chat.settings.calls.translate")}`}
                  onPress={() =>
                    translateServerCall(call.lang, !call.translate)
                  }
                />
              </View>
              {call.captions.slice(-2).map((caption, index) => (
                <Text key={index} style={{ color: colors.textSecondary }}>
                  {caption}
                </Text>
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
}
