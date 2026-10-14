const cloudflare = {
  "options": {
    "essentiallyOff": "Im Wesentlichen aus",
    "low": "Niedrig",
    "medium": "Mittel",
    "high": "Hoch"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "Verwalte DNS, Cache, SSL/TLS und Sicherheit deiner Cloudflare-Zonen für diesen Server."
  },
  "config": {
    "title": "Verbindung mit Cloudflare",
    "tokenLabel": "API Token",
    "tokenPlaceholder": "Cloudflare API Token",
    "tokenHint": "Erstelle einen Token unter dash.cloudflare.com → My Profile → API Tokens mit Zonen-Berechtigungen: DNS, Cache Purge, Zone Settings und Firewall Services.",
    "save": "Speichern",
    "test": "Verbindung testen",
    "clear": "Token entfernen",
    "tokenSet": "Token konfiguriert",
    "tokenMissing": "Konfiguriere einen API Token, um zu beginnen",
    "saved": "Token gespeichert",
    "cleared": "Token entfernt",
    "confirmClear": "Cloudflare-Token entfernen?",
    "confirmClearBtn": "Entfernen"
  },
  "zones": {
    "title": "Zone",
    "select": "Wähle eine Zone aus",
    "empty": "Mit diesem Token sind keine Zonen sichtbar.",
    "status": "Status",
    "plan": "Plan",
    "nameServers": "Nameserver",
    "domainNotFound": "Die Domain {domain} gehört zu keiner Zone des Tokens"
  },
  "runtime": {
    "active": "Aktiv",
    "pending": "Ausstehend",
    "initializing": "Wird initialisiert",
    "moved": "Verschoben",
    "paused": "pausiert",
    "pausedHint": "Pausierte Zone: Prüfe die Konfiguration, bevor du DNS änderst.",
    "inactiveHint": "Zone {status}: Prüfe die Nameserver beim Registrar.",
    "activeHint": "Aktive Zone · {count} Nameserver konfiguriert."
  },
  "tabs": {
    "dns": "DNS",
    "cache": "Cache",
    "security": "SSL / Sicherheit",
    "access": "Zugriffsregeln",
    "config": "Einstellungen"
  },
  "dns": {
    "title": "DNS-Einträge",
    "add": "Eintrag hinzufügen",
    "type": "Typ",
    "name": "Name",
    "content": "Inhalt",
    "ttl": "TTL",
    "proxied": "Proxy",
    "pointsToServer": "Zeigt auf diesen Server",
    "edit": "Bearbeiten",
    "delete": "Löschen",
    "confirmDelete": "Eintrag {name} löschen?",
    "saved": "Eintrag gespeichert",
    "deleted": "Eintrag gelöscht",
    "useServerIp": "Server-IP verwenden",
    "priority": "Priorität",
    "confirmDeleteTitle": "Datensatz löschen",
    "typeA": "A",
    "typeAAAA": "AAAA",
    "typeCNAME": "CNAME",
    "typeTXT": "TXT",
    "typeMX": "MX",
    "typeNS": "NS",
    "ttlAuto": "Auto",
    "ttl60": "60",
    "ttl300": "300",
    "ttl1800": "1800",
    "ttl3600": "3600",
    "ttl86400": "86400"
  },
  "cache": {
    "title": "Cache",
    "purgeAll": "Alles bereinigen",
    "purgeAllHint": "Entfernt alle zwischengespeicherten Inhalte der Zone bei Cloudflare.",
    "confirmPurgeAll": "Den GESAMTEN Cache der Zone bereinigen?",
    "purgeUrls": "URLs bereinigen",
    "purgeUrlsPlaceholder": "https://ejemplo.com/estilos.css (eine URL pro Zeile)",
    "purged": "Cache bereinigt",
    "devMode": "Entwicklungsmodus",
    "devModeHint": "Deaktiviert vorübergehend den Cloudflare-Cache (schaltet sich nach 3 Stunden automatisch aus).",
    "confirmPurgeTitle": "Cache leeren",
    "confirmPurgeBtn": "Leeren"
  },
  "security": {
    "title": "SSL / Sicherheit",
    "sslMode": "SSL/TLS-Modus",
    "alwaysHttps": "Immer HTTPS verwenden",
    "securityLevel": "Sicherheitsstufe",
    "underAttack": "Under-Attack-Modus",
    "updated": "Einstellung aktualisiert",
    "sslOff": "Aus",
    "sslFlexible": "Flexibel",
    "sslFull": "Vollständig",
    "sslFullStrict": "Vollständig (streng)"
  },
  "access": {
    "title": "IP-Zugriffsregeln",
    "add": "Regel hinzufügen",
    "mode": "Aktion",
    "block": "Blockieren",
    "allow": "Zulassen",
    "challenge": "Challenge",
    "ip": "IP / Bereich",
    "notes": "Notizen",
    "empty": "Keine Zugriffsregeln in dieser Zone.",
    "confirmDelete": "Regel für {ip} löschen?",
    "created": "Regel erstellt",
    "deleted": "Regel gelöscht",
    "ipHeader": "IP",
    "confirmDeleteTitle": "Regel löschen"
  },
  "common": {
    "loading": "Wird geladen...",
    "error": "Fehler",
    "save": "Speichern",
    "cancel": "Abbrechen",
    "delete": "Löschen",
    "refresh": "Aktualisieren",
    "serverIp": "Server-IP",
    "noToken": "Konfiguriere den Cloudflare API Token im Tab Einstellungen."
  },
  "settingsUi": {
    "title": "Cloudflare-Einstellungen",
    "description": "Tabelleneinstellungen für das Cloudflare-Modul.",
    "access": "Zugriff",
    "credentialsConnections": "Zugangsdaten und Verbindungen",
    "cloudflareToken": "Cloudflare-Token",
    "serverFirewall": "Server-Firewall",
    "dnsWebhooks": "DNS-Ereignisse in Webhooks"
  }
} as const;

export default cloudflare;
