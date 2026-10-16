const panelLayout = {
  "community": {
    "branchRefreshed": "Il ramo è cambiato. Le ultime novità sono ora visibili; consultale prima di aggiornare.",
    "updateAssistantActive": "È in corso un’attività dell’assistente. Attendi che termini prima di aggiornare.",
    "updatePublicationPending": "Il pannello sta inviando le modifiche completate. Attendi la conferma e riprova ad aggiornare.",
    "updateContributionReview": "Un’attività interrotta o un contributo bloccato contiene modifiche in sospeso. Controlla Contributi automatici e completa il recupero prima di aggiornare.",
    "updateCheckoutSync": "Il pannello sta sincronizzando le modifiche confermate. Controlla di nuovo gli aggiornamenti tra poco.",
    "localChangesBlocked": "Ci sono modifiche locali ancora da integrare. L’aggiornamento non è stato avviato per conservarle.",
    "branchNotesUnavailable": "Non è ancora disponibile una descrizione pubblica di queste novità.",
    "branchNotesPartial": "Alcune modifiche non hanno ancora note esplicative.",
    "branches": "Ramo",
    "releases": "Versioni pubblicate",
    "branchChanges": "Modifiche del ramo",
    "branchUpdate": "Aggiorna da {branch}",
    "branchCurrent": "Questa revisione è già installata.",
    "branchUnavailable": "Questo ramo non contiene un’installazione completa del pannello.",
    "branchPreview": "I rami possono includere modifiche in sviluppo. L’installazione inizia solo premendo Aggiorna.",
    "colorHelp": "Significato dei colori",
    "releaseColorHelp": "Verde: nuova versione pubblicata di LUXIPANEL.",
    "branchColorHelp": "{branch}: nuove modifiche disponibili.",
    "installedRevision": "Revisione installata",
    "selectedRevision": "Revisione selezionata",
    "noBranchChanges": "Nessuna nuova modifica rispetto al codice locale.",
    "unregisteredRevision": "Codice locale senza revisione installata registrata",
    "branchLoadError": "Impossibile caricare le modifiche di questo ramo.",
    "notesTab": "Note",
    "activityTab": "Attività",
    "contributors": "Collaboratori",
    "contributorsUnavailable": "Impossibile caricare i collaboratori.",
    "translationInsufficientBalance": "Il credito API del fornitore IA non è sufficiente per la traduzione. Viene mostrato il testo originale.",
    "newBadge": "nuovo",
    "updateTo": "Aggiorna a {version}",
    "title": "Comunità e versioni",
    "comments": "Commenti",
    "read": "Segna come letto",
    "empty": "Nessuna novità",
    "notes": "Note di rilascio",
    "update": "Aggiorna",
    "updating": "Aggiornamento…",
    "installed": "Installata",
    "version": "Versione",
    "openGithub": "Apri su GitHub",
    "close": "Chiudi",
    "newVersion": "Nuova versione disponibile",
    "translating": "Traduzione con IA…",
    "showOriginal": "Mostra originale",
    "showTranslation": "Mostra traduzione",
    "translationUnavailable": "La traduzione IA non è disponibile. Viene mostrato il testo originale.",
    "allComments": "Vedi tutti i commenti su GitHub",
    "activity": "Attività della comunità",
    "loading": "Caricamento…",
    "loadError": "Impossibile caricare queste informazioni."
},
  "groups": {
    "main": "Principale",
    "system": "Sistema",
    "admin": "Amministrazione",
    "tools": "Strumenti",
    "modules": "Moduli"
  },
  "nav": {
    "monitor": "Monitoraggio",
    "files": "File",
    "firewall": "Firewall",
    "bitninja": "BitNinja",
    "users": "Utenti",
    "assistant": "Agenti IA",
    "terminal": "Terminale",
    "modules": "Moduli",
    "githubStore": "GitHub",
    "settings": "Impostazioni",
    "mail": "Posta",
    "dns": "NGINX",
    "backups": "Backup",
    "cron": "Cron",
    "databases": "Database",
    "obsidian": "Obsidian",
    "cloudflare": "Cloudflare",
    "serverAlerts": "Notifiche",
    "ssl": "SSL",
    "webhooks": "Webhook",
    "hosting": "Hosting",
    "openclaw": "OpenClaw",
    "preferences": "Le mie preferenze",
    "moduleDev": "Dev moduli",
    "expo": "Expo",
    "codebaseGraph": "Grafo del Codice"
  },
  "actions": {
    "closeSession": "Esci",
    "closingSession": "Disconnessione in corso…",
    "openMenu": "Apri menu",
    "openHistory": "Apri cronologia",
    "openCommandPalette": "Apri tavolozza comandi",
    "search": "Cerca...",
    "settings": "Configurazione",
    "switchTheme": "Cambia tema",
    "notifications": "Notifiche",
    "chat": "Messaggi",
    "navigate": "Naviga",
    "open": "Apri",
    "close": "Chiudi",
    "toggleFilesEditor": "Editor file",
    "noResults": "Nessun risultato per",
    "lightMode": "Passa alla modalità chiara",
    "darkMode": "Passa alla modalità scura"
  },
  "superSearch": {
    "placeholder": "Cerca in LUXIPANEL… (viste, impostazioni, azioni)",
    "triggerLabel": "Cerca in LUXIPANEL",
    "recent": "Recenti",
    "suggestions": "Suggerimenti",
    "aiSuggested": "Suggerito dall’IA",
    "noResults": "Nessun risultato",
    "hint": "Scrivi cosa vuoi fare: «modificare utenti», «creare account email», «modalità scura»…",
    "kinds": {
      "view": "Vista",
      "subview": "Pagina",
      "tab": "Scheda",
      "drawer-section": "Sezione",
      "action": "Azione"
    },
    "groups": {
      "actions": "Azioni",
      "views": "Viste"
    }
  },
  "clock": {
    "serverTimeTitle": "Ora del server"
  },
  "serverSwitcher": {
    "label": "Cambia server",
    "title": "Cambia server",
    "currentOption": "{server} (cambia)",
    "connectingTitle": "Connessione al server in corso...",
    "connectingStatus": "Preparazione nuova sessione di connessione.",
    "changeServer": "Cambia server...",
    "localOption": "Locale (questa macchina)",
    "manageServers": "Gestisci server...",
    "viewServers": "Visualizza server...",
    "noOtherServers": "Nessun altro server attivo",
    "sshKeyFallback": "Chiave {n}",
    "chooseSshKey": "Scegli chiave SSH",
    "chooseSshKeyHelp": "Più di un utente è configurato per questo server. Seleziona con quale connettersi.",
    "cancel": "Annulla",
    "openingConnection": "Apertura connessione sicura al nuovo server...",
    "unknownError": "Errore sconosciuto",
    "switchFailedStatus": "Impossibile cambiare server ({detail}).",
    "switchFailedAlert": "Impossibile stabilire una connessione al nuovo server: {detail}",
    "connectionErrorTitle": "Errore di connessione",
    "returnButton": "Torna indietro",
    "returnTitle": "Torna al server locale"
  },
  "notificationsPanel": {
    "title": "Notifiche",
    "subtitle": "Messaggi di sistema, moduli e IA",
    "markAllTitle": "Segna tutte come lette",
    "filters": {
      "all": "Tutto",
      "system": "Sistema",
      "module": "Moduli",
      "ai": "IA",
      "security": "Sicurezza",
      "user": "Chat"
    },
    "loading": "Caricamento...",
    "clearAll": "Svuota",
    "connecting": "Connessione...",
    "live": "In diretta",
    "retrying": "Nuovo tentativo...",
    "disconnected": "Disconnesso",
    "errorLoad": "Impossibile caricare le notifiche.",
    "empty": "Nessuna notifica.",
    "emptyFiltered": "Nessuna notifica in questo filtro.",
    "dismiss": "Elimina notifica",
    "sources": {
      "system": "Sistema",
      "module": "Modulo",
      "ai": "IA",
      "security": "Sicurezza",
      "user": "Chat"
    },
    "severity": {
      "info": "Info",
      "success": "Successo",
      "warning": "Avviso",
      "error": "Errore"
    },
    "relative": {
      "now": "poco fa",
      "min": "{n} min fa",
      "h": "{n} h fa",
      "d": "{n} g fa",
      "mo": "{n} mesi fa",
      "y": "{n} anni fa"
    }
  },
  "chatPanel": {
    "title": "Messaggi",
    "newConversation": "Nuova conversazione",
    "seeMore": "Mostra altro",
    "loading": "Caricamento...",
    "empty": "Non hai ancora conversazioni.",
    "errorLoad": "Impossibile caricare le chat.",
    "connecting": "Connessione...",
    "live": "In tempo reale",
    "retrying": "Nuovo tentativo...",
    "disconnected": "Disconnesso",
    "you": "Tu",
    "attachment": "Allegato",
    "newMessage": "Nuovo messaggio",
    "newMessageIn": "Nuovo messaggio in {title}",
    "unknownUser": "Utente",
    "callIncoming": "Chiamata in arrivo",
    "callIncomingHint": "Audio con traduzione in tempo reale",
    "callAccept": "Accetta",
    "callReject": "Rifiuta"
  },
  "commandSub": {
    "main": "Principale",
    "system": "Sistema",
    "admin": "Amministrazione",
    "tools": "Strumenti",
    "account": "Account",
    "action": "Azione"
  },
  "defaultUser": "Utente",
  "logoAlt": "LUXIPANEL",
  "searchEntries": {
    "view.chat": "Chat interna",
    "chat.action.new-conversation": "Nuova conversazione",
    "chat.media": "Multimedia della conversazione",
    "chat.call": "Chiama",
    "chat.settings": "Impostazioni di messaggistica",
    "chat.settings.general": "Chat · Generale",
    "chat.settings.presence": "Chat · Presenza",
    "chat.settings.calls": "Chat · Chiamate",
    "chat.settings.appearance": "Chat · Aspetto",
    "chat.settings.groups": "Chat · Gruppi",
    "users.tab.users": "Utenti",
    "users.tab.roles": "Ruoli",
    "users.action.new-user": "Nuovo utente",
    "users.action.new-role": "Nuovo ruolo",
    "mail.tab.emails": "Account",
    "mail.action.new-account": "Nuovo account di posta",
    "mail.tab.spam": "Filtri spam",
    "mail.tab.track": "Traccia consegna",
    "mail.tab.global-filters": "Filtri globali",
    "mail.settings.routing": "Routing email",
    "mail.settings.domain-redirect": "Inoltri di dominio",
    "mail.settings.default-address": "Indirizzo predefinito",
    "mail.settings.archive": "Archivio email",
    "mail.settings.encryption": "Crittografia",
    "mail.settings.outbound": "Posta in uscita",
    "mail.subview.compose": "Redazione",
    "nginx.action.new-site": "Nuovo sito",
    "nginx.action.https": "Abilita HTTPS / certificato SSL",
    "nginx.action.proxy": "Destinazione del proxy inverso",
    "nginx.action.edit-conf": "Modifica nginx.conf",
    "firewall.action.new-rule": "Nuova regola",
    "firewall.action.ban-ip": "Banna IP",
    "firewall.action.audit": "Verifica di sicurezza",
    "backups.action.now": "Esegui backup ora",
    "backups.action.new-storage": "Nuovo storage",
    "backups.action.new-schedule": "Nuova pianificazione",
    "cron.action.new-agent": "Nuova attività IA",
    "databases.tab.rows": "Righe",
    "databases.tab.structure": "Struttura",
    "databases.tab.console": "Console SQL",
    "cloudflare.tab.dns": "DNS",
    "cloudflare.tab.cache": "Cache",
    "cloudflare.tab.security": "Sicurezza",
    "cloudflare.tab.access": "Accesso",
    "cloudflare.tab.config": "Configurazione",
    "webhooks.tab.receive": "Ricevere",
    "webhooks.tab.mailhook": "Mailhook",
    "webhooks.tab.response": "Risposta webhook",
    "webhooks.tab.webhooks": "Webhook in uscita",
    "webhooks.tab.keys": "API Key",
    "webhooks.tab.discovered": "Rilevati",
    "server-alerts.tab.prefs": "Preferenze",
    "server-alerts.tab.send": "Invia",
    "server-alerts.tab.scheduled": "Programmati",
    "server-alerts.tab.rules": "Regole di avviso",
    "repository-store.tab.saved": "Salvati",
    "repository-store.tab.cloned": "Clonati",
    "repository-store.tab.update": "Aggiornamenti",
    "modules.tab.installed": "Installati",
    "modules.tab.integrations": "Integrazioni",
    "settings.tab.general": "Generale",
    "settings.tab.layout": "Design e identità visiva",
    "settings.tab.security": "Sicurezza",
    "settings.tab.credentials": "Credenziali",
    "settings.credentials.elevenlabs": "Credenziale ElevenLabs",
    "settings.credentials.tolqia": "Token API Tolqia",
    "settings.tab.servers": "Server",
    "settings.tab.modules": "Moduli e cache",
    "settings.tab.system": "System",
    "preferences.section.profile": "Profilo",
    "preferences.section.password": "Cambia password",
    "preferences.section.passkeys": "Passkeys",
    "preferences.section.2fa": "Autenticazione a due fattori (2FA)",
    "preferences.section.audit": "Registro attività",
    "assistant.settings.general": "Generale",
    "assistant.settings.agentes": "Agenti",
    "assistant.settings.providers": "Provider",
    "assistant.settings.modules": "Moduli e strumenti",
    "assistant.settings.stats": "Utilizzo e costi",
    "assistant.settings.access": "Accesso e approvazioni",
    "assistant.action.new-conversation": "Nuova conversazione IA",
    "assistant.action.new-project": "Nuovo progetto",
    "action.theme-dark": "Passa alla modalità scura",
    "action.theme-light": "Passa alla modalità chiara",
    "action.language": "Cambia lingua",
    "action.server-switcher": "Cambia server",
    "action.sidebar-toggle": "Comprimi o espandi il menu",
    "action.logout": "Esci"
  },
  "workspaceViews": {
    "assistant": {
      "chat": "Conversazioni"
    },
    "users": {
      "users": "Utenti",
      "roles": "Gruppi"
    },
    "monitor": {
      "history": "Cronologia",
      "processes": "Processi"
    },
    "files": {
      "browser": "Esploratore",
      "editor": "Editor"
    },
    "firewall": {
      "audit": "Verifica",
      "rules": "Regole UFW",
      "fail2ban": "Fail2ban"
    },
    "bitninja": {
      "status": "Stato",
      "components": "Componenti",
      "logs": "Record"
    },
    "mail": {
      "emails": "Email",
      "spam-filters": "Filtri antispam",
      "track-delivery": "Consegna",
      "global-filters": "Filtri"
    },
    "dns": {
      "overview": "Panoramica",
      "sites": "Siti e HTTPS",
      "proxy": "Traffico",
      "perf": "Prestazioni",
      "logs": "Registri",
      "status": "Servizio"
    },
    "nginx": {
      "overview": "Panoramica",
      "sites": "Siti e HTTPS",
      "proxy": "Traffico",
      "perf": "Prestazioni",
      "logs": "Registri",
      "status": "Servizio"
    },
    "backups": {
      "overview": "Stato",
      "schedules": "Programmi",
      "history": "Cronologia"
    },
    "cron": {
      "jobs": "Job",
      "agents": "Agenti IA"
    },
    "databases": {
      "databases": "Database",
      "tables": "Tabelle",
      "console": "Console SQL"
    },
    "obsidian": {
      "vaults": "Archivi e note",
      "editor": "Editor"
    },
    "cloudflare": {
      "dns": "DNS",
      "cache": "Cache",
      "security": "Sicurezza",
      "access": "Accesso",
      "config": "Configurazione"
    },
    "server-alerts": {
      "prefs": "Preferenze",
      "send": "Invia",
      "scheduled": "Programmati",
      "rules": "Regole",
      "history": "Cronologia"
    },
    "expo": {
      "account": "Account",
      "projects": "Progetti",
      "builds": "Build",
      "store": "Store",
      "environment": "Variabili"
    },
    "module-dev": {
      "my-modules": "I miei moduli",
      "project-map": "Mappa del progetto"
    },
    "terminal": {
      "terminal": "Terminale"
    },
    "repository-store": {
      "all": "Sfoglia",
      "saved": "Salvati",
      "cloned": "Clonati",
      "update": "Aggiornamenti"
    },
    "webhooks": {
      "receive": "Ricevere",
      "webhooks": "Webhook",
      "keys": "Chiavi",
      "discovered": "Rilevati"
    },
    "openclaw": {
      "assistant": "Assistente"
    },
    "hosting": {
      "accounts": "Account",
      "new": "Nuovo account"
    },
    "codebase-graph": {
      "graph": "Grafo visuale",
      "symbols": "Simboli"
    },
    "preferences": {
      "profile": "Profilo",
      "security": "Sicurezza",
      "audit": "Attività"
    },
    "settings": {
      "settings": "Configurazione"
    },
    "modules": {
      "catalog": "Catalogo"
    },
    "chat": {
      "chat": "Chat"
    },
    "_default": {
      "overview": "Panoramica"
    }
  },
  "workspace": {
    "closeModuleBackToChat": "Chiudi il modulo e torna alla chat",
    "module": "Modulo",
    "loadingModule": "Caricamento del modulo…",
    "moduleFrameTitle": "Modulo LUXIPANEL",
    "loadingSettings": "Caricamento delle impostazioni…",
    "closeHistory": "Chiudi cronologia"
  }
} as const;

export default panelLayout;
