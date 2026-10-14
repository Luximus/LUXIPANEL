import { getMessages } from "../../i18n";

// Las claves del namespace `jobs` (IMPL-C) son PLANAS, pero muchas son strings
// con punto ("status.draft", "ai.moderation.apto", …) porque `jobsErrorKey()` de
// `api/jobs.ts` devuelve rutas con punto que aquí se resuelven tal cual. Este
// helper centraliza el acceso tipado-laxo + el reemplazo de `{placeholders}`
// (igual que `formatMessage`), para no repetir el patrón en cada componente.

export type JobsDict = Record<string, string>;

// Claves PLANAS de la MODALIDAD "SERVIDOR" (AI Dev Marketplace). Autoradas es+en;
// se fusionan con fallback a inglés (F-E hará el pase completo a 11 locales). Se
// inyectan aquí para NO tocar los 11 literales de messages/screens/jobs.ts.
const JOBS_SERVER_I18N: Record<string, Record<string, string>> = {
  en: {
    "server.mode": "Work method",
    "server.mode.standard": "Standard (deliverables)",
    "server.mode.server": "On the client's server (AI Dev)",
    "server.clientServer": "Your server (the professional connects here)",
    "server.clientServer.hint": "Required for this method. The professional gets scoped SSH access only while the job is in progress; your credentials are never shared.",
    "server.badge": "Server job",
    "server.accept.title": "Accept — server work",
    "server.accept.hint": "Pick the server you'll work from (where your AI assistant runs) and the provider to use.",
    "server.myServer": "Your work server",
    "server.provider": "AI provider",
    "server.provider.none": "No providers enabled on this server — you can still work via the console.",
    "server.provider.loading": "Loading…",
    "server.noServers": "You have no registered servers. Add one first.",
    "server.panel.title": "Work server",
    "server.status.none": "No access yet",
    "server.status.pending": "Provisioning access…",
    "server.status.active": "Access active",
    "server.status.revoked": "Access revoked",
    "server.status.error": "Provisioning failed",
    "server.reprovision": "Retry access",
    "server.console": "Server console",
    "server.console.run": "Run",
    "server.console.placeholder": "Command to run on the client's server…",
    "server.console.empty": "Output will appear here.",
    "server.toast.provisioned": "Server access ready",
    "server.toast.reprovisioned": "Access re-provisioned",
    "server.error.notReady": "Server access is not ready yet",
  },
  es: {
    "server.mode": "Método de trabajo",
    "server.mode.standard": "Estándar (entregables)",
    "server.mode.server": "En el servidor del cliente (AI Dev)",
    "server.clientServer": "Tu servidor (el profesional se conecta aquí)",
    "server.clientServer.hint": "Obligatorio en este método. El profesional recibe acceso SSH acotado solo mientras el trabajo está en curso; tus credenciales nunca se comparten.",
    "server.badge": "Trabajo en servidor",
    "server.accept.title": "Aceptar — trabajo en servidor",
    "server.accept.hint": "Elige el servidor desde el que trabajarás (donde corre tu asistente IA) y el proveedor a usar.",
    "server.myServer": "Tu servidor de trabajo",
    "server.provider": "Proveedor IA",
    "server.provider.none": "No hay proveedores habilitados en este servidor — igual puedes trabajar por la consola.",
    "server.provider.loading": "Cargando…",
    "server.noServers": "No tienes servidores registrados. Añade uno primero.",
    "server.panel.title": "Servidor del trabajo",
    "server.status.none": "Sin acceso aún",
    "server.status.pending": "Aprovisionando acceso…",
    "server.status.active": "Acceso activo",
    "server.status.revoked": "Acceso revocado",
    "server.status.error": "Falló el aprovisionamiento",
    "server.reprovision": "Reintentar acceso",
    "server.console": "Consola del servidor",
    "server.console.run": "Ejecutar",
    "server.console.placeholder": "Comando a ejecutar en el servidor del cliente…",
    "server.console.empty": "La salida aparecerá aquí.",
    "server.toast.provisioned": "Acceso al servidor listo",
    "server.toast.reprovisioned": "Acceso reaprovisionado",
    "server.error.notReady": "El acceso al servidor aún no está listo",
  },
};

/** Diccionario `jobs` del idioma activo (fuente: getMessages(lang).jobs), con las
 *  claves de la modalidad servidor inyectadas (fallback a inglés). */
export function jobsDict(language: string): JobsDict {
  const base = getMessages(language).jobs as unknown as JobsDict;
  const lang = (language || "es").slice(0, 2);
  return { ...JOBS_SERVER_I18N.en, ...(JOBS_SERVER_I18N[lang] ?? {}), ...base };
}

/** Traduce una clave plana de `jobs.*`; si falta, devuelve la clave (visible en
 *  desarrollo). `vars` rellena `{key}` igual que `formatMessage`. */
export function jt(
  dict: JobsDict,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const raw = dict[key];
  if (raw === undefined) return key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? m : String(v);
  });
}

/** Formatea tokens (escrow) con separadores de miles (espejo de `fmtTokens`). */
export function fmtTokens(n: number): string {
  try {
    return new Intl.NumberFormat().format(Math.round(n || 0));
  } catch {
    return String(n);
  }
}

/** Fecha corta localizada (espejo de `fmtDate`). */
export function fmtJobDate(iso: string | null, language: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(language === "en" ? "en" : language, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Fecha+hora corta (para el canal). */
export function fmtJobDateTime(iso: string | null, language: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(language === "en" ? "en" : language, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Tamaño legible de un adjunto. */
export function fmtBytes(n?: number): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** `input[type=date]` → ISO `YYYY-MM-DD`. */
export function toDateInput(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}
