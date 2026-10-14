const moduleCatalog = {
  "users": {
    "name": "Benutzer",
    "description": "Verwaltung von Panel-Benutzern, Rollen und Berechtigungen."
  },
  "mail": {
    "name": "Mail",
    "description": "SMTP / IMAP, Domains und Benutzerpostfächer."
  },
  "monitor": {
    "name": "Überwachung",
    "description": "Live-Metriken zu CPU, RAM, Festplatte und Prozessen."
  },
  "files": {
    "name": "Dateien",
    "description": "Remote-Dateiexplorer mit integriertem Editor."
  },
  "firewall": {
    "name": "Firewall",
    "description": "Verwaltung von UFW-Regeln und IP-Sperren."
  },
  "bitninja": {
    "name": "BitNinja",
    "description": "Umfassender Sicherheitsagent: WAF, anti-DoS, Malware-Erkennung und IP-Reputation."
  },
  "assistant": {
    "name": "KI-Agenten",
    "description": "KI-Assistent für Diagnose und Automatisierung."
  },
  "repository-store": {
    "name": "GitHub",
    "description": "Repository-Katalog und geführte Installation."
  },
  "dns": {
    "name": "Nginx",
    "description": "Verwaltung von Nginx: Sites, Reverse-Proxy, SSL, Logs und Status."
  },
  "backups": {
    "name": "Sicherungen",
    "description": "Geplante Backups mit Verschlüsselung und mehreren Zielen."
  },
  "cron": {
    "name": "Cron",
    "description": "Geplante Aufgaben mit visuellem Editor."
  },
  "databases": {
    "name": "Datenbanken",
    "description": "Datenbankverwaltung (MySQL/MariaDB und PostgreSQL): Schemas durchsuchen und SQL-Konsole."
  },
  "obsidian": {
    "name": "Obsidian",
    "description": "Obsidian-Notiz-Vaults auf deinem Server: Markdown-Editor, Wikilinks und Notizen, die von den KI-Agenten des Assistenten bearbeitet werden."
  },
  "cloudflare": {
    "name": "Cloudflare",
    "description": "Cloudflare-Verwaltung für den Server: DNS, Cache, SSL/TLS, Entwicklungsmodus und IP-Zugriffsregeln."
  },
  "server-alerts": {
    "name": "Benachrichtigungen",
    "description": "Server-Benachrichtigungen für den Panel-Inhaber: Alarmeinstellungen, sofortige und geplante/wiederkehrende Hinweise sowie Regeln nach Metriken (CPU/RAM/Festplatte/Auslastung/ausgefallener Dienst), zugestellt an seine Geräte über LP."
  },
  "expo": {
    "name": "Expo",
    "description": "Verwalte Expo/React-Native-Apps: EAS-Builds, Store-Einreichungen, OTA-Updates, Dev-Client-QR und Kontingente mit einem Access-Token des Kunden."
  },
  "webhooks": {
    "name": "Webhooks",
    "description": "HTTP-Benachrichtigungen über Panel-Ereignisse."
  },
  "openclaw": {
    "name": "OpenClaw",
    "description": "Verbindung zu OpenClaw AI mit Modellauswahl."
  },
  "hosting": {
    "name": "Hosting",
    "description": "Sites, vHosts und assistierte Bereitstellungen."
  },
  "terminal": {
    "name": "Terminal",
    "description": "Schwebendes Terminal, erreichbar aus jeder Panel-Ansicht. Aktiviert oder deaktiviert die schwebende Schaltfläche."
  },
  "module-dev": {
    "name": "Meine Module",
    "description": "Lebenszyklus deiner Marketplace-Module: Prüfstatus, Einreichungen, Tests und private Vorschau."
  },
  "filesystem-mcp": {
    "name": "Filesystem MCP",
    "description": "MCP für Dateisystemoperationen."
  },
  "github-mcp": {
    "name": "GitHub MCP",
    "description": "MCP für Operationen gegen die GitHub-API."
  },
  "google-drive": {
    "name": "Google Drive",
    "description": "Suche und hänge Dokumente aus deinem Google Drive direkt aus dem Assistenten-Chat an."
  },
  "onedrive": {
    "name": "OneDrive",
    "description": "Greife aus dem Chat auf Dateien in Microsoft OneDrive / SharePoint zu."
  },
  "dropbox": {
    "name": "Dropbox",
    "description": "Suche und hänge Dropbox-Dateien direkt aus dem Chat an."
  },
  "notion": {
    "name": "Notion",
    "description": "Rufe Notion-Seiten und -Datenbanken direkt aus dem Chat ab."
  }
} as const;

export default moduleCatalog;
