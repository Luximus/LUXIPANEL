// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Origen del canal MCP per-run (`/api/ai/mcp/cross`) que se le entrega al agente.
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * El CLI del agente NO corre en el host del panel: se lanza EN EL TARGET
 * (`cli-bridge.provider` → `executor.exec`), y su config MCP se escribe también
 * en el target (`/tmp/<jobId>-mcp.json`). Por tanto la URL del canal tiene que
 * ser alcanzable DESDE EL TARGET, no desde el panel.
 *
 * Lo que se hacía antes era derivarla del header `Host` de la petición DEL
 * NAVEGADOR (`panelOriginFromRequest`) — o sea, responder "¿qué dirección le doy
 * al agente?" con "la misma por la que me habla el navegador". Para un target
 * remoto de verdad eso es correcto. Pero cuando el target ES el propio host del
 * panel (instalación auto-gestionada), el agente acababa llamando al dominio
 * público: salía a Internet, pasaba por Cloudflare y nginx, y volvía a
 * `127.0.0.1:8080` de la MISMA máquina. Un rodeo absurdo, y encima frágil: el
 * transporte MCP es un POST por llamada SIN reintentos, así que un solo 521/502
 * de ese camino marcaba el servidor MCP como caído para el run ENTERO — el
 * agente se quedaba sin `agents.send_message` y acababa escribiendo ficheros de
 * handoff en vez de hablar con sus compañeros.
 *
 * LA DETECCIÓN
 * ------------
 * "¿Está el target en la misma máquina que el backend?" NO se contesta
 * comparando IPs ni hostnames: el SSH puede ir a `127.0.0.1`, a un dominio
 * público que resuelve aquí, a través de NAT… Cualquier heurística de
 * direcciones falla en ambos sentidos (falsos positivos = mandar al agente a un
 * `127.0.0.1:8080` que NO es el panel).
 *
 * En su lugar se PRUEBA, con una sonda auto-identificada: se le pide al target
 * que haga `curl` a SU PROPIO `127.0.0.1:<PORT>/api/health` y se comprueba si lo
 * que contesta lleva el `INSTANCE_ID` de ESTE proceso. Si coincide, no hay duda
 * posible: el backend está en esa misma máquina. Si no coincide (o no responde),
 * se usa el origen público, exactamente como antes. Es seguro por construcción —
 * ante cualquier duda, degrada al comportamiento actual.
 *
 * El veredicto se cachea por target (una sonda por sesión, sobre el SSH que ya
 * está abierto), no por run.
 */

import { env } from "../../../config/env.js";
import { INSTANCE_ID } from "../../../config/instance.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { HEALTH_PATH } from "../../../shared/constants.js";

const log = createModuleLogger("assistant-cross-origin");

/** Un veredicto positivo no caduca en la práctica (una máquina no deja de ser
 *  ella misma), pero se le pone TTL para que un target reconfigurado o una
 *  sonda que falló por un hipo de red se reevalúen solos. */
const PROBE_TTL_MS = 5 * 60_000;
const CROSS_CHANNEL_PROBE_TIMEOUT_MS = 4_000;

interface Verdict {
  colocated: boolean;
  at: number;
}

const verdicts = new Map<string, Verdict>();

/** Origen interno que se le da al agente co-localizado. */
function loopbackOrigin(): string {
  const configured = env.ASSISTANT_MCP_LOOPBACK_ORIGIN.trim();
  return configured || `http://127.0.0.1:${env.PORT}`;
}

/**
 * ¿El proceso que corre en `executor` alcanza a ESTE backend por su loopback?
 *
 * Se le pide al target que consulte su propio `/api/health` y se busca nuestro
 * `INSTANCE_ID` en la respuesta. Comparar la cadena basta: es un UUID de este
 * arranque, no colisiona con nada.
 */
async function probeColocation(executor: Executor): Promise<boolean> {
  const url = `${loopbackOrigin()}${HEALTH_PATH}`;
  try {
    // `-sf` → silencioso y sin cuerpo en error; `-m 2` → no colgarse si algo
    // escucha en el puerto pero no contesta. Si no hay curl en el target, el
    // exit code != 0 y el veredicto es "no co-localizado" (degradación segura).
    const r = await executor.exec(`curl -sf -m 2 ${JSON.stringify(url)}`, {
      timeoutMs: CROSS_CHANNEL_PROBE_TIMEOUT_MS,
    });
    return r.stdout.includes(INSTANCE_ID);
  } catch {
    return false;
  }
}

/**
 * Resuelve el origen del canal cross para un run que se ejecutará en `executor`.
 *
 * @param executor    executor del target donde se lanzará el CLI del agente.
 * @param publicOrigin origen público del panel (derivado de la request del
 *                     navegador) — el fallback y el valor correcto para targets
 *                     realmente remotos.
 */
export async function resolveCrossChannelOrigin(
  executor: Executor | null | undefined,
  publicOrigin: string,
): Promise<string> {
  if (!executor || !env.ASSISTANT_MCP_LOOPBACK_ENABLED) return publicOrigin;

  // El executor local ES el host del panel por definición: no hace falta sondear.
  if (executor.target.id === "local") return loopbackOrigin();

  const key = executor.target.id;
  const cached = verdicts.get(key);
  if (cached && Date.now() - cached.at < PROBE_TTL_MS) {
    return cached.colocated ? loopbackOrigin() : publicOrigin;
  }

  const colocated = await probeColocation(executor);
  verdicts.set(key, { colocated, at: Date.now() });
  if (colocated) {
    log.info(
      { targetId: key, origin: loopbackOrigin() },
      "cross-channel: target co-located with the panel — MCP channel goes over loopback (no CDN/nginx hop)",
    );
  } else {
    log.debug(
      { targetId: key, origin: publicOrigin },
      "cross-channel: target is remote — MCP channel uses the public origin",
    );
  }
  return colocated ? loopbackOrigin() : publicOrigin;
}

/** @internal — solo para tests. */
export const __crossChannelInternals = { verdicts, loopbackOrigin, probeColocation };
