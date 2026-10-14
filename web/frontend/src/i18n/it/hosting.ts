const hosting = {
  "pageTitle": "Hosting condiviso",
  "pageSubtitle": "Gestisci gli account di hosting dei tuoi clienti · WHM-style multi-tenant",
  "btnNewAccount": "Nuovo account",
  "options": {
    "planBasic": "Base",
    "planPro": "Pro",
    "planBusiness": "Business",
    "planCustom": "Personalizzato"
  },
  "stats": {
    "total": "Account totali",
    "active": "Attivi",
    "suspended": "Sospesi",
    "terminated": "Terminati",
    "title": "Utilizzo di {username}",
    "disk": "Disco (MB)",
    "domains": "Domini",
    "emails": "Account email",
    "databases": "Database",
    "subusers": "Sotto-utenti",
    "bandwidth": "Larghezza di banda (MB)",
    "percentUsed": "% usato",
    "method": "Metodo di misurazione",
    "methodDu": "Stima con du (best-effort)",
    "methodQuotaTools": "Quota di sistema (quota-tools)"
  },
  "tableTitle": "account",
  "modal": {
    "titleNew": "Nuovo account di hosting",
    "tabs": {
      "account": "Account",
      "resources": "Risorse",
      "security": "Moduli e sicurezza"
    },
    "labelUsername": "Utente *",
    "labelPassword": "Password *",
    "labelName": "Nome",
    "labelEmail": "Email",
    "labelPlan": "Piano",
    "resourcesTitle": "Limiti di risorse",
    "labelDisk": "Disco (MB)",
    "labelBandwidth": "Larghezza di banda (MB)",
    "labelDomains": "Domini",
    "labelEmails": "Account email",
    "labelNotes": "Note interne",
    "btnCancel": "Annulla",
    "btnCreate": "Crea account",
    "hintUsername": "Solo minuscole, numeri, - e _",
    "phUsername": "clienteesempio",
    "phPassword": "minimo 8 caratteri",
    "phName": "Azienda S.A.",
    "phEmail": "admin@azienda.com",
    "phNotes": "Note opzionali...",
    "labelStatus": "Stato",
    "labelTenantGroup": "Gruppo del tenant",
    "labelHomeRoot": "Cartella radice (home)",
    "hintTenantGroup": "Gruppo Linux dedicato dell'account (sola lettura).",
    "hintHomeRoot": "Radice del tenant sul VPS (sola lettura).",
    "labelDiskQuotaMb": "Quota disco (MB)",
    "labelBandwidthQuotaMb": "Quota banda (MB)",
    "labelMaxDomains": "Max. domini",
    "labelMaxEmailAccounts": "Max. account email",
    "labelMaxDatabases": "Max. database",
    "labelMaxSubUsers": "Max. sotto-utenti",
    "labelAllowedModules": "Moduli consentiti",
    "labelJailEnabled": "Isola shell (chroot)",
    "hintJailEnabled": "Confina il terminale/SSH di questo account alla sua cartella (gabbia chroot).",
    "modulesLoading": "Caricamento moduli…",
    "labelExpiresAt": "Data di scadenza",
    "hintExpiresAt": "Lascia vuoto per nessuna scadenza",
    "labelModules": "Moduli consentiti",
    "hintModules": "Definisce i moduli del panel a cui avrà accesso questo client.",
    "labelDatabases": "Database",
    "labelSubUsers": "Sottoutenti",
    "labelJail": "Isola shell (chroot)",
    "hintJail": "Confina il terminale/SSH di questo account alla sua cartella (jail chroot).",
    "titleEdit": "Modifica: {username}"
  },
  "pwdModal": {
    "title": "Cambia password",
    "labelNew": "Nuova password",
    "phPassword": "minimo 8 caratteri",
    "btnCancel": "Annulla",
    "btnChange": "Cambia"
  },
  "apiPageTitle": "Documentazione API Hosting",
  "apiSubtitle": "Gestione automatizzata degli account di hosting condiviso",
  "apiIntro": "La Reseller API ti permette di automatizzare la creazione, l'aggiornamento, la sospensione e l'eliminazione di account di hosting da qualsiasi sistema esterno — la tua piattaforma di fatturazione, WHMCS, script Bash, integrazioni con Zapier, ecc. È compatibile con qualsiasi linguaggio o strumento in grado di effettuare richieste HTTP.",
  "toc": {
    "label": "Contenuti",
    "items": [
      "1. Autenticazione",
      "2. Isolamento e sicurezza",
      "3. Endpoint disponibili",
      "4. Creare account",
      "5. Elencare account",
      "6. Ottenere account",
      "7. Aggiornare account",
      "8. Sospendere / Riattivare",
      "9. Cambiare password",
      "10. Statistiche account",
      "11. Eliminare account",
      "12. Login account hosting",
      "13. Codici errore",
      "14. Esempi completi"
    ]
  },
  "auth": {
    "title": "Autenticazione",
    "intro": "Tutti gli endpoint dell'API Reseller accettano due metodi di autenticazione:",
    "apiKeyTitle": "API Key (consigliato per l'automazione)",
    "apiKeyDesc": "Genera un'API key da Pannello → Webhooks → API Keys. Inviala nell'header Authorization:",
    "sessionTitle": "Sessione admin (dal panel)",
    "sessionDesc": "Se stai effettuando richieste dal panel LUXIPANEL stesso (ad esempio, da JavaScript nel browser), il tuo cookie di sessione di amministratore viene accettato automaticamente.",
    "warningTitle": "Importante:",
    "warningText": "Non esporre mai la tua API Key nel codice lato client (JavaScript nel browser, app mobile, ecc.). Utilizzalo esclusivamente da server o ambienti privati."
  },
  "isolation": {
    "title": "Isolamento e sicurezza",
    "intro": "Ogni account di hosting è un ambiente completamente isolato. Questo garantisce che nessun cliente possa vedere o modificare le risorse di un altro, indipendentemente dal fatto che tenti di farlo tramite pannello web, API, console SSH o qualsiasi altro vettore.",
    "features": [
      {
        "title": "Dati isolati",
        "desc": "Mailbox, domini, DNS, SSL e backup sono associati al tenant_id di ciascun account. Le query SQL non attraversano mai i tenant."
      },
      {
        "title": "File system",
        "desc": "Ogni account ha la propria home directory (/home/username). L'esplora file e la console sono limitati a tale directory."
      },
      {
        "title": "Sessioni indipendenti",
        "desc": "Il JWT di un account di hosting include il suo tenantId. Il backend rifiuta qualsiasi richiesta che tenti di accedere a risorse al di fuori di tale ambito."
      }
    ]
  },
  "endpoints": {
    "title": "Endpoint disponibili",
    "colMethod": "Metodo",
    "colPath": "Percorso",
    "colDesc": "Descrizione",
    "colAuth": "Auth",
    "rows": [
      [
        "POST",
        "/api/hosting/accounts",
        "Crea account di hosting",
        "Amministratore / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts",
        "Elenca account (paginato)",
        "Amministratore / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id",
        "Ottieni un singolo account",
        "Amministratore / API Key"
      ],
      [
        "PUT",
        "/api/hosting/accounts/:id",
        "Aggiorna account",
        "Amministratore / API Key"
      ],
      [
        "DELETE",
        "/api/hosting/accounts/:id",
        "Elimina l'account e tutti i suoi dati",
        "Amministratore / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/suspend",
        "Sospendi account",
        "Amministratore / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/unsuspend",
        "Riattiva account sospeso",
        "Amministratore / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/change-password",
        "Cambia password",
        "Amministratore / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id/stats",
        "Statistiche di utilizzo",
        "Amministratore / API Key"
      ],
      [
        "POST",
        "/api/hosting/auth/login",
        "Accesso account di hosting",
        "Pubblico"
      ],
      [
        "POST",
        "/api/hosting/auth/logout",
        "Logout hosting",
        "Sessione hosting"
      ]
    ]
  },
  "create": {
    "title": "Crea account",
    "labelBody": "Body (JSON)",
    "labelResp": "Risposta 201"
  },
  "list": {
    "title": "Elenca account",
    "labelParams": "Query param",
    "colParam": "Parametro",
    "colType": "Tipo",
    "colDefault": "Predefinito",
    "colDesc": "Descrizione",
    "labelResp": "Risposta 200",
    "params": [
      [
        "page",
        "integer",
        "1",
        "Pagina corrente"
      ],
      [
        "limit",
        "integer",
        "20",
        "Risultati per pagina (max 100)"
      ],
      [
        "search",
        "string",
        "—",
        "Cerca in username, displayName, email"
      ],
      [
        "status",
        "string",
        "—",
        "active | suspended | terminated"
      ]
    ]
  },
  "compactEndpoints": [
    {
      "id": "get",
      "num": "6",
      "title": "Ottieni account",
      "method": "GET",
      "path": "/api/hosting/accounts/:id",
      "note": "Restituisce l'oggetto account senza il campo passwordHash."
    },
    {
      "id": "update",
      "num": "7",
      "title": "Aggiorna account",
      "method": "PUT",
      "path": "/api/hosting/accounts/:id",
      "note": "Accetta gli stessi campi di create (eccetto username e password). Vengono aggiornati solo i campi inviati."
    },
    {
      "id": "suspend",
      "num": "8",
      "title": "Sospendi / Riattiva",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/suspend  |  /unsuspend",
      "note": "La sospensione blocca immediatamente l'accesso del cliente. La riattivazione ripristina lo stato a 'active'. Nessun corpo richiesto."
    },
    {
      "id": "password",
      "num": "9",
      "title": "Cambia password",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/change-password",
      "note": "Body: {\"password\": \"NewPass123!\"} — minimo 8 caratteri."
    },
    {
      "id": "stats",
      "num": "10",
      "title": "Statistiche di utilizzo",
      "method": "GET",
      "path": "/api/hosting/accounts/:id/stats",
      "note": "Restituisce le quote configurate e l'utilizzo corrente di disco, banda, domini attivi e account email."
    },
    {
      "id": "delete",
      "num": "11",
      "title": "Elimina account",
      "method": "DELETE",
      "path": "/api/hosting/accounts/:id",
      "note": "⚠️ Irreversibile. Elimina l'account e, tramite ON DELETE CASCADE, tutte le sue risorse: mailbox, domini, DNS, SSL e backup."
    }
  ],
  "login": {
    "title": "Login account hosting",
    "badgePublic": "· Pubblico",
    "desc": "Il cliente inserisce le sue credenziali nel pannello di login. Se sono valide, viene creata una sessione di tipo kind: \"hosting\" che limita l'accesso esclusivamente alle risorse del suo account.",
    "labelBody": "Body",
    "labelResp": "Risposta 200"
  },
  "errors": {
    "title": "Codici di errore",
    "intro": "Tutti gli errori seguono lo stesso envelope:",
    "colHttp": "HTTP",
    "colCode": "Codice",
    "colDesc": "Descrizione",
    "rows": [
      [
        "400",
        "VALIDATION_ERROR",
        "Campi non validi o mancanti"
      ],
      [
        "401",
        "AUTH_ERROR",
        "API key non valida, scaduta o mancante"
      ],
      [
        "403",
        "FORBIDDEN",
        "Non disponi dell'autorizzazione per questa operazione"
      ],
      [
        "404",
        "NOT_FOUND",
        "L'account richiesto non esiste"
      ],
      [
        "409",
        "CONFLICT",
        "Lo username è già in uso"
      ],
      [
        "429",
        "RATE_LIMIT",
        "Troppe richieste — attendi prima di riprovare"
      ],
      [
        "500",
        "INTERNAL_ERROR",
        "Errore interno del server"
      ]
    ],
    "generic": "Errore",
    "unknown": "Errore sconosciuto"
  },
  "examples": {
    "title": "Esempi completi",
    "labelCurl": "Crea account",
    "labelSuspend": "Sospendi account",
    "labelList": "Elenca con filtri",
    "labelNodeClient": "Client riutilizzabile",
    "labelPhpHelper": "Classe helper in PHP"
  },
  "table": {
    "columnStatus": "Stato",
    "columnPlan": "Piano",
    "columnModules": "Moduli",
    "columnCreated": "Creato",
    "columnUpdated": "Aggiornato",
    "columnTenantGroup": "Gruppo",
    "columnHomeRoot": "Home",
    "modulesCount": "{count} moduli"
  },
  "audit": {
    "title": "Audit di {username}",
    "eventType": "Evento",
    "actor": "Attore",
    "date": "Data",
    "empty": "Nessun evento registrato."
  },
  "actions": {
    "editModules": "Modifica moduli",
    "viewStats": "Vedi utilizzo",
    "viewAudit": "Vedi audit",
    "enableJail": "Attiva gabbia",
    "disableJail": "Disattiva gabbia",
    "save": "Salva",
    "saveChanges": "Salva modifiche",
    "saving": "Salvataggio…"
  },
  "confirm": {
    "enableJailBody": "Attivare la gabbia chroot per questo account? Il suo terminale/SSH sarà confinato alla sua cartella.",
    "disableJailBody": "Disattivare la gabbia chroot? L'account tornerà a una shell normale (/bin/bash).",
    "suspendBody": "Sospendere questo account? Il client perderà l'accesso.",
    "suspendTitle": "Sospendi account",
    "suspendOk": "Sì, sospendi",
    "deleteBody": "Eliminare l'account \"{username}\" e TUTTI i suoi dati (email, domini, file)? Questa azione non può essere annullata.",
    "deleteTitle": "Elimina account"
  },
  "jail": {
    "degraded": "jailkit non è installato sul server; la gabbia non è stata attivata. Installa jailkit e riprova.",
    "degradedTitle": "Gabbia non applicata",
    "enabledOk": "Gabbia attivata correttamente."
  },
  "toasts": {
    "jailAlready": "La gabbia è già attiva",
    "jailNotActive": "La gabbia non è attiva",
    "notActive": "L'account non è attivo",
    "notSuspended": "L'account non è sospeso"
  },
  "labels": {
    "statusActive": "Attivo",
    "statusSuspended": "Sospeso",
    "statusTerminated": "Terminato"
  },
  "dataTable": {
    "columns": {
      "username": "Utente",
      "plan": "Piano",
      "estado": "Stato",
      "modulos": "Moduli",
      "tenantGroup": "Gruppo",
      "homeRoot": "Home",
      "creado": "Creato",
      "actualizado": "Aggiornato"
    },
    "filters": {
      "searchUser": "Cerca per utente…",
      "estado": "Stato",
      "plan": "Piano",
      "statusActive": "Attiva",
      "statusSuspended": "Sospesa",
      "statusTerminated": "Terminata"
    },
    "rowActions": {
      "edit": "Modifica",
      "viewStats": "Vedi utilizzo",
      "viewAudit": "Vedi audit",
      "password": "Cambia password",
      "suspend": "Sospendi",
      "unsuspend": "Riattiva",
      "enableJail": "Attiva gabbia",
      "disableJail": "Disattiva gabbia",
      "delete": "Elimina"
    }
  },
  "runtime": {
    "defaultsLoadError": "Impossibile caricare i valori predefiniti.",
    "defaultsSaveError": "Impossibile salvare i valori.",
    "defaultsSaved": "Valori salvati sul server attivo."
  },
  "settingsUi": {
    "title": "Impostazioni hosting",
    "description": "Preferenze della tabella degli account hosting",
    "table": "Tabella",
    "apiProviders": "Provider API",
    "rowsPerPage": "Righe per pagina nella tabella degli account.",
    "newAccountDefaults": "Valori predefiniti per i nuovi account",
    "defaultsHint": "Salvati sul server attivo. Gli account esistenti non vengono modificati.",
    "emailAccounts": "Email",
    "subusers": "Sottoutenti",
    "defaultJail": "Attiva l’isolamento per impostazione predefinita",
    "defaultModules": "Moduli predefiniti (ID separati da virgole)",
    "saveDefaults": "Salva i valori",
    "relatedModules": "Moduli correlati",
    "users": "Utenti",
    "domainsSsl": "Domini e SSL",
    "showAll": "Mostra tutte",
    "hideAll": "Nascondi tutte",
    "providerConnections": "Connessioni dei gestori hosting",
    "providerConnectionsHint": "LUXIPANEL offre l’API. Ogni gestore riceve una chiave e accesso limitato a un server, ai moduli e alle operazioni.",
    "newProvider": "Nuovo provider",
    "managedServer": "Server gestito",
    "localServer": "Server locale",
    "panelHttpsOrigin": "Origine HTTPS di LUXIPANEL",
    "siteEngine": "Motore del sito sul server",
    "accountModules": "Moduli degli account",
    "modulesHint": "ID separati da virgole; HOSTING verifica il catalogo.",
    "apiOperations": "Operazioni API",
    "readAccounts": "Leggi account",
    "createAccounts": "Crea account",
    "accountStatus": "Stato e dati degli account",
    "viewUsage": "Consulta utilizzo",
    "linkSites": "Collega siti",
    "panelAccess": "Accesso al pannello",
    "deleteAccounts": "Elimina account",
    "createProviderKey": "Crea provider e chiave",
    "copyKeyNow": "Copia ora la chiave: viene mostrata una sola volta.",
    "groupPolicy": {
      "editProvider": "Modifica fornitore",
      "saveProvider": "Salva fornitore",
      "templateTitle": "Permessi del gruppo iniziale",
      "templateHint": "Ogni nuovo account riceve questi permessi nel proprio gruppo. Per gli account esistenti, modifica il gruppo in Utenti.",
      "permissions": "Permessi dettagliati",
      "sidebar": "Menu",
      "views": "Viste",
      "actions": "Azioni",
      "filesScope": "Accesso ai file",
      "relativeHint": "Un percorso per riga, relativo alla cartella dell’account. Usa . per l’intera cartella.",
      "allowPaths": "Cartelle consentite",
      "denyPaths": "Cartelle bloccate",
      "readOnlyPaths": "Cartelle di sola lettura",
      "defaultPath": "Cartella iniziale",
      "commands": "Comandi del terminale",
      "allowAllCommands": "Consenti tutti i comandi dell’utente",
      "commandGroups": "Gruppi di comandi",
      "allowedCommands": "Comandi consentiti, uno per riga",
      "deniedCommands": "Comandi bloccati, uno per riga",
      "saving": "Salvataggio…",
      "saved": "Fornitore salvato. Si applica ai nuovi account.",
      "created": "Fornitore creato.",
      "loading": "Caricamento di fornitori e permessi…",
      "loadError": "Impossibile caricare le impostazioni.",
      "active": "Attivo",
      "revoked": "Revocato",
      "rotateKey": "Ruota chiave",
      "rotateSuccess": "Chiave ruotata. Copia la nuova chiave.",
      "revoke": "Revoca accesso",
      "reactivate": "Riattiva",
      "accessUpdated": "Accesso aggiornato.",
      "emptyProviders": "Nessun fornitore configurato."
},
    "apiGuide": "Guida API",
    "retry": "Riprova"
  },
  "apiDocs": {
    "pageTitle": "API per provider di hosting",
    "backToHosting": "Torna a HOSTING",
    "contractVersion": "Contratto HTTP · versione 1",
    "heading": "Collega il tuo gestore hosting",
    "intro": "LUXIPANEL espone questa API per creare account, collegare siti e concedere accesso secondo i permessi definiti in HOSTING.",
    "guideContents": "Contenuto della guida",
    "preparation": "Preparazione",
    "authentication": "Autenticazione",
    "operations": "Operazioni",
    "example": "Esempio",
    "panelAccess": "Accesso al pannello",
    "limitsErrors": "Limiti ed errori",
    "preparationHeading": "Preparazione in HOSTING",
    "administrator": "Amministratore",
    "scope": "Ambito",
    "key": "Chiave",
    "adminStep": "Apri HOSTING → Impostazioni → Provider API e crea un provider.",
    "scopeStep": "Imposta server, motore dei siti, moduli, quote e operazioni consentite.",
    "keyStep": "Copia la chiave lhp_… una sola volta e conservala solo nel backend del gestore.",
    "providerScopeNote": "Ogni provider è legato a un server. Gli account ricevono un utente Linux e una cartella propri; il gestore non sceglie né riceve la password.",
    "anyProvider": "Qualsiasi provider",
    "endpointCapabilities": "Mostra versione, operazioni, moduli e server assegnato.",
    "endpointPutAccount": "Crea o recupera un account con displayName ed email facoltativi.",
    "endpointGetAccount": "Consulta l’account senza esporre la password.",
    "endpointPatchAccount": "Aggiorna nome, email o stato active/suspended.",
    "endpointDeleteAccount": "Elimina un account senza siti collegati. Disattivato per impostazione predefinita.",
    "endpointUsage": "Consulta quote, utilizzo disponibile e avvisi di misurazione.",
    "endpointPutSite": "Collega un dominio al motore dei siti configurato in HOSTING.",
    "endpointDeleteSite": "Rimuove solo il sito appartenente a questo provider.",
    "endpointTicket": "Emette un accesso monouso al pannello valido per 60 secondi.",
    "method": "Metodo",
    "pathFromBase": "Percorso dall’URL base",
    "permission": "Permesso",
    "result": "Risultato",
    "operationsHeading": "Operazioni del gestore",
    "authNote": "Invia le richieste al pannello via HTTPS. Cookie admin e chiavi lxp_… non autenticano questa API. Non esporre mai la chiave lhp_… al browser.",
    "baseNote": "URL base: https://<panel>/api/hosting/v1. Gli ID esterni accettano 1–128 caratteri: lettere, numeri, _ . : -.",
    "idempotencyNote": "Le richieste PUT per account e siti sono idempotenti con lo stesso riferimento e contenuto. Un provider non può accedere agli account di un altro.",
    "createAccount": "Crea o recupera un account",
    "accountResponseNote": "La risposta contiene { \"ok\": true, \"data\": … } con utente, directory home, stato e quote. Non include l’hash della password.",
    "siteExampleNote": "Per un sito, invia PUT /accounts/account-42/sites/site-1 con { \"domain\": \"example.com\" }. LUXIPANEL crea un proxy NGINX verso il motore configurato; il gestore pubblica i contenuti e instrada il traffico TLS.",
    "clientAccessHeading": "Accesso del cliente a LUXIPANEL",
    "clientAccessNote": "Il backend verifica che il cliente possieda l’account e richiede POST /accounts/{accountId}/access-ticket. Passa URL e ticket al browser, che invia POST a /api/auth/sso/handoff. Il ticket è monouso e scade dopo 60 secondi. Se è richiesto un secondo fattore, l’accesso restituisce 403 finché non esiste un flusso compatibile.",
    "limitsHeading": "Limiti e risposte di errore",
    "limitsNote": "L’API accetta solo riferimenti, dati base dell’account e domini. Il gestore non può inviare comandi, percorsi, server di destinazione o impostazioni NGINX. Un sito punta solo al motore e alla porta scelti dall’amministratore.",
    "errorCodes": "400: input non valido · 401: chiave assente o non valida · 403: operazione non autorizzata · 404: riferimento inesistente · 409: conflitto o operazione simultanea · 5xx: errore server.",
    "bandwidthNote": "La misurazione della banda non è ancora affidabile. Controlla warnings nella risposta usage."
  }
} as const;

export default hosting;
