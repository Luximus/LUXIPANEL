/**
 * Overlays del catálogo multi-proveedor de integraciones (extraídos de
 * `DataTableSettingsModal.tsx`): credenciales (conectar/reconfigurar + ayuda) y
 * recursos (importar VPS como paneles). SIN estado propio: valores/handlers
 * viven en `SettingsPanels` y llegan por props.
 */
import React from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Check, Save } from "lucide-react-native";
import { styles } from "../DataTableSettingsModal.styles";
import { FormSheet } from "../ui/FormSheet";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";
import { getLocaleTextAlign, getMessages } from "../../i18n";
import type { ProviderCatalogEntry, ProviderResource, ProviderScope } from "../../api/client";
import type { getThemeTokens } from "../../theme/colors";

type Messages = ReturnType<typeof getMessages>;
type Tokens = ReturnType<typeof getThemeTokens>;
type TextAlignValue = ReturnType<typeof getLocaleTextAlign>;
type CatalogStrings = Messages["dataTableSettings"]["integrationsTab"]["catalog"];

export function CredentialsSheet({
  credEntry,
  credTab,
  onCredTabChange,
  credValues,
  credInvalidKeys,
  onChangeField,
  credFieldRefs,
  onClose,
  onSave,
  t,
  cat,
  tokens,
  textAlign,
  language,
}: {
  credEntry: ProviderCatalogEntry | null;
  credTab: "connection" | "help";
  onCredTabChange: (tab: "connection" | "help") => void;
  credValues: Record<string, string>;
  credInvalidKeys: string[];
  onChangeField: (key: string, v: string) => void;
  credFieldRefs: React.MutableRefObject<Record<string, TextInput | null>>;
  onClose: () => void;
  onSave: () => void;
  t: Messages;
  cat: CatalogStrings;
  tokens: Tokens;
  textAlign: TextAlignValue;
  language: string;
}) {
  const fieldLabel = (key: string): string => (cat.fieldLabels as Record<string, string>)[key] ?? key;
  return (
    <FormSheet
      visible={!!credEntry}
      onClose={onClose}
      title={credEntry ? cat.credentialsTitle.replace("{provider}", credEntry.name) : ""}
      language={language}
      footer={(
        <>
          <Button variant="ghost" label={t.common.cancel} onPress={onClose} />
          {credTab === "connection" ? (
            <Button variant="primary" icon={<Save size={14} />} label={t.common.save} onPress={onSave} />
          ) : null}
        </>
      )}
    >
      <View style={styles.body}>
        <SegmentedControl
          fill
          value={credTab}
          onChange={(key) => onCredTabChange(key as "connection" | "help")}
          items={[
            { key: "connection", label: t.dataTableSettings.integrationsTab.connectionTab },
            { key: "help", label: t.dataTableSettings.integrationsTab.helpTab },
          ]}
        />
        {credTab === "connection" ? (
          <>
            <Text style={{ color: tokens.textMuted, fontSize: 12, textAlign }}>{cat.credentialsHint}</Text>
            {(credEntry?.credentialFields ?? []).map((field) => (
              <View key={field.key}>
                <Text style={{ color: tokens.textSecondary, fontSize: 12, marginBottom: 4, textAlign }}>{fieldLabel(field.label)}{field.required ? " *" : ""}</Text>
                <TextInput
                  ref={(node) => { credFieldRefs.current[field.key] = node; }}
                  value={credValues[field.key] ?? ""}
                  onChangeText={(v) => onChangeField(field.key, v)}
                  placeholder={field.placeholder ?? ""}
                  placeholderTextColor={tokens.textMuted}
                  secureTextEntry={field.type === "password"}
                  multiline={field.type === "textarea"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, field.type === "textarea" ? styles.textarea : null, { borderColor: credInvalidKeys.includes(field.key) ? tokens.danger : tokens.border, color: tokens.textPrimary, textAlign }]}
                />
              </View>
            ))}
          </>
        ) : !credEntry?.help ? (
          <Text style={{ color: tokens.textMuted, fontSize: 13, textAlign }}>{t.dataTableSettings.integrationsTab.helpEmpty}</Text>
        ) : (
          <>
            <Text style={{ color: tokens.textSecondary, fontSize: 13, lineHeight: 19, textAlign }}>{credEntry.help.intro}</Text>
            <View style={{ gap: 8 }}>
              {credEntry.help.steps.map((step, i) => (
                <Text key={i} style={{ color: tokens.textPrimary, fontSize: 13, lineHeight: 19, textAlign }}>
                  {i + 1}. {step}
                </Text>
              ))}
            </View>
            <Pressable onPress={() => { void Linking.openURL(credEntry.help!.docUrl); }}>
              <Text style={{ color: tokens.brand, fontSize: 13, fontWeight: "700", textAlign }}>
                {t.dataTableSettings.integrationsTab.helpDocsLink}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </FormSheet>
  );
}

export function ResourcesSheet({
  resEntry,
  scopes,
  scopeId,
  resources,
  resLoading,
  resSelectedIds,
  onScopeChange,
  onToggleSelect,
  onRegister,
  onClose,
  t,
  cat,
  tokens,
  textAlign,
  language,
}: {
  resEntry: ProviderCatalogEntry | null;
  scopes: ProviderScope[];
  scopeId: string;
  resources: ProviderResource[];
  resLoading: boolean;
  resSelectedIds: string[];
  onScopeChange: (value: string) => void;
  onToggleSelect: (id: string) => void;
  onRegister: () => void;
  onClose: () => void;
  t: Messages;
  cat: CatalogStrings;
  tokens: Tokens;
  textAlign: TextAlignValue;
  language: string;
}) {
  const fieldLabel = (key: string): string => (cat.fieldLabels as Record<string, string>)[key] ?? key;
  return (
    <FormSheet
      visible={!!resEntry}
      onClose={onClose}
      title={resEntry ? cat.resourcesTitle.replace("{provider}", resEntry.name) : ""}
      language={language}
      footer={(
        <>
          <Button variant="ghost" label={t.common.cancel} onPress={onClose} />
          <Button
            variant="primary"
            label={`${cat.registerSelected}${resSelectedIds.length ? ` (${resSelectedIds.length})` : ""}`}
            disabled={resSelectedIds.length === 0}
            onPress={onRegister}
          />
        </>
      )}
    >
      <View style={styles.body}>
        <Text style={{ color: tokens.textMuted, fontSize: 12, textAlign }}>{cat.resourcesSubtitle}</Text>
        {resEntry?.hasScopes ? (
          <Select
            value={scopeId}
            options={scopes.length ? scopes.map((sc) => ({ value: sc.id, label: sc.name })) : [{ value: "", label: cat.noScopes }]}
            onChange={onScopeChange}
            placeholder={resEntry.scopeLabel ? fieldLabel(resEntry.scopeLabel) : cat.scopeLabel}
          />
        ) : null}
        {resLoading ? (
          <Text style={{ color: tokens.textMuted, textAlign }}>{cat.loading}</Text>
        ) : resources.length === 0 ? (
          <Text style={{ color: tokens.textMuted, textAlign }}>{cat.noResources}</Text>
        ) : (
          <View style={[styles.keyListContainer, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
            <ScrollView style={styles.keyListScroll} contentContainerStyle={styles.keyList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {resources.map((r, idx) => {
                const active = resSelectedIds.includes(r.id);
                return (
                  <Pressable key={r.id} onPress={() => onToggleSelect(r.id)} style={[styles.keyRow, idx === resources.length - 1 && styles.keyRowLast, { backgroundColor: "transparent" }]}>
                    <View style={[styles.selectBox, { borderColor: tokens.border, backgroundColor: active ? tokens.brand : "transparent" }]}>
                      {active ? <Check size={12} color="#fff" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: tokens.textPrimary, fontWeight: "700", fontSize: 13 }}>{r.name}</Text>
                      <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11 }}>
                        {[r.region, r.size, r.status, r.ip].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    </FormSheet>
  );
}
