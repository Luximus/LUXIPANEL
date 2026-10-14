// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/**
 * Ventana ACOTADA del historial saliente del chat (paridad con
 * `buildAgentMessages` del ChatPane de LUXIPANEL).
 *
 * El gateway de LP (`POST /portal/ssh/assistant`) valida `messages` con zod:
 * enviar el hilo COMPLETO (como hacía `send`) devolvía 400 "Parámetros
 * inválidos" en hilos largos — o con un turno vacío en el historial (p. ej. el
 * turno interrumpido que deja un stream caído) — y el mensaje del usuario
 * nunca llegaba al agente/asistente. Aunque LP ya monta un parser dedicado de
 * 30mb para estas rutas (adjuntos/voz), la ventana sigue aplicando: el body
 * debe dejar sitio a los adjuntos y el contexto redundante no aporta.
 *
 * Recortar aquí NO pierde nada: el run es desacoplado y el hilo entero vive
 * persistido en el servidor; este array solo re-siembra contexto del turno.
 */

export type OutgoingMessage = { role: "user" | "assistant"; content: string };

/** Límites del gateway LP (esquema zod de `/portal/ssh/assistant`): no subirlos
 *  sin tocar también el backend (`servers.controller.ts`). */
export const MAX_SEND_MESSAGES = 40;
export const MAX_MSG_CONTENT = 8000;
/** Presupuesto total de caracteres del array: contexto de re-siembra de sobra
 *  y deja el grueso del body de 30mb para los adjuntos base64 del turno. */
export const MAX_TOTAL_CONTENT = 100_000;

function clampContent(s: string): string {
  if (s.length <= MAX_MSG_CONTENT) return s;
  return `${s.slice(0, MAX_MSG_CONTENT - 24)}\n… [recortado]`;
}

/**
 * Construye el `messages` válido para el gateway: descarta turnos previos
 * vacíos, recorta cada contenido, ventana a los últimos turnos, respeta el
 * presupuesto total soltando los más antiguos y SIEMPRE apenda el mensaje
 * nuevo del usuario al final.
 */
export function buildOutgoingHistory(prior: OutgoingMessage[], finalUserContent: string): OutgoingMessage[] {
  const trimmed = prior
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .filter((m) => m.content.length > 0)
    .map((m) => ({ role: m.role, content: clampContent(m.content) }));
  const final: OutgoingMessage = { role: "user", content: clampContent(finalUserContent) };
  let windowed = trimmed.slice(-(MAX_SEND_MESSAGES - 1));
  let total = windowed.reduce((n, m) => n + m.content.length, 0) + final.content.length;
  while (windowed.length > 0 && total > MAX_TOTAL_CONTENT) {
    total -= windowed[0]!.content.length;
    windowed = windowed.slice(1);
  }
  return [...windowed, final];
}
