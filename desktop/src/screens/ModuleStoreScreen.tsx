// Tienda de módulos (marketplace) — port nativo React DOM de
// `frontend/src/pages/portal/modules.astro` + `portal-premium-modules.ts`.
//
// Escaparate/gestor del catálogo de módulos y servidores MCP del marketplace,
// gateado a administradores (como el `portal-modules-admin-gate` de la web).
// Listado en `DataTable` con filtros (búsqueda/tipo/clase), acciones rápidas
// (nuevo módulo, borrado múltiple) y por fila (editar/eliminar). El alta/edición
// abre un modal `lp-modal-*` con todos los campos, capacidades multilingües
// (pestañas por idioma + traducción con IA) y esquema de configuración JSON.
//
// La tienda cobra en TOKENS (`priceTokens`); no hay residuo de MB/datos.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Package, Plus, RefreshCw, ShieldAlert, X } from "lucide-react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableQuickActionConfig,
  type DataTableRowActionConfig,
  type DataTableValueBadgeConfig,
} from "../components/DataTable";
import { NavActions } from "../components/NavActions";
import { useToast } from "../components/ToastProvider";
import { useDialog } from "../hooks/useDialog";
import { getMessages, formatMessage } from "../i18n";
import type { NavAction } from "../features/app/types";
import {
  getMarketplaceModules,
  createMarketplaceModule,
  updateMarketplaceModule,
  deleteMarketplaceModule,
  translateModuleFeatures,
  type MarketplaceModule,
  type MarketplaceModulePayload,
} from "../api/marketplace";

// Idiomas de las CAPACIDADES del módulo (independientes de la UI del cliente),
// espejo literal de `FEATURE_LOCALES` / `FEATURE_LOCALE_NAMES` de la web.
const FEATURE_LOCALES = [
  "es", "en", "fr", "de", "it", "pt", "ru", "ar", "hi", "bn", "ja", "ko", "zh-Hant",
] as const;
const FEATURE_LOCALE_NAMES: Record<string, string> = {
  es: "Español", en: "English", fr: "Français", de: "Deutsch", it: "Italiano",
  pt: "Português", ru: "Русский", ar: "العربية", hi: "हिन्दी", bn: "বাংলা",
  ja: "日本語", ko: "한국어", "zh-Hant": "繁體中文",
};

const TABLE_ID = "module-store-table";

/** Fila proyectada para la DataTable (todo formateado como en `buildRows` web). */
type ModuleRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  tag: string;
  kind: string;
  kindLabel: string;
  priceTokens: number;
  priceTokensLabel: string;
  repoUrlLabel: string;
  status: string;
  version: string;
  downloads: number;
  downloadsLabel: string;
  rating: number;
  ratingLabel: string;
  createdBy: string;
  updatedAtLabel: string;
  searchBlob: string;
  [key: string]: unknown;
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function normStatus(status: string): "active" | "disabled" | "development" {
  return status === "disabled" ? "disabled" : status === "development" ? "development" : "active";
}

// ── Estado del formulario del modal ──────────────────────────────────────────
type FormState = {
  code: string;
  name: string;
  description: string;
  category: string;
  tag: string;
  kind: string;
  version: string;
  rating: string;
  createdBy: string;
  scriptPath: string;
  scriptHash: string;
  repoUrl: string;
  priceTokens: string;
  status: "active" | "disabled" | "development";
  configSchema: string;
};

const EMPTY_FORM: FormState = {
  code: "", name: "", description: "", category: "", tag: "free", kind: "module",
  version: "1.0.0", rating: "0", createdBy: "system", scriptPath: "", scriptHash: "",
  repoUrl: "", priceTokens: "0", status: "active", configSchema: "",
};

export function ModuleStoreScreen({
  token,
  language,
  isAdmin = false,
}: {
  token: string;
  language?: string;
  isAdmin?: boolean;
}) {
  const tAll = getMessages(language);
  const t = tAll.moduleStore;
  const toast = useToast();
  const dialog = useDialog(language);

  const [modules, setModules] = useState<MarketplaceModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal de alta/edición.
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string>("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Capacidades multilingües: mapa locale → líneas, y locale activo (textarea).
  const [featuresByLocale, setFeaturesByLocale] = useState<Record<string, string[]>>({ es: [] });
  const [activeFeatLocale, setActiveFeatLocale] = useState("es");
  const [featText, setFeatText] = useState("");
  const [translating, setTranslating] = useState(false);
  // Snapshot de las últimas líneas persistidas del locale activo (para no perder
  // ediciones al cambiar de pestaña / traducir / guardar).
  const featTextRef = useRef("");
  featTextRef.current = featText;

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const list = await getMarketplaceModules(token);
      setModules(list);
    } catch (err) {
      setListError(err instanceof Error ? err.message : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [token, t.loadError]);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    void reload();
  }, [isAdmin, reload]);

  // ── Capacidades: parseo, cambio de pestaña, init ───────────────────────────
  const parseFeatures = (value: string): string[] =>
    value.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const initFeatState = useCallback((initial: Record<string, string[]>) => {
    const next: Record<string, string[]> = {};
    for (const [loc, list] of Object.entries(initial)) next[loc] = Array.isArray(list) ? [...list] : [];
    if (!Array.isArray(next.es)) next.es = [];
    setFeaturesByLocale(next);
    setActiveFeatLocale("es");
    setFeatText((next.es ?? []).join("\n"));
  }, []);

  const switchFeatLocale = useCallback((locale: string) => {
    if (locale === activeFeatLocale) return;
    // Persiste el textarea del locale saliente antes de cambiar.
    const merged = { ...featuresByLocale, [activeFeatLocale]: parseFeatures(featTextRef.current) };
    setFeaturesByLocale(merged);
    setFeatText((merged[locale] ?? []).join("\n"));
    setActiveFeatLocale(locale);
  }, [activeFeatLocale, featuresByLocale]);

  // ── Abrir modal (crear / editar) ───────────────────────────────────────────
  const openCreate = useCallback(() => {
    setEditingId(null);
    setEditingCode("");
    setForm(EMPTY_FORM);
    setFormError("");
    initFeatState({ es: [] });
    setModalOpen(true);
  }, [initFeatState]);

  const openEdit = useCallback((m: MarketplaceModule) => {
    setEditingId(m.id);
    setEditingCode(m.code);
    setForm({
      code: m.code,
      name: m.name ?? "",
      description: m.description ?? "",
      category: m.category ?? "",
      tag: m.tag ?? "free",
      kind: m.kind ?? "module",
      version: m.version ?? "1.0.0",
      rating: String(m.rating ?? 0),
      createdBy: m.createdBy ?? "system",
      scriptPath: m.scriptPath ?? "",
      scriptHash: m.scriptHash ?? "",
      repoUrl: m.repoUrl ?? "",
      priceTokens: String(m.priceTokens ?? 0),
      status: normStatus(m.status),
      configSchema: m.configSchema ? JSON.stringify(m.configSchema, null, 2) : "",
    });
    setFormError("");
    const initial: Record<string, string[]> = m.featuresI18n
      ? Object.fromEntries(Object.entries(m.featuresI18n).map(([loc, list]) => [loc, Array.isArray(list) ? [...list] : []]))
      : { es: m.features ?? [] };
    if (!Array.isArray(initial.es) || initial.es.length === 0) initial.es = m.features ?? [];
    initFeatState(initial);
    setModalOpen(true);
  }, [initFeatState]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSaving(false);
  }, []);

  // ── Traducir capacidades con IA ────────────────────────────────────────────
  const translate = useCallback(async () => {
    // Persiste el locale activo (por si están editando "es") antes de traducir.
    const merged = { ...featuresByLocale, [activeFeatLocale]: parseFeatures(featTextRef.current) };
    const source = merged.es ?? [];
    if (source.length === 0) { setFormError(t.featuresSourceEmpty); return; }
    setTranslating(true);
    setFormError("");
    try {
      const featuresI18n = await translateModuleFeatures(token, source, "es");
      const next = { ...merged };
      for (const [loc, list] of Object.entries(featuresI18n)) {
        if (loc === "es") continue;
        next[loc] = Array.isArray(list) ? [...list] : [];
      }
      setFeaturesByLocale(next);
      setFeatText((next[activeFeatLocale] ?? []).join("\n"));
      toast.success(t.featuresTranslateSuccess);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.featuresTranslateError);
    } finally {
      setTranslating(false);
    }
  }, [featuresByLocale, activeFeatLocale, token, t, toast]);

  // ── Guardar (crear / editar) ───────────────────────────────────────────────
  const submit = useCallback(async () => {
    setFormError("");
    // Valida el esquema JSON opcional.
    let configSchema: unknown = null;
    const rawSchema = form.configSchema.trim();
    if (rawSchema) {
      try { configSchema = JSON.parse(rawSchema); }
      catch (err) { setFormError(`${t.configSchemaInvalidPrefix}${(err as Error).message}`); return; }
    }
    if (!editingId && !form.code.trim()) { setFormError(t.codeRequired); return; }

    // Consolida las capacidades multilingües (persiste el locale activo).
    const merged = { ...featuresByLocale, [activeFeatLocale]: parseFeatures(featTextRef.current) };
    const featuresI18n: Record<string, string[]> = {};
    for (const [loc, list] of Object.entries(merged)) {
      if (Array.isArray(list) && list.length > 0) featuresI18n[loc] = list;
    }
    const esFeatures = merged.es ?? [];

    const payload: MarketplaceModulePayload = {
      name: form.name.trim() || undefined,
      description: form.description ?? "",
      category: form.category.trim() || undefined,
      tag: form.tag || "free",
      kind: form.kind || "module",
      version: form.version.trim() || "1.0.0",
      rating: Number(form.rating) || 0,
      createdBy: form.createdBy.trim() || "system",
      repoUrl: form.repoUrl.trim() || "",
      scriptPath: form.scriptPath.trim() || null,
      scriptHash: form.scriptHash.trim() || null,
      features: esFeatures,
      featuresI18n,
      configSchema,
      priceTokens: Math.max(0, Math.floor(Number(form.priceTokens) || 0)),
      status: form.status,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateMarketplaceModule(token, editingId, payload);
        toast.success(t.updatedNotice);
      } else {
        await createMarketplaceModule(token, { ...payload, code: form.code.trim() });
        toast.success(t.createdNotice);
      }
      closeModal();
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.saveError);
    } finally {
      setSaving(false);
    }
  }, [form, editingId, featuresByLocale, activeFeatLocale, token, t, toast, closeModal, reload]);

  // ── Eliminar (fila) ────────────────────────────────────────────────────────
  const removeModule = useCallback(async (m: MarketplaceModule) => {
    const ok = await dialog.confirm({
      title: t.deleteTitle,
      message: formatMessage(t.deleteBody, { code: m.code }),
      tone: "danger",
      confirmLabel: tAll.common.delete,
      cancelLabel: tAll.common.cancel,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteMarketplaceModule(token, m.id);
      toast.success(t.deletedNotice);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.deleteError);
    } finally {
      setBusy(false);
    }
  }, [dialog, t, tAll.common, token, toast, reload]);

  // ── Borrado múltiple (acción rápida) ───────────────────────────────────────
  const bulkDelete = useCallback(async (rows: ModuleRow[]) => {
    if (rows.length < 2) return;
    const ok = await dialog.confirm({
      title: formatMessage(t.bulkDeleteTitle, { count: rows.length }),
      message: formatMessage(t.bulkDeleteBody, { count: rows.length }),
      tone: "danger",
      confirmLabel: tAll.common.delete,
      cancelLabel: tAll.common.cancel,
    });
    if (!ok) return;
    setBusy(true);
    try {
      for (const row of rows) {
        try { await deleteMarketplaceModule(token, row.id); }
        catch (err) { toast.error(err instanceof Error ? err.message : t.deleteError); }
      }
      toast.success(t.deletedNotice);
      await reload();
    } finally {
      setBusy(false);
    }
  }, [dialog, t, tAll.common, token, toast, reload]);

  // ── Proyección de filas + stats ────────────────────────────────────────────
  const rows: ModuleRow[] = useMemo(() => modules.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    category: m.category,
    tag: m.tag,
    kind: m.kind,
    kindLabel: m.kind === "mcp_server" ? "MCP Server" : t.classModule,
    priceTokens: Number(m.priceTokens ?? 0),
    priceTokensLabel: formatMessage(t.costTokens, { n: Number(m.priceTokens ?? 0) }),
    repoUrlLabel: m.repoUrl ? m.repoUrl.replace(/^https?:\/\//, "") : "—",
    status: normStatus(m.status),
    version: m.version ?? "—",
    downloads: m.downloads ?? 0,
    downloadsLabel: String(m.downloads ?? 0),
    rating: m.rating ?? 0,
    ratingLabel: Number(m.rating ?? 0).toFixed(1),
    createdBy: m.createdBy,
    updatedAtLabel: fmtDate(m.updatedAt),
    searchBlob: `${m.code} ${m.name} ${m.category} ${m.createdBy}`.toLowerCase(),
  })), [modules, t.classModule, t.costTokens]);

  const totalCount = modules.length;
  const premiumCount = useMemo(() => modules.filter((m) => m.tag === "premium").length, [modules]);

  const columns: DataTableColumnConfig<ModuleRow>[] = [
    { id: "code", header: t.colCode, accessorKey: "code", sortable: true },
    { id: "name", header: t.colName, accessorKey: "name", sortable: true },
    { id: "category", header: t.colCategory, accessorKey: "category", sortable: true },
    { id: "tag", header: t.colType, accessorKey: "tag", sortable: true },
    { id: "status", header: t.colStatus, accessorKey: "status", sortable: true },
    { id: "priceTokens", header: t.colCost, accessorKey: "priceTokensLabel", sortable: true, summary: { value: (r) => r.priceTokens, format: (n) => String(n) } },
    { id: "kind", header: t.colClass, accessorKey: "kindLabel", sortable: true },
    { id: "version", header: t.colVersion, accessorKey: "version", sortable: true },
    { id: "downloads", header: t.colInstalls, accessorKey: "downloadsLabel", sortable: true, summary: { value: (r) => r.downloads, format: (n) => String(n) } },
    { id: "rating", header: t.colRating, accessorKey: "ratingLabel", sortable: true },
    { id: "createdBy", header: t.colAuthor, accessorKey: "createdBy", sortable: true },
    { id: "repoUrl", header: t.colRepo, accessorKey: "repoUrlLabel", sortable: true },
    { id: "updatedAt", header: t.colUpdated, accessorKey: "updatedAtLabel", sortable: true },
  ];

  const filters: DataTableFilterConfig<ModuleRow>[] = [
    { id: "search", label: t.searchPlaceholder, accessorKey: "searchBlob", type: "text" },
    {
      id: "tag", label: t.filterAllTypes, accessorKey: "tag", type: "select",
      options: [
        { label: t.typeFree, value: "free" },
        { label: t.typePremium, value: "premium" },
      ],
    },
    {
      id: "kind", label: t.filterAllClasses, accessorKey: "kind", type: "select",
      options: [
        { label: t.classModule, value: "module" },
        { label: "MCP Server", value: "mcp_server" },
      ],
    },
  ];

  const rowActions: DataTableRowActionConfig<ModuleRow>[] = [
    { id: "edit", label: tAll.common.edit },
    { id: "delete", label: tAll.common.delete, variant: "danger" },
  ];

  const quickActions: DataTableQuickActionConfig<ModuleRow>[] = [
    { id: "new_module", label: t.newModule, icon: <Plus size={16} />, variant: "primary", onClick: () => openCreate() },
    { id: "bulk_delete", label: tAll.common.delete, variant: "danger", requiresSelection: true, onClick: (rs) => void bulkDelete(rs) },
  ];

  const valueBadges: DataTableValueBadgeConfig[] = [
    { value: "free", className: "badge badge-ghost", label: t.typeFree },
    { value: "premium", className: "badge badge-primary", label: t.typePremium },
    { value: "active", className: "badge badge-success", label: t.statusActive },
    { value: "disabled", className: "badge badge-ghost", label: t.statusDisabled },
    { value: "development", className: "badge badge-warning", label: t.statusDevelopment },
  ];

  const onRowAction = useCallback((actionId: string, row: ModuleRow) => {
    const m = modules.find((x) => x.id === row.id);
    if (!m) return;
    if (actionId === "edit") openEdit(m);
    else if (actionId === "delete") void removeModule(m);
  }, [modules, openEdit, removeModule]);

  const navActions: NavAction[] = [
    { id: "refresh", label: tAll.common.refresh, icon: <RefreshCw size={16} />, onClick: () => void reload(), disabled: loading, busy: loading },
  ];
  if (isAdmin) {
    navActions.push({ id: "new", label: t.newModule, icon: <Plus size={16} />, variant: "primary", onClick: openCreate });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="h-full w-full overflow-y-auto p-3 sm:p-4 md:p-6">
      <div className="panel-wrapper">
        <section className="panel-hero">
          <div className="panel-hero__grid">
            <div className="panel-hero__content">
              <span className="panel-hero__eyebrow inline-flex items-center gap-1"><Package size={14} /> {t.section}</span>
              <h1 className="panel-hero__title">{t.heroTitle}</h1>
              <p className="panel-hero__subtitle">{t.heroSubtitle}</p>
            </div>
          </div>
        </section>

        {!isAdmin ? (
          <section className="panel-section">
            <div className="support-section">
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <ShieldAlert size={48} className="text-warning" />
                <h2 className="text-lg font-semibold">{t.accessRestrictedTitle}</h2>
                <p className="max-w-md text-sm text-base-content/60">{t.accessRestrictedText}</p>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Tarjetas de resumen */}
            <section className="panel-section">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-box border border-base-300 bg-base-100 p-4">
                  <p className="text-xs uppercase tracking-wide text-base-content/50">{t.statTotal}</p>
                  <p className="mt-1 text-2xl font-semibold">{totalCount}</p>
                  <p className="text-xs text-base-content/50">{t.statTotalMeta}</p>
                </div>
                <div className="rounded-box border border-base-300 bg-base-100 p-4">
                  <p className="text-xs uppercase tracking-wide text-base-content/50">{t.statPremium}</p>
                  <p className="mt-1 text-2xl font-semibold">{premiumCount}</p>
                  <p className="text-xs text-base-content/50">{t.statPremiumMeta}</p>
                </div>
              </div>
            </section>

            <section className="panel-section">
              <div className="support-section">
                <div className="support-section__header flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="support-section__title">{t.catalogLabel}</p>
                    <p className="support-section__subtitle">{t.catalogSubtitle}</p>
                  </div>
                  <NavActions actions={navActions} />
                </div>

                {listError ? (
                  <div className="mt-3 flex items-center gap-3">
                    <p className="text-sm text-error">{listError}</p>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => void reload()}>{tAll.common.refresh}</button>
                  </div>
                ) : null}

                <div className="mt-4">
                  <DataTable<ModuleRow>
                    tableId={TABLE_ID}
                    title={t.tableTitle}
                    data={rows}
                    columns={columns}
                    filters={filters}
                    rowActions={rowActions}
                    quickActions={quickActions}
                    valueBadges={valueBadges}
                    pageSizeOptions={[10, 20, 50, 100]}
                    language={language}
                    loading={loading || busy}
                    onRowAction={onRowAction}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Modal crear / editar módulo */}
      {modalOpen ? (
        <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4">
          <div className="lp-modal-card flex max-h-full w-full max-w-3xl flex-col" role="dialog" aria-modal="true">
            <div className="lp-modal-header">
              <h3 className="lp-modal-title">{editingId ? `${t.editTitlePrefix}${editingCode}` : t.createTitle}</h3>
              <button type="button" className="lp-modal-close" onClick={closeModal} aria-label={tAll.common.close}>
                <X size={18} />
              </button>
            </div>

            <div className="lp-modal-body overflow-y-auto">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="lp-modal-label">
                  <span>{t.fieldCode}</span>
                  <input
                    className="lp-modal-input"
                    type="text"
                    value={form.code}
                    disabled={editingId != null}
                    placeholder="mail-pro"
                    onChange={(e) => setField("code", e.target.value)}
                  />
                  <small className="text-xs text-base-content/50">{t.codeHint}</small>
                </label>
                <label className="lp-modal-label">
                  <span>{t.fieldName}</span>
                  <input className="lp-modal-input" type="text" value={form.name} placeholder="Mail Pro" onChange={(e) => setField("name", e.target.value)} />
                </label>
              </div>

              <label className="lp-modal-label mt-3">
                <span>{t.fieldDescription}</span>
                <textarea className="lp-modal-input" rows={3} value={form.description} placeholder={t.descPlaceholder} onChange={(e) => setField("description", e.target.value)} />
              </label>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="lp-modal-label">
                  <span>{t.fieldCategory}</span>
                  <input className="lp-modal-input" type="text" value={form.category} placeholder={t.categoryPlaceholder} onChange={(e) => setField("category", e.target.value)} />
                </label>
                <label className="lp-modal-label">
                  <span>{t.fieldType}</span>
                  <select className="lp-modal-input" value={form.tag} onChange={(e) => setField("tag", e.target.value)}>
                    <option value="free">{t.typeFree}</option>
                    <option value="premium">{t.typePremiumOption}</option>
                  </select>
                </label>
                <label className="lp-modal-label">
                  <span>{t.fieldStatus}</span>
                  <select className="lp-modal-input" value={form.status} onChange={(e) => setField("status", e.target.value as FormState["status"])}>
                    <option value="active">{t.statusActiveOption}</option>
                    <option value="disabled">{t.statusDisabledOption}</option>
                    <option value="development">{t.statusDevelopmentOption}</option>
                  </select>
                  <small className="text-xs text-base-content/50">{t.statusHint}</small>
                </label>
                <label className="lp-modal-label">
                  <span>{t.fieldCost}</span>
                  <input className="lp-modal-input" type="number" min={0} step={1} value={form.priceTokens} onChange={(e) => setField("priceTokens", e.target.value)} />
                  <small className="text-xs text-base-content/50">{t.costHint}</small>
                </label>
                <label className="lp-modal-label">
                  <span>{t.fieldClass}</span>
                  <select className="lp-modal-input" value={form.kind} onChange={(e) => setField("kind", e.target.value)}>
                    <option value="module">{t.classModule}</option>
                    <option value="mcp_server">MCP Server</option>
                  </select>
                </label>
                <label className="lp-modal-label">
                  <span>{t.fieldVersion}</span>
                  <input className="lp-modal-input" type="text" value={form.version} placeholder="1.0.0" onChange={(e) => setField("version", e.target.value)} />
                </label>
                <label className="lp-modal-label">
                  <span>{t.fieldRating}</span>
                  <input className="lp-modal-input" type="number" min={0} max={5} step={0.1} value={form.rating} onChange={(e) => setField("rating", e.target.value)} />
                </label>
                <label className="lp-modal-label">
                  <span>{t.fieldAuthor}</span>
                  <input className="lp-modal-input" type="text" value={form.createdBy} placeholder={t.authorPlaceholder} onChange={(e) => setField("createdBy", e.target.value)} />
                </label>
                <label className="lp-modal-label">
                  <span>{t.fieldRepoUrl}</span>
                  <input className="lp-modal-input" type="url" value={form.repoUrl} placeholder={t.repoUrlPlaceholder} onChange={(e) => setField("repoUrl", e.target.value)} />
                </label>
                <label className="lp-modal-label">
                  <span>{t.fieldScriptPath}</span>
                  <input className="lp-modal-input" type="text" value={form.scriptPath} placeholder="setup-mail.sh" onChange={(e) => setField("scriptPath", e.target.value)} />
                </label>
                <label className="lp-modal-label">
                  <span>{t.fieldScriptHash}</span>
                  <input className="lp-modal-input" type="text" value={form.scriptHash} placeholder="hex sha-256" onChange={(e) => setField("scriptHash", e.target.value)} />
                </label>
              </div>

              {/* Capacidades multilingües */}
              <div className="lp-modal-label mt-3">
                <span>{t.fieldFeatures}</span>
                <small className="text-xs text-base-content/50">{t.featuresLangHint}</small>
                <div className="mt-1 flex flex-wrap gap-1">
                  {FEATURE_LOCALES.map((loc) => {
                    const isActive = loc === activeFeatLocale;
                    const hasContent = (featuresByLocale[loc]?.length ?? 0) > 0;
                    return (
                      <button
                        key={loc}
                        type="button"
                        className={`btn btn-xs ${isActive ? "btn-primary" : hasContent ? "btn-outline" : "btn-ghost"}`}
                        onClick={() => switchFeatLocale(loc)}
                      >
                        {FEATURE_LOCALE_NAMES[loc] ?? loc}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  className="lp-modal-input mt-2"
                  rows={4}
                  value={featText}
                  placeholder={t.featuresPlaceholder}
                  onChange={(e) => setFeatText(e.target.value)}
                />
                <div className="mt-2">
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => void translate()} disabled={translating}>
                    {translating ? <span className="loading loading-spinner loading-xs" /> : null}
                    {translating ? t.featuresTranslating : t.featuresTranslate}
                  </button>
                </div>
              </div>

              <label className="lp-modal-label mt-3">
                <span>{t.fieldConfigSchema}</span>
                <textarea
                  className="lp-modal-input font-mono text-xs"
                  rows={5}
                  value={form.configSchema}
                  placeholder={'{ "type": "object", "properties": { ... } }'}
                  onChange={(e) => setField("configSchema", e.target.value)}
                />
                <small className="text-xs text-base-content/50">{t.configSchemaHint}</small>
              </label>

              {formError ? <p className="mt-3 text-sm text-error">{formError}</p> : null}
            </div>

            <div className="lp-modal-footer">
              <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={closeModal}>{tAll.common.cancel}</button>
              <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void submit()} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : null}
                {editingId ? t.saveChanges : t.createTitle}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dialog.element}
    </main>
  );
}
