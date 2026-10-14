/**
 * Resolución CONFIABLE del host público del panel para una sesión.
 *
 * Problema que cierra: `x-forwarded-host` llega tal cual desde el cliente
 * (nginx de tenants no lo fija y el proxy Astro solo borra `host`), así que
 * NUNCA puede usarse como identidad del panel ante LP (las rutas de servicio
 * `/panel-api/service/*` resuelven host→panel→customer). Un header arbitrario
 * permitiría operar recursos de OTRO customer (BOLA).
 *
 * Fuentes confiables, en orden:
 *  1. `user.targetHost` — claim `thost` del SSO de LP (JWT firmado por LP).
 *  2. Sesiones direct-SSH (`targetId = "panel:<subdominio>"`): el host de la
 *     request SOLO si su primer label coincide con el subdominio contra el que
 *     se validaron las credenciales en /login (lookup LP + handshake SSH van
 *     por ese subdominio). Un token reproducido contra el host de otro tenant
 *     no coincide y se descarta.
 *
 * Sin fuente confiable → undefined (el caller decide fail-closed).
 */

import type { SessionUser } from "../types/index.js";
import { firstForwardedValue, normalizeHost } from "./host.js";

const DIRECT_TARGET_PREFIX = "panel:";

/** Primer label de un host (sin puerto), o null si no parece un FQDN. */
function firstLabel(rawHost: string): { label: string; host: string } | null {
  const host = normalizeHost(firstForwardedValue(rawHost));
  if (!host || !/^[a-z0-9.-]+$/.test(host)) return null;
  const labels = host.split(".");
  if (labels.length < 3 || labels.some((l) => !l)) return null;
  return { label: labels[0]!, host };
}

/**
 * Host público confiable del panel para la sesión `user`, o undefined.
 * `headerHost` = `x-forwarded-host`/`host` crudo de la request (solo se usa,
 * validado, para sesiones direct-SSH). Función pura: nunca lanza.
 */
export function resolveSessionPanelHost(
  user: Pick<SessionUser, "targetHost" | "targetId" | "targetName"> | undefined | null,
  headerHost: string | undefined,
): string | undefined {
  if (!user) return undefined;

  const fromToken = (user.targetHost ?? "").trim().toLowerCase();
  if (fromToken) return fromToken;

  // Direct-SSH: targetId = "panel:<accessSubdomain>" (auth.service.login).
  const targetId = String(user.targetId ?? "");
  if (!targetId.startsWith(DIRECT_TARGET_PREFIX)) return undefined;
  const subdomain = targetId.slice(DIRECT_TARGET_PREFIX.length).trim().toLowerCase();
  if (!subdomain || subdomain === "local") return undefined;

  const parsed = firstLabel(String(headerHost ?? ""));
  if (!parsed || parsed.label !== subdomain) return undefined;
  return parsed.host;
}

/**
 * Host público confiable del panel YA RESUELTO en la sesión, leído de
 * `res.locals.user.targetHost` (lo fija `enrichTargetHost` en
 * `session.middleware` con `resolveSessionPanelHost`: claim `thost` del SSO de
 * LP, o host validado contra el subdominio del login direct). NUNCA usa
 * `x-forwarded-host`/`host` crudos — esos llegan tal cual del cliente y
 * permitirían operar recursos del customer de OTRO panel (BOLA). Fail-closed:
 * sin host de sesión devuelve undefined y el caller decide.
 */
export function sessionPanelHost(
  res: { locals?: { user?: Pick<SessionUser, "targetHost"> | undefined } },
): string | undefined {
  const host = (res.locals?.user?.targetHost ?? "").trim();
  return host || undefined;
}
