import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { styles } from "./DataTableSettingsModal.styles";
import { usePullRefresh } from "../hooks/usePullRefresh";
import { Check, Copy, Plus, RefreshCw, Trash2, KeyRound, Folder, Plug, KeySquare } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { SettingsColumns } from "./ui/ModuleSettingsDrawer";
import { useInlineEditCancel } from "../hooks/useInlineEditCancel";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import { SegmentedControl } from "./ui/SegmentedControl";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../i18n";
import {
  createPanelCategory,
  createPanelTag,
  createSshKey,
  deletePanelCategory,
  deletePanelTag,
  deleteProviderIntegration,
  deleteSshKey,
  getApiToken,
  getProviderCatalog,
  getProviderIntegration,
  listProviderResources,
  listProviderScopes,
  registerProviderResources,
  rotateApiToken,
  saveProviderIntegration,
  updateSshKeyApi,
  type PanelTaxonomy,
  type ProviderCatalogEntry,
  type ProviderResource,
  type ProviderScope,
  type SshKeySummary,
} from "../api/client";

import { SettingsDrawerShell } from "./DataTableSettingsShell";
import {
  CategoriesTabBody,
  IntegrationsTabBody,
  SshKeysTabBody,
} from "./datatable-settings/SettingsListTabs";
import {
  ConfirmDeleteModal,
  RegisterCatTagSheet,
  RegisterSshSheet,
  SshEditSheet,
} from "./datatable-settings/SettingsSheets";
import { CredentialsSheet, ResourcesSheet } from "./datatable-settings/IntegrationSheets";

export type SettingsTab = "categories" | "tags" | "ssh_keys" | "integrations" | "api";

// Orden de las secciones de navegación del drawer.
const TAB_ORDER: SettingsTab[] = ["ssh_keys", "categories", "integrations", "api"];

type SettingsDataProps = {
  language: string;
  token: string;
  taxonomy: PanelTaxonomy["categories"];
  sshKeys: SshKeySummary[];
  refreshTaxonomy: () => Promise<void>;
  refreshSshKeys: () => Promise<void>;
  applyCategoryCreated: (category: { id: string; name: string }) => void;
  applyCategoryRenamed: (id: string, name: string) => void;
  applyCategoryDeleted: (id: string) => void;
  applyTagCreated: (categoryId: string, tag: { id: string; name: string }) => void;
  applyTagRenamed: (id: string, name: string) => void;
  applyTagDeleted: (id: string) => void;
  applySshKeyCreated: (key: SshKeySummary) => void;
  applySshKeyUpdated: (key: SshKeySummary) => void;
  applySshKeyDeleted: (id: string) => void;
};

/**
 * Cuerpo reutilizable de los paneles de ajustes (SSH/Categorías/Tags/Integraciones/
 * API). El `tab` activo es CONTROLADO por el contenedor (`tab` + `onTabChange`) para
 * que tanto el modal/drawer del gear como el `ServerDrawer` puedan montar uno o
 * varios tabs. Devuelve solo el contenido (sin shell): el contenedor lo envuelve.
 * Los cuerpos de lista y los overlays viven en `./datatable-settings/*` como
 * componentes SIN estado; todo el estado y los handlers siguen aquí.
 */
export function SettingsPanels({
  visible,
  tab,
  onTabChange,
  hideTabs = false,
  presentation = "drawer",
  language,
  token,
  taxonomy,
  sshKeys,
  refreshTaxonomy,
  refreshSshKeys,
  applyCategoryCreated,
  applyCategoryRenamed,
  applyCategoryDeleted,
  applyTagCreated,
  applyTagRenamed,
  applyTagDeleted,
  applySshKeyCreated,
  applySshKeyUpdated,
  applySshKeyDeleted,
  initialSshTab,
}: SettingsDataProps & {
  visible: boolean;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  hideTabs?: boolean;
  presentation?: "modal" | "drawer";
  /** Sub-tab inicial del tab SSH al montar ("register" para abrir directo en el
   *  formulario de registro; por defecto "list"). */
  initialSshTab?: "list" | "register";
}) {
  const setTab = onTabChange;
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [newTag, setNewTag] = useState("");
  const [sshUser, setSshUser] = useState("");
  const [sshKey, setSshKey] = useState("");
  // Catálogo multi-proveedor de integraciones.
  const [catalog, setCatalog] = useState<ProviderCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [credEntry, setCredEntry] = useState<ProviderCatalogEntry | null>(null);
  const [credTab, setCredTab] = useState<"connection" | "help">("connection");
  const [credValues, setCredValues] = useState<Record<string, string>>({});
  const [resEntry, setResEntry] = useState<ProviderCatalogEntry | null>(null);
  const [scopes, setScopes] = useState<ProviderScope[]>([]);
  const [scopeId, setScopeId] = useState("");
  const [resources, setResources] = useState<ProviderResource[]>([]);
  const [resLoading, setResLoading] = useState(false);
  const [resSelectedIds, setResSelectedIds] = useState<string[]>([]);
  const [apiMasked, setApiMasked] = useState("");
  const [apiEmail, setApiEmail] = useState("");
  const [apiPlaintext, setApiPlaintext] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [sshSearch, setSshSearch] = useState("");
  // Formulario de registro del tab activo, desplegado en el drawer CENTRAL de
  // formularios (FormSheet, hasta 80% de pantalla). Los tabs SSH/Categorías ya
  // no tienen sub-tabs Lista/Registro: el cuerpo es la lista y el formulario se
  // abre con el botón fijo inferior. Tras crear, el sheet se cierra.
  const [registerSheet, setRegisterSheet] = useState<null | "ssh" | "catTag">(initialSshTab === "register" ? "ssh" : null);
  const [categoryPage, setCategoryPage] = useState(1);
  const [sshPage, setSshPage] = useState(1);
  // Selección múltiple para borrado en lote (categorías / tags / ssh keys).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: null | (() => Promise<void>);
  }>({ open: false, title: "", message: "", action: null });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  // Rename inline de categoría/tag en curso: atrás de Android u ocultar el
  // teclado lo CANCELAN (descartan el borrador) en vez de cerrar el drawer.
  useInlineEditCancel(editingCategoryId !== null || editingTagId !== null, () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingTagId(null);
    setEditingTagName("");
  });
  const [sshEditModal, setSshEditModal] = useState<{ open: boolean; id: string; linuxUsername: string; panelIds: string[]; sshKey: string; passphrase: string }>({
    open: false,
    id: "",
    linuxUsername: "",
    panelIds: [],
    sshKey: "",
    passphrase: "",
  });
  // Validación "focus al guardar" para los formularios con campos obligatorios.
  // `invalidField` marca el campo que falta (borde rojo); las refs lo enfocan.
  const [invalidField, setInvalidField] = useState<
    "newCategory" | "newTag" | "selectedCategory" | "sshUser" | "sshKey" | "editLinuxUsername" | null
  >(null);
  const newCategoryRef = React.useRef<TextInput>(null);
  const newTagRef = React.useRef<TextInput>(null);
  const sshUserRef = React.useRef<TextInput>(null);
  const sshKeyRef = React.useRef<TextInput>(null);
  const editLinuxUsernameRef = React.useRef<TextInput>(null);
  // Campos obligatorios faltantes del modal de credenciales del proveedor.
  const [credInvalidKeys, setCredInvalidKeys] = useState<string[]>([]);
  const credFieldRefs = React.useRef<Record<string, TextInput | null>>({});

  // Limpia las marcas de inválido al cambiar de pestaña, abrir/cerrar el
  // formulario o cerrar el contenedor.
  useEffect(() => {
    setInvalidField(null);
  }, [tab, registerSheet, visible]);
  useEffect(() => {
    if (!credEntry) setCredInvalidKeys([]);
  }, [credEntry]);
  useEffect(() => {
    if (!sshEditModal.open && invalidField === "editLinuxUsername") setInvalidField(null);
  }, [sshEditModal.open, invalidField]);

  const tabs = t.dataTableSettings.tabs;

  const loadCatalog = React.useCallback(async () => {
    if (!token) return;
    try {
      setCatalog(await getProviderCatalog(token, language));
    } catch {
      // noop
    } finally {
      setCatalogLoading(false);
    }
  }, [token, language]);

  // Pull-to-refresh: recarga lo que alimenta los 4 tabs (categorías/tags + llaves
  // SSH vía el contenedor, catálogo de integraciones y token API).
  const refreshAll = React.useCallback(async () => {
    await Promise.all([
      refreshTaxonomy?.().catch(() => {}),
      refreshSshKeys?.().catch(() => {}),
      loadCatalog(),
    ]);
    if (token) {
      try {
        const api = await getApiToken(token);
        setApiEmail(api.email ?? "");
        if (api.token) setApiMasked(`${api.token.prefix}***${api.token.last4}`);
        else setApiMasked("");
      } catch {
        // noop
      }
    }
  }, [refreshTaxonomy, refreshSshKeys, loadCatalog, token]);
  const { refreshing: panelsRefreshing, onRefresh: onPanelsRefresh } = usePullRefresh(refreshAll);

  useEffect(() => {
    if (!visible || !token) return;
    void (async () => {
      try {
        const api = await getApiToken(token);
        setApiEmail(api.email ?? "");
        setApiPlaintext("");
        if (api.token) setApiMasked(`${api.token.prefix}***${api.token.last4}`);
        else setApiMasked("");
      } catch {
        // noop
      }
    })();
    void loadCatalog();
  }, [visible, token, loadCatalog]);

  useEffect(() => {
    if (!visible) return;
    setApiPlaintext("");
  }, [visible]);

  useEffect(() => {
    if (!selectedCategoryId) return;
    if (!taxonomy.some((cat) => cat.id === selectedCategoryId)) setSelectedCategoryId("");
  }, [selectedCategoryId, taxonomy]);

  // Limpia la selección y cierra el formulario de registro al cambiar de pestaña
  // o al abrir/cerrar. SALTA el primer render: el sheet puede venir abierto de
  // fábrica (`initialSshTab === "register"`, p. ej. "registrar llave SSH").
  const firstRunRef = React.useRef(true);
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    setSelectedIds([]);
    setRegisterSheet(null);
  }, [tab, visible]);

  const tags = useMemo(() => {
    const selected = taxonomy.find((c) => c.id === selectedCategoryId);
    return selected?.tags ?? [];
  }, [selectedCategoryId, taxonomy]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return taxonomy;
    return taxonomy.filter((cat) => cat.name.toLowerCase().includes(q));
  }, [taxonomy, categorySearch]);

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [tags, tagSearch]);

  const filteredSshKeys = useMemo(() => {
    const q = sshSearch.trim().toLowerCase();
    if (!q) return sshKeys;
    return sshKeys.filter((key) => (key.linuxUsername ?? "").toLowerCase().includes(q));
  }, [sshKeys, sshSearch]);
  const PAGE_SIZE = 10;
  const pagedCategories = useMemo(
    () => filteredCategories.slice((categoryPage - 1) * PAGE_SIZE, categoryPage * PAGE_SIZE),
    [filteredCategories, categoryPage],
  );
  const categoryTotalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const pagedSshKeys = useMemo(
    () => filteredSshKeys.slice((sshPage - 1) * PAGE_SIZE, sshPage * PAGE_SIZE),
    [filteredSshKeys, sshPage],
  );
  const sshTotalPages = Math.max(1, Math.ceil(filteredSshKeys.length / PAGE_SIZE));

  const categoryOptions = useMemo(
    () => [
      { value: "", label: t.panelEditor.categoryEmpty },
      ...taxonomy.map((cat) => ({ value: cat.id, label: cat.name })),
    ],
    [taxonomy, t.panelEditor.categoryEmpty],
  );

  const run = async (fn: () => Promise<void>) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const askConfirm = (title: string, message: string, action: () => Promise<void>) => {
    setConfirmState({ open: true, title, message, action });
  };
  const runConfirmed = async () => {
    if (!confirmState.action) return;
    await run(confirmState.action);
    setConfirmState({ open: false, title: "", message: "", action: null });
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const bulkDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const ids = [...selectedIds];
    askConfirm(t.common.deleteSelected, t.common.confirmDeleteSelected.replace("{count}", String(ids.length)), async () => {
      if (tab === "categories") {
        for (const id of ids) {
          const category = taxonomy.find((c) => c.id === id);
          for (const tg of category?.tags ?? []) await deletePanelTag(tg.id, token);
          await deletePanelCategory(id, token);
          applyCategoryDeleted(id);
        }
      } else if (tab === "tags") {
        for (const id of ids) {
          await deletePanelTag(id, token);
          applyTagDeleted(id);
        }
      } else if (tab === "ssh_keys") {
        // El gate 2FA (si el usuario activó ssh.delete) lo maneja el reintento
        // central del helper `request`: pide el código y reintenta solo.
        for (const id of ids) {
          await updateSshKeyApi(id, { panelIds: [] }, token);
          await deleteSshKey(id, token);
          applySshKeyDeleted(id);
        }
      }
      setSelectedIds([]);
    });
  };

  const renderSelectCheck = (id: string) => {
    const active = selectedIds.includes(id);
    return (
      <Pressable
        onPress={() => toggleSelect(id)}
        style={[styles.selectBox, { borderColor: tokens.border, backgroundColor: active ? tokens.brand : "transparent" }]}
      >
        {active ? <Check size={12} color="#fff" /> : null}
      </Pressable>
    );
  };

  // ── Catálogo multi-proveedor de integraciones ──────────────────────────
  const cat = t.dataTableSettings.integrationsTab.catalog;

  const openConnect = (entry: ProviderCatalogEntry) => {
    if (!entry.implemented) return;
    void run(async () => {
      let values: Record<string, string> = {};
      if (entry.connected) {
        try {
          const detail = await getProviderIntegration(entry.id, token);
          values = detail.values ?? {};
        } catch {
          // sin precarga de no-secretos
        }
      }
      setCredValues(values);
      setCredTab("connection");
      setCredEntry(entry);
    });
  };

  const saveCreds = () => {
    const entry = credEntry;
    if (!entry) return;
    const missing = entry.credentialFields
      .filter((f) => f.required && !(credValues[f.key] ?? "").trim())
      .map((f) => f.key);
    if (missing.length > 0) {
      setCredInvalidKeys(missing);
      credFieldRefs.current[missing[0]]?.focus();
      Alert.alert(cat.fieldsRequired);
      return;
    }
    setCredInvalidKeys([]);
    const payload: Record<string, string> = {};
    for (const f of entry.credentialFields) {
      const v = (credValues[f.key] ?? "").trim();
      if (v) payload[f.key] = v;
    }
    void run(async () => {
      await saveProviderIntegration(entry.id, payload, token);
      setCredEntry(null);
      await loadCatalog();
    });
  };

  const disconnectProvider = (entry: ProviderCatalogEntry) => {
    askConfirm(cat.disconnectTitle, cat.disconnectText.replace("{provider}", entry.name), async () => {
      await deleteProviderIntegration(entry.id, token);
      await loadCatalog();
    });
  };

  const loadResources = async (entry: ProviderCatalogEntry, scope: string) => {
    if (entry.hasScopes && !scope) {
      setResources([]);
      return;
    }
    setResLoading(true);
    try {
      setResources(await listProviderResources(entry.id, entry.hasScopes ? scope : null, token));
    } catch {
      // noop
    } finally {
      setResLoading(false);
    }
  };

  const openResources = (entry: ProviderCatalogEntry) => {
    if (!entry.implemented || !entry.connected) return;
    setResources([]);
    setScopes([]);
    setScopeId("");
    setResSelectedIds([]);
    setResEntry(entry);
    void (async () => {
      try {
        if (entry.hasScopes) {
          const sc = await listProviderScopes(entry.id, token);
          setScopes(sc);
          const first = sc[0]?.id ?? "";
          setScopeId(first);
          await loadResources(entry, first);
        } else {
          await loadResources(entry, "");
        }
      } catch {
        // noop
      }
    })();
  };

  const handleScopeChange = (value: string) => {
    setScopeId(value);
    setResSelectedIds([]);
    if (resEntry) void loadResources(resEntry, value);
  };

  const toggleResSelect = (id: string) =>
    setResSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const registerSelected = () => {
    const entry = resEntry;
    if (!entry || resSelectedIds.length === 0) return;
    const chosen = resources.filter((r) => resSelectedIds.includes(r.id));
    void run(async () => {
      await registerProviderResources(
        entry.id,
        {
          scopeId: entry.hasScopes ? (scopeId || null) : null,
          resources: chosen.map((r) => ({
            id: r.id,
            name: r.name,
            ip: r.ip ?? null,
            privateIp: r.privateIp ?? null,
            region: r.region ?? null,
            status: r.status ?? null,
            size: r.size ?? null,
          })),
        },
        token,
      );
      setResSelectedIds([]);
      await loadResources(entry, scopeId);
    });
  };

  const copy = async (value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
  };
  const content = (
    <>


      {selectedIds.length > 0 && (tab === "categories" || tab === "tags" || tab === "ssh_keys") ? (
        <View style={{ paddingBottom: 8 }}>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={14} />}
            label={`${t.common.deleteSelected} (${selectedIds.length})`}
            onPress={bulkDeleteSelected}
            style={{ alignSelf: "flex-start" }}
          />
        </View>
      ) : null}

      <ScrollView
        style={presentation === "drawer" ? styles.drawerScroll : { maxHeight: 460 }}
        contentContainerStyle={[styles.body, presentation === "drawer" && styles.bodyDrawer]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={panelsRefreshing} onRefresh={onPanelsRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
      >
        {tab === "categories" ? (
          <CategoriesTabBody
            hideTabs={hideTabs}
            t={t}
            tokens={tokens}
            textAlign={textAlign}
            rowDirection={rowDirection}
            token={token}
            taxonomy={taxonomy}
            categorySearch={categorySearch}
            setCategorySearch={setCategorySearch}
            pagedCategories={pagedCategories}
            categoryPage={categoryPage}
            setCategoryPage={setCategoryPage}
            categoryTotalPages={categoryTotalPages}
            tagSearch={tagSearch}
            setTagSearch={setTagSearch}
            filteredTags={filteredTags}
            editingCategoryId={editingCategoryId}
            editingCategoryName={editingCategoryName}
            setEditingCategoryId={setEditingCategoryId}
            setEditingCategoryName={setEditingCategoryName}
            editingTagId={editingTagId}
            editingTagName={editingTagName}
            setEditingTagId={setEditingTagId}
            setEditingTagName={setEditingTagName}
            renderSelectCheck={renderSelectCheck}
            run={run}
            askConfirm={askConfirm}
            applyCategoryRenamed={applyCategoryRenamed}
            applyCategoryDeleted={applyCategoryDeleted}
            applyTagRenamed={applyTagRenamed}
            applyTagDeleted={applyTagDeleted}
          />
        ) : null}

        {tab === "ssh_keys" ? (
          <SshKeysTabBody
            hideTabs={hideTabs}
            t={t}
            tokens={tokens}
            textAlign={textAlign}
            rowDirection={rowDirection}
            token={token}
            sshSearch={sshSearch}
            setSshSearch={setSshSearch}
            pagedSshKeys={pagedSshKeys}
            sshPage={sshPage}
            setSshPage={setSshPage}
            sshTotalPages={sshTotalPages}
            renderSelectCheck={renderSelectCheck}
            askConfirm={askConfirm}
            onEditKey={(key) => setSshEditModal({ open: true, id: key.id, linuxUsername: key.linuxUsername || "root", panelIds: Array.isArray(key.panelIds) ? key.panelIds : [], sshKey: "", passphrase: "" })}
            applySshKeyDeleted={applySshKeyDeleted}
          />
        ) : null}

        {tab === "integrations" ? (
          <IntegrationsTabBody
            hideTabs={hideTabs}
            t={t}
            tokens={tokens}
            textAlign={textAlign}
            rowDirection={rowDirection}
            cat={cat}
            catalogLoading={catalogLoading}
            catalog={catalog}
            openResources={openResources}
            openConnect={openConnect}
            disconnectProvider={disconnectProvider}
          />
        ) : null}

        {tab === "api" ? (
          <>
            {!hideTabs ? <Text style={[styles.sectionTitle, { color: tokens.textPrimary, textAlign }]}>{t.dataTableSettings.apiTab.heading}</Text> : null}
            <Text style={{ color: tokens.textMuted, textAlign }}>{t.dataTableSettings.apiTab.registeredEmail}: {apiEmail || "-"}</Text>
            <Text style={{ color: tokens.textMuted, marginBottom: 8, textAlign }}>{t.dataTableSettings.apiTab.currentToken}: {apiMasked || "-"}</Text>
            <View style={[styles.apiTokenRow, { borderColor: tokens.warning, backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
              <TextInput
                editable={false}
                value={apiPlaintext}
                placeholder={t.settingsModals.apiTokenPlaceholder}
                placeholderTextColor={tokens.textMuted}
                style={[styles.apiTokenInput, { color: tokens.textPrimary }]}
              />
              <IconButton
                variant="secondary"
                size={34}
                disabled={!apiPlaintext}
                onPress={() => void copy(apiPlaintext)}
                icon={<Copy size={14} color={tokens.textSecondary} />}
                style={{ backgroundColor: "transparent" }}
              />
            </View>
            <View style={styles.apiActionsRow}>
              <Button
                variant="primary"
                size="sm"
                icon={<RefreshCw size={14} />}
                label={t.dataTableSettings.apiTab.rotate}
                onPress={() => askConfirm(t.dataTableSettings.apiTab.rotate, t.settingsModals.apiRotateConfirm, async () => { const res = await rotateApiToken(token); setApiPlaintext(res.token); })}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Botón FIJO en la parte inferior del tab: despliega el drawer central de
          formularios (FormSheet) con el registro del tab activo. */}
      {tab === "ssh_keys" || tab === "categories" ? (
        <View style={[styles.registerBar, { borderTopColor: tokens.border }]}>
          <Button
            variant="primary"
            icon={<Plus size={14} />}
            label={tab === "ssh_keys" ? t.settingsModals.sshKeysRegisterTab : t.dataTableSettings.accordion.form}
            onPress={() => setRegisterSheet(tab === "ssh_keys" ? "ssh" : "catTag")}
          />
        </View>
      ) : null}

      {/* Registro de llave SSH — drawer central de formularios. */}
      <RegisterSshSheet
        visible={registerSheet === "ssh"}
        onClose={() => setRegisterSheet(null)}
        language={language}
        t={t}
        tokens={tokens}
        textAlign={textAlign}
        sshUser={sshUser}
        sshKey={sshKey}
        invalidField={invalidField}
        onChangeUser={(v) => { if (invalidField === "sshUser") setInvalidField(null); setSshUser(v); }}
        onChangeKey={(v) => { if (invalidField === "sshKey") setInvalidField(null); setSshKey(v); }}
        onSubmit={() => {
          if (!sshUser.trim()) { setInvalidField("sshUser"); sshUserRef.current?.focus(); return; }
          if (!sshKey.trim()) { setInvalidField("sshKey"); sshKeyRef.current?.focus(); return; }
          setInvalidField(null);
          run(async () => { const { key } = await createSshKey({ linuxUsername: sshUser.trim(), sshKey: sshKey.trim() }, token); if (key) applySshKeyCreated(key); setSshUser(""); setSshKey(""); setRegisterSheet(null); });
        }}
        sshUserRef={sshUserRef}
        sshKeyRef={sshKeyRef}
      />

      {/* Registro de categoría + tag — drawer central de formularios. */}
      <RegisterCatTagSheet
        visible={registerSheet === "catTag"}
        onClose={() => setRegisterSheet(null)}
        language={language}
        t={t}
        tokens={tokens}
        textAlign={textAlign}
        rowDirection={rowDirection}
        newCategory={newCategory}
        newTag={newTag}
        selectedCategoryId={selectedCategoryId}
        categoryOptions={categoryOptions}
        invalidField={invalidField}
        onChangeCategoryName={(v) => { if (invalidField === "newCategory") setInvalidField(null); setNewCategory(v); }}
        onChangeTagName={(v) => { if (invalidField === "newTag") setInvalidField(null); setNewTag(v); }}
        onChangeSelectedCategory={(v) => { if (invalidField === "selectedCategory") setInvalidField(null); setSelectedCategoryId(v); }}
        onCreateCategory={() => {
          if (!newCategory.trim()) { setInvalidField("newCategory"); newCategoryRef.current?.focus(); return; }
          setInvalidField(null);
          run(async () => { const { category } = await createPanelCategory(newCategory.trim(), token); if (category) applyCategoryCreated(category); setNewCategory(""); setRegisterSheet(null); });
        }}
        onCreateTag={() => {
          if (!selectedCategoryId) { setInvalidField("selectedCategory"); return; }
          if (!newTag.trim()) { setInvalidField("newTag"); newTagRef.current?.focus(); return; }
          setInvalidField(null);
          run(async () => { const { tag } = await createPanelTag(selectedCategoryId, newTag.trim(), token); if (tag) applyTagCreated(selectedCategoryId, tag); setNewTag(""); setRegisterSheet(null); });
        }}
        newCategoryRef={newCategoryRef}
        newTagRef={newTagRef}
      />

      <ConfirmDeleteModal
        open={confirmState.open}
        submitting={busy}
        title={confirmState.title}
        message={confirmState.message}
        onClose={() => setConfirmState({ open: false, title: "", message: "", action: null })}
        onConfirm={() => void runConfirmed()}
        t={t}
        tokens={tokens}
        language={language}
      />

      <SshEditSheet
        modal={sshEditModal}
        invalidField={invalidField}
        onClose={() => setSshEditModal({ open: false, id: "", linuxUsername: "", panelIds: [], sshKey: "", passphrase: "" })}
        onSave={() => {
          const ed = sshEditModal;
          if (!ed.linuxUsername.trim()) {
            setInvalidField("editLinuxUsername");
            editLinuxUsernameRef.current?.focus();
            return;
          }
          setInvalidField(null);
          // El gate 2FA (ssh.edit) lo maneja el reintento central de `request`.
          const payload: { linuxUsername?: string; panelIds?: string[]; sshKey?: string; passphrase?: string } = {
            linuxUsername: ed.linuxUsername.trim(),
            panelIds: ed.panelIds,
          };
          // Vacío = mantener la llave/passphrase actuales.
          if (ed.sshKey.trim()) payload.sshKey = ed.sshKey.trim();
          if (ed.passphrase.trim()) payload.passphrase = ed.passphrase;
          void run(async () => {
            const { key } = await updateSshKeyApi(ed.id, payload, token);
            if (key) applySshKeyUpdated(key);
            setSshEditModal({ open: false, id: "", linuxUsername: "", panelIds: [], sshKey: "", passphrase: "" });
          });
        }}
        onChangeLinuxUsername={(v) => { if (invalidField === "editLinuxUsername") setInvalidField(null); setSshEditModal((c) => ({ ...c, linuxUsername: v })); }}
        onPatch={(patch) => setSshEditModal((c) => ({ ...c, ...patch }))}
        editLinuxUsernameRef={editLinuxUsernameRef}
        t={t}
        tokens={tokens}
        textAlign={textAlign}
        language={language}
      />

      {/* Credenciales del proveedor (conectar / reconfigurar) — drawer central. */}
      <CredentialsSheet
        credEntry={credEntry}
        credTab={credTab}
        onCredTabChange={setCredTab}
        credValues={credValues}
        credInvalidKeys={credInvalidKeys}
        onChangeField={(key, v) => {
          if (credInvalidKeys.includes(key)) setCredInvalidKeys((cur) => cur.filter((k) => k !== key));
          setCredValues((c) => ({ ...c, [key]: v }));
        }}
        credFieldRefs={credFieldRefs}
        onClose={() => setCredEntry(null)}
        onSave={saveCreds}
        t={t}
        cat={cat}
        tokens={tokens}
        textAlign={textAlign}
        language={language}
      />

      {/* Recursos del proveedor (importar VPS como paneles) — drawer central. */}
      <ResourcesSheet
        resEntry={resEntry}
        scopes={scopes}
        scopeId={scopeId}
        resources={resources}
        resLoading={resLoading}
        resSelectedIds={resSelectedIds}
        onScopeChange={handleScopeChange}
        onToggleSelect={toggleResSelect}
        onRegister={registerSelected}
        onClose={() => setResEntry(null)}
        t={t}
        cat={cat}
        tokens={tokens}
        textAlign={textAlign}
        language={language}
      />
    </>
  );

  return hideTabs ? content : <SettingsColumns language={language} value={tab} onChange={key => setTab(key as SettingsTab)} sections={[
    { key: "ssh_keys", label: tabs.sshKeys, icon: <KeyRound size={20} color={tokens.textMuted} /> },
    { key: "categories", label: tabs.categories, icon: <Folder size={20} color={tokens.textMuted} /> },
    { key: "integrations", label: tabs.integrations, icon: <Plug size={20} color={tokens.textMuted} /> },
    { key: "api", label: tabs.api, icon: <KeySquare size={20} color={tokens.textMuted} /> },
  ]}>{content}</SettingsColumns>;
}

/**
 * Contenedor del gear de ajustes: posee el estado de `tab`, calcula el título y la
 * navegación lateral, y envuelve `SettingsPanels` en el drawer derecho. Firma sin cambios respecto a su versión monolítica anterior.
 */
export function DataTableSettingsModal({
  visible,
  onClose,
  initialTab,
  hideTabs = false,
  presentation = "drawer",
  ...data
}: SettingsDataProps & {
  visible: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  hideTabs?: boolean;
  presentation?: "modal" | "drawer";
}) {
  const t = getMessages(data.language);
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? "ssh_keys");

  useEffect(() => {
    if (!visible) return;
    setTab(initialTab ?? "ssh_keys");
  }, [visible, initialTab]);

  const tabs = t.dataTableSettings.tabs;
  const modalTitle = tab === "categories"
    ? tabs.categories
    : tab === "tags"
      ? tabs.tags
      : tab === "ssh_keys"
        ? tabs.sshKeys
        : tab === "integrations"
          ? tabs.integrations
          : tabs.api;

  const panels = (
    <SettingsPanels
      visible={visible}
      tab={tab}
      onTabChange={setTab}
      hideTabs={hideTabs}
      presentation="drawer"
      {...data}
    />
  );

  return <SettingsDrawerShell visible={visible} onClose={onClose} title={hideTabs ? modalTitle : t.dataTableSettings.titleConfigure} language={data.language} activeIndex={TAB_ORDER.indexOf(tab)}>{panels}</SettingsDrawerShell>;
}
