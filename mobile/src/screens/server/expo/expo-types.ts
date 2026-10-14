/**
 * expo-types — tipos, constantes y helpers PUROS del módulo Expo (sin React ni
 * RN), extraídos de ExpoScreen para compartirlos con sus subcomponentes
 * (diálogos) sin duplicarlos.
 */
import type { PillKind } from "../../../components/server/badges";

export const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE", "DIRECT_AUTH_REQUIRED"];

/** Formas defensivas: el panel puede devolver claves alternativas. */
export type ExpoConfig = { tokenSet?: boolean; tokenPreview?: string | null; hasToken?: boolean; preview?: string | null };
export type ExpoProject = {
  path: string;
  name?: string | null;
  slug?: string | null;
  projectId?: string | null;
  androidPackage?: string | null;
  iosBundleIdentifier?: string | null;
};
export type ExpoBuild = {
  id: string;
  platform?: string | null;
  status?: string | null;
  profile?: string | null;
  createdAt?: string | null;
  url?: string | null;
  artifactUrl?: string | null;
  appVersion?: string | null;
};
/** Variable de entorno EAS (forma defensiva: el panel puede omitir campos). */
export type ExpoEnvVar = {
  id?: string | null;
  name: string;
  value?: string | null;
  scope?: string | null;
  visibility?: string | null;
  environments?: string[];
};

/**
 * Sesión del dev-client (Metro tunnel). Forma defensiva: el panel puede omitir
 * campos. `url` = enlace de instalación del último dev build; `artifactUrl` = la
 * descarga directa (APK/IPA); `raw` = diagnóstico legible.
 */
export type DevClientSession = {
  url?: string | null;
  artifactUrl?: string | null;
  buildId?: string | null;
  platform?: string | null;
  profile?: string | null;
  status?: string | null;
  qr?: string | null;
  raw?: string | null;
};

/**
 * Estado de credenciales de tienda (POST /api/expo/store-credentials). Tres
 * fuentes independientes por plataforma (forma defensiva: el panel puede omitir
 * campos): `cloudKeys` = claves que EAS mantiene en la cuenta; `projectFile` =
 * archivo referenciado por el perfil submit de eas.json; `localFile` = un
 * archivo que el panel dejó preparado en el servidor.
 */
export type StoreGoogleKey = { clientEmail?: string | null; projectIdentifier?: string | null; updatedAt?: string | null };
export type StoreAppleKey = { keyIdentifier?: string | null; issuerIdentifier?: string | null; name?: string | null; updatedAt?: string | null };
export type StoreGoogleProjectFile = { path?: string | null; clientEmail?: string | null };
export type StoreAppleProjectFile = { path?: string | null; keyId?: string | null; issuerId?: string | null };
export type ExpoStoreCredentials = {
  google?: { cloudKeys?: StoreGoogleKey[]; projectFile?: StoreGoogleProjectFile | null; localFile?: boolean };
  apple?: { cloudKeys?: StoreAppleKey[]; projectFile?: StoreAppleProjectFile | null; localFile?: boolean };
};
/** Salida cruda de un comando EAS (device:create / webhook:create). */
export type ExpoCliResult = { ok?: boolean; url?: string | null; stdout?: string | null; stderr?: string | null; exitCode?: number | null };

export const VISIBILITIES = ["plaintext", "sensitive", "secret"] as const;
export const ENV_TARGETS = ["production", "preview", "development"] as const;

/** Las variables sensibles/secretas nunca exponen su valor. */
export function envDisplayValue(v: ExpoEnvVar): string {
  const vis = (v.visibility ?? "").toLowerCase();
  if (vis === "secret" || vis === "sensitive") return "••••••";
  return v.value ?? "—";
}

export function visibilityKind(vis: string | null | undefined): PillKind {
  const v = (vis ?? "").toLowerCase();
  if (v === "secret") return "danger";
  if (v === "sensitive") return "amber";
  return "sky"; // plaintext / public
}

export function hasToken(c: ExpoConfig): boolean {
  return c.tokenSet === true || c.hasToken === true;
}
export function tokenPreview(c: ExpoConfig): string {
  return c.tokenPreview ?? c.preview ?? "";
}

export function statusKind(status: string | null | undefined): PillKind {
  const s = (status ?? "").toLowerCase();
  if (s === "finished") return "ok";
  if (s === "errored" || s === "error" || s === "failed") return "danger";
  if (s === "canceled" || s === "cancelled") return "neutral";
  if (["new", "in-queue", "in-progress", "pending", "building", "queued"].includes(s)) return "amber";
  return "sky";
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" } as Intl.DateTimeFormatOptions);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}
