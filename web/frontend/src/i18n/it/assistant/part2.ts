const assistantPart2 = {
  "cliUsageBars": {
    "sourceReal": "quota residua dell'account",
    "sourceEstimated": "token residui stimati",
    "sourceTokens": "token residui",
    "cliUsage": "CLI disponibile",
    "session5h": "Sessione (5h)",
    "week": "Settimana",
    "sessionHours": "Sessione ({hours}h)",
    "resetSameDay": "ripristina {time}",
    "resetOtherDay": "ripristina {day}, {time}",
    "unavailable": "Impossibile caricare la quota di {provider}",
    "retry": "Riprova"
  },
  "notifySettings": {
    "title": "Notifiche dell'assistente",
    "description": "Avvisami sui miei dispositivi (web, app e desktop) quando una chat termina e non la sto guardando.",
    "saveError": "Impossibile salvare."
  },
  "voiceSettings": {
    "title": "Voce (audio)",
    "description": "Parla con l’assistente e ascolta le risposte tramite OpenAI.",
    "missingCapabilities": "Configura una chiave API OpenAI nel provider Codex per attivare l’audio.",
    "inputLabel": "Ingresso (STT)",
    "outputLabel": "Uscita (TTS)",
    "notAvailable": "non disponibile",
    "voiceLabel": "Voce",
    "autoSpeak": "Leggi automaticamente le risposte al termine",
    "audioProvider": "Provider audio",
    "providerApi": "API (OpenAI/Gemini)",
    "providerPiper": "Piper (locale)",
    "providerMinimax": "MiniMax",
    "providerApiHint": "Usa la chiave API già configurata.",
    "piperReady": "Piper installato",
    "piperMissing": "Piper non installato",
    "minimaxReady": "MiniMax pronto",
    "minimaxMissing": "MiniMax non disponibile",
    "minimaxAuthMissing": "Chiave MiniMax mancante",
    "minimaxVoiceHint": "Voce MiniMax da usare."
  },
  "agentMarket": {
    "agentSource": "Mostra agenti",
    "projectAgents": "Agenti del progetto",
    "marketAgents": "Agenti del Market",
    "projectAgentsHint": "Agenti assegnati a questo progetto, inclusi quelli ereditati.",
    "creationUncertain": "Non è stato possibile confermare la creazione. Per evitare duplicati, non verrà inviata di nuovo. Controlla il catalogo e seleziona il profilo creato solo se riesci a identificarlo; se non compare, il risultato resta incerto.",
    "reviewProfiles": "Controlla il catalogo",
    "recoverProfile": "Seleziona il profilo creato",
    "overrideHint": "Il salvataggio sostituisce la configurazione ereditata in questo progetto con queste impostazioni.",
    "title": "Market",
    "description": "Profili riutilizzabili per i progetti di questo server.",
    "search": "Cerca per nome, descrizione, specialità o tecnologia",
    "project": "Progetto attivo",
    "chooseProject": "Seleziona un progetto",
    "allProviders": "Tutti i fornitori",
    "allRoles": "Tutti i ruoli",
    "allAssignments": "Tutte le assegnazioni",
    "assigned": "Assegnato",
    "unassigned": "Non assegnato",
    "inherited": "Ereditato",
    "removed": "Rimosso",
    "empty": "Non ci sono ancora profili di agenti.",
    "noMatches": "Nessun profilo corrisponde ai filtri.",
    "loading": "Caricamento del catalogo…",
    "retry": "Riprova",
    "error": "Impossibile caricare o aggiornare il catalogo.",
    "pending": "Operazione in corso…",
    "add": "Aggiungi al progetto",
    "remove": "Rimuovi dal progetto",
    "configure": "Configura assegnazione",
    "editProfile": "Modifica profilo globale",
    "profileHint": "Le modifiche al profilo si applicano a tutti i suoi progetti.",
    "assignmentHint": "Questa configurazione si applica solo al progetto selezionato.",
    "removeConfirm": "Rimuovere {name} da questo progetto? Profilo e cronologia saranno conservati.",
    "saved": "Modifiche salvate.",
    "specialty": "Specialità",
    "technologies": "Tecnologie (separate da virgole)",
    "newProfile": "Crea profilo",
    "back": "Torna alla chat",
    "inheritedHint": "Ereditato da {project}. Gestisci la rimozione nel progetto di origine.",
    "readOnly": "Sola lettura",
    "busy": "Ci sono attività o approvazioni in sospeso. Completale prima di modificare l’assegnazione.",
    "forbidden": "Non hai il permesso di eseguire questa azione.",
    "contextChanged": "Il server o la sessione è cambiato. Ricarica il catalogo.",
    "uncertain": "Non è stato possibile confermare il risultato. Controlla il catalogo prima di ripetere l’azione.",
    "historical": "Storico: non disponibile per nuove chat",
    "inherit": "Eredita dal profilo",
    "none": "Nessuno",
    "jobTitle": "Posizione nel progetto",
    "instructions": "Istruzioni del progetto",
    "limitsHint": "I limiti si combinano con i permessi esistenti senza concedere accessi aggiuntivi."
  },
  "agentsTab": {
    "teams": {
      "newTeamBtn": "Nuovo team",
      "newTeamTitle": "Crea team",
      "editTeamTitle": "Modifica team",
      "nameLabel": "Nome",
      "namePlaceholder": "Es. Backend, Frontend, Design…",
      "descriptionLabel": "Descrizione (facoltativa)",
      "colorLabel": "Colore",
      "createBtn": "Crea team",
      "saveBtn": "Salva",
      "cancelBtn": "Annulla",
      "addAgentsBtn": "Aggiungi agenti",
      "addAgentsTitle": "Aggiungi agenti al team",
      "addAgentsEmpty": "Nessun agente disponibile da aggiungere.",
      "addAgentsConfirm": "Aggiungi",
      "alreadyInTeam": "in un altro team",
      "removeFromTeamBtn": "Rimuovi dal team",
      "removeFromTeamConfirm": "Rimuovere questo agente dal team? L'agente non viene eliminato.",
      "deleteTeamBtn": "Elimina team",
      "deleteTeamConfirm": "Eliminare questo team?",
      "deleteTeamKeepsAgentsNote": "Gli agenti NON vengono eliminati: vengono solo rimossi dal team.",
      "teamSelectorLabel": "Team",
      "groupRequired": "Seleziona o crea un gruppo",
      "teamSelectorPlaceholder": "— Seleziona un gruppo —",
      "noTeamOption": "Nessun team",
      "emptyTeamHint": "Team vuoto — aggiungi agenti con il pulsante +.",
      "memberCount": "{count} membro/i"
    },
    "cancel": "Annulla",
    "saving": "Salvataggio in corso…",
    "saveChanges": "Salva modifiche",
    "noDescription": "Senza descrizione",
    "allTools": "tutte le tools",
    "toolsCount": "{count} tools",
    "noActiveModules": "Nessun modulo attivo con strumenti.",
    "removeAll": "Rimuovi tutto",
    "selectAll": "Seleziona tutto",
    "sensitiveTool": "azione sensibile",
    "confirmDeleteAgent": "Eliminare l'agente \"{name}\"?",
    "confirmDeleteRole": "Eliminare il ruolo \"{name}\"? Verrà rimosso dagli agenti che lo utilizzano.",
    "duplicateName": "{name} (copia)",
    "editBtn": "Modifica",
    "deleteTitle": "Elimina",
    "errorPrefix": "Errore: {message}",
    "backToAgents": "Agenti",
    "createdBy": "Creato da {ownerName}",
    "diagram": {
      "empty": "Nessun agente — creane uno per visualizzarlo qui",
      "connection": "connessione"
    },
    "archetypes": {
      "devops": "DevOps / SRE",
      "security": "Revisore della sicurezza",
      "dba": "Amministratore DB",
      "support": "Supporto tecnico",
      "nginx": "Amministratore web / Nginx",
      "backups": "Specialista backup",
      "logs": "Analista di log",
      "automation": "Automazione / Cron"
    },
    "editor": {
      "titleNew": "Nuovo agente",
      "titleEdit": "Modifica agente",
      "headerTitleNew": "Nuovo agente",
      "headerDescNew": "Configura un nuovo agente IA",
      "headerTitleEdit": "Modifica agente",
      "headerDescEdit": "Modifica la configurazione dell'agente",
      "backToList": "Torna agli agenti",
      "tabGeneral": "Generale",
      "tabModel": "Modello",
      "tabHierarchy": "Gerarchia",
      "tabTools": "Strumenti",
      "tabResources": "Risorse",
      "tabAccess": "Accessi",
      "aiHelpTitle": "Assistenza AI",
      "aiHelpDesc": "Scegli un profilo e l'AI redigerà nome, descrizione, prompt e strumenti in modo professionale.",
      "aiHelpSelect": "Seleziona un profilo…",
      "aiHelpFromDesc": "Dalla mia descrizione",
      "aiHelpFromDescTitle": "Migliora dalla descrizione attuale",
      "aiHelpGenerating": "Generazione agente con AI…",
      "fieldName": "Nome",
      "namePlaceholder": "Es. Revisore della sicurezza",
      "fieldDescription": "Descrizione",
      "descPlaceholder": "A cosa serve questo agente",
      "fieldSystemPrompt": "Prompt di sistema",
      "systemPromptPlaceholder": "Istruzioni, personalità e obiettivi dell'agente…",
      "fieldAvatar": "Avatar",
      "avatarRandomize": "Casuale",
      "avatarAuto": "Auto",
      "avatarAttrs": {
        "top": "Capelli / cappello",
        "hairColor": "Colore capelli",
        "eyes": "Occhi",
        "eyebrows": "Sopracciglia",
        "mouth": "Bocca",
        "skinColor": "Colore pelle",
        "clothing": "Abbigliamento",
        "clothesColor": "Colore vestiti",
        "accessories": "Accessorio",
        "facialHair": "Barba",
        "facialHairColor": "Colore barba"
      },
      "fieldProvider": "Provider",
      "fieldModel": "Modello",
      "modelPlaceholder": "(predefinito del provider)",
      "realtimeLabel": "Comunicazione in tempo reale (sessione a bassa latenza)",
      "realtimeDesc": "Sessione bidirezionale audio/testo in streaming (in base al provider: OpenAI Realtime o Gemini Live).",
      "realtimeUnavailable": "Il provider \"{providerId}\" non offre sessione in tempo reale. Disponibile solo con codex (OpenAI) o gemini.",
      "multiAgentLabel": "Modalità multi-agente: replica questo agente più volte in parallelo",
      "multiAgentDescPre": "L'agente viene ",
      "multiAgentDescBold": "moltiplicato per X",
      "multiAgentDescPost": ": il compito viene diviso in X parti e ogni copia (stesso prompt, strumenti e provider) ne risolve una in parallelo; poi viene sintetizzata un'unica risposta.",
      "multiAgentCopies": "Numero di copie (X)",
      "multiAgentCopiesHint": "copie dell'agente (2–8)",
      "multiAgentProvidersPre": "Facoltativo — distribuire le copie tra più provider (il principale ",
      "multiAgentProvidersPost": " partecipa sempre; seleziona altri per distribuirle):",
      "multiAgentApiHint": "Vengono utilizzati solo provider in modalità API con API key. Il multi-agente richiede la modalità API.",
      "roleHeading": "Ruolo e gerarchia",
      "roleAssigned": "Ruolo assegnato",
      "roleNone": "Senza ruolo",
      "roleHint": "Il ruolo fornisce un prompt base e strumenti predefiniti; l'agente lo perfeziona. Gestisci i ruoli dall'elenco agenti.",
      "parentAgent": "Agente superiore (subordinazione)",
      "parentNone": "Nessuno (livello superiore)",
      "parentHintPre": "Il suo superiore potrà ",
      "parentHintBold": "delegargli",
      "parentHintPost": " compiti durante l'esecuzione e utilizzare la sua risposta.",
      "connectionsLabel": "Connessioni con altri agenti",
      "connectionsEmpty": "Nessun altro agente.",
      "connectionsHint": "Canale bidirezionale: ognuno dei due può richiedere o fornire informazioni all'altro in esecuzione (strumento di delega).",
      "supervisorLabel": "Supervisore: può creare chat per i suoi subordinati",
      "supervisorDesc": "Apre chat reali nella scheda Chat e mette al lavoro i propri subordinati (ogni chat rimane come registro di quell'agente). Viene concesso anche tramite il ruolo.",
      "allowAllTools": "Consenti tutti gli strumenti disponibili",
      "toolsDesc": "Seleziona il sottoinsieme di strumenti che questo agente può utilizzare. L'elenco si interseca con ciò che ogni modulo consente, quindi non amplia mai i permessi.",
      "associatedServers": "Server associati",
      "serversEmpty": "Nessun server registrato.",
      "attachedProjects": "Progetti allegati",
      "attachedProjectsDesc": "Seleziona uno o più progetti dall'albero. Selezionare un progetto padre seleziona tutte le sue cartelle annidate; l'agente usa i percorsi di lavoro dei progetti selezionati.",
      "noParentProjects": "Nessun progetto.",
      "graphIndexesTitle": "Indici del grafo del codice",
      "graphIndexesDesc": "L'agente userà questi indici per esplorare il codice tramite il grafo (simboli, chiamate e architettura) invece di leggere file interi — riduce il consumo di token.",
      "graphIndexesEmpty": "Nessun indice del grafo disponibile. Indicizza un progetto dalla scheda Progetti.",
      "credentialTitle": "Credenziali di accesso",
      "saveObsidian": "Salva i riepiloghi nel vault Obsidian del progetto allegato",
      "agentSkills": "Skills dell'agente",
      "createAgent": "Crea agente",
      "snippetsSection": "Snippets del terminale",
      "snippetsCategoryLabel": "Categoria di snippets",
      "snippetsCategoryNone": "(nessuna)",
      "snippetsTagsLabel": "Tag della categoria",
      "snippetsHelp": "Pre-filtra gli snippets del terminale disponibili per questo agente: scegli una categoria e, facoltativamente, i tag di quella categoria. Nessuna categoria = nessun filtro.",
      "snippetsNoAccess": "Impossibile caricare gli snippets del terminale (richiede il permesso del terminale).",
      "snippetsNoTags": "Questa categoria non ha tag."
    },
    "roleEditor": {
      "titleNew": "Nuovo ruolo",
      "titleEdit": "Modifica ruolo",
      "fieldName": "Nome del ruolo",
      "namePlaceholder": "Es. Coordinatore, Revisore, Specialista DB",
      "fieldDesc": "Descrizione",
      "descPlaceholder": "Cosa rappresenta questo ruolo",
      "fieldBasePrompt": "Prompt base del ruolo",
      "basePromptPlaceholder": "Politiche, responsabilità e tono comuni a tutti gli agenti con questo ruolo…",
      "basePromptHint": "Viene iniettato come base, prima del prompt specifico dell'agente.",
      "noToolLimit": "Nessun limite di strumenti dal ruolo",
      "toolsDesc": "Gli strumenti del ruolo limitano ciò che i suoi agenti possono usare (si intersecano, non ampliano mai).",
      "supervisorLabel": "Ruolo supervisore: gli agenti con questo ruolo possono creare chat per i loro subordinati",
      "supervisorDesc": "Concede il permesso di agire come supervisore (strumento per aprire chat e assegnare lavoro) a ogni agente che ha questo ruolo.",
      "createRole": "Crea ruolo"
    },
    "treeView": {
      "title": "Gerarchia degli agenti",
      "reloadTitle": "Ricarica agenti e rigenera l'albero",
      "regenerating": "Rigenerazione in corso…",
      "regenerate": "Rigenera",
      "description": "Diagramma dell'albero di subordinazione (linea continua = superiore → subordinato) e connessioni tra pari (linea tratteggiata). Assegna l'«Agente superiore» nell'editor di ogni agente per costruire l'albero."
    },
    "rolesList": {
      "newRole": "Nuovo ruolo",
      "description": "Ruoli riutilizzabili (profilo con prompt base e strumenti) da assegnare a uno o più agenti.",
      "emptyTitle": "Nessun ruolo ancora",
      "emptyDesc": "Crea un ruolo per standardizzare il comportamento di più agenti.",
      "agentsCount": "{count} agente/i"
    },
    "list": {
      "description": "Agenti AI personalizzati: prompt proprio, strumenti e provider/modello. Usali nella chat o programmali in Cron.",
      "treeBtn": "Albero",
      "treeBtnTitle": "Visualizza l'albero di gerarchia degli agenti",
      "rolesBtn": "Ruoli",
      "rolesBtnTitle": "Crea e gestisci ruoli agente",
      "newAgent": "Nuovo agente",
      "loading": "Caricamento agenti…",
      "emptyTitle": "Nessun agente ancora",
      "emptyDesc": "Creane uno per chattare con un prompt e un set di strumenti personalizzato.",
      "multiAgentTitle": "Multi-agente: {count} copie",
      "roleAssignedTitle": "Ruolo assegnato",
      "subordinateTitle": "Subordinato di",
      "connectionsTitle": "Connessioni con altri agenti",
      "supervisorTitle": "Supervisore: può creare chat per i subordinati",
      "supervisorBadge": "supervisore",
      "realtimeTitle": "Comunicazione in tempo reale",
      "realtimeBadge": "tempo reale",
      "startChat": "Avvia chat",
      "duplicateTitle": "Duplica",
      "noRoleGroupTitle": "Senza gruppo di lavoro",
      "groupAria": "Gruppo di lavoro: {name}",
      "groupCount": "{count} agenti",
      "noRoleGroupDesc": "Agenti senza un ruolo assegnato. Assegnane uno dall'editor."
    },
    "resync": {
      "applying": "Creazione in corso…",
      "close": "Chiudi",
      "btn": "Sincronizza con il modello",
      "btnTitle": "Confronta questa squadra con il modello e crea gli agenti mancanti",
      "modalTitle": "Sincronizza «{name}» con il suo modello",
      "loading": "Confronto con il modello…",
      "markersMissing": "Questa squadra ha perso i marcatori di origine del modello, quindi non può essere confrontata automaticamente. Puoi creare manualmente gli agenti mancanti.",
      "missingHeading": "Mancanti",
      "presentHeading": "Presenti",
      "extraHeading": "Aggiunti manualmente",
      "extraNote": "Non verranno modificati.",
      "nothingMissing": "La squadra è completa: non manca alcun agente del modello.",
      "confirm": "Crea selezionati"
    }
  },
  "accessTab": {
    "all": "Tutti",
    "permissionsTitle": "Accessi e permessi",
    "permissionsDescription": "Oggi la visibilità dell'assistente è regolata dal permesso del modulo assistant nel tuo profilo. Il dettaglio per ruolo (assistant.use / assistant.configure / assistant.module.<id>) è previsto per la prossima iterazione.",
    "recentInvocations": "Ultime invocazioni di strumenti",
    "refreshAriaLabel": "Aggiorna accessi",
    "loading": "Caricamento...",
    "emptyRecent": "Nessuna attività recente.",
    "emptyProvider": "Nessuna attività per questo fornitore.",
    "byUser": "da",
    "crossServerTitle": "Accesso al server associato",
    "autoApproveTitle": "Approvazione automatica",
    "autoApproveDescription": "Strumenti che non richiedono più conferma (approvati con «Approva e non chiedere più»). Le modifiche si applicano dalla prossima esecuzione.",
    "autoApproveEmpty": "Nessuno strumento con approvazione automatica. Questo elenco si popola quando scegli «Approva e non chiedere più» approvando un'azione dell'agente.",
    "autoApproveRevoke": "Revoca",
    "autoApproveModeAuto": "modalità automatica: questo elenco non si applica",
    "cmdPrefix": "$ ",
    "passwordLabel": "password: ",
    "passphraseLabel": "frase segreta: ",
    "privateKeyLabel": "chiave privata"
  },
  "directoryPicker": {
    "title": "Seleziona cartella",
    "goUp": "Su",
    "loading": "Caricamento…",
    "emptyDirs": "(nessuna sottocartella)",
    "cancel": "Annulla",
    "select": "Usa questa cartella",
    "readError": "Impossibile leggere la directory"
  },
  "skillsSettings": {
    "title": "Skill e metodi dell'assistente",
    "helper": "Attiva o disattiva librerie, skill e metodi che affinano il comportamento dell'assistente.",
    "tokenNote": "Le istruzioni di ogni skill viaggiano nel prompt memorizzato nella cache (~0.1× nei turni successivi). Ponytail riduce il codice e i token di output; con UI/UX Pro Max usa il livello «Breve» per consumare meno.",
    "search": "Cerca skill…",
    "allCategories": "Tutte le categorie",
    "loading": "Caricamento skill...",
    "empty": "Nessuna skill disponibile.",
    "noMatch": "Nessuna skill corrisponde al filtro.",
    "sourcePrefix": "Fonte:",
    "errorGeneric": "Impossibile aggiornare la skill. Riprova.",
    "activeShown": "{count} attive · {shown} mostrate."
  },
  "skillsPicker": {
    "searchPlaceholder": "Cerca skill…",
    "resetTitle": "Rimuovi personalizzazione (usa skill globali)",
    "reset": "Ripristina ({count})",
    "loading": "Caricamento skill…",
    "empty": "Nessuna skill.",
    "globalNote": "Si applicano SOLO nelle tue chat, in aggiunta alle skill globali del provider."
  },
  "skillCategories": {
    "methods": "Metodi dell'assistente",
    "code-quality": "Qualità del codice",
    "web-quality": "Qualità web (Lighthouse / CWV)",
    "ui-ux": "UI / UX / design",
    "web-fullstack": "Sviluppo web / full-stack IA",
    "mobile": "App mobili",
    "code-agents": "Agenti di codice",
    "reusable-skills": "Skills riutilizzabili per IA",
    "security": "Sicurezza IA / web / app",
    "token-savings": "Risparmio token / costi IA",
    "ai-prod": "Agenti IA in produzione",
    "devops": "DevOps / deployment",
    "testing": "Testing / qualità del codice",
    "data-rag": "Database / RAG / ricerca",
    "automation": "Automazione / workflow",
    "other": "Altro"
  },
  "skillCatalog": {
    "ask-protocol": {
      "name": "Chiedere prima di decidere",
      "description": "Consente all'assistente di fermarsi e farti una domanda su una decisione chiave invece di assumere (tool lxp_ask + protocollo di domande)."
    },
    "project-context-vault": {
      "name": "Contesto del progetto (Obsidian)",
      "description": "Inietta note di contesto del progetto (Contexto.md / Errores.md) e ti permette di cercare altri con obsidian.search_notes."
    },
    "ponytail": {
      "name": "Ponytail (codice minimalista)",
      "description": "Modalità di sviluppo minimalista: scrivi il minimo codice necessario (scala di decisione + guardrail)."
    },
    "ui-ux-pro-max": {
      "name": "UI/UX Pro Max (qualità interfaccia)",
      "description": "Standard professionali di UI/UX (accessibilità, touch, tipografia, stati) iniettati nel prompt; livello breve o completo."
    },
    "openai-agents-sdk": {
      "name": "OpenAI Agents SDK",
      "description": "Agenti OpenAI con tool, handoff, guardrail, session e tracing."
    },
    "openai-agents-python": {
      "name": "OpenAI Agents Python SDK",
      "description": "SDK Python per agenti: Agent, Runner, @function_tool, handoff e tracing."
    },
    "openai-agents-js": {
      "name": "OpenAI Agents JS SDK",
      "description": "SDK TypeScript/JS per agenti OpenAI: Agent, run, tool (Zod), handoff."
    },
    "mcp-docs": {
      "name": "Model Context Protocol",
      "description": "Standard aperto (l'\"USB-C dell'IA\") per collegare LLM a tool, risorse e prompt."
    },
    "mcp-github": {
      "name": "MCP (GitHub)",
      "description": "Org GitHub di MCP: SDK ufficiali (10 linguaggi), server di riferimento e ispettore."
    },
    "anthropic-mcp-intro": {
      "name": "Anthropic MCP Intro",
      "description": "Annuncio di Anthropic: MCP come standard aperto che risolve le integrazioni N×M."
    },
    "n8n": {
      "name": "n8n",
      "description": "Automazione workflow fair-code, self-hostable."
    },
    "make": {
      "name": "Make",
      "description": "Automazione visuale no-code per scenari (ex-Integromat)."
    },
    "zapier": {
      "name": "Zapier",
      "description": "Automazione SaaS tramite trigger e azioni (Zap)."
    },
    "temporal": {
      "name": "Temporal",
      "description": "Orchestrazione di workflow durevoli e tolleranti ai guasti."
    },
    "bullmq": {
      "name": "BullMQ",
      "description": "Code di lavoro supportate da Redis per Node.js."
    },
    "langgraph": {
      "name": "LangGraph",
      "description": "Orchestrazione di agenti LLM come grafi stateful."
    },
    "codex-cli": {
      "name": "OpenAI Codex CLI",
      "description": "Guida l'agente a utilizzare OpenAI Codex CLI (agente di codice terminale)."
    },
    "codex-cli-features": {
      "name": "Codex CLI Features",
      "description": "Descrive all'agente le capacità di Codex CLI (sandbox, approvazioni, MCP, config)."
    },
    "codex-cloud": {
      "name": "Codex Cloud",
      "description": "Guida l'agente a delegare compiti a Codex Cloud (ambienti remoti, esecuzione parallela, PR)."
    },
    "claude-code-skills": {
      "name": "Claude Code Skills",
      "description": "Guida l'agente a creare e utilizzare Claude Code Skills (cartella con SKILL.md, standard Agent Skills)."
    },
    "copilot-cloud-agent": {
      "name": "GitHub Copilot Cloud Agent",
      "description": "Guida l'agente a delegare issue a GitHub Copilot coding agent, che opera nel cloud e apre PR."
    },
    "cursor": {
      "name": "Cursor",
      "description": "Guida l'agente a lavorare nell'editor Cursor (Agent, contesto repo, regole)."
    },
    "agents-md": {
      "name": "AGENTS.md",
      "description": "Guida l'agente a scrivere e seguire AGENTS.md, il file di istruzioni standard per agenti di codice."
    },
    "open-design-contribute": {
      "name": "Open Design — contribuire (no-code)",
      "description": "Flusso guidato no-code per contribuire a Open Design (nexu-io): invia una Skill o Design System, traduci doc, correggi testo o segnala un bug, e apre il PR/issue per te."
    },
    "supabase": {
      "name": "Supabase",
      "description": "Backend Postgres gestito con auth, storage e realtime."
    },
    "postgresql": {
      "name": "PostgreSQL",
      "description": "Database relazionale robusto con tipi ricchi."
    },
    "pgvector": {
      "name": "pgvector",
      "description": "Ricerca di similarità vettoriale dentro Postgres."
    },
    "pinecone": {
      "name": "Pinecone",
      "description": "Database vettoriale gestito per RAG in scala."
    },
    "qdrant": {
      "name": "Qdrant",
      "description": "Motore vettoriale open-source con filtraggio per payload."
    },
    "weaviate": {
      "name": "Weaviate",
      "description": "Database vettoriale con schema e moduli di vettorizzazione."
    },
    "github-actions": {
      "name": "GitHub Actions",
      "description": "CI/CD su GitHub con workflow YAML (.github/workflows) attivati da eventi."
    },
    "vercel": {
      "name": "Vercel",
      "description": "Deployment di frontend e funzioni serverless con anteprima per commit/PR."
    },
    "docker": {
      "name": "Docker",
      "description": "Pacchetto app in container effimeri con immagini leggere e riproducibili."
    },
    "nginx": {
      "name": "Nginx",
      "description": "Server web ad alte prestazioni e reverse proxy."
    },
    "pm2": {
      "name": "PM2",
      "description": "Gestore processi Node con cluster, restart e log."
    },
    "redis": {
      "name": "Redis",
      "description": "Store in memoria per cache, code e strutture dati."
    },
    "expo": {
      "name": "Expo",
      "description": "Guida l'agente a sviluppare app React Native con Expo (expo-router, moduli, config plugin)."
    },
    "eas-build": {
      "name": "EAS Build",
      "description": "Guida l'agente a compilare binari iOS/Android nel cloud con EAS Build e profili eas.json."
    },
    "eas-services": {
      "name": "EAS Services",
      "description": "Aiuta l'agente a utilizzare l'ecosistema EAS (Submit, Update/OTA, Workflow) end-to-end."
    },
    "react-native": {
      "name": "React Native",
      "description": "Guida l'agente a costruire UI native con React Native (componenti core, stili, piattaforma)."
    },
    "firebase-auth": {
      "name": "Firebase Auth",
      "description": "Guida l'agente a implementare autenticazione con Firebase Auth (provider, token, sessione)."
    },
    "claude-agent-skills": {
      "name": "Claude Agent Skills",
      "description": "Pacchetto capacità riutilizzabili come Agent Skills (SKILL.md) caricate on-demand."
    },
    "claude-skills-github": {
      "name": "Claude Skills (GitHub)",
      "description": "Repository ufficiale anthropics/skills: esempi, spec e template come base e pattern."
    },
    "codex-agents-md-guide": {
      "name": "Codex AGENTS.md Guide",
      "description": "Convenzione AGENTS.md di Codex per fornire istruzioni di progetto a agenti di codice."
    },
    "owasp-llm-top10": {
      "name": "OWASP Top 10 LLM",
      "description": "Top 10 rischi in app LLM: prompt injection, output non sicuro, excessive agency."
    },
    "owasp-asvs": {
      "name": "OWASP ASVS",
      "description": "ASVS v5.0: standard di requisiti di sicurezza verificabili per livelli."
    },
    "codeql": {
      "name": "CodeQL",
      "description": "CodeQL: interroga il codice come dati (data-flow/taint) per trovare vulnerabilità."
    },
    "semgrep": {
      "name": "Semgrep",
      "description": "Semgrep: SAST per regole tipo-codice + Supply Chain (SCA) e Secret, alto segnale."
    },
    "snyk": {
      "name": "Snyk",
      "description": "Snyk: SCA, Code (SAST), Container, IaC e API/Web (DAST) con remediation guidato."
    },
    "owasp-zap": {
      "name": "OWASP ZAP",
      "description": "OWASP ZAP: scanner web open-source leader per DAST (passive/active scan)."
    },
    "skillspector": {
      "name": "SkillSpector (audit Skills IA)",
      "description": "Audita Skills di agenti IA (SKILL.md + script) per vulnerabilità e intento maligno prima di installarli (NVIDIA, Apache-2.0)."
    },
    "playwright": {
      "name": "Playwright",
      "description": "Test E2E multi-browser con auto-wait e tracce."
    },
    "cypress": {
      "name": "Cypress",
      "description": "Test componenti e E2E nel browser con retry."
    },
    "vitest": {
      "name": "Vitest",
      "description": "Test runner veloce nativo di Vite/ESM."
    },
    "jest": {
      "name": "Jest",
      "description": "Framework di test con mock integrati e snapshot."
    },
    "testing-library": {
      "name": "Testing Library",
      "description": "Query incentrate sull'utente per testare UI accessibile."
    },
    "storybook": {
      "name": "Storybook",
      "description": "Sviluppo e test isolato di componenti UI."
    },
    "openai-prompt-caching": {
      "name": "OpenAI Prompt Caching",
      "description": "Riduce automaticamente il costo riutilizzando il prefisso prompt cachato in OpenAI."
    },
    "openai-prompt-engineering": {
      "name": "OpenAI Prompt Engineering",
      "description": "Scrivi prompt precisi per meno iterazioni e meno token."
    },
    "gemini-context-caching": {
      "name": "Gemini Context Caching",
      "description": "Cachea contesto grande ripetuto in Gemini (esplicito o implicito) per ridurre input."
    },
    "gemini-caching-api": {
      "name": "Gemini Caching API",
      "description": "API cachedContent di Gemini: creare, riusare, aggiornare TTL ed eliminare cache."
    },
    "litellm-cost-tracking": {
      "name": "LiteLLM Cost Tracking",
      "description": "Misura e attribuisci costo per chiave/utente/team con il proxy LiteLLM."
    },
    "litellm": {
      "name": "LiteLLM",
      "description": "Gateway unificato a 100+ LLM (formato OpenAI) con cache, fallback e routing."
    },
    "figma-ai": {
      "name": "Figma AI",
      "description": "IA Figma: agente canvas, generazione immagini e design-to-code."
    },
    "figma-make": {
      "name": "Figma Make",
      "description": "Figma Make: da prompt o frame a prototipo/app funzionale con codice vero."
    },
    "figma-ai-tools": {
      "name": "Figma AI Tools",
      "description": "Tool IA in Figma Design: First Draft, rinomina layer, immagini, testo."
    },
    "framer": {
      "name": "Framer",
      "description": "Framer: siti no-code con canvas visuale, agenti IA, CMS e pubblicazione."
    },
    "relume": {
      "name": "Relume",
      "description": "Relume: da brief a sitemap, wireframe e style guide con IA + libreria."
    },
    "design-md-tokens": {
      "name": "DESIGN.md (sistema basato su token)",
      "description": "Genera UI fedele a un marchio con un DESIGN.md strutturato: token colore/tipografia/spaziatura, spec componenti e regole do/don't (voltagent, MIT)."
    },
    "nextjs-app-router": {
      "name": "Next.js App Router",
      "description": "Guida l'agente a costruire app Next.js con App Router (Server Component, route handler, layout)."
    },
    "vercel-ai-sdk": {
      "name": "Vercel AI SDK",
      "description": "Aiuta l'agente a integrare LLM con AI SDK (generateText, streamText, tool, structured output)."
    },
    "vercel-ai-gateway": {
      "name": "Vercel AI Gateway",
      "description": "Guida l'agente a instradare richieste a più modelli tramite AI Gateway (un endpoint, fallback, osservabilità)."
    },
    "openai-sdk-cli": {
      "name": "OpenAI SDK e CLI",
      "description": "Guida l'agente a utilizzare gli SDK ufficiali OpenAI (Python/Node) e l'API in modo idiomatico."
    },
    "v0-vercel": {
      "name": "v0 by Vercel",
      "description": "Aiuta l'agente a generare e perfezionare UI React/Tailwind/shadcn con v0 da prompt."
    },
    "web-quality-audit": {
      "name": "Audit qualità web",
      "description": "Audit completo qualità web (performance, accessibilità, SEO, sicurezza) con classificazione severità."
    },
    "web-performance": {
      "name": "Performance web",
      "description": "Ottimizza velocità di caricamento e efficienza runtime (budget risorse + Lighthouse)."
    },
    "core-web-vitals": {
      "name": "Core Web Vitals (LCP/INP/CLS)",
      "description": "Migliora LCP, INP e CLS (soglie al 75° percentile)."
    },
    "web-accessibility": {
      "name": "Accessibilità web (WCAG 2.2)",
      "description": "Audit e migliora accessibilità per WCAG 2.2 (target AA)."
    },
    "web-seo": {
      "name": "SEO (tecnico + on-page)",
      "description": "Ottimizza visibilità nei motori di ricerca: SEO tecnico, on-page e dati strutturati."
    },
    "web-best-practices": {
      "name": "Best practice web (sicurezza)",
      "description": "Pattern moderni per sicurezza, compatibilità e qualità codice."
    }
  }
} as const;

export default assistantPart2;
