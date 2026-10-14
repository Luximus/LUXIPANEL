const errors = {
  "networkError": {
    "serverError": "Der Server hat einen Fehler {status} zurückgegeben (der Vorgang hat möglicherweise das Zeitlimit überschritten).",
    "invalidResponse": "Ungültige Antwort vom Server.",
    "connectionFailed": "Verbindung zum Server fehlgeschlagen. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
    "targetScopeChanged": "Der ausgewählte Server hat sich geändert; laden Sie die Ansicht neu.",
    "bridgeSessionRequired": "Wählen Sie einen Server aus oder verbinden Sie ihn erneut."
  },
  "error400": {
    "code": "400",
    "title": "Ungültige Anfrage",
    "description": "Die gesendete Anfrage enthält ungültige Parameter. Überprüfe die Daten und versuche es erneut."
  },
  "error401": {
    "code": "401",
    "title": "Nicht autorisiert",
    "description": "Du musst dich anmelden, um auf diese Ressource zuzugreifen. Bitte melde dich an."
  },
  "error403": {
    "code": "403",
    "title": "Zugriff verweigert",
    "description": "Du hast keine Berechtigung, auf diese Ressource zuzugreifen."
  },
  "error404": {
    "code": "404",
    "title": "Seite nicht gefunden",
    "description": "Der gesuchte Pfad existiert nicht oder wurde verschoben. Überprüfe die URL oder kehre zur Startseite zurück."
  },
  "error500": {
    "code": "500",
    "title": "Interner Serverfehler",
    "description": "Auf unserem Server ist ein Fehler aufgetreten. Wir arbeiten an der Lösung. Versuche es später erneut."
  },
  "error503": {
    "code": "503",
    "title": "Dienst nicht verfügbar",
    "description": "Der Server befindet sich in Wartung oder ist überlastet. Bitte versuche es später erneut."
  },
  "home": "Zur Startseite",
  "back": "Zurück",
  "backToServers": "Zurück zu den Servern"
} as const;

export default errors;
