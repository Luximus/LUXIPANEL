const components = {
  "setupWizardFooter": {
    "rights": "Alle Rechte vorbehalten.",
    "madeBy": "Erstellt von LUXISOFT",
    "termsAndConditions": "Allgemeine Geschäftsbedingungen",
    "privacyPolicy": "Datenschutzrichtlinie",
    "documentation": "Dokumentation",
    "refundPolicy": "Rückerstattungsrichtlinie"
  },
  "dataTable": {
    "boolTrue": "Ja",
    "boolFalse": "Nein",
    "selectPage": "Seite auswählen",
    "selectRow": "Zeile auswählen",
    "actions": "Aktionen",
    "configure": "Tabelle konfigurieren",
    "empty": "Keine Ergebnisse für {title}.",
    "total": "Gesamt",
    "selectedSummary": "{selected} ausgewählt • {shown} von {pageSize} Ergebnissen angezeigt, Ergebnisse insgesamt: {total}",
    "summary": "{shown} von {pageSize} Ergebnissen angezeigt, Ergebnisse insgesamt: {total}",
    "prev": "Zurück",
    "next": "Weiter",
    "pageOf": "Seite {currentPage} von {totalPages}",
    "configureTitle": "Tabelle konfigurieren",
    "columnsAndOrder": "Sichtbare Spalten und Reihenfolge",
    "resultsPerPage": "Ergebnisse pro Seite",
    "moveUp": "{col} nach oben verschieben",
    "moveDown": "{col} nach unten verschieben",
    "defaultTitle": "Tabelle",
    "dragHandle": "Ziehen zum Neuordnen",
    "moveUpAria": "{col} nach oben",
    "moveDownAria": "{col} nach unten",
    "emptyCell": "-"
  },
  "confirmModal": {
    "title": "Bestätigen",
    "cancel": "Abbrechen",
    "confirm": "Bestätigen",
    "alertTitle": "Hinweis",
    "alertOk": "Verstanden",
    "promptTitle": "Wert eingeben",
    "promptCancel": "Abbrechen",
    "promptOk": "OK"
  },
  "modalNavbar": {
    "back": "Zurück",
    "close": "Schließen"
  },
  "viewSettingsModal": {
    "buttonLabel": "Einstellungen",
    "description": "Einstellungen speziell für dieses Modul",
    "close": "Schließen"
  },
  "floatingTerminal": {
    "newSnippet": "Neues Snippet",
    "close": "Schließen",
    "name": "Name",
    "namePlaceholder": "z. B. Postfix neu starten",
    "category": "Kategorie",
    "tags": "Tags",
    "tagsHelp": "Die Tags hängen von der ausgewählten Kategorie ab",
    "command": "Befehl",
    "monacoHelp": "Monaco für Shell-Syntax. Verwenden Sie Ctrl+Enter, um aus dem Editor zu speichern.",
    "cancel": "Abbrechen",
    "save": "Speichern"
  },
  "installModal": {
    "running": "Installation läuft… kann einige Minuten dauern.",
    "success": "Installation abgeschlossen.",
    "failed": "Installation fehlgeschlagen. Bitte überprüfe das Protokoll."
  },
  "enterPage": {
    "pageTitle": "Mit Code anmelden",
    "heading": "Mit Zugriffscode anmelden",
    "subtitle": "Geben Sie den Code ein, den Sie erhalten haben, um auf das Panel zuzugreifen.",
    "codeLabel": "Zugriffscode",
    "codePlaceholder": "z. B. a1b2c3d4e5f6g7",
    "continue": "Fortfahren",
    "useAnotherCode": "Anderen Code verwenden",
    "codeShort": "Code",
    "terminalAi": "Terminal / KI",
    "enter": "Eingeben",
    "willBeRedirected": "Sie werden zur Anmeldung des Panels weitergeleitet.",
    "featuresAvailable": "Verfügbar",
    "featuresUnavailable": "Nicht verfügbar",
    "invalidCode": "Zugriffscode ungültig.",
    "verifyError": "Der Code konnte nicht überprüft werden. Versuchen Sie es erneut.",
    "networkError": "Netzwerkfehler. Versuchen Sie es erneut.",
    "guestSessionError": "Gastsitzung konnte nicht gestartet werden."
  },
  "dragHandle": "Ziehen zum Neuordnen",
  "logoAlt": "LUXIPANEL",
  "default": " (Standard)",
  "emptyCell": "-",
  "loginEffects": {
    "defaultSuffix": " (Standard)",
    "webGpuHint": "Benötigt WebGPU. Ohne Unterstützung erscheint der Standardhintergrund."
  },
  "tableSettings": {
    "pagination": "Seitennummerierung",
    "rowsPerPage": "Zeilen pro Seite in dieser Tabelle.",
    "visibleActions": "Angezeigte Aktionen",
    "actionsHint": "Wählen Sie die Aktionen im Menü «···» jeder Zeile aus."
  }
} as const;

export default components;
