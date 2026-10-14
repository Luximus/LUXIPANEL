import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { styles } from "./PanelEditorModal.styles";
import { Check, Unplug, Search, Trash2, X } from "lucide-react-native";
import type { PanelTaxonomy, SshKeyOption } from "../api/client";
import type { PanelEditorState } from "../features/app/viewModels";
import { getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { Button } from "./ui/Button";
import { PanelCredentialSection } from "./PanelCredentialSection";
import { IconButton } from "./ui/IconButton";
import { SegmentedControl } from "./ui/SegmentedControl";
import { Chip } from "./ui/Chip";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";

export type PanelEditorPanelProps = {
  panelEditor: PanelEditorState;
  taxonomy: PanelTaxonomy["categories"];
  sshKeys: SshKeyOption[];
  setPanelEditor: React.Dispatch<React.SetStateAction<PanelEditorState>>;
  closePanelEditor: () => void;
  submitPanelEditor: () => void;
  requestDeletePanel: () => void;
  language?: string;
  /** Oculta el botón Cancelar (uso inline en el sheet "New", donde no hay modal). */
  hideCancel?: boolean;
};

/**
 * Cuerpo del editor de panel (crear/editar) SIN shell de modal: formulario
 * (General/SSH) + fila de acciones (Eliminar/Cancelar/Probar conexión). Lo usa el
 * `PanelEditorModal` (editar, desde la tarjeta) y el tab "New" del bottom-sheet
 * central (crear). Extraído de `PanelEditorModal`.
 */
export function PanelEditorPanel({
  panelEditor,
  taxonomy,
  sshKeys,
  setPanelEditor,
  closePanelEditor,
  submitPanelEditor,
  requestDeletePanel,
  language,
  hideCancel = false,
}: PanelEditorPanelProps) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  const isCreate = panelEditor.mode === "create";
  const hasSharedKeys = sshKeys.length > 0;
  const hasCategories = taxonomy.length > 0;
  const availableTags = React.useMemo(() => {
    const selected = taxonomy.find((cat) => cat.name === panelEditor.category);
    return selected ? selected.tags : [];
  }, [taxonomy, panelEditor.category]);
  const hasTags = availableTags.length > 0;
  const selectedTagsSet = new Set(panelEditor.tags);
  const selectedKeysSet = new Set(panelEditor.sshKeyIds);
  const portLabel = t.common.port;
  const [activeTab, setActiveTab] = React.useState<"general" | "ssh">("general");
  const [keySearch, setKeySearch] = React.useState("");
  const SWIPE_THRESHOLD = 64;
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const ipRef = React.useRef<TextInput>(null);
  const accessUrlRef = React.useRef<TextInput>(null);
  const sshUsernameRef = React.useRef<TextInput>(null);
  const sshPrivateKeyRef = React.useRef<TextInput>(null);
  const sshPassphraseRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    if (!panelEditor.open) return;
    setActiveTab("general");
    setKeySearch("");
  }, [panelEditor.open]);

  const FIELD_TAB: Record<NonNullable<typeof panelEditor.invalidField> & string, "general" | "ssh"> = {
    ip: "general",
    accessUrl: "general",
    sshUsername: "ssh",
    sshPrivateKey: "ssh",
    sshPassphrase: "ssh",
  };

  React.useEffect(() => {
    const field = panelEditor.invalidField;
    if (!field) return;
    const targetTab = FIELD_TAB[field];
    if (targetTab && targetTab !== activeTab) setActiveTab(targetTab);
    const refByField: Record<string, React.RefObject<TextInput | null>> = {
      ip: ipRef,
      accessUrl: accessUrlRef,
      sshUsername: sshUsernameRef,
      sshPrivateKey: sshPrivateKeyRef,
      sshPassphrase: sshPassphraseRef,
    };
    const handle = setTimeout(() => refByField[field]?.current?.focus(), 60);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelEditor.invalidField]);

  const clearInvalid = React.useCallback(() => {
    setPanelEditor((c) => (c.invalidField === null ? c : { ...c, invalidField: null }));
  }, [setPanelEditor]);

  function toggleTag(tagName: string) {
    setPanelEditor((current) => {
      const next = new Set(current.tags);
      if (next.has(tagName)) next.delete(tagName);
      else next.add(tagName);
      return { ...current, tags: Array.from(next) };
    });
  }

  function toggleKey(keyId: string) {
    setPanelEditor((current) => {
      const next = new Set(current.sshKeyIds);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return { ...current, sshKeyIds: Array.from(next) };
    });
  }

  function sanitizeIp(value: string): string {
    const cleaned = value.replace(/[^\d.]/g, "");
    let result = "";
    let groupLen = 0;
    let dots = 0;
    for (const ch of cleaned) {
      if (ch === ".") {
        if (groupLen === 0 || dots >= 3) continue;
        result += ".";
        dots += 1;
        groupLen = 0;
        continue;
      }
      if (groupLen === 3) {
        if (dots >= 3) continue;
        result += ".";
        dots += 1;
        groupLen = 0;
      }
      result += ch;
      groupLen += 1;
    }
    return result;
  }

  function sanitizePort(value: string): string {
    return value.replace(/[^\d]/g, "").slice(0, 5);
  }

  const categoryOptions = React.useMemo(
    () => [
      { value: "", label: t.panelEditor.categoryEmpty },
      ...taxonomy.map((category) => ({ value: category.name, label: category.name })),
    ],
    [taxonomy, t.panelEditor.categoryEmpty],
  );

  const filteredSshKeys = React.useMemo(() => {
    const search = keySearch.trim().toLowerCase();
    if (!search) return sshKeys;
    return sshKeys.filter((key) => (key.linuxUsername ?? "").toLowerCase().includes(search));
  }, [keySearch, sshKeys]);

  const handleTabSwipeEnd = React.useCallback((dx: number, dy: number) => {
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0 && activeTab === "general") { setActiveTab("ssh"); return; }
    if (dx > 0 && activeTab === "ssh") setActiveTab("general");
  }, [activeTab]);

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.tabsRow, { borderColor: tokens.border }]}>
        <SegmentedControl
          fill
          value={activeTab}
          onChange={(key) => setActiveTab(key as "general" | "ssh")}
          items={[
            { key: "general", label: t.settingsModals.panelTabGeneral },
            { key: "ssh", label: t.panelEditor.tabSsh },
          ]}
        />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.tabBody} keyboardShouldPersistTaps="handled">
        <View
          onTouchStart={(event) => {
            const { pageX, pageY } = event.nativeEvent;
            touchStartRef.current = { x: pageX, y: pageY };
          }}
          onTouchEnd={(event) => {
            if (!touchStartRef.current) return;
            const { pageX, pageY } = event.nativeEvent;
            const dx = pageX - touchStartRef.current.x;
            const dy = pageY - touchStartRef.current.y;
            touchStartRef.current = null;
            handleTabSwipeEnd(dx, dy);
          }}
        >
          {activeTab === "general" ? (
            <>
              <View style={styles.row}>
                <View style={styles.col}>
                  <Input
                    ref={ipRef}
                    label={t.panelEditor.ipLabel}
                    placeholder={t.panelEditor.ipPlaceholder}
                    keyboardType="numeric"
                    value={panelEditor.ip}
                    error={panelEditor.invalidField === "ip" ? " " : undefined}
                    onChangeText={(v) => { clearInvalid(); setPanelEditor((c) => ({ ...c, ip: sanitizeIp(v) })); }}
                  />
                </View>
                <View style={styles.colPort}>
                  <Input
                    label={portLabel}
                    placeholder="22"
                    keyboardType="numeric"
                    value={panelEditor.port}
                    onChangeText={(v) => setPanelEditor((c) => ({ ...c, port: sanitizePort(v) }))}
                  />
                </View>
              </View>

              {/* URL COMPLETA de acceso al LUXIPANEL (customDomain): esquema y
                  puerto opcionales; reemplaza al subdominio managed retirado. */}
              <View style={styles.col}>
                <Input
                  ref={accessUrlRef}
                  label={t.panelEditor.accessUrlLabel}
                  placeholder={t.panelEditor.accessUrlPlaceholder}
                  maxLength={255}
                  value={panelEditor.accessUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                  autoCorrect={false}
                  error={panelEditor.invalidField === "accessUrl" ? " " : undefined}
                  onChangeText={(v) => { clearInvalid(); setPanelEditor((c) => ({ ...c, accessUrl: v })); }}
                />
              </View>

              {hasCategories ? (
                <View style={styles.col}>
                  <View style={{ gap: 6 }}>
                    <Text style={[styles.label, { color: tokens.textMuted }]}>{t.panelEditor.categoryLabel}</Text>
                    <Select
                      value={panelEditor.category}
                      options={categoryOptions}
                      onChange={(next) => {
                        const allowed = new Set(
                          (taxonomy.find((cat) => cat.name === next)?.tags ?? []).map((tg) => tg.name),
                        );
                        setPanelEditor((c) => ({ ...c, category: next, tags: c.tags.filter((name) => allowed.has(name)) }));
                      }}
                    />
                  </View>
                </View>
              ) : null}

              {hasTags ? (
                <View>
                  <Text style={[styles.label, { color: tokens.textMuted }]}>{t.panelEditor.tagsLabel}</Text>
                  <View style={styles.chipsRow}>
                    {availableTags.map((tag) => (
                      <Chip key={tag.id} label={tag.name} selected={selectedTagsSet.has(tag.name)} onPress={() => toggleTag(tag.name)} />
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Credencial de conexión por-panel (lxp_live_): solo al EDITAR un
                  panel existente (necesita panelId). Ver/rotar/copiar/revocar. */}
              {!isCreate && panelEditor.panelId ? (
                <PanelCredentialSection panelId={panelEditor.panelId} language={language} />
              ) : null}
            </>
          ) : (
            <>
              {!hasSharedKeys ? (
                <>
                  <Input
                    ref={sshUsernameRef}
                    label={t.panelEditor.sshUserLabel}
                    placeholder={t.panelEditor.sshUserPlaceholder}
                    maxLength={64}
                    autoCapitalize="none"
                    value={panelEditor.sshUsername}
                    error={panelEditor.invalidField === "sshUsername" ? " " : undefined}
                    onChangeText={(v) => { clearInvalid(); setPanelEditor((c) => ({ ...c, sshUsername: v })); }}
                    hint={`${t.panelEditor.sshUserHintBefore} ~/.ssh/authorized_keys ${t.panelEditor.sshUserHintAfter}`}
                  />
                  <Input
                    ref={sshPrivateKeyRef}
                    label={t.panelEditor.firstKeyLabel}
                    placeholder={t.panelEditor.firstKeyPlaceholder}
                    multiline
                    value={panelEditor.sshPrivateKey}
                    error={panelEditor.invalidField === "sshPrivateKey" ? " " : undefined}
                    onChangeText={(v) => { clearInvalid(); setPanelEditor((c) => ({ ...c, sshPrivateKey: v })); }}
                    hint={isCreate ? t.panelEditor.firstKeyHintCreate : t.panelEditor.firstKeyHintExisting}
                  />
                  <Input
                    ref={sshPassphraseRef}
                    label={t.panelEditor.passphraseLabel}
                    placeholder={t.panelEditor.passphrasePlaceholder}
                    secureTextEntry
                    secureToggle
                    autoCapitalize="none"
                    value={panelEditor.sshPassphrase}
                    error={panelEditor.invalidField === "sshPassphrase" ? " " : undefined}
                    onChangeText={(v) => { clearInvalid(); setPanelEditor((c) => ({ ...c, sshPassphrase: v })); }}
                  />
                </>
              ) : (
                <View>
                  <Text style={[styles.sshHintTop, { color: tokens.textMuted }]}>{t.panelEditor.panelKeysHint}</Text>
                  <View style={[styles.searchWrap, { borderColor: tokens.border, backgroundColor: tokens.bgCard }]}>
                    <Search size={14} color={tokens.textMuted} />
                    <TextInput
                      placeholder={t.panelEditor.sshUserPlaceholder}
                      placeholderTextColor={tokens.textMuted}
                      value={keySearch}
                      onChangeText={setKeySearch}
                      autoCapitalize="none"
                      style={[styles.searchInput, { color: tokens.textSecondary }]}
                    />
                  </View>
                  <View style={[styles.keyListContainer, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
                    <ScrollView style={styles.keyListScroll} contentContainerStyle={styles.keyList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filteredSshKeys.length === 0 ? (
                        <Text style={[styles.emptyListText, { color: tokens.textMuted }]}>{t.common.emptyList}</Text>
                      ) : null}
                      {filteredSshKeys.map((key) => {
                        const active = selectedKeysSet.has(key.id);
                        return (
                          <Pressable key={key.id} onPress={() => toggleKey(key.id)} style={[styles.keyRow, active && { backgroundColor: tokens.brandDim }]}>
                            <View style={[styles.checkbox, { borderColor: tokens.border, backgroundColor: active ? tokens.brand : "transparent" }]}>
                              {active ? <Check size={12} color="#fff" /> : null}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: tokens.textPrimary, fontWeight: "700", fontSize: 13 }}>{key.linuxUsername || t.panelEditor.noSshUser}</Text>
                              {key.fingerprint ? <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{key.fingerprint}</Text> : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              )}
            </>
          )}

          {panelEditor.error ? (
            <View style={[styles.errorBox, { borderColor: tokens.danger, backgroundColor: tokens.bgSecondary }]}>
              <Text style={{ color: tokens.danger, fontSize: 13 }}>{panelEditor.error}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: tokens.border }}>
        {!isCreate ? (
          <IconButton
            variant="danger"
            size={40}
            onPress={requestDeletePanel}
            disabled={panelEditor.saving}
            accessibilityLabel={t.panelTable.actions.delete}
            icon={<Trash2 size={16} />}
            style={{ marginRight: "auto" }}
          />
        ) : null}
        {!hideCancel ? (
          <Button label={t.panelEditor.cancel} variant="ghost" onPress={closePanelEditor} icon={<X size={15} />} />
        ) : null}
        <Button
          label={panelEditor.saving ? t.panelEditor.testingConnection : t.panelEditor.testConnection}
          variant="primary"
          onPress={submitPanelEditor}
          loading={panelEditor.saving}
          disabled={panelEditor.saving}
          icon={<Unplug size={15} color="#fff" />}
        />
      </View>
    </View>
  );
}

export default PanelEditorPanel;
