const databases = {
  "pageTitle": "Bases de datos",
  "header": {
    "heading": "Gestor de bases de datos",
    "subheading": "Explora y consulta las bases de datos del servidor (MySQL/MariaDB, PostgreSQL)."
  },
  "databases": {
    "title": "Bases de datos"
  },
  "tables": {
    "title": "Tablas"
  },
  "tabs": {
    "rows": "Filas",
    "structure": "Estructura",
    "console": "Consola SQL"
  },
  "rows": {
    "prev": "Anterior",
    "next": "Siguiente"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "Ejecutar",
    "allowWrite": "Permitir escritura",
    "hint": "Ctrl/⌘ + Enter para ejecutar. Las sentencias de escritura/DDL requieren marcar “Permitir escritura”."
  },
  "common": {
    "selectEngine": "Selecciona un motor.",
    "selectDb": "Selecciona una base de datos.",
    "selectTable": "Selecciona una tabla."
  },
  "actions": {
    "export": "Exportar",
    "addRecord": "Insertar registro",
    "cancel": "Cancelar",
    "save": "Guardar",
    "edit": "Editar",
    "downloadSql": "Descargar SQL",
    "install": "Instalar {label}"
  },
  "titles": {
    "record": "Registro",
    "exportDb": "Exportar base de datos",
    "editRecord": "Editar registro · {table}",
    "newRecord": "Nuevo registro · {table}"
  },
  "labels": {
    "tablesLabel": "Tablas",
    "allTables": "Todas",
    "includeData": "Incluir datos",
    "active": "Activo",
    "actions": "Acciones",
    "colName": "Columna",
    "colType": "Tipo",
    "colNullable": "Nulo",
    "colKey": "Clave",
    "colDefault": "Por defecto",
    "yes": "Sí",
    "no": "No",
    "primaryKey": "Clave primaria",
    "tbl": "tbl"
  },
  "install": {
    "title": "Instalar motor de base de datos",
    "description": "Instala MariaDB o PostgreSQL en el servidor conectado para empezar a gestionar bases de datos.",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "Sin resultados.",
    "noEngines": "No hay ningún motor de base de datos activo en el servidor. Instala uno para empezar.",
    "noDatabases": "Sin bases de datos.",
    "noTables": "Sin tablas."
  },
  "errors": {
    "detectEngines": "Error al detectar motores",
    "loadRows": "Error al cargar filas",
    "saveRecord": "No se pudo guardar el registro",
    "deleteRecord": "No se pudo eliminar el registro",
    "networkError": "Error de red",
    "runQuery": "Error al ejecutar la consulta"
  },
  "loading": {
    "generic": "Cargando…",
    "rows": "Cargando filas…",
    "structure": "Cargando estructura…",
    "tablesExport": "Cargando tablas…",
    "running": "Ejecutando…"
  },
  "toasts": {
    "engineInstalled": "{label} instalado",
    "noColumnsMetadata": "No hay metadatos de columnas para esta tabla",
    "recordUpdated": "Registro actualizado",
    "recordCreated": "Registro creado",
    "recordDeleted": "Registro eliminado",
    "noTableSelect": "Selecciona al menos una tabla",
    "exportDownloaded": "Exportación descargada",
    "selectEngineFirst": "Selecciona un motor primero",
    "statementExecuted": "Sentencia ejecutada"
  },
  "confirm": {
    "deleteRecord": "¿Eliminar este registro? Esta acción no se puede deshacer.",
    "deleteTitle": "Eliminar registro",
    "deleteConfirmText": "Eliminar"
  },
  "info": {
    "installing": "Instalando {label}… puede tardar unos minutos.",
    "installed": "{label} instalado. Detectando el motor…",
    "pager": "Filas {from}–{to} (página de {limit})",
    "statementExecuted": "Sentencia ejecutada",
    "rowCount": "{count} fila(s)",
    "truncated": "· resultado truncado a {count} filas"
  },
  "runtime": {
    "createPromptWithPrefix": "El nombre debe empezar por {prefix} y respetar tu cupo.",
    "createPrompt": "Nombre de la nueva base de datos en el servidor activo.",
    "invalidPrefix": "El nombre debe empezar por {prefix}",
    "createError": "No se pudo crear la base de datos.",
    "created": "Base de datos creada."
  },
  "settings": {
    "title": "Configuración de bases de datos",
    "description": "Preferencias del módulo de bases de datos.",
    "table": "Tabla",
    "pagination": "Paginación",
    "rowsPerPage": "Filas por página en los resultados de Estructura y Consola.",
    "serverPagination": "La tabla de Registros usa paginación del servidor y no se ajusta aquí.",
    "relatedModules": "Módulos relacionados",
    "hostingQuotas": "Hosting y cupos",
    "databaseBackups": "Copias de bases de datos",
    "sqlFiles": "Archivos SQL",
    "allowWriteDefault": "Permitir escritura por defecto al abrir la consola",
    "allowWriteHelp": "Se aplica al cargar el módulo; puedes cambiarlo en la consola cuando quieras.",
    "createDatabase": "Crear base de datos",
    "create": "Crear"
  }
} as const;

export default databases;
