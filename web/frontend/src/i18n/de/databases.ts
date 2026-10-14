const databases = {
  "pageTitle": "Datenbanken",
  "header": {
    "heading": "Datenbank-Manager",
    "subheading": "Datenbanken des Servers erkunden und abfragen (MySQL/MariaDB, PostgreSQL)."
  },
  "databases": {
    "title": "Datenbanken"
  },
  "tables": {
    "title": "Tabellen"
  },
  "tabs": {
    "rows": "Zeilen",
    "structure": "Struktur",
    "console": "SQL-Konsole"
  },
  "rows": {
    "prev": "Zurück",
    "next": "Weiter"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "Ausführen",
    "allowWrite": "Schreibzugriff erlauben",
    "hint": "Ctrl/⌘ + Enter zum Ausführen. Schreib-/DDL-Anweisungen erfordern das Aktivieren von \"Schreibzugriff erlauben\"."
  },
  "common": {
    "selectEngine": "Motor auswählen.",
    "selectDb": "Datenbank auswählen.",
    "selectTable": "Tabelle auswählen."
  },
  "actions": {
    "export": "Exportieren",
    "addRecord": "Datensatz einfügen",
    "cancel": "Abbrechen",
    "save": "Speichern",
    "edit": "Bearbeiten",
    "downloadSql": "SQL herunterladen",
    "install": "Installiere {label}"
  },
  "titles": {
    "record": "Datensatz",
    "exportDb": "Datenbank exportieren",
    "editRecord": "Datensatz bearbeiten · {table}",
    "newRecord": "Neuer Datensatz · {table}"
  },
  "labels": {
    "tablesLabel": "Tabellen",
    "allTables": "Alle",
    "includeData": "Daten einschließen",
    "active": "Aktiv",
    "actions": "Aktionen",
    "colName": "Spalte",
    "colType": "Typ",
    "colNullable": "Null",
    "colKey": "Schlüssel",
    "colDefault": "Standard",
    "yes": "Ja",
    "no": "Nein",
    "primaryKey": "Primärschlüssel",
    "tbl": "Tbl"
  },
  "install": {
    "title": "Datenbankmodul installieren",
    "description": "Installiere MariaDB oder PostgreSQL auf dem verbundenen Server, um mit der Verwaltung von Datenbanken zu beginnen.",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "Keine Ergebnisse.",
    "noEngines": "Kein Datenbankmodul auf dem Server aktiv. Installiere eines zum Starten.",
    "noDatabases": "Keine Datenbanken.",
    "noTables": "Keine Tabellen."
  },
  "errors": {
    "detectEngines": "Fehler beim Erkennen von Modulen",
    "loadRows": "Fehler beim Laden von Zeilen",
    "saveRecord": "Datensatz konnte nicht gespeichert werden",
    "deleteRecord": "Datensatz konnte nicht gelöscht werden",
    "networkError": "Netzwerkfehler",
    "runQuery": "Fehler beim Ausführen der Abfrage"
  },
  "loading": {
    "generic": "Wird geladen…",
    "rows": "Zeilen werden geladen…",
    "structure": "Struktur wird geladen…",
    "tablesExport": "Tabellen werden geladen…",
    "running": "Wird ausgeführt…"
  },
  "toasts": {
    "engineInstalled": "{label} installiert",
    "noColumnsMetadata": "Keine Spaltenmetadaten für diese Tabelle",
    "recordUpdated": "Datensatz aktualisiert",
    "recordCreated": "Datensatz erstellt",
    "recordDeleted": "Datensatz gelöscht",
    "noTableSelect": "Wähle mindestens eine Tabelle",
    "exportDownloaded": "Export heruntergeladen",
    "selectEngineFirst": "Wähle zuerst ein Modul",
    "statementExecuted": "Anweisung ausgeführt"
  },
  "confirm": {
    "deleteRecord": "Diesen Datensatz löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
    "deleteTitle": "Datensatz löschen",
    "deleteConfirmText": "Löschen"
  },
  "info": {
    "installing": "Installiere {label}… kann einige Minuten dauern.",
    "installed": "{label} installiert. Erkenne das Modul…",
    "pager": "Zeilen {from}–{to} (Seite von {limit})",
    "statementExecuted": "Anweisung ausgeführt",
    "rowCount": "{count} Zeile(n)",
    "truncated": "· Ergebnis auf {count} Zeilen begrenzt"
  },
  "runtime": {
    "createPromptWithPrefix": "Der Name muss mit {prefix} beginnen und innerhalb deines Kontingents bleiben.",
    "createPrompt": "Name der neuen Datenbank auf dem aktiven Server.",
    "invalidPrefix": "Der Name muss mit {prefix} beginnen",
    "createError": "Datenbank konnte nicht erstellt werden.",
    "created": "Datenbank erstellt."
  },
  "settings": {
    "title": "Datenbankeinstellungen",
    "description": "Einstellungen für das Datenbankmodul.",
    "table": "Tabelle",
    "pagination": "Seitennummerierung",
    "rowsPerPage": "Zeilen pro Seite in den Ergebnissen von Struktur und Konsole.",
    "serverPagination": "Die Tabelle Datensätze verwendet serverseitige Seitennummerierung und kann hier nicht angepasst werden.",
    "relatedModules": "Verwandte Module",
    "hostingQuotas": "Hosting und Kontingente",
    "databaseBackups": "Datenbanksicherungen",
    "sqlFiles": "SQL-Dateien",
    "allowWriteDefault": "Schreibzugriff beim Öffnen der Konsole standardmäßig erlauben",
    "allowWriteHelp": "Diese Einstellung gilt beim Laden des Moduls; Sie können sie jederzeit in der Konsole ändern.",
    "createDatabase": "Datenbank erstellen",
    "create": "Erstellen"
  }
} as const;

export default databases;
