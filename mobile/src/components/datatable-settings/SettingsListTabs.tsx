/**
 * Cuerpos de los tabs de lista del gear de ajustes (extraídos de
 * `DataTableSettingsModal.tsx`): Categorías+Tags, llaves SSH e Integraciones.
 * SIN estado propio: todo el estado y los handlers viven en `SettingsPanels`
 * y llegan por props (mismo JSX que la versión monolítica).
 */
import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Pencil, Search, Trash2 } from "lucide-react-native";
import { styles } from "../DataTableSettingsModal.styles";
import { Button } from "../ui/Button";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../../i18n";
import {
  deletePanelCategory,
  deletePanelTag,
  deleteSshKey,
  updatePanelCategory,
  updatePanelTag,
  updateSshKeyApi,
  type PanelTaxonomy,
  type ProviderCatalogEntry,
  type SshKeySummary,
} from "../../api/client";
import type { getThemeTokens } from "../../theme/colors";

type Messages = ReturnType<typeof getMessages>;
type Tokens = ReturnType<typeof getThemeTokens>;
type RowDirection = ReturnType<typeof getLocaleRowDirection>;
type TextAlignValue = ReturnType<typeof getLocaleTextAlign>;
type Category = PanelTaxonomy["categories"][number];
type Tag = Category["tags"][number];

// La huella SHA256 es muy larga para la fila; se muestra truncada (valor
// completo no necesario en móvil). Mantiene paridad con desktop.
export function shortenFingerprint(value: string): string {
  if (!value || value === "-") return value;
  return value.length > 24 ? `${value.slice(0, 24)}…` : value;
}

export function CategoriesTabBody({
  hideTabs,
  t,
  tokens,
  textAlign,
  rowDirection,
  token,
  taxonomy,
  categorySearch,
  setCategorySearch,
  pagedCategories,
  categoryPage,
  setCategoryPage,
  categoryTotalPages,
  tagSearch,
  setTagSearch,
  filteredTags,
  editingCategoryId,
  editingCategoryName,
  setEditingCategoryId,
  setEditingCategoryName,
  editingTagId,
  editingTagName,
  setEditingTagId,
  setEditingTagName,
  renderSelectCheck,
  run,
  askConfirm,
  applyCategoryRenamed,
  applyCategoryDeleted,
  applyTagRenamed,
  applyTagDeleted,
}: {
  hideTabs: boolean;
  t: Messages;
  tokens: Tokens;
  textAlign: TextAlignValue;
  rowDirection: RowDirection;
  token: string;
  taxonomy: PanelTaxonomy["categories"];
  categorySearch: string;
  setCategorySearch: (v: string) => void;
  pagedCategories: PanelTaxonomy["categories"];
  categoryPage: number;
  setCategoryPage: React.Dispatch<React.SetStateAction<number>>;
  categoryTotalPages: number;
  tagSearch: string;
  setTagSearch: (v: string) => void;
  filteredTags: Tag[];
  editingCategoryId: string | null;
  editingCategoryName: string;
  setEditingCategoryId: (v: string | null) => void;
  setEditingCategoryName: (v: string) => void;
  editingTagId: string | null;
  editingTagName: string;
  setEditingTagId: (v: string | null) => void;
  setEditingTagName: (v: string) => void;
  renderSelectCheck: (id: string) => React.ReactNode;
  run: (fn: () => Promise<void>) => Promise<void>;
  askConfirm: (title: string, message: string, action: () => Promise<void>) => void;
  applyCategoryRenamed: (id: string, name: string) => void;
  applyCategoryDeleted: (id: string) => void;
  applyTagRenamed: (id: string, name: string) => void;
  applyTagDeleted: (id: string) => void;
}) {
  return (
    <>
      {!hideTabs ? <Text style={[styles.sectionTitle, { color: tokens.textPrimary, textAlign }]}>{t.dataTableSettings.tabs.categories}</Text> : null}
      {/* Cuerpo del tab (solo la lista; el registro vive en el FormSheet) con
          el MISMO padding horizontal (12) que el cuerpo del tab "Server". */}
      <View style={styles.catTagBody}>
        <>
          {/* Lista de categorías */}
          <Text style={[styles.groupLabel, { color: tokens.textMuted, textAlign }]}>{t.dataTableSettings.tabs.categories}</Text>
          <View style={[styles.searchWrap, { borderColor: tokens.border, backgroundColor: tokens.bgCard }]}>
            <Search size={14} color={tokens.textMuted} />
            <TextInput
              placeholder={t.panelEditor.categoryLabel}
              placeholderTextColor={tokens.textMuted}
              value={categorySearch}
              onChangeText={setCategorySearch}
              autoCapitalize="none"
              style={[styles.searchInput, { color: tokens.textSecondary }]}
            />
          </View>
          <View style={[styles.keyListContainer, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
            <ScrollView style={styles.keyListScroll} contentContainerStyle={styles.keyList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {pagedCategories.length === 0 ? (
                <Text style={[styles.emptyListText, { color: tokens.textMuted }]}>{t.common.emptyList}</Text>
              ) : null}
              {pagedCategories.map((cat, idx) => (
                <View key={cat.id} style={[styles.keyRow, idx === pagedCategories.length - 1 && styles.keyRowLast, { backgroundColor: "transparent" }]}>
                  {renderSelectCheck(cat.id)}
                  {editingCategoryId === cat.id ? (
                    <TextInput
                      value={editingCategoryName}
                      autoFocus
                      onChangeText={setEditingCategoryName}
                      onBlur={() => {
                        const next = editingCategoryName.trim();
                        if (next && next !== cat.name) {
                          void run(async () => { await updatePanelCategory(cat.id, next, token); applyCategoryRenamed(cat.id, next); });
                        }
                        setEditingCategoryId(null);
                        setEditingCategoryName("");
                      }}
                      onSubmitEditing={() => {
                        const next = editingCategoryName.trim();
                        if (next && next !== cat.name) {
                          void run(async () => { await updatePanelCategory(cat.id, next, token); applyCategoryRenamed(cat.id, next); });
                        }
                        setEditingCategoryId(null);
                        setEditingCategoryName("");
                      }}
                      style={[styles.rowInlineInput, { borderColor: tokens.borderStrong, color: tokens.textPrimary, backgroundColor: tokens.bgInput }]}
                    />
                  ) : (
                    <Text style={{ color: tokens.textPrimary, flex: 1, fontWeight: "700", fontSize: 13 }}>{cat.name}</Text>
                  )}
                  <Pressable style={styles.tabIconBtn} onPress={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}>
                    <Pencil size={12} color={tokens.textMuted} />
                  </Pressable>
                  <Pressable style={styles.tabIconBtn} onPress={() => askConfirm(t.common.delete, t.dataTableSettings.categoriesTab.confirmDelete, async () => {
                    const category = taxonomy.find((c) => c.id === cat.id);
                    const categoryTags = category?.tags ?? [];
                    for (const tg of categoryTags) {
                      await deletePanelTag(tg.id, token);
                    }
                    await deletePanelCategory(cat.id, token);
                    applyCategoryDeleted(cat.id);
                  })}>
                    <Trash2 size={12} color={tokens.textMuted} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
          <View style={[styles.paginationRow, { flexDirection: rowDirection }]}>
            <Pressable disabled={categoryPage <= 1} style={[styles.pageBtn, { borderColor: tokens.border, opacity: categoryPage <= 1 ? 0.5 : 1 }]} onPress={() => setCategoryPage((p) => Math.max(1, p - 1))}>
              <Text style={{ color: tokens.textSecondary }}>‹</Text>
            </Pressable>
            <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{categoryPage}/{categoryTotalPages}</Text>
            <Pressable disabled={categoryPage >= categoryTotalPages} style={[styles.pageBtn, { borderColor: tokens.border, opacity: categoryPage >= categoryTotalPages ? 0.5 : 1 }]} onPress={() => setCategoryPage((p) => Math.min(categoryTotalPages, p + 1))}>
              <Text style={{ color: tokens.textSecondary }}>›</Text>
            </Pressable>
          </View>
          {/* Separador entre el grupo Categorías y el grupo Tags. */}
          <View style={[styles.groupDivider, { backgroundColor: tokens.border }]} />
          {/* Lista de tags */}
          <Text style={[styles.groupLabel, { color: tokens.textMuted, textAlign }]}>{t.dataTableSettings.tabs.tags}</Text>
          <View style={[styles.searchWrap, { borderColor: tokens.border, backgroundColor: tokens.bgCard }]}>
            <Search size={14} color={tokens.textMuted} />
            <TextInput
              placeholder={t.panelEditor.tagsLabel}
              placeholderTextColor={tokens.textMuted}
              value={tagSearch}
              onChangeText={setTagSearch}
              autoCapitalize="none"
              style={[styles.searchInput, { color: tokens.textSecondary }]}
            />
          </View>
          <View style={[styles.keyListContainer, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
            <ScrollView style={styles.keyListScroll} contentContainerStyle={styles.keyList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {filteredTags.length === 0 ? (
                <Text style={[styles.emptyListText, { color: tokens.textMuted }]}>{t.common.emptyList}</Text>
              ) : null}
              {filteredTags.map((tag, idx) => (
                <View key={tag.id} style={[styles.keyRow, idx === filteredTags.length - 1 && styles.keyRowLast, { backgroundColor: "transparent" }]}>
                  {renderSelectCheck(tag.id)}
                  {editingTagId === tag.id ? (
                    <TextInput
                      value={editingTagName}
                      autoFocus
                      onChangeText={setEditingTagName}
                      onBlur={() => {
                        const next = editingTagName.trim();
                        if (next && next !== tag.name) {
                          void run(async () => { await updatePanelTag(tag.id, next, token); applyTagRenamed(tag.id, next); });
                        }
                        setEditingTagId(null);
                        setEditingTagName("");
                      }}
                      onSubmitEditing={() => {
                        const next = editingTagName.trim();
                        if (next && next !== tag.name) {
                          void run(async () => { await updatePanelTag(tag.id, next, token); applyTagRenamed(tag.id, next); });
                        }
                        setEditingTagId(null);
                        setEditingTagName("");
                      }}
                      style={[styles.rowInlineInput, { borderColor: tokens.borderStrong, color: tokens.textPrimary, backgroundColor: tokens.bgInput }]}
                    />
                  ) : (
                    <Text style={{ color: tokens.textPrimary, flex: 1, fontWeight: "700", fontSize: 13 }}>{tag.name}</Text>
                  )}
                  <Pressable style={styles.tabIconBtn} onPress={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); }}>
                    <Pencil size={12} color={tokens.textMuted} />
                  </Pressable>
                  <Pressable style={styles.tabIconBtn} onPress={() => askConfirm(t.common.delete, t.dataTableSettings.tagsTab.confirmDelete, async () => { await deletePanelTag(tag.id, token); applyTagDeleted(tag.id); })}>
                    <Trash2 size={12} color={tokens.textMuted} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </>
      </View>
    </>
  );
}

export function SshKeysTabBody({
  hideTabs,
  t,
  tokens,
  textAlign,
  rowDirection,
  token,
  sshSearch,
  setSshSearch,
  pagedSshKeys,
  sshPage,
  setSshPage,
  sshTotalPages,
  renderSelectCheck,
  askConfirm,
  onEditKey,
  applySshKeyDeleted,
}: {
  hideTabs: boolean;
  t: Messages;
  tokens: Tokens;
  textAlign: TextAlignValue;
  rowDirection: RowDirection;
  token: string;
  sshSearch: string;
  setSshSearch: (v: string) => void;
  pagedSshKeys: SshKeySummary[];
  sshPage: number;
  setSshPage: React.Dispatch<React.SetStateAction<number>>;
  sshTotalPages: number;
  renderSelectCheck: (id: string) => React.ReactNode;
  askConfirm: (title: string, message: string, action: () => Promise<void>) => void;
  onEditKey: (key: SshKeySummary) => void;
  applySshKeyDeleted: (id: string) => void;
}) {
  return (
    <>
      {!hideTabs ? <Text style={[styles.sectionTitle, { color: tokens.textPrimary, textAlign }]}>{t.dataTableSettings.sshKeysTab.heading}</Text> : null}
      {/* Solo la lista (el registro vive en el FormSheet). Mismo padding
          horizontal (12) que el cuerpo del tab "Server". */}
      <View style={styles.catTagBody}>
        <>
          <View style={[styles.searchWrap, { borderColor: tokens.border, backgroundColor: tokens.bgCard }]}>
            <Search size={14} color={tokens.textMuted} />
            <TextInput
              placeholder={t.dataTableSettings.sshKeysTab.sshUserPlaceholder}
              placeholderTextColor={tokens.textMuted}
              value={sshSearch}
              onChangeText={setSshSearch}
              autoCapitalize="none"
              style={[styles.searchInput, { color: tokens.textSecondary }]}
            />
          </View>
          <View style={[styles.keyListContainer, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
            <ScrollView style={styles.keyListScroll} contentContainerStyle={styles.keyList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {pagedSshKeys.length === 0 ? (
                <Text style={[styles.emptyListText, { color: tokens.textMuted }]}>{t.common.emptyList}</Text>
              ) : null}
              {pagedSshKeys.map((key, idx) => (
                <View key={key.id} style={[styles.keyRow, idx === pagedSshKeys.length - 1 && styles.keyRowLast, { backgroundColor: "transparent" }]}>
                  {renderSelectCheck(key.id)}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: tokens.textPrimary, fontWeight: "700", fontSize: 13 }}>{key.linuxUsername || t.dataTableSettings.sshKeysTab.fallbackUser}</Text>
                    <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11 }}>{shortenFingerprint(key.fingerprint || "-")}</Text>
                  </View>
                  <Pressable style={styles.tabIconBtn} onPress={() => onEditKey(key)}>
                    <Pencil size={12} color={tokens.textMuted} />
                  </Pressable>
                  <Pressable style={styles.tabIconBtn} onPress={() => askConfirm(t.common.delete, t.dataTableSettings.sshKeysTab.confirmDelete, async () => {
                    // El gate 2FA (ssh.delete) lo maneja el reintento central de `request`.
                    await updateSshKeyApi(key.id, { panelIds: [] }, token);
                    await deleteSshKey(key.id, token);
                    applySshKeyDeleted(key.id);
                  })}>
                    <Trash2 size={12} color={tokens.textMuted} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
          <View style={[styles.paginationRow, { flexDirection: rowDirection }]}>
            <Pressable disabled={sshPage <= 1} style={[styles.pageBtn, { borderColor: tokens.border, opacity: sshPage <= 1 ? 0.5 : 1 }]} onPress={() => setSshPage((p) => Math.max(1, p - 1))}>
              <Text style={{ color: tokens.textSecondary }}>‹</Text>
            </Pressable>
            <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{sshPage}/{sshTotalPages}</Text>
            <Pressable disabled={sshPage >= sshTotalPages} style={[styles.pageBtn, { borderColor: tokens.border, opacity: sshPage >= sshTotalPages ? 0.5 : 1 }]} onPress={() => setSshPage((p) => Math.min(sshTotalPages, p + 1))}>
              <Text style={{ color: tokens.textSecondary }}>›</Text>
            </Pressable>
          </View>
        </>
      </View>
    </>
  );
}

export function IntegrationsTabBody({
  hideTabs,
  t,
  tokens,
  textAlign,
  rowDirection,
  cat,
  catalogLoading,
  catalog,
  openResources,
  openConnect,
  disconnectProvider,
}: {
  hideTabs: boolean;
  t: Messages;
  tokens: Tokens;
  textAlign: TextAlignValue;
  rowDirection: RowDirection;
  cat: Messages["dataTableSettings"]["integrationsTab"]["catalog"];
  catalogLoading: boolean;
  catalog: ProviderCatalogEntry[];
  openResources: (entry: ProviderCatalogEntry) => void;
  openConnect: (entry: ProviderCatalogEntry) => void;
  disconnectProvider: (entry: ProviderCatalogEntry) => void;
}) {
  return (
    <>
      {!hideTabs ? <Text style={[styles.sectionTitle, { color: tokens.textPrimary, textAlign }]}>{t.dataTableSettings.tabs.integrations}</Text> : null}
      <Text style={{ color: tokens.textMuted, fontSize: 12, marginBottom: 4, textAlign }}>{cat.intro}</Text>
      {catalogLoading ? (
        <Text style={{ color: tokens.textMuted, textAlign }}>{cat.loading}</Text>
      ) : catalog.length === 0 ? (
        <Text style={{ color: tokens.textMuted, textAlign }}>{cat.empty}</Text>
      ) : (
        catalog.map((entry) => {
          const pillColor = !entry.implemented ? tokens.textMuted : entry.connected ? tokens.brand : tokens.textMuted;
          const pillLabel = !entry.implemented ? cat.statusComingSoon : entry.connected ? cat.statusConnected : cat.statusNotConnected;
          return (
            <View key={entry.id} style={[styles.providerCard, { borderColor: tokens.border, backgroundColor: tokens.bgCard }]}>
              <View style={[styles.providerHeader, { flexDirection: rowDirection }]}>
                <View style={[styles.providerLogo, { backgroundColor: tokens.bgInput }]}>
                  <Text style={{ color: tokens.textPrimary, fontWeight: "800", fontSize: 13 }}>{entry.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={{ flex: 1, color: tokens.textPrimary, fontWeight: "700", fontSize: 14, textAlign }}>{entry.name}</Text>
                <View style={[styles.providerPill, { borderColor: pillColor }]}>
                  <Text style={{ color: pillColor, fontSize: 11 }}>{pillLabel}</Text>
                </View>
              </View>
              <View style={[styles.providerActions, { flexDirection: rowDirection }]}>
                {!entry.implemented ? (
                  <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{cat.comingSoon}</Text>
                ) : entry.connected ? (
                  <>
                    <Button variant="primary" size="sm" label={cat.viewResources} onPress={() => openResources(entry)} />
                    <Button variant="ghost" size="sm" label={cat.reconfigure} onPress={() => openConnect(entry)} />
                    <Button variant="danger" size="sm" icon={<Trash2 size={14} />} label={cat.disconnect} onPress={() => disconnectProvider(entry)} />
                  </>
                ) : (
                  <Button variant="primary" size="sm" label={cat.connect} onPress={() => openConnect(entry)} />
                )}
              </View>
            </View>
          );
        })
      )}
    </>
  );
}
