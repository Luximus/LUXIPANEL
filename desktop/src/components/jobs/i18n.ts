// Accesor i18n local del módulo "Empleos" (Fase 6, IMPL-B).
//
// El namespace `jobs` lo aporta IMPL-C (`i18n/messages/screens/jobs.ts`,
// registrado en `messages/index.ts`). Este helper SOLO lo consume: describe la
// FORMA esperada de `t.jobs` (§C.3 del contrato) y la extrae del objeto
// `Messages` ya ensamblado por `getMessages`. Así la UI de B se tipa contra una
// interfaz estable sin importar el orden de integración con C, y nunca toca el
// archivo i18n.
//
// La interpolación `{var}` se delega a `formatMessage` del repo (mismo motor que
// el resto de pantallas del desktop).
import { getMessages, formatMessage } from "../../i18n";

/** Forma de `t.jobs` (espejo nidificado del data-island `#lxp-jobs-i18n` del web,
 *  sin el prefijo `jobs.` porque aquí el namespace YA es `jobs`). */
export interface JobsMessages {
  section: string;
  title: string;
  subtitle: string;
  tab: { buyer: string; professional: string; profile: string };
  status: {
    draft: string; published: string; assigned: string; in_progress: string;
    disputed: string; released: string; cancelled: string;
  };
  field: {
    title: string; description: string; price: string; deadline: string;
    deliverables: string; country: string; language: string; workType: string;
  };
  workType: { fixed: string; hourly: string };
  action: {
    publish: string; offer: string; release: string; delete: string;
    accept: string; reject: string; detail: string;
  };
  confirm: { publish: string; release: string; delete: string };
  toast: {
    created: string; published: string; released: string; deleted: string;
    accepted: string; rejected: string;
  };
  empty: { buyer: string; professional: string };
  error: { generic: string; insufficientTokens: string; notCancellable: string; offerActive: string };
  ai: {
    moderatePlan: string; plan: string; translate: string; mustModerate: string;
    notModerated: string; noBalance: string; unavailable: string; estimate: string;
    professionalShare: string; platformShare: string; milestones: string; risks: string;
    questions: string; missing: string; draftPlaceholder: string; assist: string;
    moderation: {
      apto: string; spam: string; malicioso: string; adulto: string;
      "no-software": string; approved: string;
    };
    toast: { moderated: string; planned: string; translated: string };
  };
  prof: { score: string; busyCount: string; search: { empty: string } };
  profile: {
    enroll: string; save: string; saved: string; displayName: string; headline: string;
    bio: string; cvUrl: string; country: string; skills: string; languages: string;
    links: string; availability: string; rating: string; activeJobs: string;
    avail: { available: string; busy: string; away: string };
  };
  offer: {
    sendMany: string; sent: { summary: string }; none: { selected: string };
    searchPlaceholder: string; message: string; onlyAvailable: string;
  };
  channel: {
    title: string; empty: string; loadMore: string; sendError: string;
    notAssignedYet: string; attachTooLarge: string; systemRevoked: string;
    input: string; send: string; attach: string;
  };
  grants: {
    empty: string; share: string; shareError: string; revoke: string; revokeError: string;
    revoked: string; refLabel: string; keyForbidden: string; label: string;
    type: { server: string; ssh_key: string; group: string; link: string; note: string };
  };
  progress: {
    title: string; meets100: string; inProgress: string; report: string; review: string;
    toast: { done: string };
  };
  milestone: {
    title: string; request: string; requested: string; approve: string; approved: string;
    note: string; split: string; toast: { requested: string; approved: string };
  };
  edit: {
    title: string; save: string; propose: string; accept: string; reject: string;
    pending: string; topup: string; topupWarn: string; remoderate: string;
    toast: { saved: string; proposed: string; accepted: string; rejected: string };
  };
  dispute: {
    title: string; badge: string; open: string; request: string; reason: string;
    notEligible: string; refundPct: string; refundPartial: string; refundFull: string;
    continue: string; toast: { requested: string; resolved: string };
  };
  rating: { title: string; submit: string; comment: string; done: string; toast: { done: string } };
  // Fase 11: test técnico previo (espejo del bloque `test` de jobs.ts).
  test: {
    require: string; generate: string; ready: string; aiUnavailable: string;
    required: string; present: string; passed: string; failed: string;
    passedBadge: string; noTestBadge: string; acceptLocked: string; oneAttempt: string;
    attemptExists: string; gateRequired: string; questionOf: string; autoAdvance: string;
    next: string; submit: string;
    result: { passed: string; failed: string; timedOut: string };
    toast: { required: string; generated: string };
  };
}

/** Claves de la MODALIDAD "SERVIDOR" (AI Dev Marketplace). Se autoran es+en y se
 *  fusionan con fallback a inglés para los 11 locales (F-E hará el pase completo).
 *  Se inyectan aquí para NO tocar los 11 literales JobsMessages del archivo i18n. */
export interface JobsServerMessages {
  mode: string; modeStandard: string; modeServer: string;
  clientServer: string; clientServerHint: string; badge: string;
  acceptTitle: string; acceptHint: string; myServer: string;
  provider: string; providerNone: string; providerLoading: string; noServers: string;
  panelTitle: string;
  statusNone: string; statusPending: string; statusActive: string; statusRevoked: string; statusError: string;
  reprovision: string; console: string; consoleRun: string; consolePlaceholder: string; consoleEmpty: string;
  toastProvisioned: string; toastReprovisioned: string; errorNotReady: string;
}

const JOBS_SERVER_I18N: Record<string, JobsServerMessages> = {
  en: {
    mode: "Work method", modeStandard: "Standard (deliverables)", modeServer: "On the client's server (AI Dev)",
    clientServer: "Your server (the professional connects here)",
    clientServerHint: "Required for this method. The professional gets scoped SSH access only while the job is in progress; your credentials are never shared.",
    badge: "Server job",
    acceptTitle: "Accept — server work", acceptHint: "Pick the server you'll work from (where your AI assistant runs) and the provider to use.",
    myServer: "Your work server", provider: "AI provider",
    providerNone: "No providers enabled on this server — you can still work via the terminal.",
    providerLoading: "Loading…", noServers: "You have no registered servers. Add one in Servers first.",
    panelTitle: "Work server",
    statusNone: "No access yet", statusPending: "Provisioning access…", statusActive: "Access active",
    statusRevoked: "Access revoked", statusError: "Provisioning failed",
    reprovision: "Retry access", console: "Server console", consoleRun: "Run",
    consolePlaceholder: "Command to run on the client's server…", consoleEmpty: "Output will appear here.",
    toastProvisioned: "Server access ready", toastReprovisioned: "Access re-provisioned", errorNotReady: "Server access is not ready yet",
  },
  es: {
    mode: "Método de trabajo", modeStandard: "Estándar (entregables)", modeServer: "En el servidor del cliente (AI Dev)",
    clientServer: "Tu servidor (el profesional se conecta aquí)",
    clientServerHint: "Obligatorio en este método. El profesional recibe acceso SSH acotado solo mientras el trabajo está en curso; tus credenciales nunca se comparten.",
    badge: "Trabajo en servidor",
    acceptTitle: "Aceptar — trabajo en servidor", acceptHint: "Elige el servidor desde el que trabajarás (donde corre tu asistente IA) y el proveedor a usar.",
    myServer: "Tu servidor de trabajo", provider: "Proveedor IA",
    providerNone: "No hay proveedores habilitados en este servidor — igual puedes trabajar por la terminal.",
    providerLoading: "Cargando…", noServers: "No tienes servidores registrados. Añade uno en Servidores primero.",
    panelTitle: "Servidor del trabajo",
    statusNone: "Sin acceso aún", statusPending: "Aprovisionando acceso…", statusActive: "Acceso activo",
    statusRevoked: "Acceso revocado", statusError: "Falló el aprovisionamiento",
    reprovision: "Reintentar acceso", console: "Consola del servidor", consoleRun: "Ejecutar",
    consolePlaceholder: "Comando a ejecutar en el servidor del cliente…", consoleEmpty: "La salida aparecerá aquí.",
    toastProvisioned: "Acceso al servidor listo", toastReprovisioned: "Acceso reaprovisionado", errorNotReady: "El acceso al servidor aún no está listo",
  },
};

/** Devuelve el slice `jobs` del paquete i18n para el idioma dado, con el bloque
 *  `server` inyectado (fallback a inglés). */
export function getJobsMessages(language: string | null | undefined): JobsMessages & { server: JobsServerMessages } {
  // `Messages` incluye `jobs` una vez C lo registra; el cast mantiene a B
  // desacoplado del orden de integración (el typecheck final lo valida contra
  // la forma real de C).
  const base = (getMessages(language) as unknown as { jobs: JobsMessages }).jobs;
  const lang = (language ?? "es").slice(0, 2);
  return { ...base, server: JOBS_SERVER_I18N[lang] ?? JOBS_SERVER_I18N.en };
}

/** Reexport de `formatMessage` para interpolar `{var}` en las cadenas de jobs. */
export { formatMessage };
