// Portal de desarrollador (marketplace de módulos) — pantalla NATIVA del cliente
// DESKTOP (React DOM). Réplica de las 4 páginas web `/portal/dev/*`:
//   · Perfil  → enroll.astro (estado no-enrolado) + profile.astro (datos, KYC,
//               método de cobro). El backend hace upsert vía /enroll, así que el
//               alta y la edición de perfil comparten endpoint, igual que la web.
//   · Módulos → modules.astro (tabla + enviar/reenviar/despublicar/reactivar) +
//               modules/[id]/reviews.astro (timeline de revisión en un modal).
//   · Ganancias → earnings.astro (tarjetas + historial + solicitar retiro).
//
// Consume `api/devPortal.ts` (endpoints `/portal/dev/*`), i18n
// `getMessages(language).devPortal`, DataTable de desktop, useToast/useDialog y
// modales `lp-modal-*`. Contrato top-level `{ token, language?, isAdmin? }`.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Banknote, Code2, LayoutGrid, RefreshCw, UploadCloud, UserCog, X,
} from "lucide-react";
import DataTable from "../components/DataTable";
import { NavActions } from "../components/NavActions";
import { useToast } from "../components/ToastProvider";
import { useDialog } from "../hooks/useDialog";
import { getMessages, formatMessage } from "../i18n";
import type { NavAction } from "../features/app/types";
import {
  enrollDeveloper, getDeveloperProfile, updatePayoutMethod, startKyc,
  listDeveloperModules, submitModule, resubmitModule, unpublishModule, republishModule,
  getModuleReviews, getEarnings, listPayouts, requestDevPayout,
  reviewStatusBadgeClass, reviewResultBadgeClass, kycBadgeClass, isValidPayoutAmount,
  type DeveloperProfile, type DeveloperModule, type ModuleReviewsResponse, type Payout,
} from "../api/devPortal";

type Tab = "profile" | "modules" | "earnings";
type DevMessages = ReturnType<typeof getMessages>["devPortal"];

function fmtDate(iso: string | null | undefined, language: string, dash: string): string {
  if (!iso) return dash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return dash;
  return d.toLocaleDateString(language || "es", { year: "numeric", month: "short", day: "2-digit" });
}
function fmtDateTime(iso: string | null | undefined, language: string, dash: string): string {
  if (!iso) return dash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return dash;
  return d.toLocaleString(language || "es", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function DevPortalScreen({
  token,
  language = "es",
  isAdmin: _isAdmin,
}: {
  token: string;
  language?: string;
  isAdmin?: boolean;
}) {
  void _isAdmin;
  const t = getMessages(language).devPortal;
  const toast = useToast();
  const dialog = useDialog(language);

  const [tab, setTab] = useState<Tab>("profile");

  // ── Estado del perfil (compartido enroll/profile) ──────────────────────────
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const enrolled = Boolean(profile && profile.agreedTermsAt);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError("");
    try {
      setProfile(await getDeveloperProfile(token));
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t.profile.error);
    } finally {
      setProfileLoading(false);
    }
  }, [token, t]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const errMsg = useCallback((err: unknown, fallback: string): string => (
    err instanceof Error && err.message ? err.message : fallback
  ), []);

  const navActions: NavAction[] = [
    {
      id: "refresh",
      label: t.common.refresh,
      icon: <RefreshCw size={16} />,
      onClick: () => {
        void loadProfile();
      },
      disabled: profileLoading,
      busy: profileLoading,
    },
  ];

  const tabs: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: "profile", label: t.tab.profile, icon: <UserCog size={16} /> },
    { id: "modules", label: t.tab.modules, icon: <LayoutGrid size={16} /> },
    { id: "earnings", label: t.tab.earnings, icon: <Banknote size={16} /> },
  ];

  return (
    <main className="h-full w-full overflow-y-auto p-3 sm:p-4 md:p-6">
      <div className="panel-wrapper">
        <section className="panel-hero">
          <div className="panel-hero__grid">
            <div className="panel-hero__content">
              <span className="panel-hero__eyebrow inline-flex items-center gap-1"><Code2 size={14} /> {t.section}</span>
              <h1 className="panel-hero__title">{t.profile.heroTitle}</h1>
              <p className="panel-hero__subtitle">{t.profile.heroSubtitle}</p>
            </div>
          </div>
        </section>

        <section className="panel-section">
          <div className="support-section">
            <div className="support-section__header flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tb) => (
                  <button
                    key={tb.id}
                    type="button"
                    className={`btn btn-sm lp-seg-tab inline-flex items-center gap-1 ${tab === tb.id ? "is-active" : "btn-outline"}`}
                    onClick={() => setTab(tb.id)}
                  >
                    {tb.icon} {tb.label}
                  </button>
                ))}
              </div>
              <NavActions actions={navActions} />
            </div>

            {profileError ? (
              <div className="mt-3 flex items-center gap-3">
                <p className="text-sm text-error">{profileError}</p>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => void loadProfile()}>{t.common.refresh}</button>
              </div>
            ) : null}

            <div className="mt-4">
              {tab === "profile" ? (
                profileLoading ? (
                  <div className="py-10 text-center text-base-content/60"><span className="loading loading-spinner" /></div>
                ) : enrolled ? (
                  <ProfileWorkspace
                    token={token}
                    language={language}
                    t={t}
                    profile={profile as DeveloperProfile}
                    onSaved={setProfile}
                    toast={toast}
                    errMsg={errMsg}
                  />
                ) : (
                  <EnrollForm
                    token={token}
                    t={t}
                    onEnrolled={(p) => { setProfile(p); toast.success(t.enroll.success); }}
                    errMsg={errMsg}
                  />
                )
              ) : null}

              {tab === "modules" ? (
                <ModulesTab token={token} language={language} t={t} dialog={dialog} toast={toast} errMsg={errMsg} />
              ) : null}

              {tab === "earnings" ? (
                <EarningsTab token={token} language={language} t={t} toast={toast} errMsg={errMsg} />
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {dialog.element}
    </main>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ENROLL — estado no-enrolado del tab Perfil (enroll.astro)
// ════════════════════════════════════════════════════════════════════════════
function EnrollForm({
  token, t, onEnrolled, errMsg,
}: {
  token: string;
  t: DevMessages;
  onEnrolled: (p: DeveloperProfile) => void;
  errMsg: (err: unknown, fallback: string) => string;
}) {
  const [displayName, setDisplayName] = useState("");
  const [githubLogin, setGithubLogin] = useState("");
  const [country, setCountry] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    setError("");
    const name = displayName.trim();
    if (!name) { setError(t.enroll.displayNameRequired); return; }
    if (!terms) { setError(t.enroll.termsRequired); return; }
    setBusy(true);
    try {
      const p = await enrollDeveloper(token, {
        displayName: name,
        githubLogin: githubLogin.trim() || undefined,
        country: country.trim() || undefined,
      });
      onEnrolled(p);
    } catch (err) {
      setError(errMsg(err, t.enroll.error));
    } finally {
      setBusy(false);
    }
  }, [displayName, githubLogin, country, terms, token, t, onEnrolled, errMsg]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{t.enroll.notEnrolledTitle}</h2>
        <p className="mt-1 text-sm text-base-content/70">{t.enroll.notEnrolledText}</p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="form-control">
            <span className="label-text mb-1">{t.enroll.displayName}</span>
            <input className="input input-bordered w-full" maxLength={120} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{t.enroll.githubLogin}</span>
            <input className="input input-bordered w-full" maxLength={80} placeholder="octocat" value={githubLogin} onChange={(e) => setGithubLogin(e.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{t.enroll.country}</span>
            <input className="input input-bordered w-full" maxLength={2} placeholder="CO" value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>{t.enroll.termsLabel}</span>
        </label>

        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

        <div className="mt-4 flex justify-end">
          <button type="button" className="btn btn-primary btn-sm gap-1" onClick={() => void submit()} disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            {t.enroll.submit}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PROFILE — datos + KYC + método de cobro (profile.astro)
// ════════════════════════════════════════════════════════════════════════════
function ProfileWorkspace({
  token, language, t, profile, onSaved, toast, errMsg,
}: {
  token: string;
  language: string;
  t: DevMessages;
  profile: DeveloperProfile;
  onSaved: (p: DeveloperProfile) => void;
  toast: ReturnType<typeof useToast>;
  errMsg: (err: unknown, fallback: string) => string;
}) {
  void language;
  // Datos del developer.
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [githubLogin, setGithubLogin] = useState(profile.githubLogin ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [savingData, setSavingData] = useState(false);

  // Método de cobro.
  const [provider, setProvider] = useState(profile.payoutProvider ?? "");
  const [accountRef, setAccountRef] = useState(
    profile.payoutAccountRef && typeof profile.payoutAccountRef === "object"
      ? JSON.stringify(profile.payoutAccountRef)
      : "",
  );
  const [savingPayout, setSavingPayout] = useState(false);

  // KYC.
  const [kycStatus, setKycStatus] = useState(String(profile.kycStatus ?? "none"));
  const [kycBusy, setKycBusy] = useState(false);
  const [kycUrl, setKycUrl] = useState<string | null>(null);
  const [kycHint, setKycHint] = useState("");

  const kycLabel = useMemo(() => {
    switch (kycStatus) {
      case "verified": return t.kyc.statusVerified;
      case "pending": return t.kyc.statusPending;
      case "rejected": return t.kyc.statusRejected;
      default: return t.kyc.statusNone;
    }
  }, [kycStatus, t]);

  const saveData = useCallback(async () => {
    const name = displayName.trim();
    if (!name) { toast.error(t.enroll.displayNameRequired); return; }
    setSavingData(true);
    try {
      // Reusa /enroll (upsert) para editar sin perder agreedTermsAt, igual que la web.
      const updated = await enrollDeveloper(token, {
        displayName: name,
        githubLogin: githubLogin.trim() || undefined,
        country: country.trim() || undefined,
      });
      onSaved(updated);
      toast.success(t.profile.saved);
    } catch (err) {
      toast.error(errMsg(err, t.profile.error));
    } finally {
      setSavingData(false);
    }
  }, [displayName, githubLogin, country, token, t, onSaved, toast, errMsg]);

  const savePayout = useCallback(async () => {
    const prov = provider.trim();
    if (!prov) { toast.error(t.payout.providerRequired); return; }
    let ref: Record<string, unknown> = {};
    const raw = accountRef.trim();
    if (raw) {
      try { ref = JSON.parse(raw); } catch { ref = { ref: raw }; }
    }
    setSavingPayout(true);
    try {
      const updated = await updatePayoutMethod(token, prov, ref);
      onSaved(updated);
      setKycStatus(String(updated.kycStatus ?? kycStatus));
      toast.success(t.payout.saved);
    } catch (err) {
      toast.error(errMsg(err, t.modules.actionError));
    } finally {
      setSavingPayout(false);
    }
  }, [provider, accountRef, token, t, onSaved, toast, errMsg, kycStatus]);

  const startKycFlow = useCallback(async () => {
    setKycBusy(true);
    setKycHint(t.kyc.starting);
    try {
      const out = await startKyc(token);
      setKycStatus(String(out.kycStatus ?? "pending"));
      if (out.onboardingUrl) {
        setKycUrl(out.onboardingUrl);
        setKycHint(t.kyc.redirect);
        window.open(out.onboardingUrl, "_blank", "noopener");
      } else {
        // Modo stub (sin proveedor): un admin completa la verificación.
        setKycUrl(null);
        setKycHint(t.kyc.stub);
      }
    } catch (err) {
      setKycHint("");
      toast.error(errMsg(err, t.kyc.startError));
    } finally {
      setKycBusy(false);
    }
  }, [token, t, toast, errMsg]);

  return (
    <div className="flex flex-col gap-4">
      {/* Datos del developer */}
      <div className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-5">
        <p className="font-semibold">{t.profile.dataTitle}</p>
        <p className="text-sm text-base-content/60">{t.profile.dataSubtitle}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="form-control">
            <span className="label-text mb-1">{t.enroll.displayName}</span>
            <input className="input input-bordered w-full" maxLength={120} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{t.enroll.githubLogin}</span>
            <input className="input input-bordered w-full" maxLength={80} value={githubLogin} onChange={(e) => setGithubLogin(e.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{t.enroll.country}</span>
            <input className="input input-bordered w-full" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className="btn btn-primary btn-sm gap-1" onClick={() => void saveData()} disabled={savingData}>
            {savingData ? <span className="loading loading-spinner loading-xs" /> : null}
            {t.common.saveChanges}
          </button>
        </div>
      </div>

      {/* KYC */}
      <div className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{t.kyc.title}</p>
            <p className="text-sm text-base-content/60">{t.kyc.subtitle}</p>
          </div>
          <span className={kycBadgeClass(kycStatus)}>{kycLabel}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary btn-sm gap-1" onClick={() => void startKycFlow()} disabled={kycBusy || kycStatus === "verified"}>
            {kycBusy ? <span className="loading loading-spinner loading-xs" /> : null}
            {t.kyc.start}
          </button>
          {kycUrl ? (
            <a className="btn btn-outline btn-sm" href={kycUrl} target="_blank" rel="noopener noreferrer">{t.kyc.open}</a>
          ) : null}
        </div>
        {kycHint ? <p className="mt-2 text-xs text-base-content/60">{kycHint}</p> : null}
      </div>

      {/* Método de cobro */}
      <div className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-5">
        <p className="font-semibold">{t.payout.title}</p>
        <p className="text-sm text-base-content/60">{t.payout.subtitle}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="form-control">
            <span className="label-text mb-1">{t.payout.provider}</span>
            <select className="select select-bordered w-full" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="">{t.payout.providerNone}</option>
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
              <option value="wise">Wise</option>
              <option value="bank">{t.payout.providerBank}</option>
            </select>
          </label>
          <label className="form-control sm:col-span-2">
            <span className="label-text mb-1">{t.payout.accountRef}</span>
            <input className="input input-bordered w-full" placeholder={t.payout.accountRefHint} value={accountRef} onChange={(e) => setAccountRef(e.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className="btn btn-primary btn-sm gap-1" onClick={() => void savePayout()} disabled={savingPayout}>
            {savingPayout ? <span className="loading loading-spinner loading-xs" /> : null}
            {t.common.saveChanges}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MODULES — tabla + submit/resubmit/unpublish/republish + reviews (modules.astro)
// ════════════════════════════════════════════════════════════════════════════
type ModuleRow = {
  id: string;
  code: string;
  name: string;
  version: string;
  reviewStatus: string;
  priceTokens: string;
  scope: string;
  updated: string;
  search: string;
};

function ModulesTab({
  token, language, t, dialog, toast, errMsg,
}: {
  token: string;
  language: string;
  t: DevMessages;
  dialog: ReturnType<typeof useDialog>;
  toast: ReturnType<typeof useToast>;
  errMsg: (err: unknown, fallback: string) => string;
}) {
  const [modules, setModules] = useState<DeveloperModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitOpen, setSubmitOpen] = useState<{ mod: DeveloperModule | null } | null>(null);
  const [reviewsCode, setReviewsCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setModules(await listDeveloperModules(token));
    } catch (err) {
      setError(errMsg(err, t.modules.loadError));
    } finally {
      setLoading(false);
    }
  }, [token, t, errMsg]);

  useEffect(() => { void load(); }, [load]);

  const rows: ModuleRow[] = useMemo(() => modules.map((m) => ({
    id: m.code,
    code: m.code,
    name: m.name,
    version: m.version ?? t.common.dash,
    reviewStatus: m.reviewStatus,
    priceTokens: m.priceTokens > 0 ? String(m.priceTokens) : "0",
    scope: m.scope,
    updated: fmtDate(m.updatedAt, language, t.common.dash),
    search: `${m.code} ${m.name}`.toLowerCase(),
  })), [modules, language, t]);

  const total = modules.length;
  const published = modules.filter((m) => m.reviewStatus === "publico").length;

  const statusBadges = useMemo(() => [
    { value: "enviado", className: reviewStatusBadgeClass("enviado"), label: t.modules.statusEnviado },
    { value: "revision", className: reviewStatusBadgeClass("revision"), label: t.modules.statusRevision },
    { value: "correccion", className: reviewStatusBadgeClass("correccion"), label: t.modules.statusCorreccion },
    { value: "publico", className: reviewStatusBadgeClass("publico"), label: t.modules.statusPublico },
    { value: "inactivo", className: reviewStatusBadgeClass("inactivo"), label: t.modules.statusInactivo },
    { value: "suspendido", className: reviewStatusBadgeClass("suspendido"), label: t.modules.statusSuspendido },
  ], [t]);

  const onRowAction = useCallback(async (actionId: string, row: ModuleRow) => {
    const mod = modules.find((m) => m.code === row.code);
    if (!mod) return;
    try {
      if (actionId === "reviews") { setReviewsCode(mod.code); return; }
      if (actionId === "resubmit") { setSubmitOpen({ mod }); return; }
      if (actionId === "unpublish") {
        const ok = await dialog.confirm({
          title: t.modules.actionUnpublish,
          message: formatMessage(t.modules.unpublishConfirm, { name: mod.name }),
          tone: "danger",
          confirmLabel: t.common.confirm,
          cancelLabel: t.common.cancel,
        });
        if (!ok) return;
        await unpublishModule(token, mod.code);
        toast.success(t.modules.unpublished);
        await load();
        return;
      }
      if (actionId === "republish") {
        const ok = await dialog.confirm({
          title: t.modules.actionRepublish,
          message: formatMessage(t.modules.republishConfirm, { name: mod.name }),
          confirmLabel: t.common.confirm,
          cancelLabel: t.common.cancel,
        });
        if (!ok) return;
        await republishModule(token, mod.code);
        toast.success(t.modules.republished);
        await load();
        return;
      }
    } catch (err) {
      toast.error(errMsg(err, t.modules.actionError));
    }
  }, [modules, dialog, t, token, toast, load, errMsg]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-box border border-base-300 bg-base-100 p-3">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-base-content/60">{t.modules.cardTotalMeta}</p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-3">
          <p className="text-2xl font-bold">{published}</p>
          <p className="text-xs text-base-content/60">{t.modules.cardPublishedMeta}</p>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-error">{error}</p>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => void load()}>{t.common.refresh}</button>
        </div>
      ) : null}

      <DataTable<ModuleRow>
        tableId="dev-modules-table"
        title={t.modules.tableTitle}
        data={rows}
        language={language}
        loading={loading}
        columns={[
          { id: "code", header: t.modules.colCode, accessorKey: "code", sortable: true },
          { id: "name", header: t.modules.colName, accessorKey: "name", sortable: true },
          { id: "version", header: t.modules.colVersion, accessorKey: "version" },
          { id: "reviewStatus", header: t.modules.colStatus, accessorKey: "reviewStatus", sortable: true },
          { id: "priceTokens", header: t.modules.colPrice, accessorKey: "priceTokens", sortable: true },
          { id: "scope", header: t.modules.colScope, accessorKey: "scope", sortable: true },
          { id: "updated", header: t.modules.colUpdated, accessorKey: "updated", sortable: true },
        ]}
        filters={[
          { id: "search", label: t.modules.filterSearch, accessorKey: "search", type: "text" },
          {
            id: "status", label: t.modules.filterAllStatuses, accessorKey: "reviewStatus", type: "select",
            options: statusBadges.map((b) => ({ label: b.label ?? b.value, value: b.value })),
          },
        ]}
        valueBadges={statusBadges}
        rowActions={[
          { id: "reviews", label: t.modules.actionReviews },
          { id: "resubmit", label: t.modules.actionResubmit },
          { id: "unpublish", label: t.modules.actionUnpublish },
          { id: "republish", label: t.modules.actionRepublish },
        ]}
        quickActions={[
          { id: "submit", label: t.modules.submitNew, icon: <UploadCloud size={16} />, variant: "primary", onClick: () => setSubmitOpen({ mod: null }) },
        ]}
        pageSizeOptions={[10, 20, 50]}
        onRowAction={(id, row) => void onRowAction(id, row)}
      />

      {submitOpen ? (
        <SubmitModuleModal
          token={token}
          t={t}
          mod={submitOpen.mod}
          onClose={() => setSubmitOpen(null)}
          onDone={() => { setSubmitOpen(null); toast.success(t.modules.submitted); void load(); }}
          errMsg={errMsg}
        />
      ) : null}

      {reviewsCode ? (
        <ReviewsModal token={token} language={language} t={t} code={reviewsCode} onClose={() => setReviewsCode(null)} errMsg={errMsg} />
      ) : null}
    </div>
  );
}

function SubmitModuleModal({
  token, t, mod, onClose, onDone, errMsg,
}: {
  token: string;
  t: DevMessages;
  mod: DeveloperModule | null;
  onClose: () => void;
  onDone: () => void;
  errMsg: (err: unknown, fallback: string) => string;
}) {
  const editing = mod != null;
  const [id, setId] = useState(mod?.code ?? "");
  const [prUrl, setPrUrl] = useState(mod?.prUrl ?? "");
  const [scope, setScope] = useState(mod?.scope ?? "global");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    setError("");
    const modId = id.trim();
    const pr = prUrl.trim();
    if (!modId) { setError(t.modules.idRequired); return; }
    if (!pr) { setError(t.modules.prRequired); return; }
    setBusy(true);
    try {
      if (editing && mod) {
        await resubmitModule(token, mod.code, { prUrl: pr, scope });
      } else {
        await submitModule(token, { id: modId, prUrl: pr, scope });
      }
      onDone();
    } catch (err) {
      setError(errMsg(err, t.modules.submitError));
    } finally {
      setBusy(false);
    }
  }, [id, prUrl, scope, editing, mod, token, t, onDone, errMsg]);

  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[200] grid place-items-center p-4">
      <div className="lp-modal-card flex w-full max-w-lg flex-col" role="dialog" aria-modal="true">
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{editing ? t.modules.resubmitTitle : t.modules.submitTitle}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.common.close}><X size={18} /></button>
        </div>
        <div className="lp-modal-body flex flex-col gap-3">
          <label className="form-control">
            <span className="label-text mb-1">{t.modules.submitIdLabel}</span>
            <input className="input input-bordered w-full" placeholder="mi-modulo" value={id} readOnly={editing} onChange={(e) => setId(e.target.value)} />
            <span className="mt-1 text-xs text-base-content/50">{t.modules.submitIdHint}</span>
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{t.modules.scopeLabel}</span>
            <select className="select select-bordered w-full" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="global">global</option>
              <option value="local">local</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{t.modules.submitPrLabel}</span>
            <input className="input input-bordered w-full" type="url" placeholder="https://github.com/Luxisoft/LUXIPANEL/pull/123" value={prUrl} onChange={(e) => setPrUrl(e.target.value)} />
            <span className="mt-1 text-xs text-base-content/50">{t.modules.submitPrHint}</span>
          </label>
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </div>
        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>{t.common.cancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void submit()} disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            {t.modules.submitConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewsModal({
  token, language, t, code, onClose, errMsg,
}: {
  token: string;
  language: string;
  t: DevMessages;
  code: string;
  onClose: () => void;
  errMsg: (err: unknown, fallback: string) => string;
}) {
  const [data, setData] = useState<ModuleReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getModuleReviews(token, code);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(errMsg(err, t.reviews.loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, code, t, errMsg]);

  const versionById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of data?.versions ?? []) map.set(v.id, v.version);
    return map;
  }, [data]);

  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[200] grid place-items-center p-4">
      <div className="lp-modal-card flex max-h-[80vh] w-full max-w-2xl flex-col" role="dialog" aria-modal="true">
        <div className="lp-modal-header">
          <h3 className="lp-modal-title flex items-center gap-2">
            {t.reviews.title}
            <code className="text-sm opacity-70">{code}</code>
            {data ? <span className={reviewStatusBadgeClass(data.module.reviewStatus)}>{data.module.reviewStatus}</span> : null}
          </h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.common.close}><X size={18} /></button>
        </div>
        <div className="lp-modal-body overflow-y-auto">
          <p className="mb-3 text-sm text-base-content/60">{t.reviews.subtitle}</p>
          {loading ? (
            <div className="py-8 text-center text-base-content/60"><span className="loading loading-spinner" /></div>
          ) : error ? (
            <p className="text-sm text-error">{error}</p>
          ) : !data || data.events.length === 0 ? (
            <p className="py-6 text-center text-sm text-base-content/60">{t.reviews.noReviews}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.events.map((ev) => {
                const ver = versionById.get(ev.versionId);
                let detailStr = "";
                if (ev.detail && typeof ev.detail === "object") {
                  try {
                    const pretty = JSON.stringify(ev.detail, null, 2);
                    if (pretty && pretty !== "{}" && pretty !== "null") detailStr = pretty;
                  } catch { /* no serializable */ }
                }
                return (
                  <li key={ev.id} className="rounded-box border border-base-300 bg-base-100 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide">{ev.kind}</span>
                      <span className={reviewResultBadgeClass(ev.result)}>{ev.result}</span>
                      {ver ? <span className="font-mono text-xs opacity-70">v{ver}</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-base-content/60">
                      <span>{t.reviews.reviewer}: {ev.reviewer ?? t.common.dash}</span>
                      <span>{fmtDateTime(ev.createdAt, language, t.common.dash)}</span>
                    </div>
                    {detailStr ? (
                      <pre className="mt-2 overflow-x-auto rounded bg-base-200 p-2 text-xs leading-relaxed">{detailStr}</pre>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={onClose}>{t.common.understood}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EARNINGS — tarjetas + historial de retiros + solicitar retiro (earnings.astro)
// ════════════════════════════════════════════════════════════════════════════
type PayoutRow = {
  id: string;
  tokens: string;
  usd: string;
  provider: string;
  status: string;
  requested: string;
  paid: string;
  search: string;
};

function EarningsTab({
  token, language, t, toast, errMsg,
}: {
  token: string;
  language: string;
  t: DevMessages;
  toast: ReturnType<typeof useToast>;
  errMsg: (err: unknown, fallback: string) => string;
}) {
  const [earned, setEarned] = useState(0);
  const [pending, setPending] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [earnings, list] = await Promise.all([getEarnings(token), listPayouts(token)]);
      setEarned(Number(earnings.balance?.earned ?? 0));
      setPending(Number(earnings.balance?.pendingPayout ?? 0));
      setPayouts(list);
    } catch (err) {
      setError(errMsg(err, t.earnings.loadError));
    } finally {
      setLoading(false);
    }
  }, [token, t, errMsg]);

  useEffect(() => { void load(); }, [load]);

  const rows: PayoutRow[] = useMemo(() => payouts.map((p) => ({
    id: p.id,
    tokens: String(p.amountTokens),
    usd: `US$ ${p.amountUsd}`,
    provider: p.provider,
    status: p.status,
    requested: fmtDateTime(p.requestedAt, language, t.common.dash),
    paid: fmtDate(p.paidAt, language, t.common.dash),
    search: `${p.provider} ${p.status}`.toLowerCase(),
  })), [payouts, language, t]);

  const statusBadges = useMemo(() => [
    { value: "requested", className: "badge badge-pending", label: t.earnings.statusRequested },
    { value: "approved", className: "badge badge-pending", label: t.earnings.statusApproved },
    { value: "paid", className: "badge badge-approved", label: t.earnings.statusPaid },
    { value: "failed", className: "badge badge-declined", label: t.earnings.statusFailed },
  ], [t]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-box border border-base-300 bg-base-100 p-3">
          <p className="text-2xl font-bold">{earned}</p>
          <p className="text-xs text-base-content/60">{t.earnings.cardEarnedMeta}</p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-3">
          <p className="text-2xl font-bold">{pending}</p>
          <p className="text-xs text-base-content/60">{t.earnings.cardPendingMeta}</p>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-error">{error}</p>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => void load()}>{t.common.refresh}</button>
        </div>
      ) : null}

      <DataTable<PayoutRow>
        tableId="dev-payouts-table"
        title={t.earnings.historyTitle}
        data={rows}
        language={language}
        loading={loading}
        columns={[
          { id: "tokens", header: t.earnings.colTokens, accessorKey: "tokens", sortable: true },
          { id: "usd", header: t.earnings.colUsd, accessorKey: "usd", sortable: true },
          { id: "provider", header: t.earnings.colProvider, accessorKey: "provider", sortable: true },
          { id: "status", header: t.earnings.colStatus, accessorKey: "status", sortable: true },
          { id: "requested", header: t.earnings.colRequested, accessorKey: "requested", sortable: true },
          { id: "paid", header: t.earnings.colPaid, accessorKey: "paid", sortable: true },
        ]}
        filters={[
          { id: "search", label: t.earnings.filterSearch, accessorKey: "search", type: "text" },
        ]}
        valueBadges={statusBadges}
        quickActions={[
          { id: "request", label: t.earnings.request, icon: <Banknote size={16} />, variant: "primary", onClick: () => setRequestOpen(true) },
        ]}
        pageSizeOptions={[10, 20, 50]}
      />

      {requestOpen ? (
        <RequestPayoutModal
          token={token}
          t={t}
          onClose={() => setRequestOpen(false)}
          onDone={() => { setRequestOpen(false); toast.success(t.earnings.requested); void load(); }}
          errMsg={errMsg}
        />
      ) : null}
    </div>
  );
}

function RequestPayoutModal({
  token, t, onClose, onDone, errMsg,
}: {
  token: string;
  t: DevMessages;
  onClose: () => void;
  onDone: () => void;
  errMsg: (err: unknown, fallback: string) => string;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    setError("");
    const n = Number(amount);
    if (!isValidPayoutAmount(n)) { setError(t.earnings.amountInvalid); return; }
    setBusy(true);
    try {
      await requestDevPayout(token, n);
      onDone();
    } catch (err) {
      setError(errMsg(err, t.earnings.error));
    } finally {
      setBusy(false);
    }
  }, [amount, token, t, onDone, errMsg]);

  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[200] grid place-items-center p-4">
      <div className="lp-modal-card flex w-full max-w-md flex-col" role="dialog" aria-modal="true">
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.earnings.request}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.common.close}><X size={18} /></button>
        </div>
        <div className="lp-modal-body flex flex-col gap-3">
          <label className="form-control">
            <span className="label-text mb-1">{t.earnings.amountLabel}</span>
            <input className="input input-bordered w-full" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <span className="mt-1 text-xs text-base-content/50">{t.earnings.amountHint}</span>
          </label>
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </div>
        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>{t.common.cancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void submit()} disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            {t.earnings.request}
          </button>
        </div>
      </div>
    </div>
  );
}
