// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "Rileva automaticamente la configurazione: Remoto",
      "local": "Scambiatore di posta locale",
      "backup": "Scambiatore di posta di backup",
      "remote": "Scambiatore di posta remoto"
    },
    "currentMode": "Attuale: {mode}"
  },
  "tracking": {
    "statuses": {
      "success": "Successo",
      "deferred": "Rinviato",
      "failure": "Errore",
      "inProgress": "In corso",
      "unknown": "Sconosciuto"
    },
    "columns": {
      "event": "Evento",
      "fromAddress": "Indirizzo mittente",
      "sentTime": "Ora di invio",
      "spamScore": "Punteggio spam",
      "recipient": "Destinatario",
      "domain": "Dominio",
      "id": "ID",
      "result": "Risultato",
      "actions": "Azioni"
    },
    "noRecordsFound": "Nessun record trovato.",
    "zeroRecords": "0 record",
    "matchesZeroRecords": "La ricerca corrisponde a 0 record.",
    "recordsCount": "{count} record",
    "matchesRecords": "La ricerca corrisponde a {count} record.",
    "detailMeta": "Evento: {event} | ID: {id} | Destinatario: {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "Da",
      "subject": "Oggetto",
      "to": "A",
      "anyRecipient": "Qualsiasi destinatario",
      "reply": "Rispondi",
      "body": "Corpo",
      "anyHeader": "Qualsiasi intestazione",
      "notDelivered": "Non è stato consegnato in precedenza",
      "errorMessage": "È un messaggio di errore",
      "listId": "ID lista",
      "spamStatus": "Stato spam",
      "spamBar": "Barra spam",
      "spamScore": "Punteggio spam"
    },
    "matches": {
      "contains": "contiene",
      "matchesRegex": "corrisponde a regex",
      "doesNotContain": "non contiene",
      "equals": "è uguale a",
      "beginsWith": "inizia con",
      "endsWith": "termina con",
      "doesNotBegin": "non inizia con",
      "doesNotEnd": "non termina con",
      "doesNotMatch": "non corrisponde",
      "isAbove": "è superiore a (solo numeri)",
      "isNotAbove": "non è superiore a (solo numeri)",
      "isBelow": "è inferiore a (solo numeri)",
      "isNotBelow": "non è inferiore a (solo numeri)"
    },
    "actions": {
      "discard": "Scarta messaggio",
      "redirect": "Reindirizza a email",
      "fail": "Fallisci con messaggio",
      "stop": "Interrompi elaborazione regole",
      "deliverToFolder": "Consegna alla cartella",
      "pipe": "Invia a un programma"
    },
    "joinOp": {
      "and": "e",
      "or": "o"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "Impostazione attuale: (nessuno)",
      "forward": "Impostazione attuale: {destination}",
      "forwardDefault": "(inoltro)",
      "fail": "Impostazione attuale: :fail: {message}"
    },
    "defaultFailMessage": "Utente non trovato qui"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "1 mese",
      "threeMonths": "3 mesi",
      "sixMonths": "6 mesi",
      "oneYear": "1 anno",
      "twoYears": "2 anni",
      "fiveYears": "5 anni",
      "tenYears": "10 anni",
      "forever": "Per sempre",
      "custom": "Personalizzato"
    },
    "fields": {
      "incomingEmail": "Messaggi email in arrivo",
      "outgoingMailingList": "Messaggi email in uscita lista di distribuzione",
      "outgoingEmail": "Messaggi email in uscita"
    }
  },
  "encryption": {
    "neverExpires": "Non scade mai"
  },
  "actions": {
    "view": "Visualizza",
    "save": "Salva",
    "clone": "Clona",
    "copy": "Copia",
    "delete": "Elimina",
    "edit": "Modifica",
    "remove": "Rimuovi"
  },
  "outbound": {
    "cardTitle": "Invio email del pannello (SMTP)",
    "cardDesc": "Account predefinito o SMTP esterno con cui il pannello invia report ed email di sistema.",
    "back": "Indietro",
    "intro": "Identità con cui LUXIPANEL invia le email di sistema (report degli agenti cron, link di approvazione, test). Può essere un account email di questo server o un SMTP esterno che non appartiene al server.",
    "modeLabel": "Modalità di invio",
    "modeDisabled": "Disabilitato",
    "modeAccount": "Account email del server (predefinito)",
    "modeExternal": "SMTP esterno",
    "accountLabel": "Account di invio predefinito",
    "accountHint": "Usa le credenziali SMTP memorizzate di quell'account.",
    "hostLabel": "Server SMTP",
    "portLabel": "Porta",
    "userLabel": "Utente",
    "passLabel": "Password",
    "passPlaceholder": "(invariato)",
    "fromLabel": "Mittente (email)",
    "fromNameLabel": "Nome del mittente",
    "secureLabel": "TLS diretto (porta 465)",
    "save": "Salva",
    "testPlaceholder": "destinatario@esempio.com",
    "test": "Invia test",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "La Mia Azienda"
  },
  "table": {
    "status": {
      "active": "Attivo",
      "inactive": "Inattivo",
      "disabled": "Disattivato"
    },
    "redirect": {
      "columns": {
        "domain": "Dominio",
        "destinos": "Destinazioni"
      },
      "filters": {
        "searchDomain": "Cerca dominio…"
      },
      "rowActions": {
        "edit": "Modifica",
        "delete": "Elimina"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "Key ID",
        "label": "Identità",
        "keySize": "Dimensione chiave",
        "created": "Creato",
        "expires": "Scade"
      },
      "filters": {
        "searchKey": "Cerca chiave…"
      },
      "rowActions": {
        "view": "Visualizza",
        "delete": "Elimina"
      }
    },
    "accounts": {
      "columns": {
        "address": "Indirizzo",
        "domain": "Dominio",
        "uso": "Quota / Utilizzo",
        "reenvios": "Inoltri",
        "estado": "Stato"
      },
      "filters": {
        "search": "Cerca indirizzo o dominio…",
        "domain": "Dominio",
        "estado": "Stato"
      },
      "rowActions": {
        "edit": "Modifica account",
        "depurarIa": "Pulisci con l'IA",
        "password": "Cambia password",
        "toggle": "Attiva / Disattiva",
        "inbox": "Apri casella",
        "signatures": "Gestisci firme",
        "default": "Usa come predefinito",
        "contacts": "Gestisci contatti",
        "calendars": "Gestisci calendari",
        "autoresponder": "Gestisci risponditore automatico",
        "filters": "Gestisci filtri",
        "forwards": "Gestisci inoltri",
        "diskusage": "Gestisci uso del disco",
        "clone": "Clona posta",
        "delete": "Elimina account"
      },
      "quickActions": {
        "bulkForward": "Aggiungi inoltro",
        "bulkQuota": "Cambia quota",
        "bulkDelete": "Elimina account"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "Filtro",
        "estado": "Stato",
        "rules": "Regole",
        "actionsCount": "Azioni"
      },
      "filters": {
        "search": "Cerca filtro…"
      },
      "rowActions": {
        "edit": "Modifica",
        "delete": "Elimina"
      }
    },
    "contacts": {
      "columns": {
        "email": "Email",
        "name": "Nome"
      },
      "filters": {
        "searchEmail": "Cerca email…"
      },
      "rowActions": {
        "edit": "Modifica",
        "delete": "Elimina"
      }
    },
    "calendars": {
      "columns": {
        "name": "Nome",
        "timezone": "Fuso orario",
        "estado": "Stato"
      },
      "filters": {
        "search": "Cerca calendario…"
      },
      "rowActions": {
        "edit": "Modifica",
        "delete": "Elimina"
      }
    },
    "signatures": {
      "columns": {
        "sender": "Mittente",
        "preview": "Firma"
      },
      "filters": {
        "search": "Filtra e cerca…"
      },
      "rowActions": {
        "edit": "Modifica",
        "delete": "Elimina"
      }
    },
    "filters": {
      "columns": {
        "name": "Nome",
        "estado": "Stato"
      },
      "filters": {
        "search": "Cerca filtro…"
      },
      "rowActions": {
        "edit": "Modifica",
        "delete": "Elimina"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "Eliminare {count} account email? Questa azione non può essere annullata.",
    "deleteAccount": "Eliminare l'account {address}? Questa azione non può essere annullata.",
    "deleteAccountTitle": "Elimina account",
    "deleteAutoresponder": "Eliminare l'autorisponditore di questo account?",
    "deleteByDate": "Verranno eliminate le email di {folder} tra {from} e {to}. Continuare?",
    "deleteByDateTitle": "Elimina email per data",
    "deleteCalendar": "Eliminare il calendario \"{label}\"?",
    "deleteCalendarTitle": "Elimina calendario",
    "deleteContact": "Eliminare il contatto \"{label}\"?",
    "deleteContactTitle": "Elimina contatto",
    "deleteDomainForward": "Eliminare il reindirizzamento globale di @{domain}?",
    "deleteDomainForwardTitle": "Elimina reindirizzamento globale",
    "deleteEncryptionKey": "Eliminare questa chiave di cifratura?",
    "deleteFilter": "Eliminare il filtro \"{name}\"?",
    "deleteFilterTitle": "Elimina filtro",
    "deleteForward": "Eliminare l'inoltro a {destination}?",
    "deleteGlobalFilter": "Eliminare il filtro globale \"{label}\"?",
    "deleteGlobalFilterTitle": "Elimina filtro globale",
    "yesDelete": "Sì, elimina"
  },
  "empty": {
    "noDomains": "Nessun dominio",
    "noFolders": "Nessuna cartella trovata per questo account.",
    "noOtherAccount": "Nessun altro account disponibile"
  },
  "errors": {
    "accountCreateFailed": "Errore nella creazione dell'account",
    "accountNotFound": "Account non trovato",
    "accountUpdateFailed": "Errore nell'aggiornamento dell'account",
    "accountUpdatedForwardsFailed": "L'account è stato aggiornato, ma l'aggiornamento degli inoltri è fallito",
    "accountsLoadFailed": "Errore nel caricamento degli account",
    "autoDeleteThresholdInvalid": "Soglia di eliminazione automatica non valida.",
    "autoresponderDeleteFailed": "Impossibile eliminare l'autorisponditore",
    "autoresponderSaveFailed": "Impossibile salvare l'autorisponditore.",
    "calendarDeleteFailed": "Impossibile eliminare il calendario",
    "calendarNotFound": "Calendario non trovato",
    "calendarSaveFailed": "Impossibile salvare il calendario.",
    "cloneCreateFailed": "Impossibile creare il nuovo account.",
    "cloneFailed": "Impossibile clonare l'email.",
    "cloneIdResolveFailed": "Account creato, ma impossibile risolverne l'ID. Riprova come 'esistente'.",
    "cloneLocalAndDomainRequired": "Indica parte locale e dominio.",
    "clonePasswordTooShort": "La password deve contenere almeno 6 caratteri.",
    "contactDeleteFailed": "Impossibile eliminare il contatto",
    "contactNotFound": "Contatto non trovato",
    "contactSaveFailed": "Impossibile salvare il contatto.",
    "copyByRangeFailed": "Impossibile copiare per intervallo",
    "customScoreInvalid": "Punteggio personalizzato non valido.",
    "dateRangeRequired": "Devi selezionare data iniziale e finale",
    "defaultAddressLoadFailed": "Impossibile caricare l'indirizzo predefinito.",
    "defaultAddressSaveFailed": "Impossibile salvare l'indirizzo predefinito.",
    "deleteByRangeFailed": "Impossibile eliminare per intervallo",
    "deleteFailed": "Errore durante l'eliminazione",
    "destEmailInvalid": "Email di destinazione non valida",
    "destinationsInvalidFormat": "Una o più destinazioni hanno un formato non valido.",
    "diskUsageLoadFailed": "Impossibile caricare l'utilizzo del disco",
    "domainForwardDeleteFailed": "Impossibile eliminare il reindirizzamento globale.",
    "domainForwardsLoadFailed": "Impossibile caricare i reindirizzamenti globali.",
    "domainRedirectSaveFailed": "Impossibile salvare il reindirizzamento globale.",
    "domainsLoadFailed": "Impossibile caricare i domini DNS",
    "filterDeleteFailed": "Impossibile eliminare il filtro",
    "filterNotFound": "Filtro non trovato",
    "filterSaveFailed": "Impossibile salvare il filtro.",
    "forwardAlreadyExists": "Esiste già un inoltro a {destination}",
    "forwardsSaveFailed": "Impossibile salvare gli inoltri sul server",
    "globalFilterDeleteFailed": "Impossibile eliminare il filtro globale.",
    "globalFilterSaveFailed": "Impossibile salvare il filtro globale.",
    "globalFilterTestFailed": "Impossibile eseguire il test.",
    "globalFiltersLoadFailed": "Impossibile caricare i filtri globali.",
    "indicateTestDestEmail": "Indica l'email di destinazione del test.",
    "localPartInvalid": "L'utente prima di @ ha un formato non valido.",
    "localPartInvalidNoPoint": "L'utente prima di @ ha un formato non valido",
    "mustAddAtLeastOneAction": "Devi aggiungere almeno un'azione.",
    "mustAddAtLeastOneDestEmail": "Devi aggiungere almeno un'email di destinazione.",
    "mustAddAtLeastOneRule": "Devi aggiungere almeno una regola.",
    "mustEnterBody": "Devi inserire il contenuto del messaggio.",
    "mustEnterSubject": "Devi inserire un oggetto.",
    "mustEnterTestMessage": "Devi inserire un messaggio di prova.",
    "mustEnterValidDestEmail": "Devi inserire un'email di destinazione valida.",
    "mustIndicateCalendarName": "Devi indicare il nome del calendario.",
    "mustIndicateContactEmail": "Devi indicare l'email del contatto.",
    "mustIndicateFilterName": "Devi indicare un nome di filtro.",
    "mustIndicateName": "Devi indicare un nome.",
    "mustSelectDomain": "Devi selezionare un dominio.",
    "mustSelectDomainNoPoint": "Devi selezionare un dominio",
    "noAutoresponderToDelete": "Nessun autorisponditore da eliminare",
    "passwordChangeFailed": "Errore nel cambio della password",
    "quotaInvalid": "Quota non valida",
    "routingLoadFailed": "Impossibile caricare la configurazione del routing email.",
    "routingSaveFailed": "Impossibile salvare la configurazione del routing email.",
    "saveFailed": "Errore durante il salvataggio",
    "scoreTypesLoadFailed": "Impossibile caricare il catalogo dei tipi di punteggio.",
    "selectDestAccount": "Seleziona un account di destinazione",
    "selectValidDomain": "Seleziona un dominio valido.",
    "spamFiltersLoadFailed": "Impossibile caricare i filtri spam.",
    "spamFiltersSaveFailed": "Impossibile salvare la configurazione dei filtri spam.",
    "testEmailFailed": "Invio di prova fallito",
    "toggleFailed": "Errore nel cambio di stato",
    "trackDeliveryLoadFailed": "Impossibile caricare la traccia di consegna."
  },
  "labels": {
    "accountColon": "Account: {address}",
    "activating": "Attivazione",
    "cloneStartedBg": "Clonazione avviata in background. Ti avviseremo tramite notifiche al termine.",
    "cloning": "Clonazione…",
    "currentAccountColon": "Account attuale: {address}",
    "deactivating": "Disattivazione",
    "destEmailForCount": "Email di destinazione dell'inoltro da aggiungere in {count} account:",
    "loading": "Caricamento...",
    "newQuotaFor": "Nuova quota in MB per {count} account. Usa 0 per illimitato.",
    "no": "No",
    "noGlobalLimit": "Nessun limite globale",
    "originColon": "Origine: {addr}",
    "sendingTest": "Invio prova…",
    "sudoPromptMessage": "Impossibile leggere l'utilizzo delle caselle senza privilegi sul server. Inserisci la password sudo dell'utente SSH (viene salvata cifrata sul server).",
    "to": "a",
    "total": "Totale",
    "unlimited": "Illimitato",
    "yes": "Sì",
    "keepCopy": "Conserva una copia"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (nessuna modifica)",
    "selectDomain": "Seleziona dominio...",
    "value": "Valore",
    "valueIfApplicable": "Valore (se applicabile)"
  },
  "status": {
    "active": "Attivo",
    "deactivated": "Disattivato",
    "inactive": "Inattivo"
  },
  "titles": {
    "addForward": "Aggiungi inoltro",
    "changeQuota": "Cambia quota",
    "deleteAccounts": "Elimina account",
    "deleteAutoresponder": "Elimina autorisponditore",
    "deleteEncryptionKey": "Elimina chiave",
    "deleteForward": "Elimina inoltro"
  },
  "toasts": {
    "accountActivated": "Account attivato",
    "accountCreated": "Account creato correttamente",
    "accountDeactivated": "Account disattivato",
    "accountDeleted": "Account eliminato",
    "accountUpdated": "Account aggiornato ({localPart}@{domain})",
    "archiveDefaultUpdated": "Configurazione default dell'archivio aggiornata.",
    "archiveDomainUpdated": "Archivio aggiornato per {domain}.",
    "autoDeleteDisabled": "Eliminazione automatica disabilitata",
    "autoDeleteEnabled": "Eliminazione automatica abilitata",
    "autoDeleteUpdated": "Eliminazione automatica aggiornata",
    "autoresponderDeleted": "Autorisponditore eliminato",
    "autoresponderSaved": "Autorisponditore salvato",
    "blacklistUpdated": "Lista nera aggiornata",
    "bulkDeletedCount": "{ok}/{count} account eliminati",
    "bulkUpdatedCount": "{ok}/{count} account aggiornati",
    "calculatedScoresUpdated": "Punteggi calcolati aggiornati",
    "calendarCreated": "Calendario creato",
    "calendarDeleted": "Calendario eliminato",
    "calendarUpdated": "Calendario aggiornato",
    "cloneStarted": "Clonazione avviata — ti notificheremo al termine",
    "contactCreated": "Contatto creato",
    "contactDeleted": "Contatto eliminato",
    "contactUpdated": "Contatto aggiornato",
    "defaultAddressUpdated": "Indirizzo predefinito aggiornato per @{domain}",
    "defaultInboxSet": "{address} è ora l'email predefinita",
    "domainForwardDeleted": "Reindirizzamento globale di @{domain} eliminato",
    "emailRoutingUpdated": "Routing email aggiornato per @{domain}",
    "emailsCopied": "Copiate {count} email di {folder}",
    "emailsDeleted": "Eliminate {count} email di {folder}",
    "filterCreated": "Filtro creato",
    "filterDeleted": "Filtro eliminato",
    "filterUpdated": "Filtro aggiornato",
    "forwardAddedCount": "Inoltro aggiunto in {ok}/{count} account",
    "forwardDeleted": "Inoltro eliminato",
    "forwardsUpdated": "Inoltri aggiornati",
    "globalFilterCreated": "Filtro globale creato",
    "globalFilterDeleted": "Filtro globale eliminato",
    "globalFilterUpdated": "Filtro globale aggiornato",
    "globalRedirectSaved": "Reindirizzamento globale salvato per @{domain}",
    "keyDeleted": "Chiave eliminata.",
    "keyGenerated": "Chiave generata.",
    "passwordUpdated": "Password aggiornata",
    "publicKeyImported": "Chiave pubblica importata.",
    "settingsSaved": "Configurazione salvata ✓",
    "spamBoxDisabled": "Spam Box disabilitata",
    "spamBoxEnabled": "Spam Box abilitata",
    "spamBoxUpdated": "Spam Box aggiornata",
    "spamFiltersDisabled": "Filtri spam disabilitati",
    "spamFiltersEnabled": "Filtri spam abilitati",
    "spamThresholdUpdated": "Soglia spam aggiornata",
    "testEmailSent": "Email di prova inviata ✓",
    "whitelistUpdated": "Lista bianca aggiornata"
  },
  "signaturesDrawer": {
    "title": "Firme",
    "addSignature": "Aggiungi firma",
    "close": "Chiudi",
    "tableTitle": "firme"
  },
  "dataTableTitles": {
    "rules": "regole",
    "publicKeys": "chiavi pubbliche",
    "privateKeys": "chiavi private",
    "accounts": "account",
    "globalFilters": "filtri globali",
    "contacts": "contatti",
    "calendars": "calendari",
    "filters": "filtri"
  },
  "trackColumns": {
    "event": "Evento",
    "fromAddress": "Indirizzo di origine",
    "sentTime": "Ora di invio",
    "spamScore": "Punteggio spam",
    "recipient": "Destinatario",
    "domain": "Dominio",
    "queueId": "ID",
    "result": "Risultato",
    "actions": "Azioni"
  }
} as const;

export default mailPart2;
