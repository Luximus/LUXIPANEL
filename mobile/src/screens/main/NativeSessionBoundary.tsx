import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ModuleLoading } from "../../components/server/ModuleLoading";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { ensureDirectPanelSession } from "../../api/terminalSession";
import { Button } from "../../components/ui/Button";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { moduleById } from "../../features/app/luxipanel-modules";
import { getMessages } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";
import { fetchNativeModuleAccess } from "../server/native-module-access";

/** El destino es visible desde el primer frame; la conexión ocurre en su cuerpo. */
export function NativeSessionBoundary({ panelId, moduleId, token, onBack, children }: {
  panelId: string; moduleId: string; token: string; onBack: () => void; children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const language = loadSessionState().language;
  const colors = getThemeTokens(useTheme().theme === "dark");
  const messages = getMessages(language);
  const mod = moduleById(moduleId);
  const title = (messages.modules.labels as Record<string, string>)[mod?.labelKey ?? moduleId] ?? moduleId;
  useEffect(() => {
    if (moduleId === "terminal") return;
    let current = true;
    setError(null);
    void (async () => {
      if (!await ensureDirectPanelSession(panelId, token, () => current)) throw new Error(messages.serverStandalone.errSavedConnection);
      if (!current) return;
      const access = await fetchNativeModuleAccess(panelId);
      if (!current) return;
      if (!access.has(moduleId)) { setReady(false); throw new Error(language.startsWith("es") ? nativeText("Este módulo no está habilitado para tu usuario.") : nativeText("This module is not enabled for your user.")); }
      setReady(true);
    })().catch(cause => { if (current) { setError(cause instanceof Error ? cause.message : messages.serverStandalone.errGeneric); } });
    return () => { current = false; };
  }, [panelId, moduleId, token, attempt]);
  if (moduleId === "terminal") return <>{children}</>;
  if (ready) return <View style={{flex:1}}>{children}{error ? <View style={{padding:12,gap:8}}><Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text><Button label={language.startsWith("es") ? nativeText("Reintentar conexión") : nativeText("Retry connection")} onPress={()=>setAttempt(value=>value+1)} /></View> : null}</View>;
  return <ServerModuleScreen title={title} onBack={onBack} error={error} onRetry={error ? () => setAttempt(value => value + 1) : undefined}>
    {!error ? <ModuleLoading label={messages.serverStandalone.connecting} /> : null}
  </ServerModuleScreen>;
}
