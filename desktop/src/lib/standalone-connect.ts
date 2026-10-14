/**
 * standalone-connect (desktop) — helper compartido para ARMAR y REGISTRAR el
 * `DirectTarget` de un servidor LUXIPANEL standalone (conexión DIRECTA, sin
 * LP-LS). Extraído de `StandaloneManagerModal` para que tanto el gestor como la
 * pantalla nativa de módulos (`StandaloneServerScreen`) usen exactamente la
 * misma lógica de sesión/relogin, y el target sobreviva la transición
 * modal → pantalla nativa (cada superficie lo re-asegura idempotentemente).
 *
 * Registra bajo `server.id` (la clave del registro directo de `serverApi`), de
 * modo que `callServerApi/download/upload` despachen DIRECTO al box para ese id.
 */
import { ensureTarget } from "../api/serverApi";
import { reloginStandalone, type DirectSession } from "../api/directAuth";
import {
  getStandalonePassword,
  getStandaloneSession,
  setStandaloneSession,
  type StandaloneServer,
} from "./standalone-servers";

/**
 * Construye + registra el `DirectTarget` de `server` bajo su `id`. Reusa la
 * sesión persistida si sigue vigente; si venció/falta y hay contraseña guardada
 * (opt-in) hace un relogin silencioso. Devuelve `true` si el target quedó listo
 * para operar (la UI puede hablar directo), `false` si requiere reconexión
 * manual (alta pre-rellenada con credenciales + 2FA).
 */
export async function registerStandaloneTarget(server: StandaloneServer): Promise<boolean> {
  const getPassword = () =>
    server.savePassword ? getStandalonePassword(server.id) : Promise.resolve<string | null>(null);
  const onSession = (s: DirectSession) => void setStandaloneSession(server.id, s);

  const session = await getStandaloneSession(server.id);
  const stale = !!session && session.exp !== 0 && session.exp < Date.now() + 60_000;
  if (session && session.jwt && !stale) {
    ensureTarget(server.id, { baseUrl: server.baseUrl, username: server.username, session, getPassword, onSession });
    return true;
  }

  // Sesión ausente/vencida → relogin silencioso si hay contraseña guardada.
  const pw = await getPassword();
  if (pw) {
    const fresh = await reloginStandalone(server.baseUrl, server.username, pw);
    if (fresh) {
      await setStandaloneSession(server.id, fresh);
      ensureTarget(server.id, { baseUrl: server.baseUrl, username: server.username, session: fresh, getPassword, onSession });
      return true;
    }
  }
  return false;
}
