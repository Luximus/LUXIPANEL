import React from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { Download, RotateCw, Sparkles } from "lucide-react-native";
import type { ThemeMode } from "../features/app/types";
import { formatMessage, getMessages } from "../i18n";
import { humanFileSize } from "../hooks/useTicketUploads";
import type { UpdateState } from "../hooks/useUpdateChecker";
import { getThemeTokens } from "../theme/colors";
import { getPageGradient } from "../features/app/utils";
import { Button } from "../components/ui/Button";
import { styles } from "./UpdateRequiredScreen.styles";

const LOGO2 = require("../../assets/logo2.png");
const LOGO_LIGHT = require("../../assets/logo_light.png");
const LOGO_DARK = require("../../assets/logo.png");

export function UpdateRequiredScreen({
  theme,
  language,
  state,
  onStart,
  onRetry,
}: {
  theme: ThemeMode;
  language: string;
  state: UpdateState;
  onStart: () => void;
  onRetry: () => void;
}) {
  const t = getMessages(language);
  const tokens = getThemeTokens(theme === "dark");
  const gradient = getPageGradient(theme);
  const isDark = theme === "dark";

  const info = state.info;
  const phase = state.phase;
  const isDownloading = phase === "downloading";
  const isInstalling = phase === "installing";
  const isError = phase === "error";

  const total = state.total > 0 ? state.total : info?.artifact.sizeBytes ?? 0;
  const received = state.received;
  const progressPct = total > 0 ? Math.max(0, Math.min(100, Math.round((received / total) * 100))) : 0;
  const progressLabel = total > 0
    ? formatMessage(t.update.progressOf, { received: humanFileSize(received), total: humanFileSize(total) })
    : formatMessage(t.update.progressUnknown, { received: humanFileSize(received) });

  return (
    <View style={[styles.overlay, { backgroundColor: gradient[0] }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View
          style={[
            styles.card,
            { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border },
          ]}
        >
          <Image source={LOGO2} style={styles.logoBig} />
          <Image source={isDark ? LOGO_LIGHT : LOGO_DARK} style={styles.logoSmall} />

          <View style={[styles.iconCircle, styles.iconCircleBg]}>
            <Sparkles size={32} color={tokens.success} />
          </View>

          <Text style={[styles.eyebrow, { color: tokens.success }]}>{t.update.eyebrow}</Text>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>{t.update.title}</Text>
          <Text style={[styles.message, { color: tokens.textMuted }]}>{t.update.message}</Text>

          <View style={styles.versionsRow}>
            <View
              style={[
                styles.versionBox,
                { borderColor: tokens.border, backgroundColor: tokens.bgInput },
              ]}
            >
              <Text style={[styles.versionLabel, { color: tokens.textMuted }]}>{t.update.currentLabel}</Text>
              <Text style={[styles.versionValue, { color: tokens.textPrimary }]}>{state.currentVersion ?? "—"}</Text>
            </View>
            <View
              style={[
                styles.versionBox,
                { borderColor: tokens.success, backgroundColor: "rgba(16,185,129,0.10)" },
              ]}
            >
              <Text style={[styles.versionLabel, { color: tokens.success }]}>{t.update.latestLabel}</Text>
              <Text style={[styles.versionValue, { color: tokens.success }]}>{info?.version ?? "—"}</Text>
            </View>
          </View>

          {info?.releaseNotes ? (
            <View
              style={[
                styles.notesBox,
                { borderColor: tokens.border, backgroundColor: tokens.bgInput },
              ]}
            >
              <Text style={[styles.notesHeading, { color: tokens.textMuted }]}>{t.update.notesHeading}</Text>
              <Text style={[styles.notesBody, { color: tokens.textSecondary }]}>{info.releaseNotes}</Text>
            </View>
          ) : null}

          {(isDownloading || isInstalling) ? (
            <View style={styles.progressWrap}>
              <View style={[styles.progressTrack, { backgroundColor: tokens.bgSecondary }]}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${progressPct}%`, backgroundColor: tokens.success },
                  ]}
                />
              </View>
              <View style={styles.progressMeta}>
                <Text style={[styles.progressStatusText, { color: tokens.textMuted }]}>
                  {isDownloading ? t.update.downloading : t.update.installing}
                </Text>
                <Text style={[styles.progressStatusMono, { color: tokens.textMuted }]}>
                  {isDownloading ? progressLabel : ""}
                </Text>
              </View>
              {isInstalling ? (
                <Text style={[styles.progressInstallingHint, { color: tokens.textMuted }]}>
                  {t.update.installingHint}
                </Text>
              ) : null}
            </View>
          ) : null}

          {isError && state.error ? (
            <View
              style={[
                styles.errorBox,
                { borderColor: tokens.danger, backgroundColor: "rgba(244,63,94,0.10)" },
              ]}
            >
              <Text style={[styles.errorTitle, { color: tokens.danger }]}>
                {t.update.errorTitle}
              </Text>
              <Text style={[styles.errorMsg, { color: tokens.danger }]}>{state.error}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            {!isDownloading && !isInstalling ? (
              <Button
                variant="primary"
                disabled={!info}
                onPress={onStart}
                icon={<Download size={16} />}
                label={isError ? t.update.retry : t.update.download}
                style={styles.btnStretch}
              />
            ) : null}
            {isError ? (
              <Button
                variant="ghost"
                size="sm"
                onPress={onRetry}
                icon={<RotateCw size={14} />}
                label={t.update.checkAgain}
                style={styles.btnGhost}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
