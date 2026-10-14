import { nativeText } from '../../../i18n/native-text';
import { localizeServerError } from '../../../lib/server-error-localization';
import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { callServerApi, unwrap } from "../../../api/serverApi";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { applyEditorEdit, type Range } from "../../../lib/editor-edits";
export function NativeEditorAssistant({ panelId, token, path, content, onChange }: { panelId: string; token: string; path: string; content: string; onChange: (text: string) => void }) {
  const colors = getThemeTokens(useTheme().theme === "dark");
  const [prompt, setPrompt] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [reply, setReply] = useState(""), [proposal, setProposal] = useState<{ before: string; after: string } | null>(null), [undo, setUndo] = useState<string | null>(null);
  const request = useRef(0); useEffect(() => () => { request.current++; }, []);
  const ask = async () => {
    const sequence = ++request.current, before = content;
    setBusy(true); setError(null); setProposal(null);
    try {
      const response = await callServerApi(panelId, token, "POST", "/api/ai/files/editor-chat", { path, content: before, prompt });
      if (sequence !== request.current) return;
      if (!response.ok) throw new Error(response.error ?? nativeText("No se pudo consultar la IA."));
      const data = unwrap<{ reply: string; edit?: { mode: string; content: string; range?: Range } }>(response);
      setReply(data?.reply ?? "");
      if (data?.edit) setProposal({ before, after: applyEditorEdit(before, data.edit) });
    } catch (cause) { if (sequence === request.current) setError(cause instanceof Error ? cause.message : nativeText("No se pudo consultar la IA.")); }
    finally { if (sequence === request.current) setBusy(false); }
  };
  return <View style={{ gap: 8 }}><Input label={nativeText("Pedir ayuda o cambios a la IA")} value={prompt} onChangeText={setPrompt} multiline /><Button label={nativeText("Consultar IA")} loading={busy} disabled={!prompt.trim()} onPress={() => void ask()} />{error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{localizeServerError(error)}</Text> : null}{reply ? <Text selectable style={{ color: colors.textSecondary }}>{reply}</Text> : null}{proposal ? <><Text selectable style={{ color: colors.textSecondary, fontFamily: "monospace" }}>{proposal.after}</Text><Button label={nativeText("Aplicar al borrador")} disabled={content !== proposal.before} onPress={() => { setUndo(content); onChange(proposal.after); setProposal(null); }} />{content !== proposal.before ? <Text style={{ color: colors.textMuted }}>{nativeText("El archivo cambió después de la consulta. Consulta de nuevo antes de aplicar.")}</Text> : null}</> : null}{undo !== null ? <Button label={nativeText("Deshacer cambio de IA")} variant="ghost" onPress={() => { onChange(undo); setUndo(null); }} /> : null}</View>;
}
