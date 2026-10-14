const moduleCatalog = {
  "users": {
    "name": "Utenti",
    "description": "Gestione degli utenti del pannello, ruoli e permessi."
  },
  "mail": {
    "name": "Email",
    "description": "SMTP / IMAP, domini e caselle di posta degli utenti."
  },
  "monitor": {
    "name": "Monitoraggio",
    "description": "Metriche in tempo reale di CPU, RAM, disco e processi."
  },
  "files": {
    "name": "File",
    "description": "Esplora file remoto con editor integrato."
  },
  "firewall": {
    "name": "Firewall",
    "description": "Gestione delle regole UFW e blocco degli IP."
  },
  "bitninja": {
    "name": "BitNinja",
    "description": "Agente di sicurezza completo: WAF, anti-DoS, rilevamento malware e reputazione IP."
  },
  "assistant": {
    "name": "Agenti IA",
    "description": "Assistente con IA per diagnostica e automazione."
  },
  "repository-store": {
    "name": "GitHub",
    "description": "Catalogo di repository e installazione guidata."
  },
  "dns": {
    "name": "Nginx",
    "description": "Gestione di Nginx: siti, reverse proxy, SSL, log e stato."
  },
  "backups": {
    "name": "Backup",
    "description": "Backup programmati con cifratura e destinazioni multiple."
  },
  "cron": {
    "name": "Cron",
    "description": "Attività programmate con editor visuale."
  },
  "databases": {
    "name": "Database",
    "description": "Gestore di database (MySQL/MariaDB e PostgreSQL): esplora schemi e console SQL."
  },
  "obsidian": {
    "name": "Obsidian",
    "description": "Vault di note Obsidian sul tuo server: editor markdown, wikilink e note gestite dagli agenti IA dell'assistente."
  },
  "cloudflare": {
    "name": "Cloudflare",
    "description": "Gestione di Cloudflare per il server: DNS, cache, SSL/TLS, modalità sviluppo e regole di accesso IP."
  },
  "server-alerts": {
    "name": "Notifiche",
    "description": "Notifiche del server per il proprietario del pannello: preferenze degli avvisi, avvisi immediati, programmati/ricorrenti e regole per metriche (CPU/RAM/disco/carico/servizio interrotto), recapitati ai suoi dispositivi tramite LP."
  },
  "expo": {
    "name": "Expo",
    "description": "Gestisci app Expo/React Native: build EAS, invii agli store, aggiornamenti OTA, QR del dev-client e quote, con un access token del cliente."
  },
  "webhooks": {
    "name": "Webhooks",
    "description": "Notifiche HTTP degli eventi del pannello."
  },
  "openclaw": {
    "name": "OpenClaw",
    "description": "Connessione a OpenClaw AI con selettore di modello."
  },
  "hosting": {
    "name": "Hosting",
    "description": "Siti, vhost e deployment assistiti."
  },
  "terminal": {
    "name": "Terminale",
    "description": "Terminale fluttuante accessibile da qualsiasi vista del pannello. Attiva o disattiva il pulsante fluttuante."
  },
  "module-dev": {
    "name": "I miei moduli",
    "description": "Ciclo di vita dei tuoi moduli del marketplace: stato della revisione, invii, test e anteprima privata."
  },
  "filesystem-mcp": {
    "name": "Filesystem MCP",
    "description": "MCP per operazioni sul filesystem."
  },
  "github-mcp": {
    "name": "GitHub MCP",
    "description": "MCP per operazioni sull'API di GitHub."
  },
  "google-drive": {
    "name": "Google Drive",
    "description": "Cerca e allega documenti dal tuo Google Drive dalla chat dell'assistente."
  },
  "onedrive": {
    "name": "OneDrive",
    "description": "Accedi ai file di Microsoft OneDrive / SharePoint dalla chat."
  },
  "dropbox": {
    "name": "Dropbox",
    "description": "Cerca e allega file da Dropbox dalla chat."
  },
  "notion": {
    "name": "Notion",
    "description": "Consulta pagine e database di Notion dalla chat."
  }
} as const;

export default moduleCatalog;
