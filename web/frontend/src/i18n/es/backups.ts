const backups = {
  "pageTitle": "Copias de seguridad",
  "settings": {
    "title": "Configuración de backup",
    "description": "Destino y preferencias del servidor conectado.",
    "sections": "Secciones de configuración",
    "tables": "Tablas",
    "localHeading": "Destino local",
    "localHelp": "Aquí se guardan las copias locales de este servidor.",
    "changeDirWarning": "Al cambiar la carpeta se eliminarán las copias locales anteriores, después de tu confirmación.",
    "retentionHelp": "Para copias manuales y nuevas programaciones. Las existentes conservan su propio límite.",
    "save": "Guardar cambios",
    "overview": "Estado de las copias",
    "lastSuccess": "Última copia correcta",
    "localCopies": "Copias locales",
    "activeSchedules": "Programaciones activas",
    "advancedCron": "Expresión cron personalizada",
    "loading": "Cargando configuración…",
    "loadError": "No se pudo cargar la configuración del servidor.",
    "pending": "Hay cambios sin guardar.",
    "countError": "Elige entre 1 y 365 copias.",
    "saving": "Guardando…",
    "saved": "Configuración guardada.",
    "previewError": "No se pudo revisar la carpeta.",
    "destinationNotEmpty": "La carpeta nueva ya contiene backups de LUXIPANEL.",
    "changeConfirm": "Se eliminarán {count} copias locales de {path}. Las copias S3/R2 se conservarán. ¿Cambiar la carpeta?",
    "changeTitle": "Cambiar carpeta de backups",
    "changeError": "No se pudo cambiar la carpeta.",
    "targetChanged": "El servidor cambió; vuelve a revisar la configuración."
  },
  "status": {
    "completed": "Completada",
    "failed": "Fallida",
    "running": "En curso"
  },
  "header": {
    "heading": "Copias de seguridad",
    "subheading": "Protege archivos, bases de datos, correo y configuración del servidor.",
    "btnBackupNow": "Backup ahora"
  },
  "configCard": {
    "title": "Configuración de backups",
    "subtitle": "Directorio local y almacenamiento remoto.",
    "labelLocalDir": "Directorio de backups local",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "Copias locales a conservar por defecto",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "Endpoint",
    "labelBucket": "Bucket",
    "labelAccessKeyId": "ID de clave de acceso",
    "labelSecretAccessKey": "Clave de acceso secreta",
    "btnBrowse": "Examinar",
    "tabLocal": "Local",
    "tabCloud": "Nube"
  },
  "pathBrowserDialog": {
    "title": "Seleccionar carpeta",
    "btnUp": "Subir",
    "btnCancel": "Cancelar",
    "btnSelect": "Usar esta carpeta"
  },
  "backupSources": {
    "title": "Qué respaldar",
    "scopeFull": "Servidor completo (curado)",
    "scopeFullHint": "Bases de datos, correo, configuración del panel y /etc /home /var/www /root",
    "scopeCustom": "Personalizado",
    "labelDatabases": "Bases de datos",
    "dbAll": "Todas",
    "dbPick": "Elegir…",
    "dbChoose": "Elegir bases de datos",
    "dbNone": "Ninguna seleccionada",
    "labelMail": "Correo (vmail + Postfix/Dovecot)",
    "labelPanelConfig": "Configuración del panel",
    "foldersTitle": "Carpetas",
    "addFolder": "Añadir carpeta",
    "noFolders": "Sin carpetas seleccionadas"
  },
  "dbPickerDialog": {
    "title": "Seleccionar bases de datos",
    "loading": "Cargando…",
    "btnCancel": "Cancelar",
    "btnSelect": "Usar selección",
    "btnRetry": "Reintentar",
    "unavailableSelection": "Una base de datos seleccionada ya no está disponible. Revisa la selección."
  },
  "storagesSection": {
    "subtitle": "Destinos en la nube para tus backups (S3 / Cloudflare R2).",
    "tableTitle": "Destinos en la nube",
    "btnNew": "Añadir destino"
  },
  "storageDialog": {
    "titleNew": "Nuevo storage cloud",
    "titleEdit": "Editar storage cloud",
    "labelName": "Nombre",
    "placeholderName": "Mi bucket R2",
    "labelProvider": "Proveedor",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "Bucket",
    "labelPrefix": "Prefijo (carpeta)",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "Endpoint",
    "labelRegion": "Región",
    "labelAccessKey": "ID de clave de acceso",
    "labelSecret": "Clave de acceso secreta",
    "secretKeepHint": "Déjalo vacío para conservar el secreto actual.",
    "btnCancel": "Cancelar",
    "btnSave": "Guardar",
    "usingCentralCred": "Usando la credencial central de Ajustes → Credenciales (solo defines el bucket).",
    "credRequired": "No hay credencial de {provider} configurada. Regístrala en Ajustes → Credenciales para usar este destino.",
    "credRequiredCta": "Ir a Ajustes → Credenciales"
  },
  "progress": {
    "creating": "Creando copia… Esto puede tardar varios minutos."
  },
  "historySection": {
    "title": "Historial de backups",
    "tableTitle": "Copias de seguridad",
    "count": "{count} copias",
    "countPartial": "Mostrando {shown} de {total} copias"
  },
  "schedulesSection": {
    "title": "Programaciones",
    "btnNew": "Nueva",
    "loading": "Cargando...",
    "active": "Activa",
    "paused": "Pausada",
    "copies": "copias",
    "pause": "Pausar",
    "enable": "Activar",
    "edit": "Editar",
    "delete": "Eliminar"
  },
  "backupDialog": {
    "title": "Crear backup manual",
    "labelName": "Nombre",
    "placeholderName": "pre-upgrade",
    "labelStorage": "Destino",
    "optionLocal": "Local",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "Incluir dump de PostgreSQL",
    "sourcesTitle": "Qué respaldar",
    "labelIncludeDatabases": "Bases de datos (MySQL/MariaDB + PostgreSQL)",
    "labelIncludeMail": "Cuentas de correo (buzones + configuración)",
    "labelIncludePanelConfig": "Configuración de LuxiPanel",
    "btnCancel": "Cancelar",
    "btnStart": "Iniciar backup"
  },
  "scheduleDialog": {
    "title": "Programar backup",
    "labelName": "Nombre",
    "placeholderName": "Backup semanal",
    "labelSchedule": "Horario (cron)",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "Almacenamiento",
    "optionLocal": "Local",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "Copias locales a conservar",
    "localRetentionHint": "Se conservarán las copias locales más recientes de esta programación.",
    "cloudRetentionHint": "La retención de S3/R2 se configura en el proveedor de nube.",
    "editTitle": "Editar programación",
    "labelFrequency": "Frecuencia",
    "optHourly": "Cada hora",
    "optDaily": "Diario",
    "optWeekly": "Semanal",
    "optMonthly": "Mensual",
    "labelTime": "Hora",
    "labelWeekday": "Día de la semana",
    "labelMonthday": "Día del mes",
    "cronPreview": "Equivale a",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado"
    ],
    "btnCancel": "Cancelar",
    "btnSave": "Guardar"
  },
  "toasts": {
    "errorSaveSettings": "Error al guardar configuración de backups",
    "preparingDownload": "Preparando descarga…",
    "backupDeleted": "Backup eliminado",
    "recordRemoved": "Registro quitado del historial",
    "backupsDeleted": "Backups eliminados",
    "scheduleDeleted": "Programación eliminada",
    "errorDelete": "Error al eliminar",
    "errorCreateBackup": "Error al crear backup",
    "backupStarted": "Backup iniciado",
    "backupCompleted": "Backup completado",
    "backupStillRunning": "El backup sigue en proceso…",
    "scheduleCreated": "Programación creada",
    "errorCreateSchedule": "Error al crear programación",
    "storageDeleted": "Storage eliminado",
    "storageUpdated": "Storage actualizado",
    "storageCreated": "Storage creado",
    "errorSaveStorage": "Error al guardar storage"
  },
  "errors": {
    "listPathFailed": "No se pudo listar esta ruta (¿permisos?).",
    "listDbFailed": "No se pudieron listar las bases de datos.",
    "downloadFailed": "No se pudo descargar el backup",
    "backupErrorDetail": "Error: {error}"
  },
  "empty": {
    "noSubfolders": "(sin subcarpetas)",
    "noDbEngines": "No se detectaron motores de BD activos.",
    "noDatabases": "(sin bases de datos)",
    "noneSelected": "Ninguna seleccionada",
    "noSchedules": "Sin programaciones"
  },
  "labels": {
    "loading": "Cargando…",
    "fullServer": "servidor completo",
    "editStorage": "Editar storage",
    "newStorage": "Nuevo storage"
  },
  "confirm": {
    "deleteBackup": "¿Eliminar el backup \"{label}\"?",
    "deleteBackupTitle": "Eliminar backup",
    "removeRecord": "¿Quitar «{label}» del historial? El objeto en la nube se conservará.",
    "removeRecordTitle": "Quitar registro",
    "cloudBulkNote": "Los objetos S3/R2 se conservarán.",
    "deleteBulkBackup": "¿Eliminar {count} backup(s) seleccionados?",
    "deleteBulkBackupTitle": "Eliminar backups",
    "deleteSchedule": "¿Eliminar esta programación?",
    "deleteScheduleTitle": "Eliminar programación",
    "deleteStorage": "¿Eliminar el storage \"{name}\"?",
    "deleteStorageTitle": "Eliminar storage"
  },
  "table": {
    "columns": {
      "label": "Nombre",
      "status": "Estado",
      "size": "Tamaño",
      "storage": "Destino",
      "fecha": "Fecha"
    },
    "storagesColumns": {
      "name": "Nombre",
      "provider": "Proveedor",
      "bucket": "Bucket",
      "endpoint": "Endpoint"
    },
    "filters": {
      "searchBackupLabel": "Buscar copia...",
      "filterBackupStorage": "Destino",
      "searchStorageName": "Buscar nombre...",
      "filterStorageProvider": "Proveedor"
    },
    "rowActions": {
      "download": "Descargar",
      "delete": "Eliminar copia",
      "removeRecord": "Quitar del historial",
      "details": "Ver error",
      "refresh": "Actualizar estado"
    },
    "quickActions": {
      "deleteSelected": "Eliminar seleccionados"
    },
    "storagesRowActions": {
      "edit": "Editar",
      "delete": "Eliminar"
    }
  }
} as const;

export default backups;
