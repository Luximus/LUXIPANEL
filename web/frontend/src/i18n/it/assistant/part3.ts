const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "Intensità",
        "choices": {
          "off": "Spento",
          "lite": "Lite — suggerisci l'alternativa più semplice",
          "full": "Full — applica la scala",
          "ultra": "Ultra — estremista YAGNI"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "Dettaglio",
        "choices": {
          "breve": "Breve (token minimi)",
          "completo": "Completo (più dettaglio)"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "Esegui comando bash"
    },
    "admin.restart_service": {
      "title": "Riavvia servizio systemd"
    },
    "backup.list_jobs": {
      "title": "Elenca backup configurati"
    },
    "bitninja.status": {
      "title": "Stato BitNinja"
    },
    "cloudflare.status": {
      "title": "Stato Cloudflare"
    },
    "cloudflare.list_zones": {
      "title": "Elenca zone Cloudflare"
    },
    "cloudflare.list_dns_records": {
      "title": "Elenca record DNS"
    },
    "cloudflare.create_dns_record": {
      "title": "Crea record DNS"
    },
    "cloudflare.update_dns_record": {
      "title": "Aggiorna record DNS"
    },
    "cloudflare.delete_dns_record": {
      "title": "Elimina record DNS"
    },
    "cloudflare.purge_cache": {
      "title": "Svuota cache Cloudflare"
    },
    "cloudflare.get_zone_settings": {
      "title": "Visualizza impostazioni zona"
    },
    "cloudflare.set_zone_setting": {
      "title": "Modifica impostazione zona"
    },
    "cloudflare.list_access_rules": {
      "title": "Elenca regole accesso IP"
    },
    "cloudflare.block_ip": {
      "title": "Blocca IP in Cloudflare"
    },
    "cron.list": {
      "title": "Elenca task cron"
    },
    "cron.add": {
      "title": "Crea task cron"
    },
    "cron.update": {
      "title": "Modifica task cron"
    },
    "cron.toggle": {
      "title": "Pausa/riprendi task cron"
    },
    "cron.remove": {
      "title": "Elimina task cron"
    },
    "cron.ai_list": {
      "title": "Elenca agenti IA programmati"
    },
    "cron.ai_logs": {
      "title": "Elenca esecuzioni agente IA"
    },
    "cron.ai_read_log": {
      "title": "Leggi esecuzione agente IA"
    },
    "cron.ai_run": {
      "title": "Esegui agente IA programmato ora"
    },
    "cron.ai_toggle": {
      "title": "Pausa/riprendi agente IA programmato"
    },
    "cron.ai_add": {
      "title": "Crea agente IA programmato"
    },
    "cron.ai_update": {
      "title": "Modifica agente IA programmato"
    },
    "cron.ai_remove": {
      "title": "Elimina agente IA programmato"
    },
    "cron.presets_get": {
      "title": "Leggi configurazione agente (preset)"
    },
    "cron.presets_set": {
      "title": "Salva configurazione agente (preset)"
    },
    "dashboard.overview": {
      "title": "Panoramica server"
    },
    "databases.list_engines": {
      "title": "Rileva motori database"
    },
    "databases.list_databases": {
      "title": "Elenca database"
    },
    "databases.list_tables": {
      "title": "Elenca tabelle"
    },
    "databases.run_query": {
      "title": "Esegui query SQL"
    },
    "expo.status": {
      "title": "Stato Expo"
    },
    "expo.account": {
      "title": "Account Expo"
    },
    "expo.list_projects": {
      "title": "Elenca progetti Expo"
    },
    "expo.project_info": {
      "title": "Info progetto"
    },
    "expo.init_project": {
      "title": "Crea progetto Expo"
    },
    "expo.link_project": {
      "title": "Collega progetto a EAS"
    },
    "expo.build": {
      "title": "Avvia build EAS"
    },
    "expo.build_list": {
      "title": "Cronologia build"
    },
    "expo.build_view": {
      "title": "Stato build"
    },
    "expo.build_cancel": {
      "title": "Annulla build"
    },
    "expo.submit": {
      "title": "Invia allo store"
    },
    "expo.dev_client": {
      "title": "Avvia dev-client (QR)"
    },
    "expo.quota": {
      "title": "Quota build"
    },
    "expo.update": {
      "title": "Pubblica OTA update"
    },
    "expo.env_list": {
      "title": "Elenca variabili EAS"
    },
    "expo.env_set": {
      "title": "Crea variabile EAS"
    },
    "expo.set_google_credential": {
      "title": "Credenziale Play Store"
    },
    "expo.set_apple_credential": {
      "title": "Credenziale App Store"
    },
    "expo.webhook_create": {
      "title": "Registra webhook EAS"
    },
    "expo.device_create": {
      "title": "Registra dispositivo iOS"
    },
    "files.read": {
      "title": "Leggi file"
    },
    "files.list_dir": {
      "title": "Elenca directory"
    },
    "files.grep": {
      "title": "Cerca in file"
    },
    "files.project_info": {
      "title": "Rileva tipo progetto"
    },
    "files.security_scan": {
      "title": "Scan sicurezza euristico"
    },
    "files.write": {
      "title": "Scrivi file"
    },
    "files.mkdir": {
      "title": "Crea cartella"
    },
    "files.delete": {
      "title": "Elimina file o cartella"
    },
    "files.rename": {
      "title": "Rinomina o sposta"
    },
    "files.copy": {
      "title": "Copia file"
    },
    "files.chmod": {
      "title": "Modifica permessi (chmod)"
    },
    "files.chown": {
      "title": "Modifica proprietario (chown)"
    },
    "firewall.ufw_status": {
      "title": "Stato UFW"
    },
    "firewall.fail2ban_status": {
      "title": "Stato fail2ban (jail)"
    },
    "hosting.list_accounts": {
      "title": "Elenca account hosting"
    },
    "hosting.list_audit": {
      "title": "Visualizza audit account hosting"
    },
    "hosting.account_stats": {
      "title": "Statistiche utilizzo account hosting"
    },
    "mail.list_domains": {
      "title": "Domini disponibili"
    },
    "mail.list_messages": {
      "title": "Elenca messaggi casella"
    },
    "mail.fetch_message": {
      "title": "Leggi messaggio completo"
    },
    "mail.move_messages": {
      "title": "Sposta messaggi in quarantena"
    },
    "mail.flag_messages": {
      "title": "Contrassegna messaggi"
    },
    "mail.delete_messages": {
      "title": "Elimina messaggi (permanente)"
    },
    "module-dev.validate_manifest": {
      "title": "Valida manifest"
    },
    "module-dev.run_checks": {
      "title": "Check statici modulo"
    },
    "module-dev.run_tests": {
      "title": "Esegui test modulo"
    },
    "module-dev.list_modules": {
      "title": "Miei moduli marketplace"
    },
    "module-dev.module_status": {
      "title": "Stato modulo"
    },
    "module-dev.submit_module": {
      "title": "Invia modulo a revisione"
    },
    "module-dev.resubmit_module": {
      "title": "Reinvia modulo corretto"
    },
    "module-dev.unpublish_module": {
      "title": "Annulla pubblicazione modulo"
    },
    "module-dev.republish_module": {
      "title": "Ripubblica modulo"
    },
    "module-dev.preview_install": {
      "title": "Installa anteprima (Modalità B)"
    },
    "module-dev.preview_uninstall": {
      "title": "Disinstalla anteprima"
    },
    "module-dev.link_project": {
      "title": "Collega progetto ↔ modulo"
    },
    "monitor.cpu_top": {
      "title": "Processi CPU principale"
    },
    "monitor.watchdog_status": {
      "title": "Stato auto-riavvio"
    },
    "monitor.watchdog_configure": {
      "title": "Configura auto-riavvio"
    },
    "nginx.list_sites": {
      "title": "Elenca siti nginx"
    },
    "nginx.tail_access_log": {
      "title": "Coda access.log"
    },
    "obsidian.list_vaults": {
      "title": "Elenca vault"
    },
    "obsidian.list_notes": {
      "title": "Elenca note"
    },
    "obsidian.read_note": {
      "title": "Leggi nota"
    },
    "obsidian.search_notes": {
      "title": "Cerca in note"
    },
    "obsidian.backlinks": {
      "title": "Backlink nota"
    },
    "obsidian.write_note": {
      "title": "Scrivi nota"
    },
    "obsidian.append_note": {
      "title": "Aggiungi a nota"
    },
    "obsidian.daily_note": {
      "title": "Nota giornaliera"
    },
    "obsidian.delete_note": {
      "title": "Elimina nota"
    },
    "obsidian.list_containers": {
      "title": "Elenca contenitori contesto"
    },
    "obsidian.sync_containers": {
      "title": "Sincronizza contenitori contesto"
    },
    "openclaw.config": {
      "title": "Configurazione OpenClaw"
    },
    "openclaw.test_connection": {
      "title": "Test connessione OpenClaw"
    },
    "security-audit.last_report": {
      "title": "Ultimo rapporto audit"
    },
    "security-audit.ssh_posture": {
      "title": "Postura SSH server"
    },
    "server-alerts.send": {
      "title": "Invia notifica a server"
    },
    "server-alerts.list_rules": {
      "title": "Elenca regole allarme"
    },
    "server-alerts.create_rule": {
      "title": "Crea regola allarme"
    },
    "users.list": {
      "title": "Elenca utenti pannello"
    },
    "users.create": {
      "title": "Crea utente"
    },
    "users.update": {
      "title": "Modifica utente"
    },
    "users.delete": {
      "title": "Elimina utente"
    },
    "users.groups_list": {
      "title": "Elenca gruppi con permessi"
    },
    "users.group_create": {
      "title": "Crea gruppo"
    },
    "users.group_update": {
      "title": "Modifica gruppo"
    },
    "users.group_delete": {
      "title": "Elimina gruppo"
    },
    "webhooks.list": {
      "title": "Elenca webhook configurati"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "Salute server",
      "description": "Verifica rapida della raggiungibilità e del carico del server connesso, utile come contesto prima di rispondere a domande operative."
    },
    "dashboard.snapshot": {
      "title": "Panoramica compatta",
      "description": "Riepilogo breve del server connesso prima della risposta: carico, RAM usata, disco principale utilizzato e numero di servizi principali attivi."
    },
    "monitor.snapshot": {
      "title": "Snapshot sistema",
      "description": "Riepilogo attuale delle risorse del server connesso: uso della CPU, carico medio, memoria usata e totale e uso del filesystem principale."
    },
    "obsidian.vaults_summary": {
      "title": "Riepilogo vault",
      "description": "Vault Obsidian registrati sul server connesso, con percorso, disponibilità e numero di note Markdown."
    }
  },
  "structurePanel": {
    "editorLoading": "Caricamento editor...",
    "loading": "Caricamento...",
    "createdNotice": "Creati {count} elemento(i).",
    "nothingToCreate": "Niente da creare (già esisteva).",
    "savedNotice": "Salvato {rel}.",
    "noActiveProviders": "Nessun provider IA attivo. Attivane uno in Provider.",
    "improvedNotice": "Migliorato con IA. Rivedi il diff e fai clic su Salva se ti piace.",
    "noAiChanges": "L'IA non ha proposto modifiche.",
    "structureLoading": "Analisi struttura...",
    "retry": "Riprova",
    "copyAllContent": "Copia tutto il contenuto",
    "copied": "Copiato",
    "copy": "Copia",
    "downloadFile": "Scarica file",
    "download": "Scarica",
    "diff": "Diff",
    "originalDiffTitle": "Visualizza differenze rispetto al contenuto originale",
    "back": "Indietro",
    "improveContentTitle": "Migliora il contenuto con IA utilizzando il contesto del progetto",
    "improving": "Miglioramento...",
    "improveWithAi": "Migliora con IA",
    "cancel": "Annulla",
    "saving": "Salvataggio...",
    "save": "Salva",
    "chooseProvider": "Scegli il provider IA",
    "close": "Chiudi",
    "noModel": "(nessun modello)",
    "directory": "Directory",
    "structureCount": "Struttura · {count} da creare",
    "markMissing": "Contrassegna mancanti",
    "creating": "Creazione...",
    "create": "Crea ({count})",
    "expand": "Espandi",
    "collapse": "Comprimi",
    "edit": "Modifica",
    "exists": "Esiste",
    "createLabel": "creare",
    "fallbackFilename": "file.txt",
    "structureHints": {
      "claude": "Istruzioni, configurazione, regole, comandi, skill, agenti e hook che Claude Code legge dalla directory del progetto.",
      "codex": "Codex CLI legge AGENTS.md come guida del progetto e .codex/ per la configurazione e i prompt.",
      "gemini": "Gemini CLI legge GEMINI.md come contesto del progetto e .gemini/ per la configurazione e i comandi."
    },
    "structureNodes": {
      "CLAUDE.md": "Istruzioni del progetto (contesto, comandi, convenzioni)",
      "CLAUDE.local.md": "Istruzioni locali (non effettuare il commit; preferenze personali)",
      ".mcp.json": "Server MCP del progetto",
      ".claude/settings.json": "Configurazione del progetto (versionata)",
      ".claude/settings.local.json": "Configurazione locale (non versionata)",
      ".claude/rules": "Regole riutilizzabili",
      ".claude/rules/code-style.md": "Regola: stile del codice",
      ".claude/rules/testing.md": "Regola: testing",
      ".claude/rules/api-conventions.md": "Regola: convenzioni API",
      ".claude/commands": "Comandi slash personalizzati",
      ".claude/commands/review.md": "Comando /review",
      ".claude/commands/fix-issue.md": "Comando /fix-issue",
      ".claude/skills": "Skill del progetto",
      ".claude/skills/deploy": "Skill: deploy",
      ".claude/skills/deploy/SKILL.md": "Definizione della skill deploy",
      ".claude/skills/deploy/deploy-config.md": "Configurazione della skill deploy",
      ".claude/agents": "Subagenti specializzati",
      ".claude/agents/code-reviewer.md": "Agente: revisore del codice",
      ".claude/agents/security-auditor.md": "Agente: auditor di sicurezza",
      ".claude/hooks": "Hook (script del ciclo di vita)",
      ".claude/hooks/validate-bash.sh": "Hook: convalida comandi bash",
      "AGENTS.md": "Guida del progetto per Codex/agenti",
      ".codex": "Configurazione di Codex",
      ".codex/config.toml": "Configurazione del progetto Codex",
      ".codex/prompts": "Prompt/modelli riutilizzabili",
      ".codex/prompts/review.md": "Prompt: revisione del codice",
      "GEMINI.md": "Contesto del progetto per Gemini",
      ".gemini": "Configurazione di Gemini",
      ".gemini/settings.json": "Configurazione del progetto Gemini",
      ".gemini/commands": "Comandi personalizzati",
      ".gemini/commands/review.toml": "Comando: review",
      "modules/*": "Radice del modulo del marketplace",
      "modules/*/module.manifest.json": "Manifest in bozza (i campi AUTO vengono impostati dalla piattaforma)",
      "modules/*/backend/index.js": "Backend del modulo — scheletro SDK defineModule()",
      "modules/*/frontend": "Frontend del modulo (Astro, opzionale)",
      "modules/*/README.md": "README del modulo",
      ".claude/rules/marketplace.md": "Regola: architettura del marketplace (manifest, SDK, capability)",
      "MARKETPLACE.md": "Regole di architettura del marketplace (manifest, SDK, capability)"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "Nessuna risposta installazione",
    "summaryTitle": "Esponi capacità pannello al CLI (MCP)",
    "optional": "opzionale",
    "description": "Connetti il CLI {providerId} con gli strumenti del pannello. Il pannello scrive la configurazione direttamente sul server target; non devi copiare nulla.",
    "configuredTitle": "Configurato sul target",
    "tokenValidUntil": "Token valido fino al {date}.",
    "restartCli": "Riavvia il CLI nel terminale per caricare il nuovo server MCP.",
    "configuring": "Configurazione...",
    "configureAutomatically": "Configura automaticamente",
    "regenerate": "Rigenera token e riconfigura",
    "manualTitle": "Configurazione manuale (avanzato)",
    "generating": "Generazione...",
    "generateManualSnippet": "Genera snippet manuale",
    "fileLabel": "File",
    "snippetLabel": "Snippet ({format})",
    "copy": "Copia",
    "mcpUrlLabel": "URL MCP"
  },
  "conversationMedia": {
    "download": "Scarica",
    "close": "Chiudi",
    "previous": "Precedente",
    "next": "Successivo",
    "all": "Tutto",
    "images": "Immagini",
    "documents": "Documenti",
    "attachmentsTitle": "Allegati conversazione",
    "emptyConversation": "Nessun allegato in questa conversazione.",
    "imagesSection": "Immagini",
    "documentsSection": "Documenti",
    "clickToExpand": "fai clic per espandere",
    "emptyImages": "Nessuna immagine.",
    "emptyDocuments": "Nessun documento.",
    "attachToChat": "Allega alla chat",
    "uploadToChat": "Carica file nella chat",
    "attachFailed": "Impossibile allegare il file alla chat.",
    "mediaTitle": "Multimedia"
  },
  "teamBoard": {
    "showMoreTasks": "Mostra altre {count} attività",
    "showFewerTasks": "Mostra meno attività",
    "title": "Team al lavoro",
    "progressOf": "{done} di {total} attività completate",
    "statusPending": "In attesa",
    "statusRunning": "In corso",
    "statusDone": "Completata",
    "statusFailed": "Fallita",
    "statusCanceled": "Annullata",
    "pendingPermission": "In attesa della tua approvazione",
    "openChat": "Apri chat",
    "cancel": "Annulla attività",
    "cancelConfirm": "Annullare questa attività? L'agente smetterà di lavorarci.",
    "assignedTo": "Assegnata a {agent}",
    "autoTurn": "Avviso automatico del team",
    "dashboardTitle": "Team al lavoro",
    "tokensSummary": "Token: {total} (leader {leader} · team {workers})",
    "lessThan1s": "<1 s",
    "insertions": "+{count}",
    "deletions": "-{count}",
    "viewDiff": "Visualizza diff",
    "close": "Chiudi",
    "statusQueued": "In coda",
    "addTaskSubmit": "Assegna",
    "loading": "Caricamento…",
    "verifyPassed": "Verificato",
    "verifyFailed": "Verifica non riuscita ({attempts})",
    "filesChanged": "{count} file",
    "diffTitle": "Modifiche dell'attività",
    "diffUnavailable": "Nessuna differenza disponibile per questa attività (nessun worktree o nessuna modifica).",
    "diffTruncated": "Differenza troncata: l'attività ha modificato più contenuti di quelli mostrati.",
    "branchIntegrated": "Ramo integrato",
    "cancelAll": "Annulla tutto",
    "cancelAllConfirm": "Annullare TUTTE le attività in corso? Il piano attivo sarà contrassegnato come non riuscito.",
    "addTask": "Aggiungi attività",
    "addTaskTitle": "Assegna un'attività a un subordinato",
    "addTaskWorker": "Subordinato",
    "addTaskWorkerPlaceholder": "— Scegli un agente —",
    "addTaskNoWorkers": "Questo responsabile non ha subordinati diretti.",
    "addTaskInstruction": "Istruzione",
    "addTaskInstructionHint": "L'agente non vede questa conversazione; includi TUTTO il contesto necessario.",
    "addTaskTitleField": "Titolo (facoltativo)",
    "addTaskProject": "Progetto (facoltativo)",
    "addTaskProjectNone": "— Nessun progetto —",
    "addTaskSubmitting": "Assegnazione…",
    "feedbackUp": "Buon risultato",
    "feedbackDown": "Risultato scarso",
    "orgChart": "Organigramma",
    "tokensChipTitle": "Token utilizzati da questa attività",
    "verifyRunning": "Verifica in corso…"
  },
  "agentInfo": {
    "roleLabel": "Ruolo",
    "roleTooltip": "Ruolo dell'agente: {role}",
    "providerLabel": "Provider",
    "providerModelTooltip": "Provider {provider} · Modello {model}",
    "projectLabel": "Progetto",
    "projectTooltip": "Progetto: {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "Riduci zoom",
    "zoomIn": "Aumenta zoom",
    "zoomReset": "Reimposta zoom"
  },
  "assistantErrorBoundary": {
    "errorMessage": "L'assistente ha riscontrato un errore durante il caricamento.",
    "retry": "Riprova"
  }
} as const;

export default assistantPart3;
