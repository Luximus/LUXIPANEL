// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Identidad de ESTE proceso backend.
 *
 * Un nonce aleatorio por arranque, publicado en `GET /api/health`. Sirve para
 * una sola cosa, pero crítica: permitir que el panel compruebe, de forma
 * DETERMINISTA, si un servidor target está co-localizado con él — es decir, si
 * el `127.0.0.1:<PORT>` DEL TARGET es exactamente este backend.
 *
 * Por qué un nonce y no comparar IPs/hostnames: el target puede llegar por SSH
 * a `127.0.0.1`, a un dominio público que resuelve a la misma máquina, tras un
 * NAT… Comparar direcciones es una heurística que falla en los dos sentidos.
 * En cambio, si el target hace `curl http://127.0.0.1:8080/api/health` y nos
 * devuelve NUESTRO nonce, la co-localización queda probada sin ambigüedad: es
 * este proceso, no "algo que también escucha en el 8080".
 *
 * Es un identificador de instancia, NO un secreto: solo prueba identidad de
 * proceso ante quien ya puede alcanzar el health check.
 */

import { randomUUID } from "node:crypto";

/** Nonce de este proceso. Cambia en cada arranque (a propósito: un restart
 *  invalida cualquier veredicto de co-localización cacheado por un tercero). */
export const INSTANCE_ID = randomUUID();
