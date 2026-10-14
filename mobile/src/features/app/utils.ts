import { Linking } from "react-native";
import type { Panel } from "../../types/models";
import type { ThemeMode } from "./types";
import { getMessages } from "../../i18n";

export function getWindowTitle(view: string, sshUrl: string): string {
  if (view === "ssh" && sshUrl) {
    try {
      const hostname = new URL(sshUrl).hostname;
      return hostname ? `LUXIPANEL - ${hostname}` : "LUXIPANEL";
    } catch {
      return "LUXIPANEL";
    }
  }
  return "LUXIPANEL";
}

export function getPageGradient(theme: ThemeMode): readonly [string, string] {
  if (theme === "dark") {
    return ["#0d1117", "#11161c"] as const;
  }
  return ["#f6f9ff", "#eef4ff"] as const;
}

export async function openExternal(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    /* swallow — caller usually has fallback alert */
  }
}

export function maskIp(ip: string | null): string {
  if (!ip) return "-";
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.xxx.xxx.${parts[3]}`;
}

/**
 * Valor canónico de acceso al LUXIPANEL del panel: SOLO `customDomain`
 * (URL COMPLETA configurada por el usuario; esquema/puerto opcionales, puede
 * ser IP con puerto). Los subdominios managed *.luxipanel.com están RETIRADOS
 * (`managedDomain` llega null del backend). `"-"` si no hay URL configurada.
 * Para MOSTRAR el host al usuario usa `panelHostLabel`.
 */
export function getPanelHost(panel: Panel): string {
  return (panel.customDomain ?? "").trim() || "-";
}

/**
 * Etiqueta de host para MOSTRAR: si el valor es una URL completa
 * ("https://panel.midominio.com:8443/ruta") devuelve solo el host con su
 * puerto no estándar ("panel.midominio.com:8443"). Acepta hosts pelados
 * (default https al parsear). Valores vacíos/"-"/no parseables se devuelven
 * tal cual.
 */
export function panelHostLabel(value: string): string {
  const raw = (value ?? "").trim();
  if (!raw || raw === "-") return raw || "-";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).host || raw;
  } catch {
    return raw;
  }
}

/**
 * Resuelve el logo de branding del panel a una URL ABSOLUTA usable por `<Image>`.
 *
 * El backend (`brandingLogoUrl`) reenvía el valor tal cual lo guardó LUXIPANEL,
 * que puede ser:
 *  - una ruta **relativa** al host del propio panel (`/branding/logo.png`,
 *    `/panel/logo_300.webp`, `/favicon.ico`), o
 *  - una URL **absoluta** (`https://cdn…/logo.png`).
 *
 * En web un `<img src="/ruta">` resuelve contra el origen, pero React Native NO
 * resuelve `uri` relativos → una ruta relativa nunca cargaba en el carousel y
 * caía al icono de respaldo. La resolvemos contra la URL de acceso del panel
 * (`customDomain`, quien sirve esos assets estáticos públicos).
 *
 * `host` es el valor de `getPanelHost(panel)` (URL completa/host pelado o `"-"`).
 */
export function resolvePanelLogoUrl(value: string | null | undefined, host: string): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  // Ya absoluta (http/https) o data-url: usar tal cual.
  if (/^(https?:|data:)/i.test(raw)) return raw;
  // Sin host no hay forma de resolver una ruta relativa.
  if (!host || host === "-") return null;
  // `host` puede ser una URL completa (con esquema/puerto): resolver la ruta
  // relativa contra su ORIGEN preservando esquema y puerto.
  const base = /^https?:\/\//i.test(host) ? host : `https://${host}`;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  try {
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

/** Etiqueta corta para tarjetas a partir del valor de `getPanelHost`: host de
 *  la URL de acceso; si es un dominio, solo su primer label
 *  (p.ej. "https://panel.midominio.com" → "panel"); si es una IP (con o sin
 *  puerto) se muestra completa. Para valores vacíos/"-" devuelve el valor tal
 *  cual. */
export function getPanelSubdomainLabel(host: string): string {
  if (!host || host === "-") return host;
  const label = panelHostLabel(host);
  // IP v4 (con o sin puerto): mostrarla completa, no su primer octeto.
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(label)) return label;
  const first = label.split(":")[0]?.split(".")[0]?.trim();
  return first || label;
}

/**
 * Nombre corto del panel para mostrar al usuario (p. ej. en "Conexión
 * interrumpida"): nombre de licencia o clave si existen; en su defecto la
 * etiqueta corta del host de su URL de acceso, nunca la URL completa
 * (`https://panel.midominio.com` → `panel`).
 */
export function getPanelDisplayName(panel: Panel): string {
  if (panel.licenseName) return panel.licenseName;
  if (panel.licenseKey) return panel.licenseKey;
  return getPanelSubdomainLabel(getPanelHost(panel));
}

export function getLicenseState(panel: Panel): string {
  if (panel.licenseState) return panel.licenseState;
  // Modelo sin MB ni licencias por slot: el panel es un registro de conexión del
  // directorio y NO requiere licenseKey (el acceso es directo con tokens +
  // suscripción app-unlock). Solo estados de servidor duros (suspended/revoked/
  // expired…) lo marcan inactivo; active/grace_period se tratan como activo.
  if (panel.status && panel.status !== "active" && panel.status !== "grace_period") {
    return "license_inactive";
  }
  return "license_active";
}

export function getSshState(panel: Panel): string {
  if (panel.sshState) return panel.sshState;
  return panel.sshSaveCredentials ? "ssh_active" : "ssh_inactive";
}

/**
 * Mapa nombre-de-proveedor (= categoría / primera línea de notas asignada al
 * importar) → label para la columna/tarjeta "Proveedor". Debe ir en sync con
 * `metadata.name` de cada adaptador del backend (`providers/*.adapter.ts`) y
 * con `PROVIDER_BY_NAME` del frontend (`dashboard-servers.ts`).
 */
const PROVIDER_BY_NAME: Record<string, string> = {
  "google cloud": "Google Cloud",
  "digitalocean": "DigitalOcean",
  "vultr": "Vultr",
  "linode (akamai)": "Linode (Akamai)",
  "hetzner cloud": "Hetzner Cloud",
  "hostinger": "Hostinger",
  "aws ec2": "AWS EC2",
  "microsoft azure": "Microsoft Azure",
};

/**
 * Deduce el proveedor de un panel por su categoría o el prefijo de sus notas
 * ("<Nombre> VPS"). Sin coincidencia => alta directa por SSH. El label de
 * "SSH directo" se localiza (es/en); las marcas comerciales no se traducen.
 */
export function detectPanelProvider(panel: Panel, language?: string): { provider: string; providerLabel: string } {
  const cat = (panel.category ?? "").trim().toLowerCase();
  const notesFirst = (panel.notes ?? "").split("\n")[0]?.replace(/\s+VPS$/i, "").trim().toLowerCase() ?? "";
  const label = PROVIDER_BY_NAME[cat] ?? PROVIDER_BY_NAME[notesFirst] ?? null;
  if (label) return { provider: "provider_cloud", providerLabel: label };
  const directLabel = getMessages(language).panelTable.directSsh;
  return { provider: "provider_direct", providerLabel: directLabel };
}
