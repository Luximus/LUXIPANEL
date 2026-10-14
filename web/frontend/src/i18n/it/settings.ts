const settings = {
  "passkeyName": {
    "title": "Nome della passkey",
    "hint": "Usa un nome che ti aiuti a riconoscere il dispositivo.",
    "placeholder": "Es. Portatile personale",
    "save": "Salva nome",
    "edit": "Modifica nome",
    "invalid": "Inserisci un nome da 1 a 128 caratteri.",
    "saved": "Nome aggiornato",
    "error": "Impossibile salvare il nome.",
    "cancel": "Annulla"
},
  "placeholders": {
    "logoUrl": "https://esempio.com/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "Impostazioni",
  "loadFailure": {
    "title": "Impossibile caricare le impostazioni",
    "sessionMessage": "Impossibile caricare le impostazioni: la sessione con il server non è disponibile. Riseleziona il server nel selettore oppure esci e accedi di nuovo.",
    "genericMessage": "Impossibile caricare le impostazioni. Controlla la connessione e riprova.",
    "retry": "Riprova"
  },
  "header": {
    "title": "Impostazioni del pannello",
    "subtitle": "Configurazione globale di LuxiPanel",
    "autosave": "Salvataggio automatico"
  },
  "tabs": {
    "general": "Generale",
    "layoutUi": "Layout/UI",
    "security": "Sicurezza",
    "modules": "Moduli",
    "system": "Sistema",
    "credentials": "Credenziali"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "Proteggi l'accesso al pannello con una verifica hCaptcha. Inserisci le chiavi dalla tua dashboard hCaptcha.",
      "sitekeyLabel": "Site key",
      "sitekeyPlaceholder": "La tua site key hCaptcha",
      "secretLabel": "Secret key",
      "secretPlaceholder": "Inserisci una nuova secret key",
      "secretConfigured": "Una secret key è già impostata. Lascia vuoto questo campo per mantenerla.",
      "statusConfigured": "Configurato",
      "statusMissing": "Non configurato",
      "saved": "Impostazioni hCaptcha salvate"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "Token API del tuo account Tolqia (piano Plus o Premium) — abilita le chiamate con traduzione per gli utenti di questo server",
      "guide": {
        "steps": [
          "Vai su tolqia.com e accedi al tuo account (piano Plus o Premium).",
          "Apri «Impostazioni» › «API» e crea un nuovo token.",
          "Copia il token (inizia con tq_live_) e incollalo in «Configura»."
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "Crea un token su tolqia.com → Impostazioni › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "Documentazione"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "Si usa per la traduzione in tempo reale delle chiamate audio",
      "voiceIdLabel": "Voice ID predefinito",
      "voiceIdPlaceholder": "es. 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "Vai su elevenlabs.io e accedi.",
          "Apri «My Account» → «API Keys» e crea una nuova chiave.",
          "Copia la chiave (inizia con sk_) e incollala in «Configura»."
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "Chiavi API di ElevenLabs"
      }
    },
    "title": "Credenziali dei moduli",
    "subtitle": "Gestisci i token di accesso e le chiavi API di cui i moduli hanno bisogno per funzionare.",
    "empty": "Nessun modulo che richiede credenziali è abilitato su questo server.",
    "statusSet": "Configurato",
    "statusMissing": "Non configurato",
    "tokenLabel": "Token di accesso / Chiave API",
    "tokenPlaceholder": "Incolla il token…",
    "save": "Salva",
    "test": "Prova",
    "clear": "Rimuovi",
    "manage": "Gestisci",
    "show": "Mostra",
    "hide": "Nascondi",
    "saved": "Credenziali salvate",
    "cleared": "Credenziali rimosse",
    "testOk": "Connessione valida",
    "testFail": "Impossibile convalidare le credenziali",
    "confirmClear": "Rimuovere queste credenziali?",
    "confirmClearTitle": "Rimuovi credenziali",
    "error": "Si è verificato un errore",
    "getDoc": "Ottieni un token",
    "managedLabel": {
      "assistant": "Agenti IA"
    },
    "managedHint": {
      "assistant": "Le chiavi API dei fornitori dell'assistente sono gestite nel suo pannello.",
      "backups": "Le chiavi di archiviazione (S3 / R2) sono gestite nel modulo Backup."
    },
    "managedSummary": {
      "assistant": "Provider IA (Claude, OpenAI, Gemini, …)",
      "backups": "Credenziali di archiviazione S3 / R2"
    },
    "storage": {
      "accountId": "ID account (Cloudflare)",
      "accessKeyId": "ID chiave di accesso",
      "secret": "Chiave di accesso segreta",
      "endpoint": "Endpoint (facoltativo)",
      "region": "Regione (facoltativa)",
      "r2Hint": "Credenziale R2 a livello di account riutilizzabile dai Backup: imposta le chiavi una sola volta qui e scegli semplicemente un bucket nei Backup.",
      "s3Hint": "Credenziale S3 riutilizzabile dai Backup: imposta le chiavi una sola volta qui e scegli semplicemente un bucket nei Backup."
    },
    "connector": {
      "connect": "Salva e connetti",
      "disconnect": "Disconnetti",
      "connected": "Connesso",
      "configured": "Configurato",
      "notConnected": "Non connesso",
      "unavailable": "Richiede il modulo Agenti IA abilitato",
      "setupGuide": "Guida alla configurazione"
    },
    "help": {
      "tabConfig": "Configura",
      "tabHelp": "Aiuto",
      "openLink": "Apri link",
      "guides": {
        "cloudflare": {
          "steps": [
            "Vai su dash.cloudflare.com → «Il mio profilo» → «Token API».",
            "Clicca «Crea token»: usa il modello «Modifica zona DNS» o creane uno personalizzato con i permessi necessari (Zona:Lettura, DNS:Modifica, ecc.).",
            "Scegli le zone a cui dare accesso e crea il token.",
            "Copia il token (mostrato una sola volta) e incollalo nella scheda «Configura»."
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "Token API Cloudflare"
        },
        "expo": {
          "steps": [
            "Vai su expo.dev e accedi → «Account settings» → «Access tokens».",
            "Clicca «Create token», assegnagli un nome e copia il valore generato.",
            "Incollalo nella scheda «Configura»."
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "Token di accesso Expo"
        },
        "openclaw": {
          "steps": [
            "Vai su openclaw.ai e accedi.",
            "Genera o copia la tua API key dal pannello di OpenClaw.",
            "Incollala in «Configura» (regola endpoint e modello predefinito se diversi)."
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "Vai su github.com → «Settings» → «Developer settings» → «Personal access tokens».",
            "Genera un token (classic o fine-grained) con permesso di lettura dei repository (public_repo o Contents: Read).",
            "Copia il token (inizia con ghp_ o github_pat_) e incollalo in «Configura»."
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "Token GitHub"
        },
        "bitninja": {
          "steps": [
            "Vai al pannello BitNinja (admin.bitninja.io) e accedi.",
            "Copia la tua License Key dalla sezione licenze/server.",
            "Incollala in «Configura»."
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "Vai su dash.cloudflare.com → «R2» → «Manage R2 API Tokens».",
            "Crea un «R2 API Token» (compatibile S3) con permesso di lettura/scrittura degli oggetti.",
            "Copia l'Access Key ID e il Secret Access Key visualizzati.",
            "Il tuo Account ID appare nella pagina R2 / riepilogo account.",
            "Incolla Account ID + Access Key ID + Secret in «Configura» (l'endpoint si ricava dall'Account ID)."
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "Token API R2"
        },
        "s3": {
          "steps": [
            "Nella console AWS: «IAM» → «Users» → il tuo utente → «Security credentials» → «Create access key».",
            "Copia l'Access Key ID e il Secret Access Key.",
            "Se usi un servizio compatibile con S3 (Wasabi, MinIO, ecc.), annota Endpoint e Regione.",
            "Incolla le chiavi (e Endpoint/Regione se applicabile) in «Configura»."
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "Chiavi di accesso AWS"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "Richiedi hCaptcha all'accesso",
    "hcaptchaEnabledHint": "Mostra una verifica hCaptcha nel modulo di accesso del pannello.",
    "sectionTitle": "Generale",
    "labelPanelName": "Nome del pannello",
    "labelTimezone": "Fuso orario",
    "labelLanguage": "Lingua",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "Durata sessione (ore)",
    "labelMaxLoginAttempts": "Tentativi di login falliti (blocco)",
    "labelRequire2fa": "Richiedere 2FA per tutti gli utenti",
    "btnViewLog": "Visualizza log",
    "labelAuditLog": "Abilita log di controllo",
    "labelSwitchNewTab": "Apri il server in una nuova scheda al cambio"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "(URL immagine)",
    "addButton": "Aggiungi immagine"
  },
  "layout": {
    "sectionTitle": "Layout, branding e UI",
    "sectionSubtitle": "Personalizza loghi, raggi, ombre e colori base del frontend.",
    "branding": {
      "groupTitle": "Branding e loghi",
      "groupDesc": "Logo unico applicato a sidebar, login, header, footer e favicon.",
      "labelLogoUrl": "URL logo",
      "logoUrlHelp": "Logo unico usato ovunque: sidebar, login, intestazione del pannello, footer e schermate pubbliche.",
      "btnUpload": "Carica",
      "btnPick": "Scegli",
      "btnDefault": "Predefinito",
      "restoreLogos": "Ripristina loghi",
      "loginLogoOpacity": "Opacità del contenitore del logo (login)",
      "loginLogoOpacityHelp": "Traslucenza dello sfondo del cerchio del logo su /login (0 = trasparente, 100 = solido)."
    },
    "loginBg": {
      "groupTitle": "Sfondo login",
      "groupDesc": "Effetto di sfondo animato su /login e il suo colore di riserva.",
      "enableLabel": "Mostra sfondo animato in /login",
      "labelFallbackColor": "Colore di sfondo quando è disattivato",
      "labelActiveEffect": "Effetto attivo in /login",
      "previewTitle": "Anteprima accesso"
    },
    "shape": {
      "groupTitle": "Forma e ombre",
      "groupDesc": "Raggio globale, ombre di card e modali del frontend.",
      "labelRadius": "Raggio globale",
      "radiusHelp": "Es: 0.5rem, 12px.",
      "labelShadow": "Ombra base",
      "labelModalShadow": "Ombra modale",
      "labelModalBackdrop": "Overlay modale",
      "backdropHelp": "Sfondo dei dialoghi.",
      "layer1": "Livello 1",
      "layer2": "Livello 2",
      "labelColor": "Colore",
      "labelShadowSingle": "Ombra"
    },
    "palettes": {
      "title": "Tema colore",
      "subtitle": "Scegli una palette predefinita; si applica all'intero pannello (chiaro e scuro).",
      "light": "Tema chiaro",
      "dark": "Tema scuro",
      "intensity": "Intensità"
    },
    "resetButton": "Ripristina stili predefiniti",
    "panelBg": {
      "groupTitle": "Sfondo del pannello",
      "groupDesc": "Effetto di sfondo animato all'interno del pannello e il suo colore di riserva.",
      "enableLabel": "Mostra sfondo animato sul pannello",
      "labelFallbackColor": "Colore di sfondo quando disattivato",
      "labelActiveEffect": "Effetto attivo del pannello"
    }
  },
  "security": {
    "sectionTitle": "Sicurezza",
    "loginMethodsTitle": "Metodi di accesso consentiti",
    "loginMethodsDesc": "Almeno un metodo deve rimanere attivo. I metodi disattivati non appariranno nella schermata di login.",
    "loginMethodsWarning": "Deve rimanere almeno un metodo attivo.",
    "passkey": {
      "name": "Passkey",
      "desc": "Autenticazione biometrica / FIDO2. Gli utenti devono registrare il proprio dispositivo.",
      "verifying": "Verifica in corso...",
      "btnManage": "Gestisci"
    },
    "password": {
      "name": "Password",
      "desc": "Login con nome utente e password. Sempre disponibile senza configurazione preliminare.",
      "configured": "Configurato"
    },
    "recovery": {
      "name": "Recupero",
      "desc": "Codici monouso come backup di emergenza.",
      "verifying": "Verifica in corso...",
      "btnManage": "Gestisci"
    },
    "twoFaStatus": {
      "groupTitle": "Stato 2FA per questo account",
      "badgeDisabled": "Disattivato",
      "promptText": "Attiva il 2FA per proteggere questo account amministrativo.",
      "btnSetup": "Configura",
      "btnDelete": "Elimina",
      "btnDisable": "Disabilita"
    }
  },
  "modules": {
    "sectionTitle": "Motori di cache per modulo",
    "sectionDesc1": "Stato e regolazione della raccolta pianificata sul server del cliente.",
    "sectionDescBold": "Attivo/Inattivo dipende dal modulo padre",
    "modulesLink": "Moduli",
    "sectionDesc2": ": disattivando un modulo si spegne la sua raccolta; riattivandolo viene riprogrammata. Qui si regola solo la frequenza. Le DataTable leggono i dati preformattati da Redis dedicato su quel server; se è spento o troppo vecchio si passa al JSON normale.",
    "loading": "Caricamento…",
    "tableHeaders": {
      "module": "Modulo / raccolta",
      "source": "Origine",
      "active": "Attivo",
      "interval": "Intervallo (s)",
      "lastRefresh": "Ultimo aggiornamento",
      "duration": "Durata",
      "size": "Dimensione",
      "hitRatio": "Hit ratio"
    },
    "managedInPre": " (gestito in ",
    "managedInPost": ")"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "Ripristina impostazioni",
      "sectionSubtitle": "Ripristina le impostazioni del pannello ai valori di fabbrica.",
      "warningTitle": "Avviso",
      "warningBefore": "Questa azione ripristina ",
      "warningAllSettings": "tutte le impostazioni di configurazione",
      "warningMiddle": " del pannello (generali, layout/UI, SMTP, sicurezza e le preferenze salvate dai moduli) ai valori predefiniti. Utenti e moduli installati ",
      "warningNotDeleted": "non vengono eliminati",
      "warningAfter": ".",
      "btnReset": "Ripristina impostazioni di fabbrica"
    },
    "backupRestore": {
      "sectionTitle": "Ripristina da backup",
      "sectionSubtitle": "Ripristina il pannello da un backup precedente (modulo Backup richiesto).",
      "loading": "Caricamento backup...",
      "btnRestore": "Ripristina backup selezionato"
    },
    "noBackup": {
      "title": "Ripristino da backup non disponibile",
      "descBefore": "Installa il modulo ",
      "backupsModule": "Backup",
      "descAfter": " dal pannello dei moduli per abilitare questa funzione."
    }
  },
  "imagePicker": {
    "title": "Scegli immagine",
    "subtitle": "Immagini disponibili nella cartella pubblica del frontend.",
    "empty": "Non ci sono immagini nella cartella pubblica.",
    "btnUpload": "Carica nuova immagine",
    "btnCancel": "Annulla"
  },
  "smtpTest": {
    "dialogTitle": "Invia email di prova",
    "labelRecipient": "Destinatario",
    "placeholderRecipient": "tu@esempio.com",
    "btnCancel": "Annulla",
    "btnSend": "Invia"
  },
  "passkeysDialog": {
    "title": "Gestisci Passkey",
    "btnAdd": "Aggiungi passkey",
    "empty": "Nessuna passkey registrata"
  },
  "recoveryDialog": {
    "title": "Codici di recupero",
    "btnGenerate": "Genera / rigenera",
    "loading": "Caricamento...",
    "warningText": "Conserva questi codici in un luogo sicuro. Vengono mostrati una sola volta.",
    "btnCopy": "Copia tutto",
    "btnPrint": "Stampa"
  },
  "setup2faDialog": {
    "title": "Configura 2FA",
    "subtitle": "Scansiona questo codice QR con la tua app di autenticazione.",
    "secretLabel": "Secret manuale:",
    "copyTitle": "Copia",
    "verifyLabel": "Inserisci il codice a 6 cifre:",
    "btnCancel": "Annulla",
    "btnActivate": "Attiva 2FA"
  },
  "disable2faDialog": {
    "title": "Disattivare il 2FA?",
    "body": "Il 2FA verrà disattivato, ma il segreto verrà conservato per poterlo riattivare in seguito.",
    "btnCancel": "Annulla",
    "btnConfirm": "Disabilita 2FA"
  },
  "delete2faDialog": {
    "title": "Eliminare il 2FA?",
    "body": "Il segreto memorizzato verrà eliminato e dovrai riconfigurarlo per utilizzare nuovamente il 2FA.",
    "btnCancel": "Annulla",
    "btnConfirm": "Elimina 2FA"
  },
  "auditLogDialog": {
    "title": "Log di controllo",
    "empty": "Nessuna attività registrata"
  },
  "modulesCache": {
    "agoSeconds": "fa {n}s",
    "agoMinutes": "fa {n}m",
    "agoHours": "fa {n}h",
    "agoDays": "fa {n}d",
    "collectionSingular": "raccolta",
    "collectionPlural": "raccolte",
    "activeSingular": "attiva",
    "activePlural": "attive",
    "enabledTitle": "Raccolta programmata tramite dispatcher del server client",
    "badgeEnabled": "Attiva",
    "disabledTitle": "Modulo genitore disattivato in /panel/modules — la raccolta rimane in pausa",
    "badgeDisabled": "Inattiva",
    "buttonSave": "Salva",
    "saving": "Salvando…",
    "savedStatus": "{module}/{collection} aggiornato",
    "saveError": "Errore nel salvataggio di {module}/{collection}: {message}",
    "loadedSummary": "{count} collezioni cacheable in {modules} moduli. I cambiamenti si applicano al prossimo ciclo del raccoglitore (≤60s).",
    "loadError": "Errore: {message}"
  },
  "labels": {
    "auditLogin": "Accesso",
    "auditLoginFailed": "Tentativo di accesso fallito",
    "auditLogout": "Disconnessione",
    "auditPasswordChange": "Cambio password",
    "auditPasskeyRegister": "Passkey registrata",
    "auditPasskeyDelete": "Passkey eliminata",
    "auditRecoveryCodeUsed": "Codice di recupero utilizzato",
    "auditProfileUpdate": "Profilo aggiornato",
    "auditSettingsUpdate": "Impostazioni aggiornate",
    "audit2faEnabled": "2FA abilitato",
    "audit2faDisabled": "2FA disabilitato",
    "auditEventDefault": "Evento",
    "aiHintAnthropic": "Modelli consigliati: claude-fable-5 (più recente), claude-sonnet-4-6 (bilanciato), claude-opus-4-6 (più potente)",
    "aiKeyHintAnthropic": "Ottieni la tua API key su console.anthropic.com",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "Ottieni la tua API key su platform.openai.com",
    "aiHintOllama": "Nome del modello installato in Ollama locale. Non supporta strumenti.",
    "aiKeyHintOllama": "Nessuna API key richiesta per Ollama locale",
    "managedByLp": "Gestito da LP-LICENSE-SERVER",
    "notAvailable": "Non disponibile",
    "managedExternally": "Gestito esternamente",
    "twoFaManagedByLp": "L'autenticazione è gestita da LP-LICENSE-SERVER in questa modalità.",
    "licenseNoStatus": "Nessuno stato",
    "licenseActive": "Attiva",
    "licenseExpires": "scade il {date}",
    "licenseActiveDesc": "Licenza attiva",
    "licenseDegraded": "Degradata",
    "licensePending": "In attesa",
    "licenseDegradedDesc": "La licenza non ha potuto essere convalidata e il pannello è in modalità degradata.",
    "licenseNotActivated": "La licenza non è ancora attivata.",
    "passkeyCount": "{count} passkey registrata/e",
    "noPasskeys": "Nessuna passkey registrata",
    "recoveryCodesGenerated": "Codici di recupero generati",
    "noRecoveryCodes": "Nessun codice generato",
    "passkeyRegistered": "Registrata il {date}",
    "recoveryCodesActive": "Hai codici di recupero attivi.",
    "recoveryCodesNone": "Non hai codici di recupero attivi.",
    "recoveryCodesDisplayed": "{count} codici generati. Conservali in un posto sicuro.",
    "twoFaEnabled": "Attivato",
    "twoFaEnabledDesc": "Questo 2FA verrà richiesto al prossimo accesso. Puoi disabilitarlo senza eliminare il segreto.",
    "twoFaDisabled": "Disattivato",
    "twoFaDisabledDesc": "Il segreto è ancora salvato, ma non verrà richiesto all'accesso finché non lo riattivi.",
    "twoFaSetupPrompt": "Attiva il 2FA per proteggere questo account amministrativo.",
    "printRecoveryCodesTitle": "Codici di recupero - LUXIPANEL",
    "printRecoveryCodesDesc": "Conserva questi codici in un posto sicuro. Ognuno può essere usato una sola volta."
  },
  "toasts": {
    "errorSaving": "Errore nel salvataggio delle impostazioni",
    "errorSavingAppearance": "Impossibile salvare l'aspetto sul server delle licenze. Riprova tra qualche secondo.",
    "licenseKeyAndRefRequired": "Inserisci la chiave e il riferimento di pagamento",
    "licenseActivated": "Licenza attivata correttamente",
    "licenseActivateError": "Impossibile attivare la licenza",
    "timezoneApplyError": "Impossibile applicare il fuso orario al sistema",
    "timezoneSavedNotApplied": "Fuso orario salvato nel pannello, ma impossibile applicarlo al sistema (verifica i permessi sudo).",
    "passkeysInLp": "Le Passkey sono gestite in LP-LICENSE-SERVER",
    "passkeyDeleted": "Passkey eliminata",
    "passkeyDeleteError": "Errore nell'eliminazione della passkey",
    "passkeyBrowserUnsupported": "Il tuo browser non supporta le Passkey",
    "passkeyRegisterInitError": "Impossibile avviare la registrazione",
    "passkeyRegisterCancelled": "Registrazione annullata",
    "passkeyRegisterFinishError": "Errore nel completamento della registrazione",
    "passkeyRegistered": "Passkey registrata correttamente",
    "passkeyRegisterUserCancelled": "Registrazione annullata dall'utente",
    "passkeyRegisterError": "Errore nella registrazione della passkey",
    "recoveryCodesInLp": "I codici di recupero sono gestiti in LP-LICENSE-SERVER",
    "recoveryCodesGenerateError": "Errore nella generazione dei codici",
    "twoFaInLp": "Il 2FA è gestito in LP-LICENSE-SERVER",
    "twoFaSetupInitError": "Errore nell'avvio della configurazione 2FA",
    "twoFaQrError": "Impossibile generare il QR",
    "twoFaActivated": "2FA attivato correttamente",
    "twoFaDisabled": "2FA disabilitato per l'accesso",
    "twoFaDisableError": "Errore nella disattivazione del 2FA",
    "twoFaReactivated": "2FA attivato per l'accesso",
    "twoFaActivateError": "Errore nell'attivazione del 2FA",
    "twoFaDeleted": "2FA eliminato",
    "twoFaDeleteError": "Errore nell'eliminazione del 2FA",
    "backupRestoreUnavailable": "Il ripristino dei backup non è ancora disponibile da questo pannello.",
    "imageExceeds5mb": "L'immagine supera i 5 MB",
    "uploadingImage": "Caricamento immagine...",
    "imageUploadError": "Errore nel caricamento dell'immagine",
    "imageUploadInvalidResponse": "Risposta non valida dal server",
    "imageUploaded": "Immagine caricata correttamente",
    "logosRestored": "Logo ripristinati ai valori predefiniti",
    "codesCopied": "Codici copiati",
    "secretCopied": "Segreto copiato",
    "smtpTestSent": "Email di prova inviata a {to}",
    "smtpTestError": "Errore nell'invio",
    "layoutReset": "Stili ripristinati ai valori predefiniti",
    "settingsReset": "Impostazioni ripristinate",
    "settingsResetError": "Errore nel ripristino",
    "licenseRevalidated": "Licenza rivalidata",
    "licenseRevalidateError": "Impossibile rivalidare la licenza"
  },
  "actions": {
    "activating": "Attivando...",
    "activateOrUpdate": "Attiva / aggiorna",
    "manage": "Gestisci",
    "configure": "Configura",
    "viewOrRegenerate": "Visualizza / rigenera",
    "generate": "Genera",
    "generating": "Generando...",
    "generateOrRegenerate": "Genera / rigenera",
    "disable": "Disabilita",
    "activate": "Attiva",
    "activate2fa": "Attiva 2FA",
    "continue": "Continua",
    "sending": "Inviando...",
    "send": "Invia",
    "resetting": "Ripristinando...",
    "factoryReset": "Ripristina impostazioni di fabbrica"
  },
  "errors": {
    "twoFaEnter6Digits": "Inserisci le 6 cifre del codice",
    "twoFaInvalidCode": "Codice non valido"
  },
  "confirm": {
    "deletePasskeyTitle": "Elimina passkey",
    "deletePasskeyBody": "Eliminare questa passkey?",
    "restoreBackupBody": "Ripristinare il backup \"{id}\"?",
    "restoreBackupTitle": "Ripristina backup",
    "restoreLogosBody": "Ripristinare il logo ai valori predefiniti di LUXIPANEL?",
    "restoreLogosTitle": "Ripristina logo",
    "restoreLogosConfirm": "Sì, ripristina",
    "resetLayoutBody": "Ripristinare gli stili dell'interfaccia ai valori predefiniti di LUXIPANEL? Andranno persi logo, colori, ombre e sfondi personalizzati.",
    "resetLayoutTitle": "Ripristina stili",
    "resetLayoutConfirm": "Sì, ripristina",
    "factoryResetBody": "Sei sicuro? Questa operazione ripristinerà tutte le impostazioni del pannello.",
    "factoryResetTitle": "Ripristina impostazioni",
    "factoryResetConfirm": "Sì, ripristina"
  },
  "empty": {
    "noBackups": "Nessun backup disponibile."
  },
  "palettes": {
    "violet": {
      "name": "Viola",
      "description": "Palette predefinita di LUXIPANEL."
    },
    "ocean": {
      "name": "Oceano",
      "description": "Blu professionali e sereni."
    },
    "emerald": {
      "name": "Smeraldo",
      "description": "Verdi freschi e naturali."
    },
    "sunset": {
      "name": "Tramonto",
      "description": "Arancioni e ambra caldi."
    },
    "rose": {
      "name": "Rosa",
      "description": "Rosa e magenta vibranti."
    },
    "indigo": {
      "name": "Indaco",
      "description": "Indaco elegante e moderno."
    },
    "aqua": {
      "name": "Acqua",
      "description": "Turchesi e ciano luminosi."
    },
    "graphite": {
      "name": "Grafite",
      "description": "Neutro monocromatico e sobrio."
    },
    "amber": {
      "name": "Ambra",
      "description": "Dorati e miele caldi."
    },
    "fuchsia": {
      "name": "Fucsia",
      "description": "Magenta e viola intensi."
    },
    "lime": {
      "name": "Lime",
      "description": "Verdi lime energici."
    },
    "slate": {
      "name": "Ardesia",
      "description": "Grigio azzurrato professionale."
    },
    "prisma": {
      "name": "Prisma",
      "description": "Combina i colori di tutte le palette in una transizione continua e infinita.",
      "colors": "Colori",
      "addColorButton": "Aggiungi colore",
      "addColorAria": "Seleziona e aggiungi un colore all'effetto Prisma",
      "addColorInputAria": "Colore da aggiungere all'effetto Prisma",
      "editColorAria": "Modifica colore",
      "editColorInputAria": "Modifica valore del colore",
      "editColorHexAria": "Valore esadecimale del colore",
      "removeColorAria": "Rimuovi colore",
      "moveUpAria": "Sposta colore in alto",
      "moveDownAria": "Sposta colore in basso",
      "helpText": "Riordina l'elenco con le frecce. Ogni colore definisce la sequenza dell'effetto."
    },
    "custom": {
      "name": "Personalizzato",
      "description": "Scegli il tuo colore base e regola la sua intensità.",
      "baseColor": "Colore base",
      "baseColorAria": "Colore base personalizzato",
      "hexAria": "Valore esadecimale del colore base personalizzato"
    },
    "luxisoft": {
      "description": "Blu navy e menta in modalità chiara; grafite e menta in modalità scura.",
      "name": "Luxisoft"
    }
  },
  "managers": {
    "default": "Gestore 1"
  },
  "git": {
    "errorFallback": "Errore"
  }
} as const;

export default settings;
