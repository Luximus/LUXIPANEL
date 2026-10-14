const databases = {
  "pageTitle": "Databases",
  "header": {
    "heading": "Database manager",
    "subheading": "Browse and query the server's databases (MySQL/MariaDB, PostgreSQL)."
  },
  "databases": {
    "title": "Databases"
  },
  "tables": {
    "title": "Tables"
  },
  "tabs": {
    "rows": "Rows",
    "structure": "Structure",
    "console": "SQL console"
  },
  "rows": {
    "prev": "Previous",
    "next": "Next"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "Run",
    "allowWrite": "Allow write",
    "hint": "Ctrl/⌘ + Enter to run. Write/DDL statements require enabling “Allow write”."
  },
  "common": {
    "selectEngine": "Select an engine.",
    "selectDb": "Select a database.",
    "selectTable": "Select a table."
  },
  "actions": {
    "export": "Export",
    "addRecord": "Insert record",
    "cancel": "Cancel",
    "save": "Save",
    "edit": "Edit",
    "downloadSql": "Download SQL",
    "install": "Install {label}"
  },
  "titles": {
    "record": "Record",
    "exportDb": "Export database",
    "editRecord": "Edit record · {table}",
    "newRecord": "New record · {table}"
  },
  "labels": {
    "tablesLabel": "Tables",
    "allTables": "All",
    "includeData": "Include data",
    "active": "Active",
    "actions": "Actions",
    "colName": "Column",
    "colType": "Type",
    "colNullable": "Nullable",
    "colKey": "Key",
    "colDefault": "Default",
    "yes": "Yes",
    "no": "No",
    "primaryKey": "Primary key",
    "tbl": "tbl"
  },
  "install": {
    "title": "Install database engine",
    "description": "Install MariaDB or PostgreSQL on the connected server to start managing databases.",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "No results.",
    "noEngines": "No database engine is active on the server. Install one to get started.",
    "noDatabases": "No databases.",
    "noTables": "No tables."
  },
  "errors": {
    "detectEngines": "Error detecting engines",
    "loadRows": "Error loading rows",
    "saveRecord": "Could not save record",
    "deleteRecord": "Could not delete record",
    "networkError": "Network error",
    "runQuery": "Error executing query"
  },
  "loading": {
    "generic": "Loading…",
    "rows": "Loading rows…",
    "structure": "Loading structure…",
    "tablesExport": "Loading tables…",
    "running": "Running…"
  },
  "toasts": {
    "engineInstalled": "{label} installed",
    "noColumnsMetadata": "No column metadata for this table",
    "recordUpdated": "Record updated",
    "recordCreated": "Record created",
    "recordDeleted": "Record deleted",
    "noTableSelect": "Select at least one table",
    "exportDownloaded": "Export downloaded",
    "selectEngineFirst": "Select an engine first",
    "statementExecuted": "Statement executed"
  },
  "confirm": {
    "deleteRecord": "Delete this record? This action cannot be undone.",
    "deleteTitle": "Delete record",
    "deleteConfirmText": "Delete"
  },
  "info": {
    "installing": "Installing {label}… may take a few minutes.",
    "installed": "{label} installed. Detecting engine…",
    "pager": "Rows {from}–{to} (page of {limit})",
    "statementExecuted": "Statement executed",
    "rowCount": "{count} row(s)",
    "truncated": "· result truncated to {count} rows"
  },
  "runtime": {
    "createPromptWithPrefix": "The name must start with {prefix} and stay within your quota.",
    "createPrompt": "Name of the new database on the active server.",
    "invalidPrefix": "The name must start with {prefix}",
    "createError": "Could not create the database.",
    "created": "Database created."
  },
  "settings": {
    "title": "Database settings",
    "description": "Database module preferences.",
    "table": "Table",
    "pagination": "Pagination",
    "rowsPerPage": "Rows per page in Structure and Console results.",
    "serverPagination": "The Records table uses server-side pagination and cannot be adjusted here.",
    "relatedModules": "Related modules",
    "hostingQuotas": "Hosting and quotas",
    "databaseBackups": "Database backups",
    "sqlFiles": "SQL files",
    "allowWriteDefault": "Allow writes by default when opening the console",
    "allowWriteHelp": "Applied when the module loads; you can change it in the console at any time.",
    "createDatabase": "Create database",
    "create": "Create"
  }
} as const;

export default databases;
