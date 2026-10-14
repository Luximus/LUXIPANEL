import { formatPermissionLabel, permissionModuleLabel, type PermissionLabelKind } from "../../../lib/permission-labels";
import { getPermissionLabelMessages } from "../../../lib/permission-label-messages";
/**
 * RoleDialog (desktop) — crear/editar grupo. Port React DOM 1:1 de
 * `app/src/screens/server/users/RoleDialog.tsx`. Tres sub-pestañas:
 *  - General  → nombre + descripción.
 *  - Panel    → matriz de permisos por módulo (Menú/Vistas/Acciones/Botones/
 *               Columnas) cargada de `GET /api/roles/permission-catalog`.
 *  - Servidor → acceso a archivos (allowAll + rutas permitidas/solo-lectura/
 *               denegadas como chips + ruta por defecto) y política de comandos.
 *  Al guardar arma EXACTAMENTE el payload del web (`{name,description,modules,
 *  permissions}` con fileAccess/commandPolicy DENTRO de permissions) y lo entrega
 *  por `onSave`. El catálogo/navegador de rutas usan `callServerApi` directo
 *  (token `""`); sin panel accesible cae al catálogo básico embebido.
 */
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ArrowUp, Check, Folder } from "lucide-react";
import { getMessages, formatMessage } from "../../../i18n";
import { callServerApi, unwrap } from "../../../api/serverApi";
import { ModalShell, DialogFooter, Field, InfoBox } from "./dialog-kit";
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

/** Acciones de archivos que son botones/paneles (se agrupan aparte). Espejo del web. */
const BUTTON_PERMS = new Set([
  "files.search", "files.git", "files.history", "files.compare", "files.share",
  "files.security", "files.images", "files.projects", "files.copypath",
  "files.editpath", "files.tabs", "files.config",
]);

/** Catálogo básico embebido (réplica del FALLBACK_CATALOG del web). */
const FALLBACK_CATALOG: PermissionCatalog = {
  sidebarItems: ["dashboard", "mail", "monitor", "files", "firewall", "assistant", "dns", "backups", "cron", "webhooks", "ssl", "users", "modules", "settings", "preferences", "hosting", "openclaw", "repository-store", "notifications", "search", "server-switcher"],
  views: ["panel.dashboard", "panel.mail", "panel.monitor", "panel.files", "panel.firewall", "panel.assistant", "panel.dns", "panel.backups", "panel.cron", "panel.webhooks", "panel.ssl", "panel.users", "panel.modules", "panel.settings", "panel.preferences", "panel.hosting", "panel.openclaw", "panel.repository-store", "panel.notifications", "panel.search", "panel.server-switcher"],
  actions: ["users.view", "users.create", "users.edit", "users.delete", "roles.view", "roles.create", "roles.edit", "roles.delete", "files.view", "files.read", "files.write", "files.upload", "files.delete", "files.rename", "files.chmod", "files.chown", "terminal.view", "terminal.open", "terminal.manage"],
  commandGroups: ["filesystem", "process", "network", "services", "packages", "users", "archives", "development", "monitoring", "misc"],
  modules: [
    { module: "mail", label: "Correo", sidebar: ["mail"], views: ["panel.mail"], actions: [] },
    { module: "files", label: "Archivos", sidebar: ["files"], views: ["panel.files"], actions: ["files.view", "files.read", "files.write", "files.upload", "files.delete", "files.rename"] },
    { module: "users", label: "Usuarios", sidebar: ["users"], views: ["panel.users"], actions: ["users.view", "users.create", "users.edit", "users.delete", "roles.view", "roles.create", "roles.edit", "roles.delete"] },
    { module: "admin", label: "Administración", sidebar: ["settings"], views: ["panel.settings"], actions: ["terminal.view", "terminal.open", "terminal.manage", "files.chmod", "files.chown"] },
    { module: "monitor", label: "Monitor", sidebar: ["monitor"], views: ["panel.monitor"], actions: [] },
    { module: "ssl", label: "SSL", sidebar: ["ssl"], views: ["panel.ssl"], actions: [] },
    { module: "firewall", label: "Firewall", sidebar: ["firewall"], views: ["panel.firewall"], actions: [] },
    { module: "dns", label: "NGINX", sidebar: ["dns"], views: ["panel.dns"], actions: [] },
    { module: "cron", label: "Cron", sidebar: ["cron"], views: ["panel.cron"], actions: [] },
    { module: "backups", label: "Backups", sidebar: ["backups"], views: ["panel.backups"], actions: [] },
    { module: "webhooks", label: "Webhooks", sidebar: ["webhooks"], views: ["panel.webhooks"], actions: [] },
    { module: "assistant", label: "Asistente IA", sidebar: ["assistant"], views: ["panel.assistant"], actions: [] },
    { module: "modules", label: "Módulos (gestión)", sidebar: ["modules"], views: ["panel.modules"], actions: [] },
    { module: "notifications", label: "Notificaciones", sidebar: ["notifications"], views: ["panel.notifications"], actions: [] },
    { module: "search", label: "Búsqueda", sidebar: ["search"], views: ["panel.search"], actions: [] },
    { module: "server-switcher", label: "Selección de panel/servidor", sidebar: ["server-switcher"], views: ["panel.server-switcher"], actions: [] },
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

/** Deriva `modules[]` de los permisos seleccionados. Espejo de `deriveModulesFromPermissions`. */
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

/** Entrada de directorio devuelta por `GET /api/files/list` (forma defensiva). */
type DirEntry = { name?: string; path?: string; isDir?: boolean; type?: string };

/** Navegador de carpetas (réplica DOM de `#dialog-path-browser`). Lista solo
 *  carpetas de un directorio y devuelve la elegida por `onSelect`. */
function PathBrowserModal({
  serverId,
  language,
  onClose,
  onSelect,
}: {
  serverId: string;
  language?: string;
  onClose: () => void;
  onSelect: (path: string) => void;
}) {
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
        const res = await callServerApi(serverId, "", "GET", `/api/files/list?path=${encodeURIComponent(dir)}`);
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
    [serverId],
  );

  useEffect(() => {
    void loadDir("/");
  }, [loadDir]);

  const atRoot = current === "/";

  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[170] grid place-items-center p-4">
      <div className="lp-modal-card flex max-h-full w-full max-w-lg flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.pathBrowserDialog.title}</h3>
        </div>
        <div className="lp-modal-body">
          <div className="mb-3 flex items-center gap-2">
            <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm" onClick={() => void loadDir(parentPath(current))} disabled={atRoot}>
              <ArrowUp size={14} /> {t.pathBrowserDialog.btnUp}
            </button>
            <div className="min-w-0 flex-1 truncate rounded-lg border border-base-300 bg-base-200/40 px-3 py-2 font-mono text-xs text-base-content/70">
              {current}
            </div>
          </div>
          {error ? <InfoBox tone="danger">{t.pathBrowserDialog.error}</InfoBox> : null}
          {loading ? (
            <p className="py-3 text-xs text-base-content/50">{t.labels.loading}</p>
          ) : dirs.length ? (
            <div className="max-h-80 overflow-y-auto rounded-lg border border-base-300">
              {dirs.map((d, i) => (
                <button
                  key={d.path}
                  type="button"
                  onClick={() => void loadDir(d.path ?? "/")}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-base-200/60 ${i === 0 ? "" : "border-t border-base-300"}`}
                >
                  <Folder size={16} className="text-warning" />
                  <span className="min-w-0 flex-1 truncate text-sm text-base-content/80">{d.name ?? d.path}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-3 text-xs text-base-content/50">{t.pathBrowserDialog.empty}</p>
          )}
        </div>
        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>{t.pathBrowserDialog.btnCancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => onSelect(normalizePath(current))}>{t.pathBrowserDialog.btnSelect}</button>
        </div>
      </div>
    </div>
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
  onBrowse?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  };
  return (
    <div className="mb-3">
      <span className="lp-modal-label">{label}</span>
      <div className="mb-2 flex gap-2">
        <input
          className="lp-modal-input"
          value={draft}
          placeholder={placeholder}
          autoCapitalize="none"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm shrink-0" onClick={add}>{addLabel}</button>
        {onBrowse ? (
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm shrink-0" onClick={onBrowse} aria-label={label}>
            <Folder size={16} />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {paths.length ? (
          paths.map((p) => (
            <button key={p} type="button" onClick={() => onRemove(p)} className="lp-modal-chip font-mono">
              {p} <span className="text-base-content/50">×</span>
            </button>
          ))
        ) : (
          <span className="text-xs text-base-content/50">{noneLabel}</span>
        )}
      </div>
    </div>
  );
}

export function RoleDialog({
  mode,
  initial,
  serverId,
  language,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: ServerRole | null;
  serverId: string;
  language?: string;
  onClose: () => void;
  onSave: (payload: RoleFormPayload) => Promise<boolean>;
}) {
  const t = getMessages(language).serverUsers;

  const [tab, setTab] = useState<"general" | "panel" | "server">("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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

  const [browseTarget, setBrowseTarget] = useState<null | "allow" | "readonly" | "deny" | "default">(null);
  const canBrowse = Boolean(serverId);
  const addUnique = (set: Dispatch<SetStateAction<string[]>>, s: string) =>
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
  }, [initial]);

  // Cargar el catálogo del panel.
  useEffect(() => {
    if (!serverId) return;
    let alive = true;
    setCatalogLoading(true);
    callServerApi(serverId, "", "GET", "/api/roles/permission-catalog")
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
  }, [serverId]);

  // Sub-pestañas: un módulo por tab + "General" para lo huérfano.
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
    if (!name.trim()) return;
    setSubmitting(true);
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
    if (mode === "edit" && !isSystem && initial && name.trim() !== initial.name) payload.newName = name.trim();
    const ok = await onSave(payload);
    setSubmitting(false);
    if (ok) onClose();
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const permRow = (id: string, checked: boolean, onToggle: () => void, kind?: PermissionLabelKind) => {
    const desc = descOf(id, kind);
    return (
      <label key={id} className="flex cursor-pointer items-start gap-2 py-1">
        <span
          className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded border-[1.5px] ${checked ? "border-primary bg-primary text-white" : "border-base-300"}`}
          onClick={(e) => { e.preventDefault(); onToggle(); }}
        >
          {checked ? <Check size={12} /> : null}
        </span>
        <span className="min-w-0 flex-1" onClick={(e) => { e.preventDefault(); onToggle(); }}>
          <span className="block text-[13px] leading-tight text-base-content/85">{desc}</span>
          {desc !== id ? <span className="block font-mono text-[10px] text-base-content/45">{id}</span> : null}
        </span>
      </label>
    );
  };

  const permSection = (sectionTitle: string, ids: string[], selected: string[], setSelected: Dispatch<SetStateAction<string[]>>) => {
    if (!ids.length) return null;
    const allOn = ids.every((id) => selected.includes(id));
    return (
      <div className="mb-3" key={sectionTitle}>
        <button
          type="button"
          onClick={() => setSelected((prev) => (allOn ? prev.filter((x) => !ids.includes(x)) : [...new Set([...prev, ...ids])]))}
          className="mb-1 flex w-full items-center justify-between"
        >
          <span className="text-xs font-semibold text-base-content/60">{sectionTitle}</span>
          <span className="text-[11px] text-primary">{t.roleDialog.selectAll}</span>
        </button>
        {ids.map((id) => permRow(id, selected.includes(id), () => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))))}
      </div>
    );
  };

  const activeModule = moduleEntries.find((e) => e.module === moduleTab) ?? null;

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      maxWidth="max-w-2xl"
      closeLabel={t.roleDialog.btnCancel}
      footer={
        <DialogFooter
          onCancel={onClose}
          cancelLabel={t.roleDialog.btnCancel}
          onSubmit={() => void submit()}
          submitLabel={t.roleDialog.btnSave}
          submitting={submitting}
        />
      }
    >
      <div className="mb-3 flex gap-1 border-b border-base-300">
        {([
          ["general", t.roleDialog.tabGeneral],
          ["panel", t.roleDialog.tabPanel],
          ["server", t.roleDialog.tabServer],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`px-3 py-2 text-sm font-semibold ${tab === key ? "border-b-2 border-primary text-primary" : "text-base-content/60"}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "general" ? (
        <>
          <Field label={t.roleDialog.labelGroupName} hint={isSystem ? t.roleDialog.groupNameHint : undefined}>
            <input className="lp-modal-input" value={name} placeholder={t.roleDialog.placeholderGroupName} disabled={isSystem} autoCapitalize="none" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t.roleDialog.labelDescription}>
            <textarea className="lp-modal-textarea min-h-[60px] font-sans text-sm" value={description} placeholder={t.roleDialog.placeholderDescription} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </>
      ) : tab === "panel" ? (
        <div>
          <InfoBox>{t.roleDialog.panelPermsInfo}</InfoBox>
          {catalogLoading ? <p className="mb-2 text-xs text-base-content/50">{t.roleDialog.loadingCatalog}</p> : null}
          {moduleEntries.length ? (
            <>
              <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
                {moduleEntries.map((e) => (
                  <button
                    key={e.module}
                    type="button"
                    className={`btn btn-xs shrink-0 ${moduleTab === e.module ? "btn-primary" : "btn-ghost border border-base-300"}`}
                    onClick={() => setModuleTab(e.module)}
                  >
                    {permissionModuleLabel(e.module, catalog, getPermissionLabelMessages(language))}
                  </button>
                ))}
              </div>
              {activeModule ? (
                <div>
                  {permSection(t.labels.permMenu, activeModule.sidebar, selSidebar, setSelSidebar)}
                  {permSection(t.labels.permViews, activeModule.views, selViews, setSelViews)}
                  {permSection(t.labels.permActions, activeModule.actions.filter((a) => !a.includes(".col.") && !BUTTON_PERMS.has(a)), selActions, setSelActions)}
                  {permSection(t.labels.permButtons, activeModule.actions.filter((a) => !a.includes(".col.") && BUTTON_PERMS.has(a)), selActions, setSelActions)}
                  {permSection(t.labels.permColumns, activeModule.actions.filter((a) => a.includes(".col.")), selActions, setSelActions)}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <div>
          {/* Acceso a archivos / carpetas */}
          <div className="mb-3 rounded-lg border border-base-300 p-3">
            <label className="mb-3 flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="checkbox checkbox-sm" checked={fileAllowAll} onChange={(e) => setFileAllowAll(e.target.checked)} />
              <span className="text-sm">{t.roleDialog.labelFileAllowAll}</span>
            </label>
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
              <div className="flex gap-2">
                <input className="lp-modal-input" value={defaultPath} placeholder={t.roleDialog.placeholderDefaultPath} autoCapitalize="none" onChange={(e) => setDefaultPath(e.target.value)} />
                {canBrowse ? (
                  <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm shrink-0" onClick={() => setBrowseTarget("default")} aria-label={t.roleDialog.labelDefaultPath}>
                    <Folder size={16} />
                  </button>
                ) : null}
              </div>
            </Field>
          </div>

          {/* Política de comandos */}
          <div className="mb-3 rounded-lg border border-base-300 p-3">
            <label className="mb-3 flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="checkbox checkbox-sm" checked={cmdAllowAll} onChange={(e) => setCmdAllowAll(e.target.checked)} />
              <span className="text-sm">{t.roleDialog.labelCmdAllowAll}</span>
            </label>
            <span className="mb-1 block text-xs font-semibold text-base-content/60">{t.roleDialog.labelCmdGroupsAllowed}</span>
            <div className="mb-3">
              {catalog.commandGroups.map((g) => permRow(g, cmdGroups.includes(g), () => setCmdGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])), "commands"))}
            </div>
            <Field label={t.roleDialog.labelCmdAllowExtra}>
              <textarea className="lp-modal-textarea" value={cmdAllow} placeholder={t.roleDialog.cmdListPlaceholder} autoCapitalize="none" onChange={(e) => setCmdAllow(e.target.value)} />
            </Field>
            <Field label={t.roleDialog.labelCmdDenyList}>
              <textarea className="lp-modal-textarea" value={cmdDeny} placeholder={t.roleDialog.cmdListPlaceholder} autoCapitalize="none" onChange={(e) => setCmdDeny(e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {browseTarget && serverId ? (
        <PathBrowserModal serverId={serverId} language={language} onClose={() => setBrowseTarget(null)} onSelect={onPathPicked} />
      ) : null}
    </ModalShell>
  );
}
