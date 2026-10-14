import { localizeServerError } from '../../../lib/server-error-localization';
import { nativeText } from '../../../i18n/native-text';
import { FormDrawer } from "../../../components/ui/FormDrawer";
import { ModuleLoading } from "../../../components/server/ModuleLoading";
import { formatPermissionLabel, permissionModuleLabel, type PermissionLabelKind } from "../../../lib/permission-labels";
import { getPermissionLabelMessages } from "../../../lib/permission-label-messages";
/** RoleDialog — crear/editar grupo (réplica de `#dialog-role`). Tres sub-tabs:
 *  - General  → nombre + descripción (igual que antes).
 *  - Panel    → matriz de permisos por módulo (Menú/Vistas/Acciones/Botones/
 *               Columnas) cargada de `GET /api/roles/permission-catalog`.
 *  - Servidor → acceso a archivos (allowAll + rutas permitidas/solo-lectura/
 *               denegadas como chips + ruta por defecto) y política de comandos
 *               (allowAll + grupos + allow/deny).
 *  Al guardar arma EXACTAMENTE el payload del web (`{name,description,modules,
 *  permissions}` con fileAccess/commandPolicy DENTRO de permissions) y lo entrega
 *  por `onSave` (que lo transporta tal cual al gateway). El catálogo necesita
 *  credenciales del gateway (`panelId`/`token`); si no llegan, usa un catálogo
 *  básico embebido (mismo fallback que el web). */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { Field, DialogFooter, InfoBox, Checkbox } from "../../../components/server/Form";
import { TablerArrowUp, TablerCheck, TablerFolder } from "../../../features/app/tabler-icons";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { RoleFormPayload, RolePermissionsPayload, ServerRole } from "./types";

// ── Catálogo de permisos ─────────────────────────────────────────────────────
type ModuleCatalogEntry = { module: string; label: string; sidebar: string[]; views: string[]; actions: string[] };
type PermissionCatalog = {
  sidebarItems: string[];
  views: string[];
  actions: string[];
  commandGroups: string[];
  modules: ModuleCatalogEntry[];
  descriptions: Record<string, string>;
};

/** Acciones de archivos que son botones/paneles (se agrupan aparte de las
 *  operaciones núcleo y de las columnas de tabla). Espejo del web. */
const BUTTON_PERMS = new Set([
  "files.search", "files.git", "files.history", "files.compare", "files.share",
  "files.security", "files.images", "files.projects", "files.copypath",
  "files.editpath", "files.tabs", "files.config",
]);

/** Catálogo básico embebido (réplica del FALLBACK_CATALOG del web) usado cuando
 *  el endpoint no está disponible. */
const FALLBACK_CATALOG: PermissionCatalog = {
  sidebarItems: ["dashboard", "mail", "monitor", "files", "firewall", "assistant", "dns", "backups", "cron", "webhooks", "ssl", "users", "modules", "settings", "preferences", "hosting", "openclaw", "repository-store", "notifications", "search", "server-switcher"],
  views: ["panel.dashboard", "panel.mail", "panel.monitor", "panel.files", "panel.firewall", "panel.assistant", "panel.dns", "panel.backups", "panel.cron", "panel.webhooks", "panel.ssl", "panel.users", "panel.modules", "panel.settings", "panel.preferences", "panel.hosting", "panel.openclaw", "panel.repository-store", "panel.notifications", "panel.search", "panel.server-switcher"],
  actions: ["users.view", "users.create", "users.edit", "users.delete", "roles.view", "roles.create", "roles.edit", "roles.delete", "files.view", "files.read", "files.write", "files.upload", "files.delete", "files.rename", "files.chmod", "files.chown", "terminal.view", "terminal.open", "terminal.manage"],
  commandGroups: ["filesystem", "process", "network", "services", "packages", "users", "archives", "development", "monitoring", "misc"],
  modules: [
    { module: "mail", get label() { return nativeText("Correo"); }, sidebar: ["mail"], views: ["panel.mail"], actions: [] },
    { module: "files", get label() { return nativeText("Archivos"); }, sidebar: ["files"], views: ["panel.files"], actions: ["files.view", "files.read", "files.write", "files.upload", "files.delete", "files.rename"] },
    { module: "users", get label() { return nativeText("Usuarios"); }, sidebar: ["users"], views: ["panel.users"], actions: ["users.view", "users.create", "users.edit", "users.delete", "roles.view", "roles.create", "roles.edit", "roles.delete"] },
    { module: "admin", get label() { return nativeText("Administración"); }, sidebar: ["settings"], views: ["panel.settings"], actions: ["terminal.view", "terminal.open", "terminal.manage", "files.chmod", "files.chown"] },
    { module: "monitor", get label() { return nativeText("Monitor"); }, sidebar: ["monitor"], views: ["panel.monitor"], actions: [] },
    { module: "ssl", label: "SSL", sidebar: ["ssl"], views: ["panel.ssl"], actions: [] },
    { module: "firewall", get label() { return nativeText("Firewall"); }, sidebar: ["firewall"], views: ["panel.firewall"], actions: [] },
    { module: "dns", label: "NGINX", sidebar: ["dns"], views: ["panel.dns"], actions: [] },
    { module: "cron", get label() { return nativeText("Cron"); }, sidebar: ["cron"], views: ["panel.cron"], actions: [] },
    { module: "backups", get label() { return nativeText("Backups"); }, sidebar: ["backups"], views: ["panel.backups"], actions: [] },
    { module: "webhooks", get label() { return nativeText("Webhooks"); }, sidebar: ["webhooks"], views: ["panel.webhooks"], actions: [] },
    { module: "assistant", get label() { return nativeText("Asistente IA"); }, sidebar: ["assistant"], views: ["panel.assistant"], actions: [] },
    { module: "modules", get label() { return nativeText("Módulos (gestión)"); }, sidebar: ["modules"], views: ["panel.modules"], actions: [] },
    { module: "notifications", get label() { return nativeText("Notificaciones"); }, sidebar: ["notifications"], views: ["panel.notifications"], actions: [] },
    { module: "search", get label() { return nativeText("Búsqueda"); }, sidebar: ["search"], views: ["panel.search"], actions: [] },
    { module: "server-switcher", get label() { return nativeText("Selección de panel/servidor"); }, sidebar: ["server-switcher"], views: ["panel.server-switcher"], actions: [] },
  ],
  descriptions: {},
};

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Coacciona defensivamente la respuesta del endpoint a un catálogo válido. */
function normalizeCatalog(raw: unknown): PermissionCatalog {
  const c = (raw ?? {}) as Record<string, unknown>;
  const modules = Array.isArray(c.modules)
    ? (c.modules as unknown[])
        .map((m) => {
          const e = (m ?? {}) as Record<string, unknown>;
          return { module: String(e.module ?? ""), label: String(e.label ?? e.module ?? ""), sidebar: strArr(e.sidebar), views: strArr(e.views), actions: strArr(e.actions) };
        })
        .filter((m) => m.module)
    : [];
  return {
    sidebarItems: strArr(c.sidebarItems),
    views: strArr(c.views),
    actions: strArr(c.actions),
    commandGroups: strArr(c.commandGroups),
    modules: modules.length ? modules : FALLBACK_CATALOG.modules,
    descriptions: c.descriptions && typeof c.descriptions === "object" ? (c.descriptions as Record<string, string>) : {},
  };
}

/** Deriva `modules[]` de los permisos seleccionados (un módulo está "on" si
 *  alguno de su menú/vista/acción está marcado). Espejo de
 *  `deriveModulesFromPermissions`. */
function deriveModules(catalog: PermissionCatalog, perm: RolePermissionsPayload): string[] {
  const sb = new Set(perm.sidebar);
  const vw = new Set(perm.views);
  const ac = new Set(perm.actions);
  const out: string[] = [];
  for (const m of catalog.modules) {
    const on =
      m.sidebar.some((s) => sb.has(s)) ||
      m.views.some((v) => vw.has(v)) ||
      m.actions.some((a) => ac.has(a) || ac.has(`${a.split(".")[0]}.*`));
    if (on) out.push(m.module);
  }
  return out;
}

const linesFrom = (s: string): string[] => [...new Set(s.split("\n").map((x) => x.trim()).filter(Boolean))];

/** Normaliza una ruta como el backend (empieza por `/`, sin barra final). */
function normalizePath(input: string): string {
  let s = input.trim();
  if (!s) return "";
  if (!s.startsWith("/")) s = `/${s}`;
  s = s.replace(/\/+$/, "");
  return s || "/";
}

/** Ruta padre (espejo de `parentPath` del web): «/var/www/sitio» → «/var/www». */
function parentPath(p: string): string {
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx <= 0 ? "/" : trimmed.slice(0, idx);
}

const mono = Platform.OS === "ios" ? "Menlo" : "monospace";

/** Botón compacto (icono carpeta) para abrir el navegador de carpetas junto a
 *  un campo de ruta. Réplica del botón `data-path-add` del web. */
function BrowseButton({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: 8,
        paddingHorizontal: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.bgSecondary,
      }}
    >
      <TablerFolder size={17} color={tokens.textSecondary} />
    </Pressable>
  );
}

/** Entrada de directorio devuelta por `GET /api/files/list` (forma defensiva). */
type DirEntry = { name?: string; path?: string; isDir?: boolean; type?: string };

/** Navegador de carpetas (réplica RN de `#dialog-path-browser`): lista las
 *  subcarpetas de un directorio vía el gateway, permite entrar/subir y devuelve
 *  la carpeta elegida por `onSelect`. Solo lista carpetas (filtra `isDir`). */
function PathBrowserModal({
  panelId,
  token,
  onClose,
  onSelect,
}: {
  panelId: string;
  token: string;
  onClose: () => void;
  onSelect: (path: string) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverUsers;

  const [current, setCurrent] = useState("/");
  const [dirs, setDirs] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadDir = useCallback(
    async (path: string) => {
      const dir = path || "/";
      setCurrent(dir);
      setLoading(true);
      setError(false);
      try {
        const res = await callServerApi(panelId, token, "GET", `/api/files/list?path=${encodeURIComponent(dir)}`);
        const data = unwrap<DirEntry[]>(res);
        if (!res.ok || !Array.isArray(data)) {
          setError(true);
          setDirs([]);
        } else {
          setDirs(
            data
              .filter((e): e is DirEntry => Boolean(e) && (e.isDir === true || e.type === "dir") && typeof e.path === "string")
              .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""))),
          );
        }
      } catch {
        setError(true);
        setDirs([]);
      } finally {
        setLoading(false);
      }
    },
    [panelId, token],
  );

  useEffect(() => {
    void loadDir("/");
  }, [loadDir]);

  const atRoot = current === "/";

  return (
    <Modal
      visible
      onClose={onClose}
      title={t.pathBrowserDialog.title}
      language={language}
      footer={
        <DialogFooter
          onCancel={onClose}
          cancelLabel={t.pathBrowserDialog.btnCancel}
          onSubmit={() => onSelect(normalizePath(current))}
          submitLabel={t.pathBrowserDialog.btnSelect}
        />
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Button
          label={t.pathBrowserDialog.btnUp}
          size="sm"
          variant="secondary"
          icon={<TablerArrowUp size={15} />}
          onPress={() => void loadDir(parentPath(current))}
          disabled={atRoot}
        />
        <View style={{ flex: 1, borderWidth: 1, borderColor: tokens.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: withAlpha(tokens.brand, 0.05) }}>
          <Text numberOfLines={1} style={{ color: tokens.textSecondary, fontSize: 12, fontFamily: mono }}>
            {current}
          </Text>
        </View>
      </View>

      {error ? <InfoBox tone="danger">{t.pathBrowserDialog.error}</InfoBox> : null}

      {loading ? (
        <ModuleLoading label={t.labels.loading} />
      ) : dirs.length ? (
        <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, overflow: "hidden" }}>
            {dirs.map((d, i) => (
              <Pressable
                key={d.path}
                onPress={() => void loadDir(d.path ?? "/")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  paddingHorizontal: 11,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: tokens.border,
                }}
              >
                <TablerFolder size={16} color={tokens.warning} />
                <Text numberOfLines={1} style={{ color: tokens.textSecondary, fontSize: 13, flex: 1 }}>
                  {d.name ?? d.path}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <Text style={{ color: tokens.textMuted, fontSize: 12, paddingVertical: 10 }}>{t.pathBrowserDialog.empty}</Text>
      )}
    </Modal>
  );
}

// ── Editor de listas de rutas (chips) ────────────────────────────────────────
function PathField({
  label,
  paths,
  onAdd,
  onRemove,
  addLabel,
  placeholder,
  noneLabel,
  onBrowse,
}: {
  label: string;
  paths: string[];
  onAdd: (p: string) => void;
  onRemove: (p: string) => void;
  addLabel: string;
  placeholder: string;
  noneLabel: string;
  /** Si se pasa, muestra un botón de carpeta que abre el navegador de rutas. */
  onBrowse?: () => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  };
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <Input value={draft} onChangeText={setDraft} placeholder={placeholder} autoCapitalize="none" onSubmitEditing={add} returnKeyType="done" />
        </View>
        <Button label={addLabel} size="sm" variant="secondary" onPress={add} />
        {onBrowse ? <BrowseButton onPress={onBrowse} /> : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {paths.length ? (
          paths.map((p) => (
            <Pressable
              key={p}
              onPress={() => onRemove(p)}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: tokens.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: withAlpha(tokens.brand, 0.07) }}
            >
              <Text style={{ color: tokens.textSecondary, fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{p}</Text>
              <Text style={{ color: tokens.textMuted, fontSize: 14, lineHeight: 14 }}>×</Text>
            </Pressable>
          ))
        ) : (
          <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{noneLabel}</Text>
        )}
      </View>
    </View>
  );
}

export function RoleDialog({
  visible,
  mode,
  initial,
  panelId,
  token,
  onClose,
  onSave,
}: {
  visible: boolean;
  mode: "create" | "edit";
  initial?: ServerRole | null;
  /** Credenciales del gateway para cargar el catálogo (opcionales: sin ellas se
   *  usa el catálogo básico embebido). */
  panelId?: string;
  token?: string;
  onClose: () => void;
  onSave: (payload: RoleFormPayload) => Promise<boolean>;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverUsers;

  const [tab, setTab] = useState<string>("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const pending = useRef(false);
  const close = () => { if (!pending.current) onClose(); };
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [catalog, setCatalog] = useState<PermissionCatalog>(FALLBACK_CATALOG);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [moduleTab, setModuleTab] = useState("");

  // Panel (matriz de permisos)
  const [selSidebar, setSelSidebar] = useState<string[]>([]);
  const [selViews, setSelViews] = useState<string[]>([]);
  const [selActions, setSelActions] = useState<string[]>([]);

  // Servidor → acceso a archivos
  const [fileAllowAll, setFileAllowAll] = useState(false);
  const [allowPaths, setAllowPaths] = useState<string[]>([]);
  const [readonlyPaths, setReadonlyPaths] = useState<string[]>([]);
  const [denyPaths, setDenyPaths] = useState<string[]>([]);
  const [defaultPath, setDefaultPath] = useState("");

  // Navegador de carpetas: qué lista recibe la ruta elegida (o `default`).
  const [browseTarget, setBrowseTarget] = useState<null | "allow" | "readonly" | "deny" | "default">(null);
  const canBrowse = Boolean(panelId && token);
  const addUnique = (set: React.Dispatch<React.SetStateAction<string[]>>, s: string) =>
    set((prev) => (s && !prev.includes(s) ? [...prev, s] : prev));
  const onPathPicked = (picked: string) => {
    const s = normalizePath(picked);
    if (s) {
      if (browseTarget === "default") setDefaultPath(s);
      else if (browseTarget === "allow") addUnique(setAllowPaths, s);
      else if (browseTarget === "readonly") addUnique(setReadonlyPaths, s);
      else if (browseTarget === "deny") addUnique(setDenyPaths, s);
    }
    setBrowseTarget(null);
  };

  // Servidor → política de comandos
  const [cmdAllowAll, setCmdAllowAll] = useState(false);
  const [cmdGroups, setCmdGroups] = useState<string[]>([]);
  const [cmdAllow, setCmdAllow] = useState("");
  const [cmdDeny, setCmdDeny] = useState("");

  const isSystem = initial?.kind === "system";

  // Reset / prefill al abrir.
  useEffect(() => {
    if (!visible) return;
    setTab("general");
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    const p = (initial?.permissions ?? {}) as Record<string, unknown>;
    const fa = (p.fileAccess ?? {}) as Record<string, unknown>;
    const cp = (p.commandPolicy ?? {}) as Record<string, unknown>;
    setSelSidebar(strArr(p.sidebar));
    setSelViews(strArr(p.views));
    setSelActions(strArr(p.actions));
    setFileAllowAll(Boolean(fa.allowAll));
    setAllowPaths(strArr(fa.allowPaths));
    setReadonlyPaths(strArr(fa.readOnlyPaths));
    setDenyPaths(strArr(fa.denyPaths));
    setDefaultPath(typeof fa.defaultPath === "string" ? fa.defaultPath : "");
    setCmdAllowAll(Boolean(cp.allowAll));
    setCmdGroups(strArr(cp.groups));
    setCmdAllow(strArr(cp.allowCommands).join("\n"));
    setCmdDeny(strArr(cp.denyCommands).join("\n"));
  }, [visible, initial]);

  // Cargar el catálogo del panel (si hay credenciales).
  useEffect(() => {
    if (!visible || !panelId || !token) return;
    let alive = true;
    setCatalogLoading(true);
    callServerApi(panelId, token, "GET", "/api/roles/permission-catalog")
      .then((res) => {
        if (!alive) return;
        const data = unwrap(res);
        if (data && typeof data === "object") setCatalog(normalizeCatalog(data));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setCatalogLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, panelId, token]);

  // Sub-pestañas de la matriz: un módulo por tab + tab "General" para lo
  // huérfano (réplica de renderModulePermissionTabs).
  const moduleEntries = useMemo<ModuleCatalogEntry[]>(() => {
    const mods = catalog.modules;
    const usedSidebar = new Set(mods.flatMap((m) => m.sidebar));
    const usedViews = new Set(mods.flatMap((m) => m.views));
    const usedActions = new Set(mods.flatMap((m) => m.actions));
    const leftover: ModuleCatalogEntry = {
      module: "general",
      label: t.roleDialog.moduleGeneral,
      sidebar: catalog.sidebarItems.filter((s) => !usedSidebar.has(s)),
      views: catalog.views.filter((v) => !usedViews.has(v)),
      actions: catalog.actions.filter((a) => !usedActions.has(a)),
    };
    const entries = [...mods];
    if (leftover.sidebar.length || leftover.views.length || leftover.actions.length) entries.push(leftover);
    return entries;
  }, [catalog, t.roleDialog.moduleGeneral]);

  useEffect(() => {
    if (moduleEntries.length && !moduleEntries.some((e) => e.module === moduleTab)) {
      setModuleTab(moduleEntries[0]!.module);
    }
  }, [moduleEntries, moduleTab]);

  const title = mode === "create" ? t.roleDialog.titleNew : formatMessage(t.titles.editGroup, { name: initial?.name ?? "" });

  const descOf = (id: string, kind?: PermissionLabelKind): string => formatPermissionLabel(id, catalog, getPermissionLabelMessages(language), kind);

  const submit = async () => {
    if (pending.current || !name.trim()) return;
    pending.current = true;
    setSaveError(null);
    setSubmitting(true);
    try {
    const permissions: RolePermissionsPayload = {
      sidebar: selSidebar,
      views: selViews,
      actions: selActions,
      fileAccess: {
        allowAll: fileAllowAll,
        allowPaths,
        denyPaths,
        readOnlyPaths: readonlyPaths,
        defaultPath: defaultPath.trim() || null,
      },
      commandPolicy: {
        allowAll: cmdAllowAll,
        groups: cmdGroups,
        allowCommands: linesFrom(cmdAllow),
        denyCommands: linesFrom(cmdDeny),
      },
    };
    const payload: RoleFormPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      modules: deriveModules(catalog, permissions),
      permissions,
    };
    // Renombrar solo grupos creados por el usuario (no del sistema).
    if (mode === "edit" && !isSystem && initial && name.trim() !== initial.name) payload.newName = name.trim();
    const ok = await onSave(payload);
    if (ok) onClose();
    else setSaveError(t.toasts.saveFailed);
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : t.toasts.saveFailed); }
    finally { pending.current = false; setSubmitting(false); }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const permRow = (id: string, checked: boolean, onToggle: () => void, kind?: PermissionLabelKind) => {
    const desc = descOf(id, kind);
    return (
      <Pressable key={id} onPress={onToggle} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 5 }}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            borderWidth: 1.5,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 1,
            backgroundColor: checked ? tokens.brand : "transparent",
            borderColor: checked ? tokens.brand : tokens.border,
          }}
        >
          {checked ? <TablerCheck size={12} color="#ffffff" /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: tokens.textSecondary, fontSize: 13, lineHeight: 17 }}>{desc}</Text>
          {desc !== id ? <Text style={{ color: tokens.textMuted, fontSize: 10, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{id}</Text> : null}
        </View>
      </Pressable>
    );
  };

  const permSection = (sectionTitle: string, ids: string[], selected: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (!ids.length) return null;
    const allOn = ids.every((id) => selected.includes(id));
    return (
      <View style={{ marginBottom: 10 }} key={sectionTitle}>
        <Pressable
          onPress={() => setSelected((prev) => (allOn ? prev.filter((x) => !ids.includes(x)) : [...new Set([...prev, ...ids])]))}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}
        >
          <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{sectionTitle}</Text>
          <Text style={{ color: tokens.brand, fontSize: 11 }}>{t.roleDialog.selectAll}</Text>
        </Pressable>
        {ids.map((id) => permRow(id, selected.includes(id), () => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))))}
      </View>
    );
  };

  const activeModule = moduleEntries.find((e) => e.module === moduleTab) ?? null;
  const cardStyle = { borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 12, marginBottom: 12 } as const;

  return (
    <>
    <FormDrawer
      visible={visible}
      onClose={close}
      title={title}
      language={language}
      footer={<DialogFooter onCancel={close} cancelLabel={t.roleDialog.btnCancel} onSubmit={submit} submitLabel={t.roleDialog.btnSave} submitting={submitting} />}
    >
      {saveError ? <InfoBox tone="danger">{localizeServerError(saveError)}</InfoBox> : null}
      <View style={{ marginBottom: 14 }}>
        <SegmentedControl
          items={[
            { key: "general", label: t.roleDialog.tabGeneral },
            { key: "panel", label: t.roleDialog.tabPanel },
            { key: "server", label: t.roleDialog.tabServer },
          ]}
          value={tab}
          onChange={setTab}
          fill
        />
      </View>

      {tab === "general" ? (
        <>
          <Field label={t.roleDialog.labelGroupName} hint={isSystem ? t.roleDialog.groupNameHint : undefined}>
            <Input value={name} onChangeText={setName} placeholder={t.roleDialog.placeholderGroupName} editable={!isSystem} autoCapitalize="none" />
          </Field>
          <Field label={t.roleDialog.labelDescription}>
            <Input value={description} onChangeText={setDescription} placeholder={t.roleDialog.placeholderDescription} multiline style={{ minHeight: 60 }} />
          </Field>
        </>
      ) : tab === "panel" ? (
        <View>
          <InfoBox>{t.roleDialog.panelPermsInfo}</InfoBox>
          {catalogLoading ? <ModuleLoading label={t.roleDialog.loadingCatalog} /> : null}
          {moduleEntries.length ? (
            <>
              <View style={{ marginBottom: 10 }}>
                <SegmentedControl scroll items={moduleEntries.map((e) => ({ key: e.module, label: permissionModuleLabel(e.module, catalog, getPermissionLabelMessages(language)) }))} value={moduleTab} onChange={setModuleTab} />
              </View>
              {activeModule ? (
                <View>
                  {permSection(t.labels.permMenu, activeModule.sidebar, selSidebar, setSelSidebar)}
                  {permSection(t.labels.permViews, activeModule.views, selViews, setSelViews)}
                  {permSection(t.labels.permActions, activeModule.actions.filter((a) => !a.includes(".col.") && !BUTTON_PERMS.has(a)), selActions, setSelActions)}
                  {permSection(t.labels.permButtons, activeModule.actions.filter((a) => !a.includes(".col.") && BUTTON_PERMS.has(a)), selActions, setSelActions)}
                  {permSection(t.labels.permColumns, activeModule.actions.filter((a) => a.includes(".col.")), selActions, setSelActions)}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      ) : (
        <View>
          {/* Acceso a archivos / carpetas */}
          <View style={cardStyle}>
            <View style={{ marginBottom: 10 }}>
              <Checkbox value={fileAllowAll} onChange={setFileAllowAll} label={t.roleDialog.labelFileAllowAll} />
            </View>
            <PathField
              label={t.roleDialog.labelAllowedPaths}
              paths={allowPaths}
              onAdd={(p) => setAllowPaths((prev) => { const s = normalizePath(p); return s && !prev.includes(s) ? [...prev, s] : prev; })}
              onRemove={(p) => setAllowPaths((prev) => prev.filter((x) => x !== p))}
              addLabel={t.roleDialog.btnAddPath}
              placeholder={t.roleDialog.placeholderAddPath}
              noneLabel={t.roleDialog.noPaths}
              onBrowse={canBrowse ? () => setBrowseTarget("allow") : undefined}
            />
            <PathField
              label={t.roleDialog.labelReadonlyPaths}
              paths={readonlyPaths}
              onAdd={(p) => setReadonlyPaths((prev) => { const s = normalizePath(p); return s && !prev.includes(s) ? [...prev, s] : prev; })}
              onRemove={(p) => setReadonlyPaths((prev) => prev.filter((x) => x !== p))}
              addLabel={t.roleDialog.btnAddPath}
              placeholder={t.roleDialog.placeholderAddPath}
              noneLabel={t.roleDialog.noPaths}
              onBrowse={canBrowse ? () => setBrowseTarget("readonly") : undefined}
            />
            <PathField
              label={t.roleDialog.labelDeniedPaths}
              paths={denyPaths}
              onAdd={(p) => setDenyPaths((prev) => { const s = normalizePath(p); return s && !prev.includes(s) ? [...prev, s] : prev; })}
              onRemove={(p) => setDenyPaths((prev) => prev.filter((x) => x !== p))}
              addLabel={t.roleDialog.btnAddPath}
              placeholder={t.roleDialog.placeholderAddPath}
              noneLabel={t.roleDialog.noPaths}
              onBrowse={canBrowse ? () => setBrowseTarget("deny") : undefined}
            />
            <Field label={t.roleDialog.labelDefaultPath} hint={t.roleDialog.defaultPathHelp}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Input value={defaultPath} onChangeText={setDefaultPath} placeholder={t.roleDialog.placeholderDefaultPath} autoCapitalize="none" />
                </View>
                {canBrowse ? <BrowseButton onPress={() => setBrowseTarget("default")} /> : null}
              </View>
            </Field>
          </View>

          {/* Política de comandos */}
          <View style={cardStyle}>
            <View style={{ marginBottom: 10 }}>
              <Checkbox value={cmdAllowAll} onChange={setCmdAllowAll} label={t.roleDialog.labelCmdAllowAll} />
            </View>
            <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>{t.roleDialog.labelCmdGroupsAllowed}</Text>
            <View style={{ marginBottom: 10 }}>
              {catalog.commandGroups.map((g) => permRow(g, cmdGroups.includes(g), () => setCmdGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])), "commands"))}
            </View>
            <Field label={t.roleDialog.labelCmdAllowExtra}>
              <Input value={cmdAllow} onChangeText={setCmdAllow} multiline style={{ minHeight: 60 }} autoCapitalize="none" placeholder={t.roleDialog.cmdListPlaceholder} />
            </Field>
            <Field label={t.roleDialog.labelCmdDenyList}>
              <Input value={cmdDeny} onChangeText={setCmdDeny} multiline style={{ minHeight: 60 }} autoCapitalize="none" placeholder={t.roleDialog.cmdListPlaceholder} />
            </Field>
          </View>
        </View>
      )}
    </FormDrawer>
    {browseTarget && panelId && token ? (
      <PathBrowserModal
        panelId={panelId}
        token={token}
        onClose={() => setBrowseTarget(null)}
        onSelect={onPathPicked}
      />
    ) : null}
    </>
  );
}
