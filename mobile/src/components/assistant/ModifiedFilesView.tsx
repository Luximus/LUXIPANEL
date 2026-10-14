import { localizeServerError } from "../../lib/server-error-localization";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { ChevronDown, FilePen, Files, Trash2 } from "lucide-react-native";
import { callServerApi, unwrap } from "../../api/serverApi";
import { FormSheet } from "../ui/FormSheet";
import type { ModFile } from "../../features/assistant/modified-files";
import type { ThemeTokens } from "../../theme/colors";
import type { AssistantStrings } from "./types";
import { styles as toolStyles } from "./ToolBlockView.styles";
import { styles } from "./ModifiedFilesView.styles";

/** Modified files reopen in the native editor; deleted files remain inert. */
export function ModifiedFilesView({ files, panelId, token, language, t, tokens }: { files: ModFile[]; panelId: string; token: string; language?: string; t: AssistantStrings; tokens: ThemeTokens }) {
  const [open, setOpen] = useState(false);
  const [editor, setEditor] = useState<{ path: string; content: string; original: string; loading: boolean; binary: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const readSeq = useRef(0);
  const spanish = (language ?? "es").startsWith("es");
  const closeEditor = () => { readSeq.current++; setEditor(null); };
  const openFile = async (path: string) => {
    const seq = ++readSeq.current;
    setError(""); setEditor({ path, content: "", original: "", loading: true, binary: false });
    try {
      const response = await callServerApi(panelId, token, "GET", `/api/files/read?path=${encodeURIComponent(path)}`);
      if (seq !== readSeq.current) return;
      const value = unwrap<{ content?: string } | string>(response);
      const content = typeof value === "string" ? value : value?.content ?? "";
      if (!response.ok) setError(response.error ?? (spanish ? "No se pudo abrir el archivo." : "Could not open file."));
      setEditor({ path, content: response.ok ? content : "", original: response.ok ? content : "", loading: false, binary: !response.ok || content.includes("\u0000") });
    } catch {
      if (seq === readSeq.current) { setError(spanish ? "No se pudo abrir el archivo." : "Could not open file."); setEditor({ path, content: "", original: "", loading: false, binary: true }); }
    }
  };
  const saveFile = async () => {
    if (!editor || saving || editor.binary || editor.content === editor.original) return;
    setSaving(true); setError("");
    try {
      const response = await callServerApi(panelId, token, "PUT", "/api/files/write", { path: editor.path, content: editor.content, encoding: "utf-8" });
      if (response.ok) closeEditor();
      else setError(response.error ?? (spanish ? "No se pudo guardar el archivo." : "Could not save file."));
    } catch { setError(spanish ? "No se pudo guardar el archivo." : "Could not save file."); }
    finally { setSaving(false); }
  };
  const deleted = files.reduce((n, f) => (f.kind === "deleted" ? n + 1 : n), 0);
  return (
    <View style={[toolStyles.toolBlock, { borderColor: tokens.border, backgroundColor: tokens.bgInput, marginTop: 6 }]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.modFilesHead}>
        <Files size={13} color={tokens.textMuted} />
        <Text style={[styles.modFilesTitle, { color: tokens.textSecondary }]}>{t.modifiedFiles ?? "Archivos modificados"}</Text>
        <View style={[styles.modFilesCount, { backgroundColor: tokens.bgCardSolid }]}>
          <Text style={[styles.modFilesCountText, { color: tokens.textMuted }]}>{files.length}</Text>
        </View>
        {deleted > 0 ? (
          <View style={[styles.modFilesCount, { backgroundColor: "rgba(244,63,94,0.14)", flexDirection: "row", gap: 2 }]}>
            <Trash2 size={9} color={tokens.danger} />
            <Text style={[styles.modFilesCountText, { color: tokens.danger }]}>{deleted}</Text>
          </View>
        ) : null}
        <ChevronDown size={13} color={tokens.textMuted} style={{ marginLeft: "auto", transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </Pressable>
      {open ? (
        <View>
          {files.map((f) => {
            const name = f.path.split("/").pop() || f.path;
            const dir = f.path.slice(0, f.path.length - name.length);
            const del = f.kind === "deleted";
            return (
              <Pressable key={f.path} onPress={del ? undefined : () => void openFile(f.path)} disabled={del}
                accessibilityRole={del ? undefined : "button"} accessibilityLabel={del ? undefined : `${spanish ? "Abrir" : "Open"} ${f.path}`}
                style={[styles.modFileRow, { borderTopColor: tokens.border }]}>
                {del ? <Trash2 size={13} color={tokens.danger} /> : <FilePen size={13} color={tokens.brand} />}
                <Text numberOfLines={1} style={[styles.modFileName, { color: del ? tokens.textMuted : tokens.textPrimary, textDecorationLine: del ? "line-through" : "none" }]}>{name}</Text>
                {dir ? <Text numberOfLines={1} style={[styles.modFileDir, { color: tokens.textMuted }]}>{dir}</Text> : null}
                {del ? <Text style={[styles.modFilesCountText, { color: tokens.danger, marginLeft: "auto", textTransform: "uppercase" }]}>{t.deletedLabel ?? "eliminado"}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <FormSheet visible={!!editor} onClose={closeEditor} title={editor?.path.split("/").pop()} language={language} fillHeight
        footer={editor && !editor.binary && !editor.loading ? <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={closeEditor} style={{ padding: 12 }}><Text style={{ color: tokens.textSecondary }}>{spanish ? "Cerrar" : "Close"}</Text></Pressable>
          <Pressable onPress={() => void saveFile()} disabled={saving || editor.content === editor.original}
            style={{ padding: 12, opacity: saving || editor.content === editor.original ? 0.5 : 1 }}>
            <Text style={{ color: tokens.brand, fontWeight: "700" }}>{saving ? (spanish ? "Guardando…" : "Saving…") : (spanish ? "Guardar" : "Save")}</Text>
          </Pressable>
        </View> : undefined}>
        {editor?.loading ? <ActivityIndicator color={tokens.brand} /> : editor?.binary ? <Text style={{ color: tokens.textMuted }}>{error || (spanish ? "No se puede editar este archivo binario." : "Cannot edit this binary file.")}</Text> : editor ? <TextInput
          value={editor.content} onChangeText={(content) => setEditor((current) => current ? { ...current, content } : null)}
          multiline autoCapitalize="none" autoCorrect={false} textAlignVertical="top"
          style={{ minHeight: 310, color: tokens.textPrimary, backgroundColor: tokens.bgInput, borderColor: tokens.border, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 12, fontFamily: "monospace" }}
        /> : null}
        {error && !editor?.binary ? <Text accessibilityRole="alert" style={{ color: tokens.danger, marginTop: 8 }}>{localizeServerError(error)}</Text> : null}
      </FormSheet>
    </View>
  );
}
