import { useConfirmation } from "./ui/useConfirmation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ChevronLeft, ChevronRight, Pencil, Play, Plus, Search, Trash2, SlidersHorizontal, Folder, Tags } from "lucide-react-native";
import {
  createServerSnippet,
  createServerSnippetCategory,
  createServerSnippetTag,
  deleteServerSnippet,
  deleteServerSnippetCategory,
  deleteServerSnippetTag,
  getServerSnippets,
  updateServerSnippet,
  updateServerSnippetCategory,
  updateServerSnippetTag,
  type ServerSnippetState,
  type ServerSnippet,
} from "../api/client";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { IconButton } from "./ui/IconButton";
import { Select } from "./ui/Select";
import { Chip } from "./ui/Chip";
import { SettingsColumns, SettingsSectionBody } from "./ui/ModuleSettingsDrawer";
import { SegmentedControl } from "./ui/SegmentedControl";
import { ListPanelSkeleton } from "./skeletons";
// Sub-paneles, editor modal, i18n local, helpers y estilos extraídos a
// `./server-snippets/` (refactor conservador: código movido tal cual; este
// archivo conserva el orquestador del tab con su estado).
import { snippetStrings } from "./server-snippets/snippet-strings";
import { styles } from "./server-snippets/snippet-styles";
import { SnippetEditorModal } from "./server-snippets/SnippetEditorModal";
import { ConsolasPanel } from "./server-snippets/ConsolasPanel";
import { CategoriesPanel, TagsPanel } from "./server-snippets/config-panels";
import { HistorialPanel } from "./server-snippets/HistorialPanel";
import { TerminalCliSelector } from "./server-snippets/TerminalCliSelector";
import { TerminalPreferencesPanel } from "./server-snippets/TerminalPreferencesPanel";
import type { TerminalPreferences } from "./server-snippets/terminal-preferences";

type SubTab = "consolas" | "snippets" | "historial" | "config";

const SNIPPETS_PAGE_SIZE = 7;

/**
 * Cuerpo del tab "Snippets" del drawer izquierdo. Copia de la funcionalidad de
 * snippets del módulo terminal de LUXIPANEL, conectada al MISMO origen de datos
 * por el túnel SSO (`/api/terminal/snippets*`). Tocar un snippet inyecta el
 * evento `lxp-terminal:inject-command` (auto-run con `\r`), que la sesión nativa
 * interpreta sin evaluar JavaScript — mismo contrato que `runSnippet` del panel.
 */
export default function ServerSnippetsTab({ panelId, token, language, injectIntoTerminal, onAfterRun, consoles, activeConsoleId, onSelectConsole, onCloseConsole, onRenameConsole, onNewConsole, initialTab = "consolas", onPreferencesChange, tab, hideTabs = false, newSnippetRequest = 0, onSnippetAvailabilityChange }: {
  panelId: string;
  token: string;
  language?: string;
  /** Entrega el comando serializado a la sesión nativa del panel visible. */
  injectIntoTerminal: (js: string) => void;
  /** Tras ejecutar un snippet: cierra el drawer para ver el terminal. */
  onAfterRun?: () => void;
  // ── Consolas (sub-tab "Consolas") ──
  /** Consolas abiertas; `undefined` cuando no hay overlay de consola (muestra
   *  hint para abrir una). Cada una es una conexión nativa viva. */
  consoles?: { id: string; panelId: string; panelName: string; label?: string; autoLabel?: string }[];
  activeConsoleId?: string | null;
  onSelectConsole?: (id: string) => void;
  onCloseConsole?: (id: string) => void;
  onRenameConsole?: (id: string, label: string) => void;
  onNewConsole?: () => void;
  initialTab?: SubTab;
  /** The terminal's floating buttons open independent panels. */
  tab?: SubTab;
  hideTabs?: boolean;
  newSnippetRequest?: number;
  onSnippetAvailabilityChange?: (available: boolean) => void;
  onPreferencesChange?: (preferences: TerminalPreferences) => void;
}) {
  const { askConfirmation, confirmation } = useConfirmation(language);
  const t = snippetStrings(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  const [state, setState] = useState<ServerSnippetState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [localTab, setSubTab] = useState<SubTab>(initialTab);
  const subTab = tab ?? localTab;
  const [configSection, setConfigSection] = useState("general");

  const [query, setQuery] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const [snipPage, setSnipPage] = useState(0); // paginación de snippets (7/pág.)

  // Editor de snippet (modal). `editing` null = cerrado.
  const [editing, setEditing] = useState<ServerSnippet | "new" | null>(null);
  useEffect(() => {
    if (newSnippetRequest > 0) setEditing("new");
  }, [newSnippetRequest]);

  const reload = useCallback(async () => {
    if (!panelId || !token) return;
    const next = await getServerSnippets(panelId, token);
    setState(next);
    setLoading(false);
  }, [panelId, token]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const categories = state?.categories ?? [];
  const tags = state?.tags ?? [];
  const snippets = state?.snippets ?? [];
  useEffect(() => {
    onSnippetAvailabilityChange?.(!loading && categories.length > 0);
  }, [loading, categories.length, onSnippetAvailabilityChange]);

  const categoryName = useCallback(
    (id: number) => categories.find((c) => c.id === id)?.name ?? "—",
    [categories],
  );
  const tagsForCategory = useCallback(
    (categoryId: number) => tags.filter((tg) => tg.categoryId === categoryId),
    [tags],
  );

  // ── Mutaciones con feedback + recarga ──────────────────────────────────
  const runMutation = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res === null) { Alert.alert(t.deleteTitle, t.saveError); return false; }
      await reload();
      return true;
    } catch {
      Alert.alert(t.deleteTitle, t.saveError);
      return false;
    } finally {
      setBusy(false);
    }
  }, [reload, t.deleteTitle, t.saveError]);

  const confirmThenDelete = useCallback((message: string, fn: () => Promise<unknown>) => {
    askConfirmation(t.deleteTitle, message, [
      { text: t.cancel, style: "cancel" },
      { text: t.delete, style: "destructive", onPress: async () => { const result = await fn(); if (result === null) throw new Error(t.saveError); await reload(); } },
    ]);
  }, [askConfirmation, reload, t.cancel, t.delete, t.deleteTitle, t.saveError]);

  // ── Ejecutar snippet → inyecta el evento del terminal (auto-run) ────────
  const runSnippet = useCallback((snippet: ServerSnippet) => {
    const js = `(function(){try{window.dispatchEvent(new CustomEvent('lxp-terminal:inject-command',{detail:{command:${JSON.stringify(snippet.command)},run:true}}));}catch(e){}})(); true;`;
    injectIntoTerminal(js);
    onAfterRun?.();
  }, [injectIntoTerminal, onAfterRun]);

  // ── Lista filtrada + agrupada por categoría ────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snippets.filter((s) => {
      if (filterCategoryId && s.categoryId !== filterCategoryId) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.command.toLowerCase().includes(q)) return false;
      if (filterTagIds.length > 0 && !filterTagIds.every((id) => s.tagIds.includes(id))) return false;
      return true;
    });
  }, [snippets, query, filterCategoryId, filterTagIds]);

  // Paginación de snippets: 7 por página sobre la lista YA filtrada.
  const snipPageCount = Math.max(1, Math.ceil(filtered.length / SNIPPETS_PAGE_SIZE));
  // Si cambian los filtros/búsqueda y la página actual queda fuera de rango, vuelve a la 0.
  useEffect(() => { setSnipPage((p) => (p > snipPageCount - 1 ? 0 : p)); }, [snipPageCount]);
  const pagedSnippets = useMemo(
    () => filtered.slice(snipPage * SNIPPETS_PAGE_SIZE, snipPage * SNIPPETS_PAGE_SIZE + SNIPPETS_PAGE_SIZE),
    [filtered, snipPage],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ServerSnippet[]>();
    for (const s of pagedSnippets) {
      const key = categoryName(s.categoryId);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  }, [pagedSnippets, categoryName]);

  if (loading) return <>{confirmation}<ListPanelSkeleton rows={6} /></>;

  return <>
      {confirmation}
    <View style={[styles.root, subTab === "config" && { padding: 0, gap: 0 }]}>
      {!hideTabs && <SegmentedControl
        scroll
        value={subTab}
        onChange={(k) => setSubTab(k as SubTab)}
        items={[
          { key: "consolas", label: t.tabConsolas },
          { key: "snippets", label: t.tabSnippets },
          { key: "historial", label: t.tabHistorial },
          { key: "config", label: t.tabConfig },
        ]}
      />}

      {subTab === "consolas" ? (
        // Independencia por servidor: SOLO las consolas de ESTE panel/servidor.
        <ConsolasPanel
          tokens={tokens}
          t={t}
          consoles={(consoles ?? []).filter((c) => c.panelId === panelId)}
          activeConsoleId={activeConsoleId ?? null}
          onSelect={onSelectConsole}
          onClose={onCloseConsole}
          onRename={onRenameConsole}
          onNew={onNewConsole}
        />
      ) : null}

      {subTab === "historial" ? (
        <HistorialPanel
          tokens={tokens}
          t={t}
          panelId={panelId}
          token={token}
          injectIntoTerminal={injectIntoTerminal}
          onAfterRun={onAfterRun}
        />
      ) : null}

      {subTab === "snippets" ? (
        <View style={styles.fill}>
          {/* Buscador + nuevo */}
          <View style={styles.searchRow}>
            <View style={[styles.searchBox, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
              <Search size={15} color={tokens.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t.searchPlaceholder}
                placeholderTextColor={tokens.textMuted}
                style={[styles.searchInput, { color: tokens.textPrimary }]}
              />
            </View>
            {!hideTabs && <IconButton
              icon={<Plus size={18} />}
              variant="primary"
              accessibilityLabel={t.newSnippet}
              disabled={categories.length === 0}
              onPress={() => setEditing("new")}
            />}
          </View>

          {/* Filtro por categoría + tags */}
          <Select
            value={filterCategoryId ? String(filterCategoryId) : ""}
            placeholder={t.allCategories}
            onChange={(v) => { setFilterCategoryId(v ? Number(v) : null); setFilterTagIds([]); }}
            options={[{ value: "", label: t.allCategories }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]}
          />
          {filterCategoryId ? (
            tagsForCategory(filterCategoryId).length > 0 ? (
              <View style={styles.tagWrap}>
                {tagsForCategory(filterCategoryId).map((tg) => (
                  <Chip
                    key={tg.id}
                    label={tg.name}
                    selected={filterTagIds.includes(tg.id)}
                    onPress={() => setFilterTagIds((cur) => cur.includes(tg.id) ? cur.filter((x) => x !== tg.id) : [...cur, tg.id])}
                  />
                ))}
              </View>
            ) : (
              <Text style={[styles.hint, { color: tokens.textMuted }]}>{t.categoryNoTags}</Text>
            )
          ) : null}

          {/* Lista agrupada */}
          <ScrollView style={styles.fill} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <Text style={[styles.empty, { color: tokens.textMuted }]}>
                {snippets.length === 0 ? t.emptyList : t.noResults}
              </Text>
            ) : (
              grouped.map(([group, items]) => (
                <View key={group} style={styles.group}>
                  {(!filterCategoryId || grouped.length > 1) ? (
                    <Text style={[styles.groupLabel, { color: tokens.textMuted }]}>{group.toUpperCase()}</Text>
                  ) : null}
                  {items.map((s) => {
                    const tagNames = s.tagIds.map((id) => tags.find((tg) => tg.id === id)?.name).filter(Boolean) as string[];
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => runSnippet(s)}
                        style={[styles.snipRow, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}
                      >
                        <View style={styles.snipMain}>
                          <Text numberOfLines={1} style={[styles.snipName, { color: tokens.textPrimary }]}>{s.name}</Text>
                          <Text numberOfLines={1} style={[styles.snipCmd, { color: tokens.textMuted }]}>{s.command}</Text>
                          {tagNames.length > 0 ? (
                            <View style={styles.snipTags}>
                              {tagNames.map((n, i) => (
                                <View key={i} style={[styles.tagBadge, { backgroundColor: tokens.brandDim }]}>
                                  <Text style={[styles.tagBadgeText, { color: tokens.brand }]}>{n}</Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.snipActions}>
                          <IconButton size={32} variant="ghost" icon={<Play size={15} color={tokens.brand} />} accessibilityLabel={t.tabSnippets} onPress={() => runSnippet(s)} />
                          <IconButton size={32} variant="ghost" icon={<Pencil size={15} />} accessibilityLabel={t.editSnippet} onPress={() => setEditing(s)} />
                          <IconButton size={32} variant="ghost" icon={<Trash2 size={15} color={tokens.danger} />} accessibilityLabel={t.delete} onPress={() => confirmThenDelete(t.confirmDeleteSnippet, () => deleteServerSnippet(panelId, token, s.id))} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>
          {/* Paginación de snippets (7 por página): solo con más de una página. */}
          {snipPageCount > 1 ? (
            <View style={styles.pager}>
              <IconButton
                size={36}
                variant="secondary"
                icon={<ChevronLeft size={18} color={snipPage <= 0 ? tokens.textMuted : tokens.textPrimary} />}
                accessibilityLabel={t.prevPage}
                disabled={snipPage <= 0}
                onPress={() => setSnipPage((p) => Math.max(0, p - 1))}
              />
              <Text style={[styles.pagerLabel, { color: tokens.textSecondary }]}>{snipPage + 1} / {snipPageCount}</Text>
              <IconButton
                size={36}
                variant="secondary"
                icon={<ChevronRight size={18} color={snipPage >= snipPageCount - 1 ? tokens.textMuted : tokens.textPrimary} />}
                accessibilityLabel={t.nextPage}
                disabled={snipPage >= snipPageCount - 1}
                onPress={() => setSnipPage((p) => Math.min(snipPageCount - 1, p + 1))}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {subTab === "config" ? (
        <View style={styles.fill}>
          <SettingsColumns language={language ?? "es"} value={configSection} onChange={setConfigSection} sections={[
            { key: "general", label: "General", icon: <SlidersHorizontal size={20} color={tokens.textMuted} /> },
            { key: "categories", label: t.tabCategories, icon: <Folder size={20} color={tokens.textMuted} /> },
            { key: "tags", label: t.tabTags, icon: <Tags size={20} color={tokens.textMuted} /> },
          ]}>
            <SettingsSectionBody active={configSection === "general"}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14, gap: 14 }}>
                <TerminalPreferencesPanel panelId={panelId} token={token} language={language} onChange={onPreferencesChange}>
                  <TerminalCliSelector panelId={panelId} token={token} language={language} onInstall={command=>{
                    injectIntoTerminal(`(function(){try{window.dispatchEvent(new CustomEvent('lxp-terminal:inject-command',{detail:{command:${JSON.stringify(command)},run:true}}));}catch(e){}})(); true;`);
                    onAfterRun?.();
                  }} />
                </TerminalPreferencesPanel>
              </ScrollView>
            </SettingsSectionBody>
            <SettingsSectionBody active={configSection === "categories"}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14, gap: 14 }}>
                <CategoriesPanel tokens={tokens} t={t} busy={busy} categories={categories} tagsForCategory={tagsForCategory}
                  onCreate={(name) => runMutation(() => createServerSnippetCategory(panelId, token, name))}
                  onRename={(id, name) => runMutation(() => updateServerSnippetCategory(panelId, token, id, name))}
                  onDelete={(id) => confirmThenDelete(t.confirmDeleteCategory, () => deleteServerSnippetCategory(panelId, token, id))} />
              </ScrollView>
            </SettingsSectionBody>
            <SettingsSectionBody active={configSection === "tags"}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14, gap: 14 }}>
                <TagsPanel tokens={tokens} t={t} busy={busy} categories={categories} tags={tags}
                  onCreate={(categoryId, name) => runMutation(() => createServerSnippetTag(panelId, token, categoryId, name))}
                  onRename={(id, categoryId, name) => runMutation(() => updateServerSnippetTag(panelId, token, id, categoryId, name))}
                  onDelete={(id) => confirmThenDelete(t.confirmDeleteTag, () => deleteServerSnippetTag(panelId, token, id))} />
              </ScrollView>
            </SettingsSectionBody>
          </SettingsColumns>
        </View>
      ) : null}

      {editing ? (
        <SnippetEditorModal
          tokens={tokens} t={t} busy={busy}
          categories={categories} tags={tags} tagsForCategory={tagsForCategory}
          snippet={editing === "new" ? null : editing}
          defaultCategoryId={filterCategoryId ?? categories[0]?.id ?? null}
          onClose={() => setEditing(null)}
          onSubmit={async (input) => {
            const ok = await runMutation(() => editing === "new"
              ? createServerSnippet(panelId, token, input)
              : updateServerSnippet(panelId, token, (editing as ServerSnippet).id, input));
            if (ok) setEditing(null);
          }}
        />
      ) : null}
    </View>
  </>;
}
