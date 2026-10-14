const openclaw = {
  "pageTitle": "OpenClaw",
  "header": {
    "subtitle": "Verbindet das Panel mit",
    "subtitleSuffix": "um dessen Modelle und Werkzeuge zu nutzen."
  },
  "statusCard": {
    "title": "Verbindungsstatus",
    "descKeySet": "API-Key konfiguriert. Klicke auf \"Verbindung testen\", um zu prüfen.",
    "descNoKey": "Noch kein API-Key konfiguriert.",
    "btnTest": "Verbindung testen"
  },
  "form": {
    "sectionTitle": "Anmeldedaten und Endpunkt",
    "sectionDesc": "Der API-Schlüssel wird verschlüsselt in der Panel-Datenbank gespeichert.",
    "labelEndpoint": "Endpunkt",
    "placeholderEndpoint": "https://openclaw.ai",
    "hintEndpoint": "Basis-URL der API. Standardmäßig",
    "labelApiKey": "API-Schlüssel",
    "placeholderApiKeySet": "Konfiguriert · {preview}",
    "placeholderApiKeyUnset": "sk-...",
    "ariaToggleKey": "Anzeigen oder ausblenden",
    "btnClearKey": "Löschen",
    "hintApiKey": "Leer lassen, um den aktuellen API-Schlüssel beizubehalten.",
    "labelDefaultModel": "Standardmodell",
    "placeholderDefaultModel": "claw-default",
    "hintDefaultModel": "Bezeichner des Modells, das interne Aufrufe ohne eigene Angabe verwenden.",
    "btnSave": "Änderungen speichern"
  },
  "help": {
    "title": "Wie erhalte ich meinen API-Key?",
    "step1": "Melde dich an bei",
    "step2": "Öffnen Sie Ihre Kontoeinstellungen und erstellen Sie einen neuen API-Schlüssel.",
    "step3": "Füge ihn oben ein und speichere — das Panel zeigt ihn nicht mehr im Klartext."
  }
} as const;

export default openclaw;
