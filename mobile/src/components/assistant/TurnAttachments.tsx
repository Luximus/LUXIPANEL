import { localizeServerError } from "../../lib/server-error-localization";
import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { FileText, ImageIcon, Paperclip } from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { downloadServerFile, getDirect } from "../../api/serverApi";
import { conversationMediaPath } from "../../features/assistant/conversation-media";
import type { ChatMsg } from "../../features/assistant/types";
import type { ThemeTokens } from "../../theme/colors";
import { FormSheet } from "../ui/FormSheet";
import { PanelText as Text } from "../ui/PanelText";

type Attachment = NonNullable<ChatMsg["attachments"]>[number];

/** The same attachment thumbnails and full image preview as the web bubble.
 * Persisted files are loaded only from the selected panel with its credentials. */
export function TurnAttachments({ panelId, token, items, language, tokens }: {
  panelId: string; token: string; items: Attachment[]; language?: string; tokens: ThemeTokens;
}) {
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const spanish = (language ?? "es").startsWith("es");
  const source = (item: Attachment) => {
    if (item.url.startsWith("data:image/")) return { uri: item.url };
    const target = getDirect(panelId);
    if (!target) return undefined;
    try {
      const path = conversationMediaPath(item.url, target.baseUrl);
      return { uri: target.baseUrl + path, headers: {
        Cookie: `luxipanel_session=${target.jwt}`,
        Authorization: `Bearer ${target.jwt}`,
        ...(target.bridgeSessionId ? { "X-Bridge-Session-Id": target.bridgeSessionId } : {}),
      } };
    } catch { return undefined; }
  };
  const share = async (item: Attachment) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      let base64: string;
      if (item.url.startsWith("data:")) {
        base64 = item.url.split(",", 2)[1] ?? "";
      } else {
        const target = getDirect(panelId);
        if (!target) throw new Error("NO_PANEL");
        const blob = await downloadServerFile(panelId, token, conversationMediaPath(item.url, target.baseUrl));
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
          reader.onerror = () => reject(new Error("READ_FAILED"));
          reader.readAsDataURL(blob);
        });
      }
      if (!base64 || !(await Sharing.isAvailableAsync())) throw new Error("SHARE_UNAVAILABLE");
      const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!directory) throw new Error("NO_CACHE");
      const path = `${directory}lxp-chat-${Date.now()}-${item.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
      try { await Sharing.shareAsync(path, { mimeType: item.mimeType }); }
      finally { await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined); }
    } catch { setError(spanish ? "No se pudo abrir el adjunto." : "Could not open attachment."); }
    finally { setBusy(false); }
  };

  return <>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {items.map((item, index) => item.mimeType.startsWith("image/") ? (
        <Pressable key={`${item.name}-${index}`} onPress={() => setPreview(item)} accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${spanish ? "ampliar imagen" : "open image"}`}
          style={{ width: 80, height: 80, borderWidth: 1, borderColor: tokens.border, borderRadius: 8, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: tokens.bgInput }}>
          {source(item) ? <Image source={source(item)} style={{ width: 80, height: 80 }} resizeMode="cover" /> : <ImageIcon size={22} color={tokens.textMuted} />}
        </Pressable>
      ) : (
        <Pressable key={`${item.name}-${index}`} onPress={() => void share(item)} accessibilityRole="button"
          accessibilityLabel={`${spanish ? "Abrir" : "Open"} ${item.name}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", borderWidth: 1, borderColor: tokens.border, borderRadius: 8, backgroundColor: tokens.bgInput, paddingHorizontal: 8, paddingVertical: 6 }}>
          <FileText size={14} color={tokens.textMuted} />
          <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 12, maxWidth: 180 }}>{item.name}</Text>
        </Pressable>
      ))}
    </View>
    {busy ? <ActivityIndicator size="small" color={tokens.brand} /> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: tokens.danger, fontSize: 11 }}>{localizeServerError(error)}</Text> : null}
    <FormSheet visible={!!preview} onClose={() => setPreview(null)} title={preview?.name} language={language} fillHeight>
      {preview ? <>
        <Image source={source(preview)} resizeMode="contain" style={{ width: "100%", height: 330 }} />
        <Pressable onPress={() => void share(preview)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 12 }}>
          <Paperclip size={15} color={tokens.brand} />
          <Text style={{ color: tokens.brand }}>{spanish ? "Compartir o guardar" : "Share or save"}</Text>
        </Pressable>
      </> : null}
    </FormSheet>
  </>;
}
