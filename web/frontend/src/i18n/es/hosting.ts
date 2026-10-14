const hosting = {
  "pageTitle": "Hosting compartido",
  "pageSubtitle": "Gestiona las cuentas de hosting de tus clientes · WHM-style multi-tenant",
  "btnNewAccount": "Nueva cuenta",
  "options": {
    "planBasic": "Básico",
    "planPro": "Pro",
    "planBusiness": "Empresa",
    "planCustom": "Personalizado"
  },
  "stats": {
    "total": "Total cuentas",
    "active": "Activas",
    "suspended": "Suspendidas",
    "terminated": "Terminadas",
    "title": "Uso de {username}",
    "disk": "Disco (MB)",
    "domains": "Dominios",
    "emails": "Cuentas email",
    "databases": "Bases de datos",
    "subusers": "Sub-usuarios",
    "bandwidth": "Ancho de banda (MB)",
    "percentUsed": "% usado",
    "method": "Método de medición",
    "methodDu": "Estimación por du (best-effort)",
    "methodQuotaTools": "Cuota del sistema (quota-tools)"
  },
  "tableTitle": "cuentas",
  "modal": {
    "titleNew": "Nueva cuenta de hosting",
    "tabs": {
      "account": "Cuenta",
      "resources": "Recursos",
      "security": "Módulos y seguridad"
    },
    "labelUsername": "Usuario *",
    "labelPassword": "Contraseña *",
    "labelName": "Nombre",
    "labelEmail": "Email",
    "labelPlan": "Plan",
    "resourcesTitle": "Límites de recursos",
    "labelDisk": "Disco (MB)",
    "labelBandwidth": "Ancho de banda (MB)",
    "labelDomains": "Dominios",
    "labelEmails": "Cuentas email",
    "labelNotes": "Notas internas",
    "btnCancel": "Cancelar",
    "btnCreate": "Crear cuenta",
    "hintUsername": "Solo minúsculas, números, - y _",
    "phUsername": "clienteejemplo",
    "phPassword": "mínimo 8 caracteres",
    "phName": "Empresa S.A.",
    "phEmail": "admin@empresa.com",
    "phNotes": "Observaciones opcionales…",
    "labelStatus": "Estado",
    "labelTenantGroup": "Grupo del tenant",
    "labelHomeRoot": "Carpeta raíz (home)",
    "hintTenantGroup": "Grupo Linux dedicado de la cuenta (solo lectura).",
    "hintHomeRoot": "Raíz del tenant en el VPS (solo lectura).",
    "labelDiskQuotaMb": "Cuota de disco (MB)",
    "labelBandwidthQuotaMb": "Cuota de banda (MB)",
    "labelMaxDomains": "Máx. dominios",
    "labelMaxEmailAccounts": "Máx. cuentas email",
    "labelMaxDatabases": "Máx. bases de datos",
    "labelMaxSubUsers": "Máx. sub-usuarios",
    "labelAllowedModules": "Módulos permitidos",
    "labelJailEnabled": "Aislar shell (chroot)",
    "hintJailEnabled": "Confina la terminal/SSH de esta cuenta a su carpeta (jaula chroot).",
    "modulesLoading": "Cargando módulos…",
    "labelExpiresAt": "Fecha de expiración",
    "hintExpiresAt": "Dejar vacío para sin vencimiento",
    "labelModules": "Módulos permitidos",
    "hintModules": "Define los módulos del panel a los que tendrá acceso este cliente.",
    "labelDatabases": "Bases de datos",
    "labelSubUsers": "Sub-usuarios",
    "labelJail": "Aislar shell (chroot)",
    "hintJail": "Confina la terminal/SSH de esta cuenta a su carpeta (jaula chroot).",
    "titleEdit": "Editar: {username}"
  },
  "pwdModal": {
    "title": "Cambiar contraseña",
    "labelNew": "Nueva contraseña",
    "phPassword": "mínimo 8 caracteres",
    "btnCancel": "Cancelar",
    "btnChange": "Cambiar"
  },
  "apiPageTitle": "Documentación API de Hosting",
  "apiSubtitle": "Gestión automatizada de cuentas de hosting compartido",
  "apiIntro": "La Reseller API te permite automatizar la creación, actualización, suspensión y eliminación de cuentas de hosting desde cualquier sistema externo — tu propia plataforma de facturación, WHMCS, scripts Bash, integraciones con Zapier, etc. Es compatible con cualquier lenguaje o herramienta que pueda hacer peticiones HTTP.",
  "toc": {
    "label": "Contenido",
    "items": [
      "1. Autenticación",
      "2. Aislamiento y seguridad",
      "3. Endpoints disponibles",
      "4. Crear cuenta",
      "5. Listar cuentas",
      "6. Obtener cuenta",
      "7. Actualizar cuenta",
      "8. Suspender / Reactivar",
      "9. Cambiar contraseña",
      "10. Estadísticas de cuenta",
      "11. Eliminar cuenta",
      "12. Login de cuenta hosting",
      "13. Códigos de error",
      "14. Ejemplos completos"
    ]
  },
  "auth": {
    "title": "Autenticación",
    "intro": "Todos los endpoints de la Reseller API aceptan dos métodos de autenticación:",
    "apiKeyTitle": "Clave API (recomendado para automatización)",
    "apiKeyDesc": "Genera una clave API desde Panel → Webhooks → Clave APIs. Envíala en el header Authorization:",
    "sessionTitle": "Sesión de admin (desde el panel)",
    "sessionDesc": "Si estás haciendo peticiones desde el propio panel LUXIPANEL (por ejemplo, desde JavaScript en el browser), tu cookie de sesión de administrador es aceptada automáticamente.",
    "warningTitle": "Importante:",
    "warningText": "Nunca expongas tu clave API en código del lado cliente (JavaScript en el navegador, aplicaciones móviles, etc.). Úsala exclusivamente desde servidores o entornos privados."
  },
  "isolation": {
    "title": "Aislamiento y seguridad",
    "intro": "Cada cuenta de hosting es un entorno completamente aislado. Esto garantiza que ningún cliente puede ver ni modificar los recursos de otro, sin importar si intenta hacerlo via panel web, API, consola SSH o cualquier otro vector.",
    "features": [
      {
        "title": "Datos aislados",
        "desc": "Los buzones, dominios, DNS, SSL y copias de seguridad están vinculados al tenant_id de cada cuenta. Las consultas SQL nunca cruzan inquilinos."
      },
      {
        "title": "Sistema de archivos",
        "desc": "Cada cuenta tiene su propio directorio personal (/home/username). El explorador de archivos y la consola están restringidos a ese directorio."
      },
      {
        "title": "Sesiones independientes",
        "desc": "El JWT de una cuenta de hosting incluye su tenantId. El backend rechaza cualquier solicitud que intente acceder a recursos fuera de ese ámbito."
      }
    ]
  },
  "endpoints": {
    "title": "Endpoints disponibles",
    "colMethod": "Método",
    "colPath": "Ruta",
    "colDesc": "Descripción",
    "colAuth": "Autenticación",
    "rows": [
      [
        "POST",
        "/api/hosting/accounts",
        "Crear cuenta de hosting",
        "Administrador / Clave API"
      ],
      [
        "GET",
        "/api/hosting/accounts",
        "Listar cuentas (paginado)",
        "Administrador / Clave API"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id",
        "Obtener una sola cuenta",
        "Administrador / Clave API"
      ],
      [
        "PUT",
        "/api/hosting/accounts/:id",
        "Actualizar cuenta",
        "Administrador / Clave API"
      ],
      [
        "DELETE",
        "/api/hosting/accounts/:id",
        "Eliminar la cuenta y todos sus datos",
        "Administrador / Clave API"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/suspend",
        "Suspender cuenta",
        "Administrador / Clave API"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/unsuspend",
        "Reactivar cuenta suspendida",
        "Administrador / Clave API"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/change-password",
        "Cambiar contraseña",
        "Administrador / Clave API"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id/stats",
        "Estadísticas de uso",
        "Administrador / Clave API"
      ],
      [
        "POST",
        "/api/hosting/auth/login",
        "Inicio de sesión de cuenta de hosting",
        "Público"
      ],
      [
        "POST",
        "/api/hosting/auth/logout",
        "Cierre de sesión de hosting",
        "Sesión de hosting"
      ]
    ]
  },
  "create": {
    "title": "Crear cuenta",
    "labelBody": "Cuerpo (JSON)",
    "labelResp": "Respuesta 201"
  },
  "list": {
    "title": "Listar cuentas",
    "labelParams": "Parámetros de consulta",
    "colParam": "Parámetro",
    "colType": "Tipo",
    "colDefault": "Predeterminado",
    "colDesc": "Descripción",
    "labelResp": "Respuesta 200",
    "params": [
      [
        "page",
        "integer",
        "1",
        "Página actual"
      ],
      [
        "limit",
        "integer",
        "20",
        "Resultados por página (máx. 100)"
      ],
      [
        "search",
        "string",
        "—",
        "Buscar en username, displayName, email"
      ],
      [
        "status",
        "string",
        "—",
        "active | suspended | terminated"
      ]
    ]
  },
  "compactEndpoints": [
    {
      "id": "get",
      "num": "6",
      "title": "Obtener cuenta",
      "method": "GET",
      "path": "/api/hosting/accounts/:id",
      "note": "Devuelve el objeto de la cuenta sin el campo passwordHash."
    },
    {
      "id": "update",
      "num": "7",
      "title": "Actualizar cuenta",
      "method": "PUT",
      "path": "/api/hosting/accounts/:id",
      "note": "Acepta los mismos campos que la creación (excepto username y password). Solo se actualizan los campos enviados."
    },
    {
      "id": "suspend",
      "num": "8",
      "title": "Suspender / Reactivar",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/suspend  |  /unsuspend",
      "note": "Suspender bloquea el acceso del cliente de inmediato. Reactivar restaura el estado a 'active'. No requiere cuerpo."
    },
    {
      "id": "password",
      "num": "9",
      "title": "Cambiar contraseña",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/change-password",
      "note": "Body: {\"password\": \"NewPass123!\"} — mínimo 8 caracteres."
    },
    {
      "id": "stats",
      "num": "10",
      "title": "Estadísticas de uso",
      "method": "GET",
      "path": "/api/hosting/accounts/:id/stats",
      "note": "Devuelve las cuotas configuradas y el uso actual de disco, ancho de banda, dominios activos y cuentas de correo."
    },
    {
      "id": "delete",
      "num": "11",
      "title": "Eliminar cuenta",
      "method": "DELETE",
      "path": "/api/hosting/accounts/:id",
      "note": "⚠️ Irreversible. Elimina la cuenta y, mediante ON DELETE CASCADE, todos sus recursos: buzones, dominios, DNS, SSL y copias de seguridad."
    }
  ],
  "login": {
    "title": "Login de cuenta hosting",
    "badgePublic": "· Público",
    "desc": "El cliente ingresa sus credenciales en el panel de login. Si son válidas, se crea una sesión de tipo kind: \"hosting\" que restringe el acceso exclusivamente a los recursos de su cuenta.",
    "labelBody": "Cuerpo",
    "labelResp": "Respuesta 200"
  },
  "errors": {
    "title": "Códigos de error",
    "intro": "Todos los errores siguen el mismo envelope:",
    "colHttp": "HTTP",
    "colCode": "Código",
    "colDesc": "Descripción",
    "rows": [
      [
        "400",
        "VALIDATION_ERROR",
        "Campos inválidos o faltantes"
      ],
      [
        "401",
        "AUTH_ERROR",
        "clave API inválida, expirada o ausente"
      ],
      [
        "403",
        "FORBIDDEN",
        "No tienes permiso para esta operación"
      ],
      [
        "404",
        "NOT_FOUND",
        "La cuenta solicitada no existe"
      ],
      [
        "409",
        "CONFLICT",
        "El nombre de usuario ya está en uso"
      ],
      [
        "429",
        "RATE_LIMIT",
        "Demasiadas solicitudes — espera antes de reintentar"
      ],
      [
        "500",
        "INTERNAL_ERROR",
        "Error interno del servidor"
      ]
    ],
    "generic": "Error",
    "unknown": "Error desconocido"
  },
  "examples": {
    "title": "Ejemplos completos",
    "labelCurl": "Crear cuenta",
    "labelSuspend": "Suspender cuenta",
    "labelList": "Listar con filtros",
    "labelNodeClient": "Cliente reutilizable",
    "labelPhpHelper": "Clase helper en PHP"
  },
  "table": {
    "columnStatus": "Estado",
    "columnPlan": "Plan",
    "columnModules": "Módulos",
    "columnCreated": "Creado",
    "columnUpdated": "Actualizado",
    "columnTenantGroup": "Grupo",
    "columnHomeRoot": "Directorio personal",
    "modulesCount": "{count} módulos"
  },
  "audit": {
    "title": "Auditoría de {username}",
    "eventType": "Evento",
    "actor": "Responsable",
    "date": "Fecha",
    "empty": "Sin eventos registrados."
  },
  "actions": {
    "editModules": "Editar módulos",
    "viewStats": "Ver uso",
    "viewAudit": "Ver auditoría",
    "enableJail": "Activar jaula",
    "disableJail": "Desactivar jaula",
    "save": "Guardar",
    "saveChanges": "Guardar cambios",
    "saving": "Guardando…"
  },
  "confirm": {
    "enableJailBody": "¿Activar la jaula chroot para esta cuenta? Su terminal/SSH quedará confinado a su carpeta.",
    "disableJailBody": "¿Desactivar la jaula chroot? La cuenta volverá a una shell normal (/bin/bash).",
    "suspendBody": "¿Suspender esta cuenta? El cliente perderá acceso.",
    "suspendTitle": "Suspender cuenta",
    "suspendOk": "Sí, suspender",
    "deleteBody": "¿Eliminar la cuenta \"{username}\" y TODOS sus datos (correos, dominios, archivos)? Esta acción no se puede deshacer.",
    "deleteTitle": "Eliminar cuenta"
  },
  "jail": {
    "degraded": "jailkit no está instalado en el servidor; la jaula no quedó activa. Instala jailkit y reintenta.",
    "degradedTitle": "Jaula no aplicada",
    "enabledOk": "Jaula activada correctamente."
  },
  "toasts": {
    "jailAlready": "La jaula ya está activa",
    "jailNotActive": "La jaula no está activa",
    "notActive": "La cuenta no está activa",
    "notSuspended": "La cuenta no está suspendida"
  },
  "labels": {
    "statusActive": "Activa",
    "statusSuspended": "Suspendida",
    "statusTerminated": "Terminada"
  },
  "dataTable": {
    "columns": {
      "username": "Usuario",
      "plan": "Plan",
      "estado": "Estado",
      "modulos": "Módulos",
      "tenantGroup": "Grupo",
      "homeRoot": "Home",
      "creado": "Creado",
      "actualizado": "Actualizado"
    },
    "filters": {
      "searchUser": "Buscar por usuario…",
      "estado": "Estado",
      "plan": "Plan",
      "statusActive": "Activa",
      "statusSuspended": "Suspendida",
      "statusTerminated": "Terminada"
    },
    "rowActions": {
      "edit": "Editar",
      "viewStats": "Ver uso",
      "viewAudit": "Ver auditoría",
      "password": "Cambiar contraseña",
      "suspend": "Suspender",
      "unsuspend": "Reactivar",
      "enableJail": "Activar jaula",
      "disableJail": "Desactivar jaula",
      "delete": "Eliminar"
    }
  },
  "runtime": {
    "defaultsLoadError": "No se pudieron cargar los valores predeterminados.",
    "defaultsSaveError": "No se pudieron guardar los valores.",
    "defaultsSaved": "Valores guardados en el servidor activo."
  },
  "settingsUi": {
    "title": "Configuración de Hosting",
    "description": "Preferencias de la tabla de cuentas de hosting",
    "table": "Tabla",
    "apiProviders": "Proveedores API",
    "rowsPerPage": "Filas por página en la tabla de cuentas.",
    "newAccountDefaults": "Valores para nuevas cuentas",
    "defaultsHint": "Se guardan en el servidor activo. No modifican cuentas existentes.",
    "emailAccounts": "Correos",
    "subusers": "Subusuarios",
    "defaultJail": "Activar jaula por defecto",
    "defaultModules": "Módulos predeterminados (IDs separados por comas)",
    "saveDefaults": "Guardar valores",
    "relatedModules": "Módulos relacionados",
    "users": "Usuarios",
    "domainsSsl": "Dominios y SSL",
    "showAll": "Mostrar todas",
    "hideAll": "Ocultar todas",
    "providerConnections": "Conexiones de gestores de hosting",
    "providerConnectionsHint": "LUXIPANEL ofrece la API. Cada gestor recibe una clave y acceso limitado a un servidor, módulos y operaciones.",
    "newProvider": "Nuevo proveedor",
    "managedServer": "Servidor administrado",
    "localServer": "Servidor local",
    "panelHttpsOrigin": "Origen HTTPS de LUXIPANEL",
    "siteEngine": "Motor del sitio en el servidor",
    "accountModules": "Módulos para las cuentas",
    "modulesHint": "IDs separados por coma; HOSTING valida el catálogo.",
    "apiOperations": "Operaciones de la API",
    "readAccounts": "Leer cuentas",
    "createAccounts": "Crear cuentas",
    "accountStatus": "Estado y datos de cuenta",
    "viewUsage": "Consultar consumo",
    "linkSites": "Vincular sitios",
    "panelAccess": "Acceso al panel",
    "deleteAccounts": "Eliminar cuentas",
    "createProviderKey": "Crear proveedor y clave",
    "copyKeyNow": "Copia la clave ahora: se muestra una sola vez.",
    "groupPolicy": {
      "editProvider": "Editar proveedor",
      "saveProvider": "Guardar proveedor",
      "templateTitle": "Permisos del grupo inicial",
      "templateHint": "Cada cuenta nueva recibe estos permisos en su propio grupo. Para cuentas existentes, edita el grupo en Usuarios.",
      "permissions": "Permisos detallados",
      "sidebar": "Menús",
      "views": "Vistas",
      "actions": "Acciones",
      "filesScope": "Acceso a archivos",
      "relativeHint": "Una ruta por línea, relativa a la carpeta de cada cuenta. Usa . para toda su carpeta.",
      "allowPaths": "Carpetas permitidas",
      "denyPaths": "Carpetas bloqueadas",
      "readOnlyPaths": "Carpetas de solo lectura",
      "defaultPath": "Carpeta inicial",
      "commands": "Comandos de terminal",
      "allowAllCommands": "Permitir todos los comandos del usuario",
      "commandGroups": "Grupos de comandos",
      "allowedCommands": "Comandos permitidos, uno por línea",
      "deniedCommands": "Comandos bloqueados, uno por línea",
      "saving": "Guardando…",
      "saved": "Proveedor guardado. Se aplicará a cuentas nuevas.",
      "created": "Proveedor creado.",
      "loading": "Cargando proveedores y permisos…",
      "loadError": "No se pudo cargar la configuración.",
      "active": "Activo",
      "revoked": "Revocado",
      "rotateKey": "Rotar clave",
      "rotateSuccess": "Clave rotada. Copia la nueva clave.",
      "revoke": "Revocar acceso",
      "reactivate": "Reactivar",
      "accessUpdated": "Acceso actualizado.",
      "emptyProviders": "Todavía no hay proveedores configurados."
},
    "apiGuide": "Guía API",
    "retry": "Reintentar"
  },
  "apiDocs": {
    "pageTitle": "API de proveedores de hosting",
    "backToHosting": "Volver a HOSTING",
    "contractVersion": "Contrato HTTP · versión 1",
    "heading": "Conecta tu gestor de hosting",
    "intro": "LUXIPANEL expone esta API para que tu gestor cree cuentas, vincule sitios y conceda acceso según los permisos definidos en HOSTING.",
    "guideContents": "Contenido de la guía",
    "preparation": "Preparación",
    "authentication": "Autenticación",
    "operations": "Operaciones",
    "example": "Ejemplo",
    "panelAccess": "Acceso al panel",
    "limitsErrors": "Límites y errores",
    "preparationHeading": "Preparación en HOSTING",
    "administrator": "Administrador",
    "scope": "Alcance",
    "key": "Clave",
    "adminStep": "Abre HOSTING → Configuración → Proveedores API y crea un proveedor.",
    "scopeStep": "Define el servidor, el motor de sitios, los módulos, cupos y operaciones permitidas.",
    "keyStep": "Copia la clave lhp_… una sola vez y guárdala únicamente en el backend del gestor.",
    "providerScopeNote": "Cada proveedor pertenece a un servidor. Las cuentas reciben un usuario Linux y carpeta propios; el gestor no elige ni recibe su contraseña.",
    "anyProvider": "Cualquier proveedor",
    "endpointCapabilities": "Consulta versión, operaciones, módulos y servidor asignado.",
    "endpointPutAccount": "Crea o recupera una cuenta con displayName y email opcionales.",
    "endpointGetAccount": "Consulta la cuenta sin exponer su contraseña.",
    "endpointPatchAccount": "Actualiza nombre, correo o estado active/suspended.",
    "endpointDeleteAccount": "Elimina una cuenta sin sitios vinculados. Desactivado por defecto.",
    "endpointUsage": "Consulta cupos, consumo disponible y advertencias de medición.",
    "endpointPutSite": "Vincula un dominio al motor de sitios configurado en HOSTING.",
    "endpointDeleteSite": "Retira únicamente el sitio perteneciente al proveedor.",
    "endpointTicket": "Emite un acceso al panel de un solo uso, válido 60 segundos.",
    "method": "Método",
    "pathFromBase": "Ruta desde la base",
    "permission": "Permiso",
    "result": "Resultado",
    "operationsHeading": "Operaciones para el gestor",
    "authNote": "Envía solicitudes al panel por HTTPS. Las cookies de administrador y claves lxp_… no autentican esta API. Nunca expongas la clave lhp_… al navegador.",
    "baseNote": "URL base: https://<panel>/api/hosting/v1. Los identificadores externos admiten de 1 a 128 caracteres: letras, números, _ . : -.",
    "idempotencyNote": "Las solicitudes PUT de cuenta y sitio son idempotentes con la misma referencia y contenido. Un proveedor no puede acceder a las cuentas de otro.",
    "createAccount": "Crear o recuperar una cuenta",
    "accountResponseNote": "La respuesta contiene { \"ok\": true, \"data\": … } con usuario, directorio, estado y cupos. No incluye el hash de la contraseña.",
    "siteExampleNote": "Para un sitio, envía PUT /accounts/account-42/sites/site-1 con { \"domain\": \"example.com\" }. LUXIPANEL crea un proxy NGINX al motor configurado; el gestor publica contenido y dirige el tráfico TLS al servidor.",
    "clientAccessHeading": "Acceso del cliente a LUXIPANEL",
    "clientAccessNote": "El backend del gestor verifica la propiedad de la cuenta y solicita POST /accounts/{accountId}/access-ticket. Envía la URL y el ticket al navegador, que hace POST a /api/auth/sso/handoff. El ticket es de un solo uso y vence en 60 segundos. Si se exige segundo factor, la respuesta es 403 hasta que exista un flujo compatible.",
    "limitsHeading": "Límites y respuestas de error",
    "limitsNote": "La API solo acepta referencias, datos básicos de cuenta y dominios. El gestor no puede enviar comandos, rutas de archivos, servidor de destino ni configuración NGINX. Un sitio solo apunta al motor y puerto fijados por el administrador.",
    "errorCodes": "400: entrada inválida · 401: clave ausente o inválida · 403: operación no concedida · 404: referencia inexistente · 409: conflicto o trabajo concurrente · 5xx: fallo del servidor.",
    "bandwidthNote": "La medición de ancho de banda aún no es fiable. Consulta warnings en la respuesta de usage."
  }
} as const;

export default hosting;
