import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import { WorkspaceModuleSection } from "../main/WorkspaceModuleSection";
import React, { useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { Checkbox, Field } from "../../components/server/Form";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { loadSessionState } from "../../lib/session-state";
import { useNativeModuleVisible } from "../main/native-module-context";
import {
  useServerPreferences,
  PANEL_LANGUAGES,
  PREFERENCE_CHOICES,
  preferenceChoiceLabel,
  PANEL_LANGUAGE_NAMES,
} from "../../lib/use-server-preferences";
import { serverUserText } from "../../i18n/server-user-messages";
export function NativePreferencesScreen({
  panelId,
  onBack,
}: {
  panelId: string;
  token: string;
  onBack: () => void;
}) {
  const p = useServerPreferences(panelId, useNativeModuleVisible()),
    { theme } = useTheme(),
    colors = getThemeTokens(theme === "dark"),
    t = serverUserText(loadSessionState().language);
  const [confirm, setConfirm] = useState<
      "disable" | "regenerate" | string | null
    >(null),
    [passkeyLabel, setPasskeyLabel] = useState("Passkey");
  const heading = (label: string) => (
    <Text
      style={{
        color: colors.textPrimary,
        fontSize: 18,
        fontWeight: "700",
        marginTop: 12,
      }}
    >
      {label}
    </Text>
  );
  const text = (value: string) => (
    <Text style={{ color: colors.textSecondary }}>{value}</Text>
  );
  return (
    <ServerModuleScreen
      title={t("preferences.pageTitle")}
      onBack={onBack}
      error={p.error}
      onRetry={() => void p.refreshSecurity()}
    >
      {p.notice ? text(p.notice) : null}
      <WorkspaceModuleSection views={["profile"]}>{heading(t("preferences.profile.sectionTitle"))}
      {text(p.username)}
      <Input
        label={t("preferences.profile.labelDisplayName")}
        value={p.displayName}
        onChangeText={p.setDisplayName}
      />
      <Input
        label={t("preferences.profile.labelPhone")}
        value={p.phone}
        onChangeText={p.setPhone}
        keyboardType="phone-pad"
      />
      <Button
        label={t("preferences.profile.btnSave")}
        loading={p.busy}
        onPress={() => void p.saveProfile()}
      />
      </WorkspaceModuleSection><WorkspaceModuleSection views={["profile","security"]}>{heading(t("preferences.password.sectionTitle"))}
      {text(t("preferences.password.disabledNotice"))}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["light", "dark", "system"].map((value, index) => (
          <Button
            key={value}
            label={`${p.ui.theme === value ? "✓ " : ""}${["☀", "☾", "◐"][index]}`}
            variant="ghost"
            onPress={() =>
              p.setUi((previous) => ({ ...previous, theme: value }))
            }
          />
        ))}
      </View>
      <Field label={t("common.language")}>
        <Select
          value={p.ui.language}
          options={PANEL_LANGUAGES.map((value) => ({
            value,
            label: PANEL_LANGUAGE_NAMES[value],
          }))}
          onChange={(language) =>
            p.setUi((previous) => ({ ...previous, language }))
          }
        />
      </Field>
      <Button
        label={t("chat.save")}
        loading={p.busy}
        onPress={() => void p.saveUi()}
      />
      {heading(t("chat.settings.title"))}
      {Object.entries(p.chat).map(([section, fields]) => (
        <View key={section} style={{ gap: 10 }}>
          {heading(t(`chat.settings.tabs.${section}`))}
          {Object.entries(fields).map(([key, value]) => (
            <Field key={key} label={t(`chat.settings.${section}.${key}`)}>
              {typeof value === "boolean" ? (
                <Checkbox
                  value={value}
                  onChange={(next) =>
                    p.setChat((previous) => ({
                      ...previous,
                      [section]: { ...previous[section], [key]: next },
                    }))
                  }
                />
              ) : PREFERENCE_CHOICES[key] ? (
                <Select
                  value={String(value)}
                  options={PREFERENCE_CHOICES[key].map((option) => ({
                    value: option,
                    label: preferenceChoiceLabel(section, key, option, t),
                  }))}
                  onChange={(next) =>
                    p.setChat((previous) => ({
                      ...previous,
                      [section]: {
                        ...previous[section],
                        [key]: typeof value === "number" ? Number(next) : next,
                      },
                    }))
                  }
                />
              ) : (
                <Input
                  value={String(value)}
                  onChangeText={(next) =>
                    p.setChat((previous) => ({
                      ...previous,
                      [section]: { ...previous[section], [key]: next },
                    }))
                  }
                />
              )}
            </Field>
          ))}
        </View>
      ))}
      <Checkbox
        value={p.presence.showOnline}
        label={t("chat.settings.presence.showOnline")}
        onChange={(showOnline) =>
          p.setPresence((previous) => ({ ...previous, showOnline }))
        }
      />
      <Input
        label={t("chat.settings.presence.statusMessage")}
        value={p.presence.statusMessage}
        maxLength={80}
        onChangeText={(statusMessage) =>
          p.setPresence((previous) => ({ ...previous, statusMessage }))
        }
      />
      <Button
        label={t("chat.save")}
        loading={p.busy}
        onPress={() => void p.saveChat()}
      />
      </WorkspaceModuleSection><WorkspaceModuleSection views={["security"]}>{heading(t("preferences.twoFactor.sectionTitle"))}
      {text(
        t(
          p.totp.enabled
            ? "preferences.labels.twoFaBadgeEnabled"
            : "preferences.labels.twoFaBadgeDisabled",
        ),
      )}
      <Button
        label={t(
          p.totp.enabled
            ? "preferences.twoFactor.btnDisable"
            : "preferences.twoFactor.btnEnable",
        )}
        onPress={() => {
          if (p.totp.enabled) setConfirm("disable");
          else void p.setupTotp();
        }}
      />
      {heading(t("preferences.passkeys.sectionTitle"))}
      <Input
        value={passkeyLabel}
        onChangeText={setPasskeyLabel}
        accessibilityLabel={t("preferences.passkeys.sectionTitle")}
      />
      <Button
        label={t("preferences.passkeys.btnAdd")}
        loading={!!p.enrollment}
        onPress={() =>
          void p.register(
            (url) => WebBrowser.openBrowserAsync(url),
            passkeyLabel,
          )
        }
      />
      {p.passkeys.map((key) => (
        <View
          key={key.id}
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          {text(key.label)}
          <Button
            label={t("chat.delete")}
            variant="ghost"
            onPress={() => setConfirm(key.id)}
          />
        </View>
      ))}
      {heading(t("preferences.recoveryCodes.sectionTitle"))}
      {text(
        t(
          p.recovery
            ? "preferences.labels.hasActiveCodes"
            : "preferences.labels.noActiveCodes",
        ),
      )}
      <Button
        label={t("preferences.recoveryCodes.btnRegenerate")}
        onPress={() => setConfirm("regenerate")}
      />
      {p.codes.length ? (
        <View style={{ gap: 8 }}>
          {text(t("preferences.recoveryCodes.warning"))}
          <Text
            selectable
            style={{ color: colors.textPrimary, fontFamily: "monospace" }}
          >
            {p.codes.join("\n")}
          </Text>
          <Button
            label={t("preferences.recoveryCodes.btnCopy")}
            onPress={() => void Clipboard.setStringAsync(p.codes.join("\n"))}
          />
          <Button
            label={t("chat.close")}
            variant="ghost"
            onPress={() => p.setCodes([])}
          />
        </View>
      ) : null}
      </WorkspaceModuleSection><WorkspaceModuleSection views={["audit"]}>{heading(t("preferences.auditLog.sectionTitle"))}
      {p.audit.map((entry) => (
        <View key={entry.id}>
          {text(
            `${entry.eventType} · ${new Date(entry.createdAt).toLocaleString()}`,
          )}
        </View>
      ))}
      </WorkspaceModuleSection><FormDrawer
        visible={!!p.setup}
        onClose={() => p.setSetup(null)}
        title={t("preferences.dialogSetup2fa.title")}
      >
        {p.error && (
          <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>
            {localizeServerError(p.error)}
          </Text>
        )}
        <Text selectable style={{ color: colors.textPrimary }}>
          {p.setup?.secret}
        </Text>
        <Input
          label={t("preferences.dialogSetup2fa.verifyCodeLabel")}
          value={p.code}
          onChangeText={p.setCode}
          keyboardType="number-pad"
          maxLength={6}
        />
        <Button
          label={t("preferences.dialogSetup2fa.btnConfirm")}
          disabled={!/^\d{6}$/.test(p.code)}
          onPress={() => void p.enableTotp()}
        />
      </FormDrawer>
      <Modal
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={t(
          confirm === "disable"
            ? "preferences.dialogDisable2fa.title"
            : confirm === "regenerate"
              ? "preferences.dialogRegenCodes.title"
              : "preferences.confirm.deletePasskeyTitle",
        )}
      >
        {text(
          t(
            confirm === "disable"
              ? "preferences.dialogDisable2fa.body"
              : confirm === "regenerate"
                ? "preferences.dialogRegenCodes.body"
                : "preferences.confirm.deletePasskey",
          ),
        )}
        <Button
          label={t("chat.save")}
          loading={p.busy}
          onPress={() => {
            void (
              confirm === "disable"
                ? p.disableTotp()
                : confirm === "regenerate"
                  ? p.regenerate()
                  : p.revoke(confirm!)
            ).then((ok) => {
              if (ok) setConfirm(null);
            });
          }}
        />
      </Modal>
    </ServerModuleScreen>
  );
}
