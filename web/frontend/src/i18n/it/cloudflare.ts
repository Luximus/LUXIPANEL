const cloudflare = {
  "options": {
    "essentiallyOff": "Praticamente disattivato",
    "low": "Basso",
    "medium": "Medio",
    "high": "Alto"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "Gestisci DNS, cache, SSL/TLS e sicurezza delle tue zone Cloudflare per questo server."
  },
  "config": {
    "title": "Connessione con Cloudflare",
    "tokenLabel": "API Token",
    "tokenPlaceholder": "Token API di Cloudflare",
    "tokenHint": "Crea un token su dash.cloudflare.com → My Profile → API Tokens con permessi di zona: DNS, Cache Purge, Zone Settings e Firewall Services.",
    "save": "Salva",
    "test": "Prova connessione",
    "clear": "Rimuovi token",
    "tokenSet": "Token configurato",
    "tokenMissing": "Configura un API Token per iniziare",
    "saved": "Token salvato",
    "cleared": "Token rimosso",
    "confirmClear": "Rimuovere il token di Cloudflare?",
    "confirmClearBtn": "Rimuovi"
  },
  "zones": {
    "title": "Zona",
    "select": "Seleziona una zona",
    "empty": "Nessuna zona visibile con questo token.",
    "status": "Stato",
    "plan": "Piano",
    "nameServers": "Name server",
    "domainNotFound": "Il dominio {domain} non appartiene a nessuna zona del token"
  },
  "runtime": {
    "active": "Attiva",
    "pending": "In attesa",
    "initializing": "Inizializzazione",
    "moved": "Spostata",
    "paused": "in pausa",
    "pausedHint": "Zona in pausa: controlla la configurazione prima di modificare il DNS.",
    "inactiveHint": "Zona {status}: controlla i server dei nomi presso il registrar.",
    "activeHint": "Zona attiva · {count} server dei nomi configurati."
  },
  "tabs": {
    "dns": "DNS",
    "cache": "Cache",
    "security": "SSL / Sicurezza",
    "access": "Regole di accesso",
    "config": "Configurazione"
  },
  "dns": {
    "title": "Record DNS",
    "add": "Aggiungi record",
    "type": "Tipo",
    "name": "Nome",
    "content": "Contenuto",
    "ttl": "TTL",
    "proxied": "Proxy",
    "pointsToServer": "Punta a questo server",
    "edit": "Modifica",
    "delete": "Elimina",
    "confirmDelete": "Eliminare il record {name}?",
    "saved": "Record salvato",
    "deleted": "Record eliminato",
    "useServerIp": "Usa IP del server",
    "priority": "Priorità",
    "confirmDeleteTitle": "Elimina record",
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
    "purgeAll": "Svuota tutto",
    "purgeAllHint": "Rimuove tutto il contenuto in cache della zona su Cloudflare.",
    "confirmPurgeAll": "Svuotare TUTTA la cache della zona?",
    "purgeUrls": "Svuota URL",
    "purgeUrlsPlaceholder": "https://ejemplo.com/estilos.css (un URL per riga)",
    "purged": "Cache svuotata",
    "devMode": "Modalità sviluppo",
    "devModeHint": "Disattiva temporaneamente la cache di Cloudflare (si disattiva da sola dopo 3 ore).",
    "confirmPurgeTitle": "Svuota cache",
    "confirmPurgeBtn": "Svuota"
  },
  "security": {
    "title": "SSL / Sicurezza",
    "sslMode": "Modalità SSL/TLS",
    "alwaysHttps": "Sempre HTTPS",
    "securityLevel": "Livello di sicurezza",
    "underAttack": "Modalità sotto attacco",
    "updated": "Impostazione aggiornata",
    "sslOff": "Disattivato",
    "sslFlexible": "Flessibile",
    "sslFull": "Completo",
    "sslFullStrict": "Completo (rigoroso)"
  },
  "access": {
    "title": "Regole di accesso IP",
    "add": "Aggiungi regola",
    "mode": "Azione",
    "block": "Blocca",
    "allow": "Consenti",
    "challenge": "Challenge",
    "ip": "IP / intervallo",
    "notes": "Note",
    "empty": "Nessuna regola di accesso in questa zona.",
    "confirmDelete": "Eliminare la regola per {ip}?",
    "created": "Regola creata",
    "deleted": "Regola eliminata",
    "ipHeader": "IP",
    "confirmDeleteTitle": "Elimina regola"
  },
  "common": {
    "loading": "Caricamento...",
    "error": "Errore",
    "save": "Salva",
    "cancel": "Annulla",
    "delete": "Elimina",
    "refresh": "Aggiorna",
    "serverIp": "IP del server",
    "noToken": "Configura l'API Token di Cloudflare nella scheda Configurazione."
  },
  "settingsUi": {
    "title": "Impostazioni Cloudflare",
    "description": "Preferenze delle tabelle del modulo Cloudflare.",
    "access": "Accesso",
    "credentialsConnections": "Credenziali e connessioni",
    "cloudflareToken": "Token Cloudflare",
    "serverFirewall": "Firewall del server",
    "dnsWebhooks": "Eventi DNS in Webhooks"
  }
} as const;

export default cloudflare;
