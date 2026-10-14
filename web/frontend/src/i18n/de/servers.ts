const servers = {
  "pageTitle": "Server",
  "description": "Lokales Verzeichnis der SSH-Ziele, mit denen sich dieses Panel verbinden kann. Geheimnisse (Schlüssel und Passwörter) werden verschlüsselt gespeichert und hier niemals angezeigt.",
  "btnNew": "Server hinzufügen",
  "table": {
    "name": "Name",
    "host": "Host",
    "username": "Benutzer",
    "authType": "Authentifizierung",
    "status": "Status"
  },
  "authTypes": {
    "key": "SSH-Schlüssel",
    "password": "Passwort"
  },
  "status": {
    "approved": "Freigegeben",
    "pending": "Ausstehend",
    "untested": "Nicht getestet"
  },
  "common": {
    "test": "Testen",
    "edit": "Bearbeiten",
    "delete": "Löschen",
    "cancel": "Abbrechen",
    "save": "Speichern",
    "close": "Schließen",
    "error": "Fehler",
    "yes": "Ja",
    "no": "Nein"
  },
  "dialog": {
    "titleNew": "Server hinzufügen",
    "titleEdit": "Server bearbeiten",
    "name": "Name",
    "namePlaceholder": "Mein Produktionsserver",
    "host": "Host oder IP",
    "hostPlaceholder": "203.0.113.10 oder server.beispiel.de",
    "port": "Port",
    "username": "Benutzer",
    "usernamePlaceholder": "root",
    "authType": "Authentifizierungstyp",
    "secretKey": "Privater SSH-Schlüssel",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "Schlüssel-Passphrase (optional)",
    "passphrasePlaceholder": "Passphrase zum Entsperren des Schlüssels",
    "secretPassword": "Passwort",
    "secretPasswordPlaceholder": "Passwort des SSH-Benutzers",
    "secretKeepHint": "Leer lassen, um das aktuelle Geheimnis beizubehalten.",
    "btnCancel": "Abbrechen",
    "btnSave": "Speichern"
  },
  "fingerprint": {
    "title": "Host-Fingerabdruck freigeben",
    "intro": "Dies ist die erste Verbindung zu diesem Server. Prüfen Sie vor der Freigabe, ob der Fingerabdruck des Host-Schlüssels dem erwarteten entspricht.",
    "approve": "Fingerabdruck freigeben",
    "approving": "Freigabe läuft…",
    "approved": "Fingerabdruck freigegeben",
    "approveError": "Fingerabdruck konnte nicht freigegeben werden"
  },
  "toasts": {
    "created": "Server hinzugefügt",
    "updated": "Server aktualisiert",
    "deleted": "Server gelöscht",
    "testOk": "Verbindung erfolgreich",
    "testFailed": "Verbindung fehlgeschlagen"
  },
  "validation": {
    "nameRequired": "Geben Sie einen Namen ein",
    "hostRequired": "Geben Sie den Host ein",
    "usernameRequired": "Geben Sie den Benutzer ein",
    "secretRequired": "Geben Sie das Authentifizierungsgeheimnis ein"
  },
  "confirmDelete": "Server {name} löschen? Dies kann nicht rückgängig gemacht werden.",
  "confirmDeleteTitle": "Server löschen",
  "testing": "Verbindung wird getestet…"
} as const;

export default servers;
