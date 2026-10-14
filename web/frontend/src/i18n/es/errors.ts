const errors = {
  "networkError": {
    "serverError": "El servidor devolvió un error {status} (la operación pudo exceder el tiempo límite).",
    "invalidResponse": "Respuesta no válida del servidor.",
    "connectionFailed": "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.",
    "targetScopeChanged": "Cambió el servidor seleccionado; recarga la vista.",
    "bridgeSessionRequired": "Selecciona o reconecta un servidor para continuar."
  },
  "error400": {
    "code": "400",
    "title": "Solicitud inválida",
    "description": "La solicitud enviada contiene parámetros inválidos. Verifica los datos e inténtalo de nuevo."
  },
  "error401": {
    "code": "401",
    "title": "No autorizado",
    "description": "Necesitas iniciar sesión para acceder a este recurso. Inicia sesión."
  },
  "error403": {
    "code": "403",
    "title": "Acceso prohibido",
    "description": "No tienes permisos para acceder a este recurso."
  },
  "error404": {
    "code": "404",
    "title": "Página no encontrada",
    "description": "La ruta que buscas no existe o fue movida. Verifica la URL o regresa al inicio."
  },
  "error500": {
    "code": "500",
    "title": "Error interno del servidor",
    "description": "Algo salió mal en nuestro servidor. Estamos trabajando para solucionarlo. Inténtalo más tarde."
  },
  "error503": {
    "code": "503",
    "title": "Servicio no disponible",
    "description": "El servidor está en mantenimiento o sobrecargado. Inténtalo más tarde."
  },
  "home": "Ir al inicio",
  "back": "Volver atrás",
  "backToServers": "Volver a servidores"
} as const;

export default errors;
