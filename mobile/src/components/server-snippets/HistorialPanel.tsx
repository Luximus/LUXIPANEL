import { useConfirmation } from "../ui/useConfirmation";
// ── Panel "Historial": conversaciones Codex/Claude (server-backed) ───────
// El historial de COMANDOS de la consola vive en localStorage del WebView (no
// fetchable por API); aquí mostramos las conversaciones, que sí son server-backed.
// Extraído de `ServerSnippetsTab.tsx` (refactor conservador: código movido tal cual).
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, Play, Trash2 } from "lucide-react-native";
import {
  getServerConversations,
  deleteServerConversations,
  type ServerConversation,
  type ConversationSource,
} from "../../api/client";
import { loadCommandHistory, removeCommandHistory } from "../../lib/terminal-command-history";
import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";
import { ListPanelSkeleton } from "../skeletons";
import { styles, type ThemeTokens } from "./snippet-styles";
import type { SnippetStrings } from "./snippet-strings";
import { formatConvDate, buildResumeCommand, runCommandJs } from "./snippet-helpers";
import { DEFAULT_TERMINAL_PREFERENCES, getTerminalPreferences, type HistoryMode, type TerminalPreferences } from "./terminal-preferences";

// Conversaciones por página en el tab "Historial".
const HISTORY_PAGE_SIZE = 7;

export function HistorialPanel({
  tokens, t, panelId, token, injectIntoTerminal, onAfterRun,
}: {
  tokens: ThemeTokens;
  t: SnippetStrings;
  panelId: string;
  token: string;
  /** Ejecuta JS en la consola activa (para reanudar conversación / reejecutar comando). */
  injectIntoTerminal: (js: string) => void;
  /** Tras ejecutar: cierra el drawer para ver la consola. */
  onAfterRun?: () => void;
}) {
  const { askConfirmation, confirmation } = useConfirmation();
  const [data, setData] = useState<{ codex: ServerConversation[]; claude: ServerConversation[] } | null>(null);
  const [commands, setCommands] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<TerminalPreferences>(DEFAULT_TERMINAL_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryMode>("commands");
  const [page, setPage] = useState(0);

  const reload = useCallback(async () => {
    const [conv, cmds, prefs] = await Promise.all([
      getServerConversations(panelId, token),
      loadCommandHistory(panelId),
      getTerminalPreferences(panelId, token),
    ]);
    setData(conv);
    setCommands(cmds);
    setPreferences(prefs ?? DEFAULT_TERMINAL_PREFERENCES);
    setLoading(false);
  }, [panelId, token]);
  useEffect(() => { setLoading(true); setPage(0); void reload(); }, [reload]);

  // Ejecuta en la consola (mismo contrato que un snippet) y cierra el drawer.
  const runInConsole = (command: string) => { injectIntoTerminal(runCommandJs(command)); onAfterRun?.(); };

  const removeConversation = (c: ServerConversation) => {
    askConfirmation(t.delete, t.confirmDeleteConversation, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.delete,
        style: "destructive",
        onPress: async () => {
          await deleteServerConversations(panelId, token, c.source as ConversationSource, [c.sessionId]);
          await reload();
        },
      },
    ]);
  };
  const removeCommand = (cmd: string) => {
    void removeCommandHistory(panelId, cmd);
    setCommands((cur) => cur.filter((c) => c !== cmd));
  };

  if (loading) return <>{confirmation}<ListPanelSkeleton rows={5} /></>;

  const availableModes = preferences.historyOrder.filter((id) => preferences.historyVisible.includes(id));
  const effFilter = availableModes.includes(filter) ? filter : (availableModes[0] ?? "commands");
  const convList = [...((effFilter === "codex" ? data?.codex : data?.claude) ?? [])]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  // Paginación (7 por página) sobre la lista activa.
  const list: Array<{ key: string; node: React.ReactNode }> = effFilter !== "commands"
    ? convList.map((c) => ({
        key: `${c.source}:${c.sessionId}`,
        node: (
          <Pressable
            onPress={() => runInConsole(buildResumeCommand(c))}
            style={[styles.snipRow, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}
          >
            <View style={styles.snipMain}>
              <View style={styles.histTop}>
                <View style={[styles.tagBadge, { backgroundColor: tokens.brandDim }]}>
                  <Text style={[styles.tagBadgeText, { color: tokens.brand }]}>{c.source}</Text>
                </View>
                <Text numberOfLines={1} style={[styles.snipName, styles.flex1, { color: tokens.textPrimary }]}>{c.title || c.sessionId.slice(0, 8)}</Text>
              </View>
              {c.preview ? <Text numberOfLines={2} style={[styles.snipCmd, { color: tokens.textMuted }]}>{c.preview}</Text> : null}
              <Text style={[styles.histMeta, { color: tokens.textMuted }]}>{c.entryCount} {t.histEntries} · {formatConvDate(c.updatedAt)}</Text>
            </View>
            <View style={styles.snipActions}>
              <IconButton size={32} variant="ghost" icon={<Play size={15} color={tokens.brand} />} accessibilityLabel={t.histRunHint} onPress={() => runInConsole(buildResumeCommand(c))} />
              <IconButton size={32} variant="ghost" icon={<Trash2 size={15} color={tokens.danger} />} accessibilityLabel={t.delete} onPress={() => removeConversation(c)} />
            </View>
          </Pressable>
        ),
      }))
    : commands.map((cmd, idx) => ({
        key: `cmd:${idx}:${cmd}`,
        node: (
          <Pressable
            onPress={() => runInConsole(cmd)}
            style={[styles.snipRow, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}
          >
            <Play size={15} color={tokens.brand} />
            <Text numberOfLines={2} style={[styles.snipCmd, styles.flex1, { color: tokens.textPrimary }]}>{cmd}</Text>
            <View style={styles.snipActions}>
              <IconButton size={32} variant="ghost" icon={<Trash2 size={15} color={tokens.danger} />} accessibilityLabel={t.delete} onPress={() => removeCommand(cmd)} />
            </View>
          </Pressable>
        ),
      }));

  const totalPages = Math.max(1, Math.ceil(list.length / HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1); // clamp tras borrar/recargar
  const visible = list.slice(currentPage * HISTORY_PAGE_SIZE, currentPage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE);
  const emptyLabel = effFilter !== "commands" ? t.histEmpty : t.commandsEmpty;

  return <>
      {confirmation}
    <View style={styles.fill}>
      {availableModes.length > 1 ? (
        <Select
          value={effFilter}
          onChange={(v) => { setFilter(v as HistoryMode); setPage(0); }}
          options={availableModes.map((id) => ({ value: id, label: id === "commands" ? t.filterCommands : id === "codex" ? "Codex" : "Claude" }))}
        />
      ) : null}
      <Text style={[styles.hint, { color: tokens.textMuted }]}>{t.histRunHint}</Text>
      <ScrollView style={styles.fill} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {list.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.textMuted }]}>{emptyLabel}</Text>
        ) : visible.map((row) => <View key={row.key}>{row.node}</View>)}
      </ScrollView>

      {/* Paginación (7 por página): solo con más de una página. */}
      {totalPages > 1 ? (
        <View style={styles.pager}>
          <IconButton
            size={36}
            variant="secondary"
            icon={<ChevronLeft size={18} color={currentPage <= 0 ? tokens.textMuted : tokens.textPrimary} />}
            accessibilityLabel={t.prevPage}
            disabled={currentPage <= 0}
            onPress={() => setPage(Math.max(0, currentPage - 1))}
          />
          <Text style={[styles.pagerLabel, { color: tokens.textSecondary }]}>{currentPage + 1} / {totalPages}</Text>
          <IconButton
            size={36}
            variant="secondary"
            icon={<ChevronRight size={18} color={currentPage >= totalPages - 1 ? tokens.textMuted : tokens.textPrimary} />}
            accessibilityLabel={t.nextPage}
            disabled={currentPage >= totalPages - 1}
            onPress={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
          />
        </View>
      ) : null}
    </View>
  </>;
}
