import React from "react";
import { Text, View } from "react-native";
import { X } from "lucide-react-native";
import { fileExtBadge, humanFileSize, type UploadEntry } from "../hooks/useTicketUploads";
import { getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { IconButton } from "./ui/IconButton";
import { styles } from "./UploadList.styles";

export function UploadList({
  entries,
  onRemove,
  language,
}: {
  entries: UploadEntry[];
  onRemove: (id: string) => void;
  language?: string;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  if (entries.length === 0) return null;

  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const pct = Math.max(0, Math.min(100, Math.round(entry.progress)));
        const barColor =
          entry.status === "done" ? tokens.success
          : entry.status === "error" || entry.status === "aborted" ? tokens.danger
          : tokens.brand;
        const meta =
          entry.status === "uploading"
            ? `${humanFileSize(entry.size)} · ${pct}%`
            : entry.status === "done"
              ? `${humanFileSize(entry.size)} · ${t.uploads.statuses.ready}`
              : entry.status === "error"
                ? entry.error || t.uploads.statuses.errorFallback
                : t.uploads.statuses.cancelled;

        return (
          <View
            key={entry.id}
            style={[
              styles.item,
              { borderColor: tokens.border, backgroundColor: tokens.bgSecondary },
            ]}
          >
            <View style={styles.itemMain}>
              <View style={styles.itemRow}>
                <View style={[styles.badge, { backgroundColor: tokens.brandDim }]}>
                  <Text style={[styles.badgeText, { color: tokens.brandLight }]}>
                    {fileExtBadge(entry.name, entry.type)}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: tokens.textSecondary }]}
                >
                  {entry.name}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: tokens.bgInput }]}>
                <View style={[styles.progressBar, { width: `${pct}%`, backgroundColor: barColor }]} />
              </View>
              <Text
                style={[
                  styles.meta,
                  { color: entry.status === "error" ? tokens.danger : tokens.textMuted },
                ]}
              >
                {meta}
              </Text>
            </View>
            <IconButton
              variant="ghost"
              size={28}
              onPress={() => onRemove(entry.id)}
              accessibilityLabel={t.uploads.removeAria}
              icon={<X size={18} />}
            />
          </View>
        );
      })}
    </View>
  );
}

