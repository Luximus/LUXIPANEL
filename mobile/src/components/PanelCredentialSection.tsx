import { useConfirmation } from "./ui/useConfirmation";
import React from "react";
import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Copy, KeyRound, RefreshCw, Trash2 } from "lucide-react-native";
import { getPanelCredential, rotatePanelCredential, revokePanelCredential, type PanelCredentialMasked } from "../api/client";
import { getMessages } from "../i18n";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { Button } from "./ui/Button";

/**
 * Sección "Credencial de conexión (LUXIPANEL)" del editor de panel (modo
 * editar). Muestra la credencial por-panel (`lxp_live_`) enmascarada y permite
 * verla/rotarla/copiarla/revocarla. El secreto en claro solo se revela una vez
 * (tras rotar) con copiar-al-portapapeles. El usuario lo pega en el `.env` de
 * su caja LUXIPANEL para identificarse. Paridad con la sección del portal.
 */
export function PanelCredentialSection({ panelId, language }: { panelId: string; language?: string }) {
  const { askConfirmation, confirmation } = useConfirmation(language);
  const t = getMessages(language);
  const c = t.panelEditor;
  const { token } = useAuth();
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  const [masked, setMasked] = React.useState<PanelCredentialMasked>(null);
  const [plaintext, setPlaintext] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!token) return;
    setFeedback(null);
    try {
      setMasked(await getPanelCredential(panelId, token));
    } catch {
      // Sin credencial todavía (o no disponible): estado vacío, sin ruido.
      setMasked(null);
    }
  }, [panelId, token]);

  React.useEffect(() => {
    setPlaintext(null);
    void load();
  }, [load]);

  const maskedDisplay = masked ? `${masked.prefix || ""}••••••${masked.last4 || ""}` : "";

  async function copy(value: string) {
    if (!value) return;
    try {
      await Clipboard.setStringAsync(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bloqueado */
    }
  }

  async function rotate() {
    if (!token || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await rotatePanelCredential(panelId, token);
      if (res.plaintext) setPlaintext(res.plaintext);
      setMasked(res.masked);
      await load();
      setFeedback(c.credRotated);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : c.credRotateFailed);
    } finally {
      setBusy(false);
    }
  }

  function confirmRevoke() {
    if (!token || busy) return;
    askConfirmation(c.credRevokeConfirmTitle, c.credRevokeConfirmMsg, [
      { text: c.cancel, style: "cancel" },
      {
        text: c.credConfirmRevoke,
        style: "destructive",
        onPress: () => revoke(),
      },
    ]);
  }

  async function revoke() {
    if (!token) return;
    setBusy(true);
    setFeedback(null);
    try {
      await revokePanelCredential(panelId, token);
      setMasked(null);
      setPlaintext(null);
      setFeedback(c.credRevoked);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : c.credRevokeFailed);
    } finally {
      setBusy(false);
    }
  }

  return <>
      {confirmation}
    <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: tokens.border, paddingTop: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <KeyRound size={14} color={tokens.textMuted} />
        <Text style={{ color: tokens.textPrimary, fontWeight: "700", fontSize: 13 }}>{c.credSectionTitle}</Text>
      </View>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{c.credSectionHint}</Text>

      {masked ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              flex: 1,
              color: tokens.textSecondary,
              fontFamily: "monospace",
              fontSize: 13,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: tokens.border,
              borderRadius: 8,
              backgroundColor: tokens.bgInput,
            }}
          >
            {maskedDisplay}
          </Text>
        </View>
      ) : (
        <Text style={{ color: tokens.textMuted, fontSize: 12, fontStyle: "italic" }}>{c.credEmpty}</Text>
      )}

      {plaintext ? (
        <View style={{ gap: 6, borderWidth: 1, borderColor: tokens.brand, borderRadius: 8, padding: 10, backgroundColor: tokens.brandDim }}>
          <Text style={{ color: tokens.danger, fontSize: 12 }}>{c.credOnceWarning}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text selectable style={{ flex: 1, color: tokens.textPrimary, fontFamily: "monospace", fontSize: 12 }}>
              {plaintext}
            </Text>
            <Pressable
              onPress={() => void copy(plaintext)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: tokens.brand }}
            >
              <Copy size={13} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{copied ? c.credCopied : c.credCopy}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {feedback ? <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{feedback}</Text> : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label={c.credRotateBtn} variant="secondary" onPress={() => void rotate()} loading={busy} disabled={busy} icon={<RefreshCw size={14} color={tokens.textPrimary} />} />
        {masked ? (
          <Button label={c.credRevokeBtn} variant="danger" onPress={confirmRevoke} disabled={busy} icon={<Trash2 size={14} color="#fff" />} />
        ) : null}
      </View>
    </View>
  </>;
}

export default PanelCredentialSection;
