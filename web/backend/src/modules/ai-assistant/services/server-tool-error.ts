// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/** Expected vault/authorization failures, already safe to show to the user. */
export class ServerAccessError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ServerAccessError";
  }
}

export interface ServerToolErrorContext {
  serverId: string;
  serverName?: string;
  /** The optional peer may have received the operation before SSH fallback. */
  peerAttempted?: boolean;
}

/** Never expose arbitrary SSH/peer errors: they may contain secrets or commands.
 * A lost response does not prove that an operation was not executed. */
export function serverToolError(error: unknown, context: ServerToolErrorContext) {
  const detail = error && typeof error === "object"
    ? error as { message?: unknown; code?: unknown; level?: unknown }
    : {};
  const raw = typeof detail.message === "string" ? detail.message : typeof error === "string" ? error : "";
  const code = typeof detail.code === "string" ? detail.code : "";
  const server = context.serverName ? `«${context.serverName}»` : "remoto";
  let errorCode = "SERVER_OPERATION_FAILED";
  let message = `No pude completar la operación en el servidor ${server}.`;
  let nextStep = "Consulta el diagnóstico del panel antes de volver a intentarlo.";
  let notStarted = false;

  if (error instanceof ServerAccessError) {
    errorCode = error.code;
    message = error.message;
    nextStep = "Revisa la configuración indicada en Ajustes → Servidores.";
    notStarted = true;
  } else if (/host denied.*verification|host key.*(mismatch|verification failed)|fingerprint.*mismatch/i.test(raw)) {
    errorCode = "SERVER_HOST_KEY_CHANGED";
    message = `La identidad del servidor ${server} cambió; detuve la conexión por seguridad.`;
    nextStep = "Verifica el cambio de identidad con el administrador antes de aprobar la nueva huella en Ajustes → Servidores.";
    notStarted = true;
  } else if (detail.level === "client-authentication" || /all configured authentication methods failed|authentication failed|permission denied \(publickey/i.test(raw)) {
    errorCode = "SERVER_AUTH_FAILED";
    message = `El servidor ${server} rechazó las credenciales de conexión guardadas.`;
    nextStep = "Revisa el usuario y la credencial guardada en Ajustes → Servidores. No compartas contraseñas en el chat.";
    notStarted = true;
  } else if (/exec timed out after/i.test(raw)) {
    errorCode = "SERVER_OPERATION_TIMEOUT";
    message = `La operación en el servidor ${server} superó el tiempo de espera; no pude confirmar cómo terminó.`;
    nextStep = "Comprueba el estado de la operación antes de repetirla: pudo haber aplicado cambios.";
  } else if (/^(ENOTFOUND|EAI_AGAIN)$/.test(code) || /getaddrinfo.*(ENOTFOUND|EAI_AGAIN)/i.test(raw)) {
    errorCode = "SERVER_DNS_FAILED";
    message = `No pude encontrar la dirección del servidor ${server}.`;
    nextStep = "Comprueba el nombre configurado en Ajustes → Servidores y su resolución DNS.";
    notStarted = true;
  } else if (code === "ECONNREFUSED" || /connect ECONNREFUSED/i.test(raw)) {
    errorCode = "SERVER_CONNECTION_REFUSED";
    message = `La conexión al servidor ${server} fue rechazada.`;
    nextStep = "Revisa que el servicio SSH esté activo y que el puerto configurado permita la conexión desde el panel.";
    notStarted = true;
  } else if (/^(EHOSTUNREACH|ENETUNREACH)$/.test(code) || /(?:EHOSTUNREACH|ENETUNREACH|no route to host)/i.test(raw)) {
    errorCode = "SERVER_UNREACHABLE";
    message = `No pude llegar al servidor ${server} por la red.`;
    nextStep = "Comprueba su disponibilidad y la conexión de red desde el panel; si persiste, revisa la consola del proveedor.";
    notStarted = true;
  } else if (/timed out while waiting for handshake|connect ETIMEDOUT/i.test(raw)) {
    errorCode = "SERVER_CONNECTION_TIMEOUT";
    message = `El servidor ${server} no respondió a tiempo para establecer la conexión.`;
    nextStep = "Comprueba su disponibilidad y la conexión desde el panel. Este fallo no confirma que esté apagado ni que falten permisos del proyecto.";
    notStarted = true;
  } else if (code === "ETIMEDOUT" || /timed? ?out|tiempo de espera/i.test(raw)) {
    errorCode = "SERVER_RESPONSE_TIMEOUT";
    message = `El servidor ${server} no respondió a tiempo; el resultado de la operación quedó sin confirmar.`;
    nextStep = "Comprueba la conexión y el estado de la operación antes de repetirla.";
  } else if (/^(ECONNRESET|EPIPE|ENOTCONN)$/.test(code) || /connection (?:lost|closed|reset)|not connected|socket hang up|no response from server/i.test(raw)) {
    errorCode = "SERVER_CONNECTION_LOST";
    message = `Se perdió la conexión con el servidor ${server}; no pude confirmar el resultado de la operación.`;
    nextStep = "Recupera la conexión y comprueba el estado de la operación antes de repetirla: pudo haber aplicado cambios.";
  } else if (code === "ENOENT" || /no such file|file not found/i.test(raw)) {
    errorCode = "SERVER_FILE_NOT_FOUND";
    message = `El archivo o directorio solicitado no existe en el servidor ${server}.`;
    nextStep = "Comprueba la ruta solicitada.";
  } else if (/^(EACCES|EPERM)$/.test(code) || /permission denied/i.test(raw)) {
    errorCode = "SERVER_FILE_PERMISSION_DENIED";
    message = `La cuenta utilizada en el servidor ${server} no tiene permiso para esta operación.`;
    nextStep = "Revisa los permisos de esa cuenta sobre la ruta solicitada.";
  }

  if (notStarted && context.peerAttempted) {
    nextStep += " El intento anterior pudo haberse ejecutado; comprueba su estado antes de repetirlo.";
  }

  return {
    code: errorCode,
    serverId: context.serverId,
    ...(context.serverName ? { serverName: context.serverName } : {}),
    message,
    operationStatus: notStarted && !context.peerAttempted ? "not_started" : "unconfirmed",
    nextStep,
  };
}
