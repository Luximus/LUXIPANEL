const webhooks = {
  "pageTitle": "Webhooks y Clave APIs",
  "tabs": {
    "webhooks": "Salientes",
    "apiKeys": "Clave APIs",
    "discovered": "Detectados"
  },
  "categories": {
    "receiveData": "Recibir datos",
    "mailhook": "Mailhook",
    "response": "Respuesta a webhook",
    "soon": "Próximamente",
    "soonDesc": "La configuración y el escaneo de esta categoría se definirán en una fase posterior."
  },
  "gateway": {
    "description": "Endpoints que el panel aloja para recibir datos entrantes (estilo Make.com). Autenticación por clave API (x-make-apikey), restricción por IP y validación de estructura de datos.",
    "btnNew": "Nuevo webhook",
    "detectedTitle": "Receptores detectados en el servidor",
    "urlReveal": "URL del webhook — envía las peticiones aquí",
    "cols": {
      "name": "Nombre",
      "auth": "Auth",
      "recibidos": "Recibidos",
      "ultima": "Última",
      "estado": "Estado",
      "estadoActive": "Activo",
      "estadoPaused": "Pausado"
    },
    "dialog": {
      "titleNew": "Crear un webhook",
      "titleEdit": "Editar webhook",
      "name": "Nombre del webhook",
      "namePlaceholder": "Mi webhook gateway",
      "nameHint": "Debe tener entre 1 y 128 caracteres.",
      "apiAuth": "Autenticación por clave API",
      "apiAuthHint": "Envía la clave API en la cabecera x-make-apikey. Añade una o más; si alguna coincide, se concede el acceso.",
      "apiKeyName": "Nombre",
      "apiKeyValue": "Valor de la clave API",
      "apiKeyKeep": "(guardada — deja vacío para conservar)",
      "addApiKey": "Añadir clave API",
      "ipTitle": "Restricciones de IP",
      "ipHint": "Lista de IPs separadas por coma. Puedes usar notación CIDR. Vacío = sin comprobación.",
      "dataStructure": "Estructura de datos",
      "dataStructureHint": "Validación de los datos entrantes. Vacío = se aceptan sin validar.",
      "dsValidate": "Validar estructura de datos",
      "dsStrict": "Estricto (rechazar campos no especificados)",
      "dsFieldName": "Nombre",
      "dsFieldDesc": "Descripción",
      "dsFieldType": "Tipo",
      "dsFieldDefault": "Valor por defecto",
      "dsFieldRequired": "Requerido",
      "dsFieldMultiline": "Multilínea",
      "addItem": "Añadir campo",
      "getHeaders": "Obtener cabeceras de la petición",
      "getHeadersHint": "Las cabeceras se añadirán al cuerpo.",
      "getMethod": "Obtener método HTTP",
      "getMethodHint": "El método (verbo) se añadirá al cuerpo.",
      "jsonPassthrough": "Guardar JSON como texto",
      "jsonPassthroughHint": "Si se activa, el contenido JSON se guarda como texto.",
      "enabled": "Webhook activo",
      "advanced": "Ajustes avanzados",
      "btnCancel": "Cancelar",
      "btnSave": "Guardar"
    },
    "payloads": {
      "title": "Payloads recibidos",
      "empty": "Aún no se ha recibido ningún payload.",
      "btnClose": "Cerrar"
    },
    "confirm": {
      "deleteTitle": "Eliminar webhook",
      "deleteBody": "¿Eliminar el webhook \"{name}\"? Se perderán los payloads almacenados.",
      "deleteBtn": "Sí, eliminar"
    },
    "toasts": {
      "created": "Webhook creado",
      "updated": "Webhook actualizado",
      "deleted": "Webhook eliminado",
      "copied": "URL copiada",
      "error": "Error al guardar"
    }
  },
  "webhooksPanel": {
    "description": "Notificaciones HTTP salientes con firma HMAC",
    "btnNew": "Nuevo webhook"
  },
  "apiKeysPanel": {
    "description": "Acceso programático con tokens permanentes",
    "btnNew": "Nueva clave API"
  },
  "newKeyReveal": {
    "message": "Clave API creada — cópiala ahora, no se mostrará de nuevo",
    "btnCopy": "Copiar"
  },
  "webhookDialog": {
    "placeholderUrl": "https://ejemplo.com/webhook",
    "title": "Nuevo webhook",
    "labelUrl": "URL del endpoint",
    "labelEvents": "Eventos a escuchar",
    "labelEnabled": "Webhook activo",
    "btnCancel": "Cancelar",
    "btnSave": "Guardar"
  },
  "apiKeyDialog": {
    "placeholderName": "Mi integración",
    "title": "Nueva Clave API",
    "labelName": "Nombre descriptivo",
    "labelExpires": "Expira (opcional)",
    "btnCancel": "Cancelar",
    "btnCreate": "Crear key"
  },
  "discovered": {
    "description": "Webhooks detectados en el servidor (Git, nginx, cron, systemd, configuraciones y proyectos)",
    "btnRescan": "Reescanear",
    "scanning": "Escaneando servidor…",
    "empty": "No se detectaron webhooks en el servidor",
    "cols": {
      "source": "Origen",
      "name": "Nombre",
      "target": "Destino",
      "location": "Ubicación",
      "estado": "Estado"
    },
    "filters": {
      "searchTarget": "Buscar destino…",
      "source": "Origen"
    },
    "sources": {
      "sidecar": "Panel",
      "git-hook": "Git hook",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "Config",
      "project": "Proyecto"
    },
    "status": {
      "enabled": "Activo",
      "disabled": "Inactivo",
      "unknown": "—"
    },
    "actions": {
      "detail": "Ver detalle",
      "delete": "Eliminar"
    },
    "detail": {
      "title": "Detalle del webhook detectado",
      "source": "Origen",
      "target": "Destino",
      "location": "Ubicación",
      "info": "Información",
      "raw": "Configuración",
      "managedNote": "Este webhook lo gestiona el panel",
      "readonlyNote": "Solo lectura: gestiónalo desde su módulo correspondiente",
      "btnClose": "Cerrar"
    },
    "confirm": {
      "deleteTitle": "Eliminar webhook detectado",
      "deleteBody": "¿Eliminar \"{name}\"? Esto modifica el archivo en el servidor.",
      "deleteBtn": "Sí, eliminar"
    },
    "toasts": {
      "deleted": "Eliminado",
      "errorDeleting": "No se pudo eliminar",
      "scanComplete": "Escaneo completado: {count}",
      "notManageable": "Gestiónalo desde su módulo correspondiente"
    }
  },
  "labels": {
    "statusFailing": "Fallando",
    "statusActive": "Activo",
    "statusPaused": "Pausado",
    "newWebhookTitle": "Nuevo webhook",
    "noExpiry": "Sin expiración"
  },
  "confirm": {
    "rotateSecretBody": "¿Rotar el secret de este webhook? Deberás actualizar el receptor.",
    "rotateSecretTitle": "Rotar secret",
    "rotateSecretBtn": "Sí, rotar",
    "deleteWebhookBody": "¿Eliminar este webhook?",
    "deleteWebhookTitle": "Eliminar webhook",
    "revokeKeyBody": "¿Revocar la clave API \"{name}\"?",
    "revokeKeyTitle": "Revocar clave API",
    "revokeKeyBtn": "Sí, revocar"
  },
  "toasts": {
    "secretRotated": "Secret rotado",
    "errorRotating": "Error al rotar",
    "webhookDeleted": "Webhook eliminado",
    "errorDeleting": "Error al eliminar",
    "webhookUpdated": "Webhook actualizado",
    "webhookCreated": "Webhook creado",
    "errorSaving": "Error al guardar",
    "keyRevoked": "Key revocada",
    "errorRevoking": "Error al revocar",
    "copiedToClipboard": "Copiado al portapapeles",
    "errorCreatingKey": "Error al crear la key"
  },
  "table": {
    "gateway": {
      "columns": {
        "name": "Nombre",
        "auth": "Auth",
        "recibidos": "Recibidos",
        "ultima": "Última",
        "estado": "Estado"
      },
      "filters": {
        "searchName": "Buscar nombre…",
        "estado": "Estado"
      },
      "rowActions": {
        "copy": "Copiar URL",
        "payloads": "Ver payloads",
        "edit": "Editar",
        "delete": "Eliminar"
      },
      "options": {
        "statusActive": "Activo",
        "statusPaused": "Pausado"
      }
    },
    "webhooks": {
      "columns": {
        "url": "URL",
        "eventos": "Eventos",
        "estado": "Estado"
      },
      "filters": {
        "searchUrl": "Buscar URL…",
        "estado": "Estado"
      },
      "rowActions": {
        "regenerate": "Rotar secret",
        "delete": "Eliminar"
      },
      "options": {
        "statusActive": "Activo",
        "statusPaused": "Pausado",
        "statusFailing": "Fallando"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "Nombre",
        "prefix": "Prefijo",
        "creada": "Creada",
        "expira": "Expira"
      },
      "filters": {
        "searchName": "Buscar nombre…"
      },
      "rowActions": {
        "revoke": "Revocar"
      }
    },
    "discovered": {
      "columns": {
        "origen": "Origen",
        "name": "Nombre",
        "target": "Destino",
        "location": "Ubicación",
        "estado": "Estado"
      },
      "filters": {
        "searchTarget": "Buscar destino…",
        "origen": "Origen"
      },
      "rowActions": {
        "detail": "Ver detalle",
        "delete": "Eliminar"
      },
      "options": {
        "panel": "Panel",
        "gitHook": "Git hook",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "Config",
        "proyecto": "Proyecto"
      }
    }
  },
  "runtime": {
    "testDelivered": "Prueba entregada correctamente.",
    "testFailed": "La entrega de prueba falló.",
    "loadingDeliveries": "Cargando entregas…",
    "loadDeliveriesError": "No se pudieron cargar las entregas.",
    "noDeliveries": "Todavía no hay entregas registradas.",
    "delivered": "Entregado",
    "failed": "Fallido",
    "attempts": "Intentos: {count}",
    "selectEvent": "Selecciona al menos un evento."
  },
  "settingsUi": {
    "title": "Configuración de Webhooks",
    "description": "Paginación y acciones visibles de las tablas de Webhooks.",
    "gateway": "Gateway",
    "webhooks": "Webhooks",
    "signingSecret": "Secreto de firma · cópialo ahora",
    "signingSecretHint": "Se muestra una sola vez. Configúralo en el receptor para verificar X-Luxipanel-Signature.",
    "recentDeliveries": "Entregas recientes"
  }
} as const;

export default webhooks;
