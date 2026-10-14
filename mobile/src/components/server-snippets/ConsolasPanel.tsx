// ── Panel "Consolas": lista de terminales nativos abiertos (vivos) ──────────
// Cada consola es una conexión/WebView independiente que se mantiene viva para
// retomarla. Tocar una la activa (la muestra); la papelera la cierra; el botón
// superior abre una consola nueva para el servidor del drawer.
// Extraído de `ServerSnippetsTab.tsx` (refactor conservador: código movido tal cual).
import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Check, Pencil, Plus, TerminalSquare, Trash2 } from "lucide-react-native";
import { useInlineEditCancel } from "../../hooks/useInlineEditCancel";
import { IconButton } from "../ui/IconButton";
import { styles, type ThemeTokens } from "./snippet-styles";
import type { SnippetStrings } from "./snippet-strings";

export function ConsolasPanel({
  tokens, t, consoles, activeConsoleId, onSelect, onClose, onRename, onNew,
}: {
  tokens: ThemeTokens;
  t: SnippetStrings;
  consoles: { id: string; panelId: string; panelName: string; label?: string; autoLabel?: string }[];
  activeConsoleId: string | null;
  onSelect?: (id: string) => void;
  onClose?: (id: string) => void;
  onRename?: (id: string, label: string) => void;
  onNew?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const commitRename = () => {
    if (editingId) onRename?.(editingId, draft);
    setEditingId(null);
  };
  // Rename inline en curso: atrás de Android u ocultar el teclado lo cancelan
  // (descartan el borrador, sin commit) en vez de cerrar el drawer.
  useInlineEditCancel(editingId !== null, () => setEditingId(null));

  return (
    <View style={styles.fill}>
      {consoles.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={[styles.placeholderTitle, { color: tokens.textSecondary }]}>{t.consolesEmpty}</Text>
          <Text style={[styles.placeholderHint, { color: tokens.textMuted }]}>{t.consolesEmptyHint}</Text>
        </View>
      ) : (
        <ScrollView style={styles.fill} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          {consoles.map((c, idx) => {
            const active = c.id === activeConsoleId;
            const isEditing = editingId === c.id;
            const baseName = c.panelName || t.console;
            // Nombre mostrado: custom > auto-rótulo (actividad) > panel + índice.
            const display = c.label?.trim() || c.autoLabel?.trim() || `${baseName}  #${idx + 1}`;
            return (
              <View
                key={c.id}
                style={[styles.snipRow, { backgroundColor: active ? tokens.brandDim : tokens.bgCardSolid, borderColor: active ? tokens.brand : tokens.border }]}
              >
                <TerminalSquare size={18} color={active ? tokens.brand : tokens.textMuted} />
                {isEditing ? (
                  <TextInput
                    value={draft}
                    autoFocus
                    selectTextOnFocus
                    onChangeText={setDraft}
                    onBlur={commitRename}
                    onSubmitEditing={commitRename}
                    placeholder={baseName}
                    placeholderTextColor={tokens.textMuted}
                    style={[styles.input, styles.flex1, { backgroundColor: tokens.bgInput, borderColor: tokens.border, color: tokens.textPrimary }]}
                  />
                ) : (
                  <Pressable style={styles.snipMain} onPress={() => onSelect?.(c.id)}>
                    <Text numberOfLines={1} style={[styles.snipName, { color: tokens.textPrimary }]}>{display}</Text>
                    {active ? <Text style={[styles.snipCmd, { color: tokens.brand }]}>{t.consoleActive}</Text> : null}
                  </Pressable>
                )}
                <View style={styles.snipActions}>
                  <IconButton
                    size={32}
                    variant="ghost"
                    icon={isEditing ? <Check size={15} color={tokens.brand} /> : <Pencil size={15} />}
                    accessibilityLabel={t.editSnippet}
                    onPress={() => {
                      if (isEditing) { commitRename(); return; }
                      setEditingId(c.id);
                      setDraft(c.label?.trim() || c.autoLabel?.trim() || baseName);
                    }}
                  />
                  <IconButton size={32} variant="ghost" icon={<Trash2 size={15} color={tokens.danger} />} accessibilityLabel={t.delete} onPress={() => onClose?.(c.id)} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* "Nueva consola" FIJO al fondo del tab (separador arriba + icono), igual que
          "Nueva conexión" del tab Pestañas del drawer derecho (TabsManagerPanel).
          Margen negativo para que el separador/fondo lleguen a los bordes del drawer
          (el cuerpo de este tab tiene padding 12). */}
      {onNew ? (
        <View style={[styles.consoleFooter, { borderTopColor: tokens.border, backgroundColor: tokens.bgPrimary }]}>
          <Pressable
            onPress={() => onNew()}
            accessibilityLabel={t.newConsole}
            style={[styles.newConsoleBtn, { backgroundColor: tokens.brand }]}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={styles.newConsoleLabel}>{t.newConsole}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
