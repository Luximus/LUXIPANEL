import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Briefcase, Camera, Check, CreditCard, Globe, ImageUp, Lock, LogOut, MessageCircle, NotebookText, Server, Store, Trash2, User, UserPlus, X } from "lucide-react";
import { ChevronDownIcon } from "./ui/icons";
import type { SectionNavItem } from "../features/app/sectionNav";
import { ThemeToggle } from "./ui/ThemeToggle";
import { getInitials } from "./ui/Avatar";
import { SecurityTab } from "./account/SecurityTab";
import { PaymentsTab } from "./account/PaymentsTab";
import { WorklogTab } from "./account/WorklogTab";
import type { ThemeMode } from "../features/app/types";
import { LOCALES, getMessages } from "../i18n";
import { useAuth } from "../context/useAuth";
import { useDialog } from "../hooks/useDialog";
import {
  deleteCurrentAccount,
  getCurrentCustomer,
  updateCurrentCustomer,
  uploadAvatar,
  deleteAvatar,
  AVATAR_ALLOWED_MIME,
  startWhatsappVerification,
  getWhatsappStatus,
} from "../api/client";
import { COUNTRY_OPTIONS, DIAL_OPTIONS } from "../lib/countries-data";

/** Copia i18n ligera (local) de la sección de perfil + validación WhatsApp. */
const ACCT_COPY: Record<string, {
  sectionTitle: string; name: string; company: string; country: string; countryPlaceholder: string; phone: string;
  saving: string; saved: string;
  waValidate: string; waVerified: string; waHint: string;
  waOpen: string; waWaiting: string; waError: string;
  avatarChange: string; avatarRemove: string; avatarUploading: string; avatarSaved: string;
  avatarErrType: string; avatarErrSize: (mb: number) => string; avatarErrUpload: string;
  avatarHint: (mb: number) => string;
}> = {
  es: {
    sectionTitle: "Información de la cuenta", name: "Nombre", company: "Empresa", country: "País", countryPlaceholder: "Seleccionar país", phone: "WhatsApp",
    saving: "Guardando…", saved: "Guardado ✓",
    waValidate: "Validar por WhatsApp", waVerified: "Teléfono verificado ✓",
    waHint: "Abrimos WhatsApp con tu código. Solo envía el mensaje y verificaremos tu número automáticamente.",
    waOpen: "Abrir WhatsApp",
    waWaiting: "Esperando confirmación…", waError: "No se pudo iniciar la validación.",
    avatarChange: "Cambiar foto", avatarRemove: "Quitar foto",
    avatarUploading: "Subiendo…", avatarSaved: "Foto actualizada ✓",
    avatarErrType: "Formato no permitido. Usa JPG, PNG, WEBP o GIF.",
    avatarErrSize: (mb) => `La imagen supera el límite de ${mb} MB.`,
    avatarErrUpload: "No se pudo subir la imagen.",
    avatarHint: (mb) => `JPG, PNG, WEBP o GIF · máx ${mb} MB`,
  },
  en: {
    sectionTitle: "Account information", name: "Name", company: "Company", country: "Country", countryPlaceholder: "Select country", phone: "WhatsApp",
    saving: "Saving…", saved: "Saved ✓",
    waValidate: "Verify on WhatsApp", waVerified: "Phone verified ✓",
    waHint: "We opened WhatsApp with your code. Just send the message and we'll verify your number automatically.",
    waOpen: "Open WhatsApp",
    waWaiting: "Waiting for confirmation…", waError: "Couldn't start verification.",
    avatarChange: "Change photo", avatarRemove: "Remove photo",
    avatarUploading: "Uploading…", avatarSaved: "Photo updated ✓",
    avatarErrType: "Unsupported format. Use JPG, PNG, WEBP or GIF.",
    avatarErrSize: (mb) => `Image exceeds the ${mb} MB limit.`,
    avatarErrUpload: "Couldn't upload the image.",
    avatarHint: (mb) => `JPG, PNG, WEBP or GIF · max ${mb} MB`,
  },
};

/** Pestaña superior del modal de cuenta: espejo de la página de cuenta web. */
export type AccountTabId = "info" | "worklog" | "security" | "payments";

/** Señal imperativa para abrir el modal en una pestaña concreta desde el
 *  asistente o el dashboard (acción Seguridad). El `nonce` cambia en cada
 *  solicitud para re-disparar el efecto aunque la pestaña sea la misma. */
export type AccountOpenSignal = {
  tab: AccountTabId;
  nonce: number;
} | null;

export function AccountMenu({
  theme,
  toggleTheme,
  language,
  setLanguage,
  displayName,
  switchAccount,
  logout,
  openSignal = null,
  sectionNav = [],
}: {
  theme: ThemeMode;
  toggleTheme: () => void;
  language: string;
  setLanguage: (next: string) => void;
  displayName: string;
  switchAccount: () => Promise<void>;
  logout: () => Promise<void>;
  tokensAvailable: number | null;
  openSignal?: AccountOpenSignal;
  /** Navegación de sección (Servidores/Soporte/Pagos/Admin) para los items del
   *  dropdown que navegan en vez de abrir un modal. */
  sectionNav?: SectionNavItem[];
}) {
  const t = getMessages(language);
  const { userEmail, savedAccounts, token, updateAccountPhoto, loginWithSavedAccount } = useAuth();
  // Dropdown de cuenta (menú estilo "perfiles"): el trigger es avatar + chevron.
  const [menuOpen, setMenuOpen] = useState(false);
  // Modal de SECCIÓN: cada item del dropdown abre el suyo (sin barra de
  // pestañas). `accountOpen` controla la visibilidad; `activeTab` la sección.
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTabId>("info");
  // Otras cuentas guardadas (para el switcher), excluida la activa.
  const otherAccounts = savedAccounts.filter((a) => a.email !== userEmail);
  const sectionSelect = (key: SectionNavItem["key"]) => {
    setMenuOpen(false);
    sectionNav.find((item) => item.key === key)?.onSelect?.();
  };
  const currentAccount = userEmail ? savedAccounts.find((entry) => entry.email === userEmail) : null;
  // Foto autoritativa de R2 (subida propia) que tiene PRECEDENCIA sobre la de
  // Firebase: el backend usa `customers.photoUrl` como fuente única (una subida
  // propia sobrescribe la imagen del proveedor), así que al abrir el modal
  // /portal/me devuelve la foto vigente. `photoOverride` la mantiene al día tras
  // subir/quitar sin reiniciar; si es undefined caemos a la cuenta guardada.
  const [photoOverride, setPhotoOverride] = useState<string | null | undefined>(undefined);
  const photoURL = photoOverride !== undefined ? photoOverride : (currentAccount?.photoURL ?? null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(photoURL) && !photoFailed;
  const dialog = useDialog(language);
  const [deleting, setDeleting] = useState(false);

  // ── Subida de avatar (foto de perfil) ──
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarState, setAvatarState] = useState<"idle" | "uploading" | "saved">("idle");
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  // Límite de subida dinámico por rol (MB), resuelto server-side en /portal/me.
  // Aplica al avatar; null hasta que carga → fallback 5 MB en el punto de uso.
  const [maxUploadMb, setMaxUploadMb] = useState<number | null>(null);

  // ── Perfil + validación de teléfono por WhatsApp ──
  const ac = ACCT_COPY[language] ?? ACCT_COPY.es;
  const [name, setName] = useState(displayName);
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  // Catálogo de países y prefijos: lista estática COMPLETA compartida con web y
  // app (lib/countries-data) para que las tres listas sean IDÉNTICAS y no
  // dependan de una API externa que puede fallar.
  const countryOptions = COUNTRY_OPTIONS;
  const [phonePrefix, setPhonePrefix] = useState("+57");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const lastSavedRef = useRef<string>("");
  const [waVerified, setWaVerified] = useState(false);
  const [waState, setWaState] = useState<"idle" | "starting" | "pending">("idle");
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const waPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopWaPoll = () => { if (waPollRef.current) { clearInterval(waPollRef.current); waPollRef.current = null; } };

  // Carga perfil + estado WhatsApp al abrir el modal.
  useEffect(() => {
    if (!accountOpen || !token) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await getCurrentCustomer(token);
        if (!cancelled && me) {
          setName(me.name ?? displayName);
          setCompany(me.company ?? "");
          setCountry(me.country ?? "");
          setPhonePrefix(me.phoneCountryCode?.trim() || "+57");
          setPhoneNumber((me.phone ?? "").replace(/\D/g, ""));
          if (typeof me.maxUploadMb === "number") setMaxUploadMb(me.maxUploadMb);
          // Foto autoritativa del backend (propia R2 > Firebase). Si difiere de
          // la cuenta guardada (p. ej. subida desde otro cliente), la refresca.
          if (me.photoUrl !== undefined) {
            setPhotoOverride(me.photoUrl ?? null);
            setPhotoFailed(false);
            if (currentAccount && (currentAccount.photoURL ?? null) !== (me.photoUrl ?? null)) {
              updateAccountPhoto(currentAccount.uid, me.photoUrl ?? null);
            }
          }
          // Snapshot del "último guardado" NORMALIZADO igual que el payload del
          // auto-guardado (company/country vacío→null y misma regla de teléfono)
          // para que al abrir el modal NO se dispare un PUT espurio sin editar.
          // `locale` debe ser EL MISMO que el payload del auto-guardado
          // (`language`), no `me.locale`: si el locale almacenado difería del
          // idioma actual, el snapshot no casaba y se disparaba un PUT espurio al
          // abrir el menú sin editar nada.
          const meNum = (me.phone ?? "").replace(/\D/g, "");
          const mePrefix = me.phoneCountryCode?.trim() || "+57";
          lastSavedRef.current = JSON.stringify({
            name: (me.name ?? displayName).trim(), company: (me.company ?? "").trim() || null,
            country: (me.country ?? "").trim() || null, phoneCountryCode: meNum ? mePrefix : null,
            phone: meNum || null, locale: language,
          });
        }
        const s = await getWhatsappStatus(token);
        if (!cancelled && s?.whatsapp_verified) setWaVerified(true);
      } catch { /* sin datos */ }
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; stopWaPoll(); };
  }, [accountOpen, token]);

  // Auto-guardado debounced del perfil.
  useEffect(() => {
    if (!accountOpen || !loaded || !token || !name.trim()) return;
    const num = phoneNumber.replace(/\D/g, "");
    const payload = {
      name: name.trim(), company: company.trim() || null, country: country.trim() || null,
      phoneCountryCode: num ? phonePrefix : null, phone: num || null, locale: language,
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      setSaveState("saving");
      void (async () => {
        try {
          await updateCurrentCustomer(token, payload);
          lastSavedRef.current = serialized;
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 2000);
        } catch { setSaveState("idle"); }
      })();
    }, 700);
    return () => clearTimeout(timer);
  }, [accountOpen, loaded, token, name, company, country, phonePrefix, phoneNumber, language]);

  const startWaVerification = async () => {
    if (!token) return;
    const num = phoneNumber.replace(/\D/g, "");
    if (!num) return;
    setWaError(null); setWaState("starting");
    try {
      const out = await startWhatsappVerification(token, `${phonePrefix}${num}`);
      setWaUrl(out.wa_url); setWaState("pending");
      if (out.wa_url) window.open(out.wa_url, "_blank", "noreferrer");
      stopWaPoll();
      waPollRef.current = setInterval(async () => {
        try {
          const s = await getWhatsappStatus(token);
          if (s?.whatsapp_verified) { setWaVerified(true); setWaState("idle"); stopWaPoll(); }
        } catch { /* reintenta */ }
      }, 4000);
    } catch { setWaState("idle"); setWaError(ac.waError); }
  };

  // Selección de archivo → valida tipo/tamaño del contrato y sube a R2.
  const handleAvatarFile = async (file: File | null) => {
    if (!file || !token) return;
    setAvatarError(null);
    // Validación de tipo (espejo de AVATAR_ALLOWED_MIME). El GIF animado entra
    // como image/gif y se acepta tal cual; Electron lo anima nativo en <img>.
    if (!(AVATAR_ALLOWED_MIME as readonly string[]).includes(file.type)) {
      setAvatarError(ac.avatarErrType);
      return;
    }
    // Límite dinámico por rol (MB → bytes); fallback 5 MB si aún no cargó.
    const effectiveMb = maxUploadMb ?? 5;
    const maxBytes = effectiveMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setAvatarError(ac.avatarErrSize(effectiveMb));
      return;
    }
    setAvatarState("uploading");
    setAvatarProgress(0);
    // Preview inmediato con object URL mientras sube (se revoca al terminar).
    const previewUrl = URL.createObjectURL(file);
    setPhotoFailed(false);
    setPhotoOverride(previewUrl);
    try {
      const photoUrl = await uploadAvatar(file, token, setAvatarProgress);
      // Foto definitiva de R2 (URL absoluta). Refresca avatar + caché de cuenta.
      setPhotoOverride(photoUrl);
      setPhotoFailed(false);
      if (currentAccount) updateAccountPhoto(currentAccount.uid, photoUrl);
      setAvatarState("saved");
      setTimeout(() => setAvatarState("idle"), 2000);
    } catch (err) {
      setPhotoOverride(currentAccount?.photoURL ?? null);
      setAvatarError(err instanceof Error ? err.message : ac.avatarErrUpload);
      setAvatarState("idle");
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  };

  // Quita la foto (DELETE) y vuelve a iniciales/placeholder.
  const handleAvatarRemove = async () => {
    if (!token || avatarState === "uploading") return;
    setAvatarError(null);
    setAvatarState("uploading");
    try {
      await deleteAvatar(token);
      setPhotoOverride(null);
      setPhotoFailed(false);
      if (currentAccount) updateAccountPhoto(currentAccount.uid, null);
      setAvatarState("idle");
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : ac.avatarErrUpload);
      setAvatarState("idle");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    // Cierra el modal de cuenta (z muy alto) para que el diálogo de
    // confirmación quede visible por encima de la página.
    setAccountOpen(false);
    const confirmed = await dialog.confirm({
      title: t.account.deleteAccountTitle,
      message: t.account.deleteAccountDescription,
      confirmLabel: t.account.deleteAccountConfirm,
      tone: "danger",
    });
    if (!confirmed || !token) return;
    setDeleting(true);
    try {
      await deleteCurrentAccount(token);
      await dialog.alert({
        title: t.account.deleteAccount,
        message: t.account.deleteAccountDeleted,
      });
      await logout();
    } catch {
      await dialog.alert({ title: t.account.deleteAccount, message: t.account.deleteAccountError, tone: "danger" });
    } finally {
      setDeleting(false);
    }
  };

  // Gate de entrada a Seguridad: con 2FA, pide el código antes de mostrar la
  // pestaña (igual que el antiguo `goSecurityGated` de MainScreen). Si el usuario
  // cancela/falla, NO cambia de pestaña. `requireSecurityAccess` no re-pide si el
  // token de step-up sigue vigente esta sesión.
  // Abre el MODAL de cuenta directamente en una sección (sin barra de pestañas);
  // cada item del dropdown abre el suyo. El gate de 2FA de Seguridad ya NO se pide
  // aquí con un modal: el propio `SecurityTab` lo muestra INLINE al abrirse.
  const openSection = (tab: AccountTabId) => {
    setMenuOpen(false);
    setActiveTab(tab);
    setAccountOpen(true);
  };

  // Solicitudes externas (asistente / dashboard) de abrir el modal en una
  // pestaña (hoy solo Seguridad). Cambia de pestaña aplicando el gate de
  // Seguridad. El `nonce` re-dispara aunque la pestaña no cambie. Las
  // actualizaciones de estado se difieren a un microtask (no se llaman síncronas
  // dentro del cuerpo del efecto) para no encadenar renders.
  useEffect(() => {
    if (!openSignal) return;
    const signal = openSignal;
    queueMicrotask(() => {
      setAccountOpen(true);
      // El gate 2FA de Seguridad lo aplica `SecurityTab` inline (sin modal).
      setActiveTab(signal.tab);
    });
    // Solo reacciona al cambio de nonce (cada solicitud).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal?.nonce]);

  const initials = getInitials(displayName, userEmail);
  const whatsappPhone = "19295636472";
  const whatsappHref = `https://api.whatsapp.com/send/?phone=%2B${whatsappPhone}&text=${encodeURIComponent(t.account.whatsappMessage)}&type=phone_number&app_absent=0`;
  const currentLanguageLabel = LOCALES.find((entry) => entry.code === language)?.label ?? language;

  return (
    <div className="titlebar-no-drag flex items-center gap-2">
      <ThemeToggle theme={theme} onToggle={toggleTheme} label={t.common.toggleTheme} />
      {/* Botón de cuenta: SOLO avatar + chevron. Al pulsar despliega el menú de
          cuenta (cabecera de perfil + switcher + items). */}
      <div className="relative">
        <button
          className="btn btn-outline account-menu-trigger h-10 min-h-0 items-center gap-1.5 rounded-xl border-base-300/80 ps-1.5 pe-2 py-0 normal-case backdrop-blur-xs"
          onClick={() => setMenuOpen((prev) => !prev)}
          title={displayName}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {showPhoto ? (
            <div className="avatar avatar-online">
              <div className="w-9 rounded-full ring ring-base-100 ring-offset-0">
                <img
                  src={photoURL ?? undefined}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setPhotoFailed(true)}
                />
              </div>
            </div>
          ) : (
            <div className="avatar avatar-placeholder avatar-online">
              <div className="w-9 rounded-full bg-primary text-primary-content ring ring-base-100 ring-offset-0">
                <span className="text-xs font-bold">{initials}</span>
              </div>
            </div>
          )}
          <ChevronDownIcon />
        </button>

        {menuOpen ? (
          <>
            {/* Backdrop transparente: cierra el menú al hacer click fuera. */}
            <div className="fixed inset-0 z-[140]" onClick={() => setMenuOpen(false)} />
            <div className="lp-modal-card absolute end-0 top-full z-[150] mt-2 flex w-72 flex-col gap-0.5 p-2 text-start" role="menu">
              {/* Cabecera de perfil */}
              <div className="flex items-center gap-3 px-2 py-2">
                {showPhoto ? (
                  <div className="avatar"><div className="w-9 rounded-full"><img src={photoURL ?? undefined} alt={displayName} referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} /></div></div>
                ) : (
                  <div className="avatar avatar-placeholder"><div className="w-9 rounded-full bg-primary text-primary-content"><span className="text-xs font-bold">{initials}</span></div></div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold leading-tight">{displayName}</div>
                  <div className="truncate text-xs opacity-70">{userEmail ?? "-"}</div>
                </div>
              </div>

              {/* Switcher de OTRAS cuentas guardadas */}
              {otherAccounts.length > 0 ? (
                <>
                  <div className="my-1 h-px bg-base-300/70" />
                  {otherAccounts.map((acct) => {
                    const name = acct.displayName || acct.email.split("@")[0] || acct.email;
                    return (
                      <button
                        key={acct.uid}
                        type="button"
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-start hover:bg-base-200/70"
                        onClick={() => { setMenuOpen(false); void loginWithSavedAccount(acct).then((ok) => { if (!ok) void switchAccount(); }); }}
                        title={acct.email}
                      >
                        {acct.photoURL ? (
                          <div className="avatar"><div className="w-7 rounded-full"><img src={acct.photoURL} alt="" referrerPolicy="no-referrer" /></div></div>
                        ) : (
                          <div className="avatar avatar-placeholder"><div className="w-7 rounded-full bg-base-300 text-base-content"><span className="text-[10px] font-bold">{getInitials(name, acct.email)}</span></div></div>
                        )}
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate text-sm font-semibold">{name}</span>
                          <span className="truncate text-xs opacity-60">{acct.email}</span>
                        </span>
                      </button>
                    );
                  })}
                </>
              ) : null}
              <button type="button" className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:bg-base-200/70" onClick={() => { setMenuOpen(false); void switchAccount(); }}>
                <UserPlus size={16} /> {(t.account as { allProfiles?: string }).allProfiles ?? "Ver todos los perfiles"}
              </button>

              <div className="my-1 h-px bg-base-300/70" />

              {/* Items */}
              <button type="button" className="lp-acct-row" onClick={() => openSection("info")} role="menuitem"><User size={16} /> {t.account.tabInfo}</button>
              <button type="button" className="lp-acct-row" onClick={() => openSection("worklog")} role="menuitem"><NotebookText size={16} /> {t.account.tabWorklog}</button>
              <button type="button" className="lp-acct-row" onClick={() => sectionSelect("servers")} role="menuitem"><Server size={16} /> {t.titleBar.fabServers}</button>
              {sectionNav.some((i) => i.key === "notifications") ? (
                <button type="button" className="lp-acct-row" onClick={() => sectionSelect("notifications")} role="menuitem"><Bell size={16} /> {(t.titleBar as Record<string, string>).fabNotifications ?? "Notificaciones"}</button>
              ) : null}
              <button type="button" className="lp-acct-row" onClick={() => sectionSelect("payments")} role="menuitem"><Store size={16} /> {(t.account as { store?: string }).store ?? "Tienda"}</button>
              {sectionNav.some((i) => i.key === "jobs") ? (
                <button type="button" className="lp-acct-row" onClick={() => sectionSelect("jobs")} role="menuitem"><Briefcase size={16} /> {(t as Record<string, { section?: string }>).jobs?.section ?? "Trabajos"}</button>
              ) : null}
              <button type="button" className="lp-acct-row" onClick={() => openSection("security")} role="menuitem"><Lock size={16} /> {t.account.tabSecurity}</button>
              <button type="button" className="lp-acct-row" onClick={() => openSection("payments")} role="menuitem"><CreditCard size={16} /> {t.account.tabPayments}</button>
              <a className="lp-acct-row" href={whatsappHref} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)} role="menuitem"><MessageCircle size={16} /> {(t.account as { help?: string }).help ?? t.account.whatsapp}</a>

              {/* Items de staff/admin (solo si la sección está disponible). */}
              {sectionNav.some((i) => i.key === "support") ? (
                <button type="button" className="lp-acct-row" onClick={() => sectionSelect("support")} role="menuitem"><MessageCircle size={16} /> {t.titleBar.fabSupport}</button>
              ) : null}
              {sectionNav.some((i) => i.key === "admin") ? (
                <button type="button" className="lp-acct-row" onClick={() => sectionSelect("admin")} role="menuitem"><Globe size={16} /> {t.admin.section}</button>
              ) : null}

              <div className="my-1 h-px bg-base-300/70" />
              <button type="button" className="lp-acct-row text-error" onClick={() => { setMenuOpen(false); void logout(); }} role="menuitem"><LogOut size={16} className="lp-rtl-flip" /> {t.account.logout}</button>
            </div>
          </>
        ) : null}
      </div>

      {accountOpen ? createPortal((
        <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4">
          <div
            className={`lp-modal-card flex max-h-full w-full flex-col ${activeTab === "info" ? "max-w-md" : "max-w-3xl"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal de UNA sección (sin barra de pestañas): el título refleja la
                sección abierta desde el dropdown. Seguridad pasó por el gate. */}
            <div className="lp-modal-header">
              <h2 className="flex items-center gap-2 text-base font-bold">
                {activeTab === "info" ? <User size={16} /> : activeTab === "worklog" ? <NotebookText size={16} /> : activeTab === "security" ? <Lock size={16} /> : <CreditCard size={16} />}
                {activeTab === "info" ? t.account.tabInfo : activeTab === "worklog" ? t.account.tabWorklog : activeTab === "security" ? t.account.tabSecurity : t.account.tabPayments}
              </h2>
              <button
                type="button"
                className="lp-modal-close"
                onClick={() => setAccountOpen(false)}
                aria-label={t.common.close}
              >
                <X size={18} />
              </button>
            </div>

            <div className="lp-modal-body grow min-h-0">
                {activeTab === "worklog" ? (
                  <WorklogTab token={token ?? ""} language={language} />
                ) : null}

                {activeTab === "security" ? (
                  <SecurityTab token={token ?? ""} language={language} />
                ) : null}

                {activeTab === "payments" ? (
                  <PaymentsTab language={language} token={token ?? ""} />
                ) : null}

                {activeTab === "info" ? (
                <>
                <div className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200/40 px-3 py-3">
                  {/* Avatar clickable: abre el selector de archivo para cambiar la
                      foto. El GIF animado se muestra animado (Electron anima GIF
                      nativo en <img>). El object URL de preview también anima. */}
                  <button
                    type="button"
                    className="group relative shrink-0 rounded-full tooltip tooltip-bottom"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarState === "uploading"}
                    aria-label={ac.avatarChange}
                    data-tip={ac.avatarChange}
                  >
                    {showPhoto ? (
                      <div className="avatar">
                        <div className="w-20 rounded-full ring ring-base-300">
                          <img
                            src={photoURL ?? undefined}
                            alt={displayName}
                            referrerPolicy="no-referrer"
                            onError={() => setPhotoFailed(true)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="avatar avatar-placeholder">
                        <div className="w-20 rounded-full bg-primary text-primary-content ring ring-base-300">
                          <span className="text-xl font-bold">{initials}</span>
                        </div>
                      </div>
                    )}
                    {/* Overlay de cámara al pasar el cursor / mientras sube. */}
                    <span className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white transition-opacity ${avatarState === "uploading" ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                      {avatarState === "uploading" ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : (
                        <Camera size={22} />
                      )}
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      // Permite re-seleccionar el mismo archivo después.
                      e.target.value = "";
                      void handleAvatarFile(file);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{name.trim() || displayName}</div>
                    <div className="truncate text-xs opacity-70">{userEmail ?? "-"}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-xs btn-outline gap-1.5"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarState === "uploading"}
                      >
                        <ImageUp size={13} /> {ac.avatarChange}
                      </button>
                      {showPhoto ? (
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost gap-1.5 text-error"
                          onClick={() => { void handleAvatarRemove(); }}
                          disabled={avatarState === "uploading"}
                        >
                          <Trash2 size={13} /> {ac.avatarRemove}
                        </button>
                      ) : null}
                      {avatarState === "uploading" ? (
                        <span className="text-[11px] font-semibold opacity-60">{ac.avatarUploading} {avatarProgress}%</span>
                      ) : avatarState === "saved" ? (
                        <span className="text-[11px] font-semibold text-success">{ac.avatarSaved}</span>
                      ) : null}
                    </div>
                    {avatarState === "uploading" ? (
                      <progress
                        className="progress progress-primary mt-1.5 h-1.5 w-full"
                        value={avatarProgress}
                        max={100}
                        aria-label={ac.avatarUploading}
                      />
                    ) : null}
                    {avatarError ? (
                      <div className="mt-1 text-[11px] text-error">{avatarError}</div>
                    ) : (
                      <div className="mt-1 text-[10px] opacity-50">{ac.avatarHint(maxUploadMb ?? 5)}</div>
                    )}
                  </div>
                </div>

                {/* ── Sección de información de la cuenta (perfil + teléfono) ── */}
                <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-200/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide opacity-70">{ac.sectionTitle}</span>
                    {saveState !== "idle" ? (
                      <span className={`text-[11px] font-semibold ${saveState === "saved" ? "text-success" : "opacity-60"}`}>
                        {saveState === "saving" ? ac.saving : ac.saved}
                      </span>
                    ) : null}
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold opacity-60">{ac.name}</span>
                    <input className="input input-sm input-bordered w-full" value={name} onChange={(e) => setName(e.target.value)} />
                  </label>
                  <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 min-w-0">
                      <span className="text-[11px] font-semibold opacity-60">{ac.company}</span>
                      <input className="input input-sm input-bordered w-full" value={company} onChange={(e) => setCompany(e.target.value)} />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 min-w-0">
                      <span className="text-[11px] font-semibold opacity-60">{ac.country}</span>
                      <select
                        className="select select-sm select-bordered w-full"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                      >
                        <option value="">{ac.countryPlaceholder}</option>
                        {/* País ya guardado que aún no está en el catálogo cargado
                            (p. ej. antes de que termine la descarga) para no perder
                            la selección actual. */}
                        {country && !countryOptions.some((entry) => entry.value === country) ? (
                          <option value={country}>{country}</option>
                        ) : null}
                        {countryOptions.map((entry) => (
                          <option key={entry.value} value={entry.value}>{entry.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold opacity-60">{ac.phone}</span>
                    <div className="flex gap-2">
                      <select
                        className="select select-sm select-bordered w-24 shrink-0"
                        value={phonePrefix}
                        onChange={(e) => setPhonePrefix(e.target.value)}
                      >
                        {/* Prefijo guardado que no esté en la lista, para no perderlo. */}
                        {phonePrefix && !DIAL_OPTIONS.includes(phonePrefix) ? (
                          <option value={phonePrefix}>{phonePrefix}</option>
                        ) : null}
                        {DIAL_OPTIONS.map((dial) => (
                          <option key={dial} value={dial}>{dial}</option>
                        ))}
                      </select>
                      <input
                        className="input input-sm input-bordered min-w-0 flex-1"
                        value={phoneNumber}
                        inputMode="numeric"
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 20))}
                      />
                      {/* Botón de validación inline con el número (oculto cuando ya
                          está verificado o ya se abrió WhatsApp esperando envío). */}
                      {!waVerified && waState !== "pending" ? (
                        <button
                          className="btn btn-sm btn-outline shrink-0 gap-2 whitespace-nowrap border-success/40 text-success"
                          onClick={() => void startWaVerification()}
                          disabled={waState === "starting" || !phoneNumber.trim()}
                        >
                          <MessageCircle size={14} /> {ac.waValidate}
                        </button>
                      ) : null}
                    </div>
                  </label>

                  {/* Estado de validación por WhatsApp: el usuario envía el mensaje
                      con el código (prellenado en wa.me) al WhatsApp de LuxiSoft; el
                      bridge lo valida e informa por callback, y el polling refleja el
                      cambio aquí. No se teclea código en la app. */}
                  {waVerified ? (
                    <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                      <Check size={14} /> {ac.waVerified}
                    </span>
                  ) : waState === "pending" ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] opacity-70">{ac.waHint}</p>
                      {waUrl ? (
                        <a
                          className="btn btn-sm btn-success self-start gap-2"
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle size={14} /> {ac.waOpen}
                        </a>
                      ) : null}
                      <span className="inline-flex items-center gap-2 text-[11px] opacity-60">
                        <span className="loading loading-spinner loading-xs" /> {ac.waWaiting}
                      </span>
                      {waError ? <span className="text-[11px] text-error">{waError}</span> : null}
                    </div>
                  ) : null}
                  {waState === "idle" && waError ? <span className="text-[11px] text-error">{waError}</span> : null}
                </div>

                <div className="flex gap-2">
                  <button
                    className="btn btn-outline min-w-0 flex-1 justify-start gap-2 text-sm"
                    onClick={() => {
                      window.open(whatsappHref, "_blank", "noreferrer");
                      setAccountOpen(false);
                    }}
                  >
                    <MessageCircle size={16} className="shrink-0" />
                    <span className="truncate">{t.account.whatsapp}</span>
                  </button>

                  {/* Selector de idioma (antes en su propia fila). El botón
                      "Cambiar cuenta" se quitó: ya no es necesario. */}
                  <label className="btn btn-ghost relative min-w-0 flex-1 justify-start gap-2 text-sm normal-case">
                    <Globe size={16} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-start">{currentLanguageLabel}</span>
                    <ChevronDownIcon />
                    <select
                      className="account-language-select absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      aria-label={t.account.languageLabel}
                    >
                      {LOCALES.map((entry) => (
                        <option key={entry.code} value={entry.code}>{entry.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  className="btn account-logout-btn justify-start gap-2 text-sm"
                  onClick={() => {
                    setAccountOpen(false);
                    void logout();
                  }}
                >
                  <LogOut size={16} className="lp-rtl-flip" />
                  <span>{t.account.logout}</span>
                </button>

                <button
                  className="btn btn-ghost btn-sm self-start justify-start gap-2 px-2 text-error"
                  onClick={() => { void handleDeleteAccount(); }}
                  disabled={deleting}
                >
                  <Trash2 size={14} />
                  <span>{t.account.deleteAccount}</span>
                </button>
                </>
                ) : null}
            </div>
          </div>
        </div>
      ), document.body) : null}
      {dialog.element}
    </div>
  );
}
