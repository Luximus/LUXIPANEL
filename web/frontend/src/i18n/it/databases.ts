const databases = {
  "pageTitle": "Database",
  "header": {
    "heading": "Gestore di database",
    "subheading": "Esplora e interroga i database del server (MySQL/MariaDB, PostgreSQL)."
  },
  "databases": {
    "title": "Database"
  },
  "tables": {
    "title": "Tabelle"
  },
  "tabs": {
    "rows": "Righe",
    "structure": "Struttura",
    "console": "Console SQL"
  },
  "rows": {
    "prev": "Precedente",
    "next": "Successivo"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "Esegui",
    "allowWrite": "Consenti scrittura",
    "hint": "Ctrl/⌘ + Enter per eseguire. Le istruzioni di scrittura/DDL richiedono di selezionare \"Consenti scrittura\"."
  },
  "common": {
    "selectEngine": "Seleziona un motore.",
    "selectDb": "Seleziona un database.",
    "selectTable": "Seleziona una tabella."
  },
  "actions": {
    "export": "Esporta",
    "addRecord": "Inserisci record",
    "cancel": "Annulla",
    "save": "Salva",
    "edit": "Modifica",
    "downloadSql": "Scarica SQL",
    "install": "Installa {label}"
  },
  "titles": {
    "record": "Record",
    "exportDb": "Esporta database",
    "editRecord": "Modifica record · {table}",
    "newRecord": "Nuovo record · {table}"
  },
  "labels": {
    "tablesLabel": "Tabelle",
    "allTables": "Tutte",
    "includeData": "Includi dati",
    "active": "Attivo",
    "actions": "Azioni",
    "colName": "Colonna",
    "colType": "Tipo",
    "colNullable": "Nullo",
    "colKey": "Chiave",
    "colDefault": "Predefinito",
    "yes": "Sì",
    "no": "No",
    "primaryKey": "Chiave primaria",
    "tbl": "tbl"
  },
  "install": {
    "title": "Installa motore database",
    "description": "Installa MariaDB o PostgreSQL sul server connesso per iniziare a gestire database.",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "Nessun risultato.",
    "noEngines": "Nessun motore database attivo sul server. Installa uno per iniziare.",
    "noDatabases": "Nessun database.",
    "noTables": "Nessuna tabella."
  },
  "errors": {
    "detectEngines": "Errore nel rilevamento motori",
    "loadRows": "Errore nel caricamento righe",
    "saveRecord": "Impossibile salvare il record",
    "deleteRecord": "Impossibile eliminare il record",
    "networkError": "Errore di rete",
    "runQuery": "Errore nell'esecuzione della query"
  },
  "loading": {
    "generic": "Caricamento…",
    "rows": "Caricamento righe…",
    "structure": "Caricamento struttura…",
    "tablesExport": "Caricamento tabelle…",
    "running": "Esecuzione…"
  },
  "toasts": {
    "engineInstalled": "{label} installato",
    "noColumnsMetadata": "Nessun metadato colonne per questa tabella",
    "recordUpdated": "Record aggiornato",
    "recordCreated": "Record creato",
    "recordDeleted": "Record eliminato",
    "noTableSelect": "Seleziona almeno una tabella",
    "exportDownloaded": "Esportazione scaricata",
    "selectEngineFirst": "Seleziona un motore per primo",
    "statementExecuted": "Istruzione eseguita"
  },
  "confirm": {
    "deleteRecord": "Eliminare questo record? Questa azione non può essere annullata.",
    "deleteTitle": "Elimina record",
    "deleteConfirmText": "Elimina"
  },
  "info": {
    "installing": "Installazione di {label}… potrebbe richiedere alcuni minuti.",
    "installed": "{label} installato. Rilevamento del motore…",
    "pager": "Righe {from}–{to} (pagina di {limit})",
    "statementExecuted": "Istruzione eseguita",
    "rowCount": "{count} riga(s)",
    "truncated": "· risultato troncato a {count} righe"
  },
  "runtime": {
    "createPromptWithPrefix": "Il nome deve iniziare con {prefix} e rispettare la quota.",
    "createPrompt": "Nome del nuovo database sul server attivo.",
    "invalidPrefix": "Il nome deve iniziare con {prefix}",
    "createError": "Impossibile creare il database.",
    "created": "Database creato."
  },
  "settings": {
    "title": "Impostazioni dei database",
    "description": "Preferenze del modulo database.",
    "table": "Tabella",
    "pagination": "Paginazione",
    "rowsPerPage": "Righe per pagina nei risultati di Struttura e Console.",
    "serverPagination": "La tabella Record usa la paginazione lato server e non può essere modificata qui.",
    "relatedModules": "Moduli correlati",
    "hostingQuotas": "Hosting e quote",
    "databaseBackups": "Backup dei database",
    "sqlFiles": "File SQL",
    "allowWriteDefault": "Consenti la scrittura per impostazione predefinita all’apertura della console",
    "allowWriteHelp": "Si applica al caricamento del modulo; puoi cambiarla nella console in qualsiasi momento.",
    "createDatabase": "Crea database",
    "create": "Crea"
  }
} as const;

export default databases;
