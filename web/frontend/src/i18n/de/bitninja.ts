const bitninja = {
  "header": {
    "description": "Umfassender Sicherheitsagent (WAF, Anti-DoS, Malware-Erkennung und IP-Reputation) auf dem verbundenen Server.",
    "statusChecking": "wird geprüft…"
  },
  "sudo": {
    "label": "Sudo-Passwort (Passphrase deiner Sitzung)",
    "placeholder": "Nur wenn der Server es für sudo anfordert",
    "hint": "Wird nur für diese Aktion verwendet und niemals im Browser gespeichert."
  },
  "installCard": {
    "title": "BitNinja ist nicht installiert",
    "description": "Gib den Lizenzschlüssel deines BitNinja-Kontos ein, um den Agenten auf diesem Server zu installieren. Das offizielle Installationsprogramm (get.bitninja.io) wird heruntergeladen und mit sudo ausgeführt.",
    "licensePlaceholder": "Lizenzschlüssel (z.B.: ab12cd34-…)",
    "installButton": "BitNinja installieren"
  },
  "stats": {
    "service": "Service",
    "license": "Lizenz",
    "version": "Version"
  },
  "serviceControl": {
    "title": "Service-Kontrolle",
    "start": "Starten",
    "restart": "Neustarten",
    "stop": "Stoppen"
  },
  "components": {
    "title": "Schutzkomponenten",
    "checking": "wird geprüft…",
    "noReported": "Der Agent hat keine Komponenten gemeldet.",
    "active": "Aktiv",
    "inactive": "Inaktiv"
  },
  "updateLicense": {
    "title": "Lizenzschlüssel aktualisieren",
    "placeholder": "Neuer Lizenzschlüssel",
    "applyButton": "Anwenden"
  },
  "toasts": {
    "sudoRequired": "Geben Sie Ihr sudo-Passwort ein und versuchen Sie es erneut.",
    "sudoInvalid": "Ungültiges sudo-Passwort.",
    "actionFailed": "Aktion fehlgeschlagen. Überprüfen Sie die Ausgabe.",
    "installing": "BitNinja wird installiert… kann einige Minuten dauern.",
    "installed": "BitNinja installiert.",
    "serviceAction": "Dienst: {action} OK.",
    "componentToggleEnabled": "{component}: aktiviert.",
    "componentToggleDisabled": "{component}: deaktiviert.",
    "licenseApplied": "Lizenzschlüssel angewendet."
  },
  "errors": {
    "unknown": "Unbekannter Fehler"
  },
  "status": {
    "notInstalled": "Nicht installiert",
    "running": "Aktiv",
    "installedStopped": "Installiert (gestoppt)",
    "serviceRunning": "Läuft",
    "serviceStopped": "Gestoppt",
    "licenseValid": "Gültig",
    "licenseReview": "Überprüfen"
  },
  "validation": {
    "licenseKeyRequired": "Geben Sie den Lizenzschlüssel ein.",
    "newLicenseKeyRequired": "Geben Sie den neuen Lizenzschlüssel ein."
  },
  "settingsUi": {
    "settingsTitle": "BitNinja-Einstellungen",
    "settingsButton": "Einstellungen",
    "settingsDescription": "Diagnoseeinstellungen für den aktiven Server.",
    "settingsSections": "Bereiche der BitNinja-Einstellungen",
    "diagnostics": "Diagnose",
    "related": "Verwandte",
    "logSource": "Das Log wird vom BitNinja-Dienst auf dem ausgewählten Server gelesen.",
    "autoRefresh": "Status alle 30 Sekunden aktualisieren",
    "logLines": "Logzeilen",
    "relatedModules": "Verwandte Module",
    "firewallAudit": "Firewall und Prüfung",
    "credentials": "BitNinja-Zugangsdaten"
  },
  "logsUi": {
    "loading": "Protokoll wird geladen…",
    "empty": "Keine aktuellen Ereignisse.",
    "loadError": "Protokoll konnte nicht geladen werden.",
    "logsTitle": "Letztes Log",
    "logsDescription": "Dienstereignisse auf dem aktiven Server.",
    "refreshLogs": "Log aktualisieren",
    "logsHint": "Wählen Sie „Log aktualisieren“, um die Ereignisse zu laden."
  }
} as const;

export default bitninja;
