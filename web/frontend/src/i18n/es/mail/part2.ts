// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "Detectar Configuración Automáticamente: Remoto",
      "local": "Servidor de Correo Local",
      "backup": "Servidor de Correo de Respaldo",
      "remote": "Servidor de Correo Remoto"
    },
    "currentMode": "Actual: {mode}"
  },
  "tracking": {
    "statuses": {
      "success": "Éxito",
      "deferred": "Diferido",
      "failure": "Fallido",
      "inProgress": "En progreso",
      "unknown": "Desconocido"
    },
    "columns": {
      "event": "Evento",
      "fromAddress": "Dirección de origen",
      "sentTime": "Hora de envío",
      "spamScore": "Puntuación de spam",
      "recipient": "Destinatario",
      "domain": "Dominio",
      "id": "ID",
      "result": "Resultado",
      "actions": "Acciones"
    },
    "noRecordsFound": "No se encontraron registros.",
    "zeroRecords": "0 registros",
    "matchesZeroRecords": "La búsqueda no arroja resultados.",
    "recordsCount": "{count} registros",
    "matchesRecords": "La búsqueda arroja {count} resultados.",
    "detailMeta": "Evento: {event} | ID: {id} | Destinatario: {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "De",
      "subject": "Asunto",
      "to": "Para",
      "anyRecipient": "Cualquier destinatario",
      "reply": "Responder",
      "body": "Cuerpo",
      "anyHeader": "Cualquier encabezado",
      "notDelivered": "No ha sido entregado previamente",
      "errorMessage": "Es un mensaje de error",
      "listId": "List ID",
      "spamStatus": "Estado de spam",
      "spamBar": "Barra de spam",
      "spamScore": "Puntuación de spam"
    },
    "matches": {
      "contains": "contiene",
      "matchesRegex": "coincide con regex",
      "doesNotContain": "no contiene",
      "equals": "es igual a",
      "beginsWith": "comienza con",
      "endsWith": "termina con",
      "doesNotBegin": "no comienza con",
      "doesNotEnd": "no termina con",
      "doesNotMatch": "no coincide",
      "isAbove": "es mayor que (solo números)",
      "isNotAbove": "no es mayor que (solo números)",
      "isBelow": "es menor que (solo números)",
      "isNotBelow": "no es menor que (solo números)"
    },
    "actions": {
      "discard": "Descartar mensaje",
      "redirect": "Redirigir a email",
      "fail": "Rechazar con mensaje",
      "stop": "Detener el procesamiento de reglas",
      "deliverToFolder": "Entregar en carpeta",
      "pipe": "Canalizar a un programa"
    },
    "joinOp": {
      "and": "y",
      "or": "o"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "Configuración actual: (ninguna)",
      "forward": "Configuración actual: {destination}",
      "forwardDefault": "(reenvío)",
      "fail": "Configuración actual: :fail: {message}"
    },
    "defaultFailMessage": "No existe ese usuario aquí"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "1 mes",
      "threeMonths": "3 meses",
      "sixMonths": "6 meses",
      "oneYear": "1 año",
      "twoYears": "2 años",
      "fiveYears": "5 años",
      "tenYears": "10 años",
      "forever": "Para siempre",
      "custom": "Personalizado"
    },
    "fields": {
      "incomingEmail": "Mensajes de correo entrantes",
      "outgoingMailingList": "Mensajes de correo de listas de distribución salientes",
      "outgoingEmail": "Mensajes de correo salientes"
    }
  },
  "encryption": {
    "neverExpires": "Nunca"
  },
  "actions": {
    "view": "Ver",
    "save": "Guardar",
    "clone": "Clonar",
    "copy": "Copiar",
    "delete": "Eliminar",
    "edit": "Editar",
    "remove": "Quitar"
  },
  "outbound": {
    "cardTitle": "Envío del panel (SMTP)",
    "cardDesc": "Cuenta por defecto o SMTP externo con el que el panel envía reportes y correos del sistema.",
    "back": "Volver",
    "intro": "Identidad con la que LUXIPANEL envía correos del sistema (reportes de agentes cron, enlaces de aprobación, pruebas). Puede ser una cuenta de correo de este servidor o un SMTP externo que no pertenezca al servidor.",
    "modeLabel": "Modo de envío",
    "modeDisabled": "Deshabilitado",
    "modeAccount": "Cuenta de correo del servidor (por defecto)",
    "modeExternal": "SMTP externo",
    "accountLabel": "Cuenta de envío por defecto",
    "accountHint": "Usa la credencial SMTP almacenada de esa cuenta.",
    "hostLabel": "Servidor SMTP",
    "portLabel": "Puerto",
    "userLabel": "Usuario",
    "passLabel": "Contraseña",
    "passPlaceholder": "(sin cambios)",
    "fromLabel": "Remitente (email)",
    "fromNameLabel": "Nombre del remitente",
    "secureLabel": "TLS directo (puerto 465)",
    "save": "Guardar",
    "testPlaceholder": "destino@prueba.com",
    "test": "Enviar prueba",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "Mi Empresa"
  },
  "table": {
    "status": {
      "active": "Activo",
      "inactive": "Inactivo",
      "disabled": "Desactivado"
    },
    "redirect": {
      "columns": {
        "domain": "Dominio",
        "destinos": "Destinos"
      },
      "filters": {
        "searchDomain": "Buscar dominio…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Eliminar"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "Key ID",
        "label": "Identidad",
        "keySize": "Tamaño de clave",
        "created": "Creada",
        "expires": "Caduca"
      },
      "filters": {
        "searchKey": "Buscar key…"
      },
      "rowActions": {
        "view": "Ver",
        "delete": "Eliminar"
      }
    },
    "accounts": {
      "columns": {
        "address": "Dirección",
        "domain": "Dominio",
        "uso": "Quota / Uso",
        "reenvios": "Reenvíos",
        "estado": "Estado"
      },
      "filters": {
        "search": "Buscar dirección o dominio…",
        "domain": "Dominio",
        "estado": "Estado"
      },
      "rowActions": {
        "edit": "Editar cuenta",
        "depurarIa": "Depurar con IA",
        "password": "Cambiar contraseña",
        "toggle": "Activar / Desactivar",
        "inbox": "Entrar al correo",
        "signatures": "Gestionar firmas",
        "default": "Usar como predeterminado",
        "contacts": "Gestionar contactos",
        "calendars": "Gestionar calendarios",
        "autoresponder": "Gestionar autoresponder",
        "filters": "Gestionar filtros",
        "forwards": "Gestionar reenvíos",
        "diskusage": "Gestionar disk usage",
        "clone": "Clonar correo",
        "delete": "Eliminar cuenta"
      },
      "quickActions": {
        "bulkForward": "Añadir reenvío",
        "bulkQuota": "Cambiar quota",
        "bulkDelete": "Eliminar cuentas"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "Filtro",
        "estado": "Estado",
        "rules": "Reglas",
        "actionsCount": "Acciones"
      },
      "filters": {
        "search": "Buscar filtro…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Eliminar"
      }
    },
    "contacts": {
      "columns": {
        "email": "Email",
        "name": "Nombre"
      },
      "filters": {
        "searchEmail": "Buscar email…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Eliminar"
      }
    },
    "calendars": {
      "columns": {
        "name": "Nombre",
        "timezone": "Zona horaria",
        "estado": "Estado"
      },
      "filters": {
        "search": "Buscar calendario…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Eliminar"
      }
    },
    "signatures": {
      "columns": {
        "sender": "Remitente",
        "preview": "Firma"
      },
      "filters": {
        "search": "Filtrar y buscar…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Eliminar"
      }
    },
    "filters": {
      "columns": {
        "name": "Nombre",
        "estado": "Estado"
      },
      "filters": {
        "search": "Buscar filtro…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Eliminar"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "¿Eliminar {count} cuenta(s) de correo? Esta acción no se puede deshacer.",
    "deleteAccount": "¿Eliminar la cuenta {address}? Esta acción no se puede deshacer.",
    "deleteAccountTitle": "Eliminar cuenta",
    "deleteAutoresponder": "¿Eliminar autoresponder de esta cuenta?",
    "deleteByDate": "Se eliminarán correos de {folder} entre {from} y {to}. ¿Continuar?",
    "deleteByDateTitle": "Eliminar correos por fecha",
    "deleteCalendar": "¿Eliminar calendario \"{label}\"?",
    "deleteCalendarTitle": "Eliminar calendario",
    "deleteContact": "¿Eliminar contacto \"{label}\"?",
    "deleteContactTitle": "Eliminar contacto",
    "deleteDomainForward": "¿Eliminar la redirección global de @{domain}?",
    "deleteDomainForwardTitle": "Eliminar redirección global",
    "deleteEncryptionKey": "¿Eliminar esta llave de cifrado?",
    "deleteFilter": "¿Eliminar el filtro \"{name}\"?",
    "deleteFilterTitle": "Eliminar filtro",
    "deleteForward": "¿Eliminar el reenvío a {destination}?",
    "deleteGlobalFilter": "¿Eliminar filtro global \"{label}\"?",
    "deleteGlobalFilterTitle": "Eliminar filtro global",
    "yesDelete": "Sí, eliminar"
  },
  "empty": {
    "noDomains": "Sin dominios",
    "noFolders": "No se encontraron carpetas para esta cuenta.",
    "noOtherAccount": "No hay otra cuenta disponible"
  },
  "errors": {
    "accountCreateFailed": "Error al crear la cuenta",
    "accountNotFound": "No se encontró la cuenta",
    "accountUpdateFailed": "Error al actualizar la cuenta",
    "accountUpdatedForwardsFailed": "La cuenta se actualizó, pero falló la actualización de redirecciones",
    "accountsLoadFailed": "Error al cargar cuentas",
    "autoDeleteThresholdInvalid": "Umbral de auto-eliminación inválido.",
    "autoresponderDeleteFailed": "No se pudo eliminar autoresponder",
    "autoresponderSaveFailed": "No se pudo guardar el autoresponder.",
    "calendarDeleteFailed": "No se pudo eliminar calendario",
    "calendarNotFound": "No se encontró el calendario",
    "calendarSaveFailed": "No se pudo guardar el calendario.",
    "cloneCreateFailed": "No se pudo crear la cuenta nueva.",
    "cloneFailed": "No se pudo clonar el correo.",
    "cloneIdResolveFailed": "Cuenta creada, pero no se pudo resolver su ID. Reintenta como 'existente'.",
    "cloneLocalAndDomainRequired": "Indica parte local y dominio.",
    "clonePasswordTooShort": "La contraseña debe tener al menos 6 caracteres.",
    "contactDeleteFailed": "No se pudo eliminar contacto",
    "contactNotFound": "No se encontró el contacto",
    "contactSaveFailed": "No se pudo guardar el contacto.",
    "copyByRangeFailed": "No se pudo copiar por rango",
    "customScoreInvalid": "Puntuación personalizada inválida.",
    "dateRangeRequired": "Debes seleccionar fecha inicial y final",
    "defaultAddressLoadFailed": "No se pudo cargar la dirección predeterminada.",
    "defaultAddressSaveFailed": "No se pudo guardar la dirección predeterminada.",
    "deleteByRangeFailed": "No se pudo eliminar por rango",
    "deleteFailed": "Error al eliminar",
    "destEmailInvalid": "Correo destino inválido",
    "destinationsInvalidFormat": "Uno o más destinos tienen formato inválido.",
    "diskUsageLoadFailed": "No se pudo cargar el uso de disco",
    "domainForwardDeleteFailed": "No se pudo eliminar la redirección global.",
    "domainForwardsLoadFailed": "No se pudieron cargar las redirecciones globales.",
    "domainRedirectSaveFailed": "No se pudo guardar la redirección global.",
    "domainsLoadFailed": "No se pudieron cargar dominios DNS",
    "filterDeleteFailed": "No se pudo eliminar el filtro",
    "filterNotFound": "No se encontró el filtro",
    "filterSaveFailed": "No se pudo guardar el filtro.",
    "forwardAlreadyExists": "Ya existe un reenvío a {destination}",
    "forwardsSaveFailed": "No se pudieron guardar los reenvíos en el servidor",
    "globalFilterDeleteFailed": "No se pudo eliminar el filtro global.",
    "globalFilterSaveFailed": "No se pudo guardar el filtro global.",
    "globalFilterTestFailed": "No se pudo ejecutar el test.",
    "globalFiltersLoadFailed": "No se pudieron cargar los filtros globales.",
    "indicateTestDestEmail": "Indica el email de destino de la prueba.",
    "localPartInvalid": "El usuario antes de @ tiene un formato inválido.",
    "localPartInvalidNoPoint": "El usuario antes de @ tiene un formato inválido",
    "mustAddAtLeastOneAction": "Debes agregar al menos una acción.",
    "mustAddAtLeastOneDestEmail": "Debes agregar al menos un correo destino.",
    "mustAddAtLeastOneRule": "Debes agregar al menos una regla.",
    "mustEnterBody": "Debes ingresar el contenido del mensaje.",
    "mustEnterSubject": "Debes ingresar un asunto.",
    "mustEnterTestMessage": "Debes ingresar un mensaje de prueba.",
    "mustEnterValidDestEmail": "Debes ingresar un correo destino válido.",
    "mustIndicateCalendarName": "Debes indicar nombre de calendario.",
    "mustIndicateContactEmail": "Debes indicar el correo del contacto.",
    "mustIndicateFilterName": "Debes indicar un nombre de filtro.",
    "mustIndicateName": "Debes indicar un nombre.",
    "mustSelectDomain": "Debes seleccionar un dominio.",
    "mustSelectDomainNoPoint": "Debes seleccionar un dominio",
    "noAutoresponderToDelete": "No hay autoresponder para eliminar",
    "passwordChangeFailed": "Error al cambiar la contraseña",
    "quotaInvalid": "Quota inválida",
    "routingLoadFailed": "No se pudo cargar la configuración de enrutamiento de correo.",
    "routingSaveFailed": "No se pudo guardar la configuración de enrutamiento de correo.",
    "saveFailed": "Error al guardar",
    "scoreTypesLoadFailed": "No se pudo cargar el catálogo de tipos de puntuación.",
    "selectDestAccount": "Selecciona una cuenta destino",
    "selectValidDomain": "Selecciona un dominio válido.",
    "spamFiltersLoadFailed": "No se pudieron cargar los filtros de spam.",
    "spamFiltersSaveFailed": "No se pudo guardar la configuración de filtros de spam.",
    "testEmailFailed": "Fallo el envío de prueba",
    "toggleFailed": "Error al cambiar estado",
    "trackDeliveryLoadFailed": "No se pudo cargar el seguimiento de entrega."
  },
  "labels": {
    "accountColon": "Cuenta: {address}",
    "activating": "Activando",
    "cloneStartedBg": "Clonación iniciada en segundo plano. Te avisaremos por notificaciones cuando termine.",
    "cloning": "Clonando…",
    "currentAccountColon": "Cuenta actual: {address}",
    "deactivating": "Desactivando",
    "destEmailForCount": "Correo destino del reenvío a añadir en {count} cuenta(s):",
    "loading": "Cargando...",
    "newQuotaFor": "Nueva quota en MB para {count} cuenta(s). Usa 0 para ilimitado.",
    "no": "No",
    "noGlobalLimit": "Sin límite global",
    "originColon": "Origen: {addr}",
    "sendingTest": "Enviando prueba…",
    "sudoPromptMessage": "No se puede leer el uso de las casillas sin privilegios en el servidor. Introduce la contraseña sudo del usuario SSH (se guarda cifrada en el servidor).",
    "to": "a",
    "total": "Total",
    "unlimited": "Ilimitado",
    "yes": "Sí",
    "keepCopy": "Guardar copia"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (sin cambios)",
    "selectDomain": "Selecciona dominio...",
    "value": "Valor",
    "valueIfApplicable": "Valor (si aplica)"
  },
  "status": {
    "active": "Activo",
    "deactivated": "Desactivado",
    "inactive": "Inactivo"
  },
  "titles": {
    "addForward": "Añadir reenvío",
    "changeQuota": "Cambiar quota",
    "deleteAccounts": "Eliminar cuentas",
    "deleteAutoresponder": "Eliminar autoresponder",
    "deleteEncryptionKey": "Eliminar llave",
    "deleteForward": "Eliminar reenvío"
  },
  "toasts": {
    "accountActivated": "Cuenta activada",
    "accountCreated": "Cuenta creada correctamente",
    "accountDeactivated": "Cuenta desactivada",
    "accountDeleted": "Cuenta eliminada",
    "accountUpdated": "Cuenta actualizada ({localPart}@{domain})",
    "archiveDefaultUpdated": "Configuración default de archivo actualizada.",
    "archiveDomainUpdated": "Archivo actualizado para {domain}.",
    "autoDeleteDisabled": "Auto-eliminación deshabilitada",
    "autoDeleteEnabled": "Auto-eliminación habilitada",
    "autoDeleteUpdated": "Auto-eliminación actualizada",
    "autoresponderDeleted": "Autoresponder eliminado",
    "autoresponderSaved": "Autoresponder guardado",
    "blacklistUpdated": "Lista negra actualizada",
    "bulkDeletedCount": "{ok}/{count} cuenta(s) eliminada(s)",
    "bulkUpdatedCount": "{ok}/{count} cuenta(s) actualizada(s)",
    "calculatedScoresUpdated": "Puntuaciones calculadas actualizadas",
    "calendarCreated": "Calendario creado",
    "calendarDeleted": "Calendario eliminado",
    "calendarUpdated": "Calendario actualizado",
    "cloneStarted": "Clonación iniciada — te notificaremos al terminar",
    "contactCreated": "Contacto creado",
    "contactDeleted": "Contacto eliminado",
    "contactUpdated": "Contacto actualizado",
    "defaultAddressUpdated": "Dirección predeterminada actualizada para @{domain}",
    "defaultInboxSet": "{address} ahora es el correo predeterminado",
    "domainForwardDeleted": "Redirección global de @{domain} eliminada",
    "emailRoutingUpdated": "Enrutamiento de correo actualizado para @{domain}",
    "emailsCopied": "Copiados {count} correos de {folder}",
    "emailsDeleted": "Eliminados {count} correos de {folder}",
    "filterCreated": "Filtro creado",
    "filterDeleted": "Filtro eliminado",
    "filterUpdated": "Filtro actualizado",
    "forwardAddedCount": "Reenvío añadido en {ok}/{count} cuenta(s)",
    "forwardDeleted": "Reenvío eliminado",
    "forwardsUpdated": "Reenvíos actualizados",
    "globalFilterCreated": "Filtro global creado",
    "globalFilterDeleted": "Filtro global eliminado",
    "globalFilterUpdated": "Filtro global actualizado",
    "globalRedirectSaved": "Redirección global guardada para @{domain}",
    "keyDeleted": "Llave eliminada.",
    "keyGenerated": "Llave generada.",
    "passwordUpdated": "Contraseña actualizada",
    "publicKeyImported": "Llave pública importada.",
    "settingsSaved": "Configuración guardada ✓",
    "spamBoxDisabled": "Carpeta de spam deshabilitada",
    "spamBoxEnabled": "Carpeta de spam habilitada",
    "spamBoxUpdated": "Carpeta de spam actualizada",
    "spamFiltersDisabled": "Filtros de spam deshabilitados",
    "spamFiltersEnabled": "Filtros de spam habilitados",
    "spamThresholdUpdated": "Umbral de spam actualizado",
    "testEmailSent": "Correo de prueba enviado ✓",
    "whitelistUpdated": "Lista blanca actualizada"
  },
  "dataTableTitles": {
    "rules": "reglas",
    "publicKeys": "llaves públicas",
    "privateKeys": "llaves privadas",
    "accounts": "cuentas",
    "globalFilters": "filtros globales",
    "contacts": "contactos",
    "calendars": "calendarios",
    "filters": "filtros"
  },
  "trackColumns": {
    "event": "Evento",
    "fromAddress": "Dirección de origen",
    "sentTime": "Hora de envío",
    "spamScore": "Puntuación de spam",
    "recipient": "Destinatario",
    "domain": "Dominio",
    "queueId": "ID",
    "result": "Resultado",
    "actions": "Acciones"
  },
  "signaturesDrawer": {
    "title": "Firmas",
    "addSignature": "Añadir firma",
    "close": "Cerrar",
    "tableTitle": "firmas"
  }
} as const;

export default mailPart2;
