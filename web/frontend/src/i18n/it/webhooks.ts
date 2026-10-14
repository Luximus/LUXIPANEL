const webhooks = {
  "pageTitle": "Webhook e API Key",
  "tabs": {
    "webhooks": "Webhook",
    "apiKeys": "API Key",
    "discovered": "Rilevati"
  },
  "webhooksPanel": {
    "description": "Notifiche HTTP in uscita con firma HMAC",
    "btnNew": "Nuovo webhook"
  },
  "apiKeysPanel": {
    "description": "Accesso programmatico con token permanenti",
    "btnNew": "Nuova API Key"
  },
  "newKeyReveal": {
    "message": "API Key creata — copiala ora, non verrà mostrata di nuovo",
    "btnCopy": "Copia"
  },
  "webhookDialog": {
    "placeholderUrl": "https://esempio.it/webhook",
    "title": "Nuovo webhook",
    "labelUrl": "URL endpoint",
    "labelEvents": "Eventi da ascoltare",
    "labelEnabled": "Webhook attivo",
    "btnCancel": "Annulla",
    "btnSave": "Salva"
  },
  "apiKeyDialog": {
    "placeholderName": "La mia integrazione",
    "title": "Nuova API Key",
    "labelName": "Nome descrittivo",
    "labelExpires": "Scade (facoltativo)",
    "btnCancel": "Annulla",
    "btnCreate": "Crea chiave"
  },
  "discovered": {
    "description": "Webhook rilevati sul server (Git, nginx, cron, systemd, file di configurazione e progetti)",
    "btnRescan": "Riscansiona",
    "scanning": "Scansione del server…",
    "empty": "Nessun webhook rilevato sul server",
    "cols": {
      "source": "Origine",
      "name": "Nome",
      "target": "Destinazione",
      "location": "Posizione",
      "estado": "Stato"
    },
    "filters": {
      "searchTarget": "Cerca destinazione…",
      "source": "Origine"
    },
    "sources": {
      "sidecar": "Pannello",
      "git-hook": "Git hook",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "Config",
      "project": "Progetto"
    },
    "status": {
      "enabled": "Attivo",
      "disabled": "Inattivo",
      "unknown": "—"
    },
    "actions": {
      "detail": "Vedi dettaglio",
      "delete": "Elimina"
    },
    "detail": {
      "title": "Dettaglio del webhook rilevato",
      "source": "Origine",
      "target": "Destinazione",
      "location": "Posizione",
      "info": "Informazioni",
      "raw": "Configurazione",
      "managedNote": "Questo webhook è gestito dal pannello",
      "readonlyNote": "Sola lettura: gestiscilo dal modulo corrispondente",
      "btnClose": "Chiudi"
    },
    "confirm": {
      "deleteTitle": "Elimina webhook rilevato",
      "deleteBody": "Eliminare \"{name}\"? Questo modifica il file sul server.",
      "deleteBtn": "Sì, elimina"
    },
    "toasts": {
      "deleted": "Eliminato",
      "errorDeleting": "Impossibile eliminare",
      "scanComplete": "Scansione completata: {count}",
      "notManageable": "Gestiscilo dal modulo corrispondente"
    }
  },
  "labels": {
    "statusFailing": "Non funzionante",
    "statusActive": "Attivo",
    "statusPaused": "In pausa",
    "newWebhookTitle": "Nuovo webhook",
    "noExpiry": "Senza scadenza"
  },
  "confirm": {
    "rotateSecretBody": "Ruotare il secret di questo webhook? Dovrai aggiornare il ricevitore.",
    "rotateSecretTitle": "Ruota secret",
    "rotateSecretBtn": "Sì, ruota",
    "deleteWebhookBody": "Eliminare questo webhook?",
    "deleteWebhookTitle": "Elimina webhook",
    "revokeKeyBody": "Revocare la API key \"{name}\"?",
    "revokeKeyTitle": "Revoca API key",
    "revokeKeyBtn": "Sì, revoca"
  },
  "toasts": {
    "secretRotated": "Secret ruotato",
    "errorRotating": "Errore nella rotazione",
    "webhookDeleted": "Webhook eliminato",
    "errorDeleting": "Errore nell'eliminazione",
    "webhookUpdated": "Webhook aggiornato",
    "webhookCreated": "Webhook creato",
    "errorSaving": "Errore nel salvataggio",
    "keyRevoked": "Key revocata",
    "errorRevoking": "Errore nella revoca",
    "copiedToClipboard": "Copiato negli appunti",
    "errorCreatingKey": "Errore nella creazione della key"
  },
  "categories": {
    "receiveData": "Ricevere dati",
    "mailhook": "Mailhook",
    "response": "Risposta webhook",
    "soon": "Prossimamente",
    "soonDesc": "La configurazione e la scansione di questa categoria saranno definite in una fase successiva."
  },
  "gateway": {
    "description": "Endpoint ospitati dal pannello per ricevere dati in ingresso (stile Make.com). Autenticazione tramite API key (x-make-apikey), restrizione per IP e validazione della struttura dei dati.",
    "btnNew": "Nuovo webhook",
    "detectedTitle": "Ricevitori rilevati nel server",
    "urlReveal": "URL webhook — invia le richieste qui",
    "cols": {
      "name": "Nome",
      "auth": "Auth",
      "recibidos": "Ricevuti",
      "ultima": "Ultimo",
      "estado": "Stato",
      "estadoActive": "Attivo",
      "estadoPaused": "In pausa"
    },
    "dialog": {
      "titleNew": "Crea un webhook",
      "titleEdit": "Modifica webhook",
      "name": "Nome webhook",
      "namePlaceholder": "Mio webhook gateway",
      "nameHint": "Deve contenere tra 1 e 128 caratteri.",
      "apiAuth": "Autenticazione tramite API key",
      "apiAuthHint": "Invia la API key nell'intestazione x-make-apikey. Aggiungi una o più chiavi; se una corrisponde, viene concesso l'accesso.",
      "apiKeyName": "Nome",
      "apiKeyValue": "Valore API key",
      "apiKeyKeep": "(salvata — lascia vuoto per mantenere)",
      "addApiKey": "Aggiungi API key",
      "ipTitle": "Restrizioni IP",
      "ipHint": "Elenco di IP separati da virgola. Puoi usare la notazione CIDR. Vuoto = nessun controllo.",
      "dataStructure": "Struttura dati",
      "dataStructureHint": "Convalida dei dati in arrivo. Vuoto = accettati senza convalida.",
      "dsValidate": "Convalida struttura dati",
      "dsStrict": "Rigoroso (rifiuta campi non specificati)",
      "dsFieldName": "Nome",
      "dsFieldDesc": "Descrizione",
      "dsFieldType": "Tipo",
      "dsFieldDefault": "Valore predefinito",
      "dsFieldRequired": "Richiesto",
      "dsFieldMultiline": "Multilinea",
      "addItem": "Aggiungi campo",
      "getHeaders": "Ottieni intestazioni della richiesta",
      "getHeadersHint": "Le intestazioni verranno aggiunte al corpo.",
      "getMethod": "Ottieni metodo HTTP",
      "getMethodHint": "Il metodo (verbo) verrà aggiunto al corpo.",
      "jsonPassthrough": "Salva JSON come testo",
      "jsonPassthroughHint": "Se abilitato, il payload JSON viene salvato come stringa.",
      "enabled": "Webhook attivo",
      "advanced": "Impostazioni avanzate",
      "btnCancel": "Annulla",
      "btnSave": "Salva"
    },
    "payloads": {
      "title": "Payload ricevuti",
      "empty": "Nessun payload ricevuto finora.",
      "btnClose": "Chiudi"
    },
    "confirm": {
      "deleteTitle": "Elimina webhook",
      "deleteBody": "Eliminare il webhook \"{name}\"? I payload archiviati andranno persi.",
      "deleteBtn": "Sì, elimina"
    },
    "toasts": {
      "created": "Webhook creato",
      "updated": "Webhook aggiornato",
      "deleted": "Webhook eliminato",
      "copied": "URL copiato",
      "error": "Errore durante il salvataggio"
    }
  },
  "table": {
    "gateway": {
      "columns": {
        "name": "Nome",
        "auth": "Auth",
        "recibidos": "Ricevuti",
        "ultima": "Ultimo",
        "estado": "Stato"
      },
      "filters": {
        "searchName": "Cerca nome…",
        "estado": "Stato"
      },
      "rowActions": {
        "copy": "Copia URL",
        "payloads": "Vedi payload",
        "edit": "Modifica",
        "delete": "Elimina"
      },
      "options": {
        "statusActive": "Attivo",
        "statusPaused": "In pausa"
      }
    },
    "webhooks": {
      "columns": {
        "url": "URL",
        "eventos": "Eventi",
        "estado": "Stato"
      },
      "filters": {
        "searchUrl": "Cerca URL…",
        "estado": "Stato"
      },
      "rowActions": {
        "regenerate": "Ruota secret",
        "delete": "Elimina"
      },
      "options": {
        "statusActive": "Attivo",
        "statusPaused": "In pausa",
        "statusFailing": "Non funzionante"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "Nome",
        "prefix": "Prefisso",
        "creada": "Creata",
        "expira": "Scade"
      },
      "filters": {
        "searchName": "Cerca nome…"
      },
      "rowActions": {
        "revoke": "Revoca"
      }
    },
    "discovered": {
      "columns": {
        "origen": "Origine",
        "name": "Nome",
        "target": "Destinazione",
        "location": "Posizione",
        "estado": "Stato"
      },
      "filters": {
        "searchTarget": "Cerca destinazione…",
        "origen": "Origine"
      },
      "rowActions": {
        "detail": "Vedi dettaglio",
        "delete": "Elimina"
      },
      "options": {
        "panel": "Pannello",
        "gitHook": "Git hook",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "Config",
        "proyecto": "Progetto"
      }
    }
  },
  "runtime": {
    "testDelivered": "Test consegnato correttamente.",
    "testFailed": "La consegna di prova non è riuscita.",
    "loadingDeliveries": "Caricamento delle consegne…",
    "loadDeliveriesError": "Impossibile caricare le consegne.",
    "noDeliveries": "Non sono ancora state registrate consegne.",
    "delivered": "Consegnato",
    "failed": "Non riuscito",
    "attempts": "Tentativi: {count}",
    "selectEvent": "Seleziona almeno un evento."
  },
  "settingsUi": {
    "title": "Impostazioni Webhooks",
    "description": "Paginazione e azioni visibili delle tabelle Webhooks.",
    "gateway": "Gateway",
    "webhooks": "Webhooks",
    "signingSecret": "Segreto di firma · copialo ora",
    "signingSecretHint": "Viene mostrato una sola volta. Configuralo nel destinatario per verificare X-Luxipanel-Signature.",
    "recentDeliveries": "Consegne recenti"
  }
} as const;

export default webhooks;
