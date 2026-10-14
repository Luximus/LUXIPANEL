import React from "react";
import { Pressable, Text, View } from "react-native";
import { resourcesForModule } from "../../lib/native-live-read";
import { useDataFreshness } from "../../lib/use-live-module-data";
import { refreshServerData } from "../../lib/server-data-events";
import { liveDataLabels } from "../../lib/live-data-labels";
import { loadSessionState } from "../../lib/session-state";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
export function LiveDataStatus({serverId, moduleId}: {serverId: string; moduleId: string}) {
  const resources = resourcesForModule[moduleId] ?? [];
  const freshness = useDataFreshness(serverId, resources);
  const language = loadSessionState().language;
  const labels = liveDataLabels(language);
  const {theme} = useTheme(); const colors = getThemeTokens(theme === "dark");
  if (!resources.length || !freshness) return null;
  return <View style={{flexDirection:"row", justifyContent:"flex-end", gap:12, paddingHorizontal:14, paddingVertical:5, backgroundColor:colors.bgPrimary}}>
    <Text accessibilityLiveRegion="polite" style={{color:colors.textMuted,fontSize:12}}>{labels[freshness.state]}{freshness.collectedAt ? ` · ${new Date(freshness.collectedAt*1000).toLocaleTimeString(language)}` : ""}</Text>
    <Pressable disabled={freshness.state === "updating"} onPress={() => void refreshServerData(serverId, resources)}><Text style={{color:colors.brand,fontSize:12}}>{labels.refresh}</Text></Pressable>
  </View>;
}
