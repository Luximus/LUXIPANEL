import { nativeText } from '../../i18n/native-text';
import React, { useContext } from "react";
import { View } from "react-native";
import { PanelText as Text } from "../ui/PanelText";
import { Button } from "../ui/Button";
import { NativeModuleContext } from "../../screens/main/native-module-visibility";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { loadSessionState } from "../../lib/session-state";

const labels: Record<string, [string, string]> = {
  users: ["Usuarios", "Users"], databases: ["Bases de datos", "Databases"], dns: ["Nginx", "Nginx"],
  files: ["Archivos", "Files"], hosting: ["Hosting", "Hosting"], backups: ["Copias de seguridad", "Backups"],
  assistant: ["Asistente", "Assistant"], "codebase-graph": ["Grafo de código", "Codebase graph"],
  "repository-store": ["Repositorios", "Repositories"], bitninja: ["BitNinja", "BitNinja"], cloudflare: ["Cloudflare", "Cloudflare"], webhooks: ["Webhooks", "Webhooks"],
};
export function RelatedModuleSettings({ modules }: { modules: string[] }) {
  const context = useContext(NativeModuleContext);
  const tokens = getThemeTokens(useTheme().theme === "dark");
  const es = loadSessionState().language.startsWith("es");
  if (!context?.openModule) return null;
  return <View style={{ gap: 10 }}>
    <Text style={{ color: tokens.textPrimary, fontWeight: "600" }}>{es ? nativeText("Módulos relacionados") : nativeText("Related modules")}</Text>
    {modules.map(id => <Button key={id} label={nativeText(labels[id]?.[0] ?? id)} variant="secondary" onPress={() => context.openModule?.(id)} />)}
  </View>;
}
