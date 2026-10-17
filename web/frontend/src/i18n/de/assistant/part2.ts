const assistantPart2 = {
  "cliUsageBars": {
    "sourceReal": "verbleibendes Kontingent",
    "sourceEstimated": "geschätzte verbleibende Token",
    "sourceTokens": "verbleibende Token",
    "cliUsage": "CLI verfügbar",
    "session5h": "Sitzung (5h)",
    "week": "Woche",
    "sessionHours": "Sitzung ({hours}h)",
    "resetSameDay": "setzt zurück {time}",
    "resetOtherDay": "setzt zurück {day}, {time}",
    "unavailable": "Kontingent von {provider} konnte nicht geladen werden",
    "retry": "Erneut versuchen"
  },
  "notifySettings": {
    "title": "Assistenten-Benachrichtigungen",
    "description": "Benachrichtige mich auf meinen Geräten (Web, App und Desktop), wenn ein Chat endet und ich gerade nicht zusehe.",
    "saveError": "Speichern fehlgeschlagen."
  },
  "voiceSettings": {
    "title": "Stimme (Audio)",
    "description": "Sprich mit dem Assistenten und höre seine Antworten über OpenAI.",
    "missingCapabilities": "Konfiguriere einen OpenAI-API-Schlüssel beim Codex-Anbieter, um Audio zu aktivieren.",
    "inputLabel": "Eingabe (STT)",
    "outputLabel": "Ausgabe (TTS)",
    "notAvailable": "nicht verfügbar",
    "voiceLabel": "Stimme",
    "autoSpeak": "Antworten automatisch vorlesen, sobald sie fertig sind",
    "audioProvider": "Audio-Anbieter",
    "providerApi": "API (OpenAI/Gemini)",
    "providerPiper": "Piper (lokal)",
    "providerMinimax": "MiniMax",
    "providerApiHint": "Nutzt den bereits konfigurierten API-Schlüssel.",
    "piperReady": "Piper installiert",
    "piperMissing": "Piper nicht installiert",
    "minimaxReady": "MiniMax bereit",
    "minimaxMissing": "MiniMax nicht verfügbar",
    "minimaxAuthMissing": "MiniMax-Schlüssel fehlt",
    "minimaxVoiceHint": "Zu verwendende MiniMax-Stimme."
  },
  "agentMarket": {
    "title": "Market",
    "description": "Wiederverwendbare Profile für Projekte auf diesem Server.",
    "search": "Nach Name, Beschreibung, Fachgebiet oder Technologie suchen",
    "project": "Aktives Projekt",
    "chooseProject": "Projekt auswählen",
    "allProviders": "Alle Anbieter",
    "allRoles": "Alle Rollen",
    "allAssignments": "Alle Zuweisungen",
    "assigned": "Zugewiesen",
    "unassigned": "Nicht zugewiesen",
    "inherited": "Geerbt",
    "removed": "Entfernt",
    "empty": "Es gibt noch keine Agentenprofile.",
    "noMatches": "Keine Profile entsprechen den Filtern.",
    "loading": "Katalog wird geladen…",
    "retry": "Erneut versuchen",
    "error": "Der Katalog konnte nicht geladen oder aktualisiert werden.",
    "pending": "Vorgang läuft…",
    "add": "Zum Projekt hinzufügen",
    "remove": "Aus Projekt entfernen",
    "configure": "Zuweisung konfigurieren",
    "editProfile": "Globales Profil bearbeiten",
    "profileHint": "Profiländerungen gelten für alle zugehörigen Projekte.",
    "assignmentHint": "Diese Konfiguration gilt nur für das ausgewählte Projekt.",
    "removeConfirm": "{name} aus diesem Projekt entfernen? Profil und Verlauf bleiben erhalten.",
    "saved": "Änderungen gespeichert.",
    "specialty": "Fachgebiet",
    "technologies": "Technologien (durch Kommas getrennt)",
    "newProfile": "Profil erstellen",
    "back": "Zurück zum Chat",
    "inheritedHint": "Von {project} geerbt. Die Entfernung erfolgt im Ursprungsprojekt.",
    "readOnly": "Nur Lesen",
    "busy": "Arbeit oder Genehmigungen stehen aus. Schließen Sie diese vor einer Änderung der Zuweisung ab.",
    "forbidden": "Sie haben keine Berechtigung für diese Aktion.",
    "contextChanged": "Server oder Sitzung hat sich geändert. Laden Sie den Katalog neu.",
    "uncertain": "Das Ergebnis konnte nicht bestätigt werden. Prüfen Sie den Katalog, bevor Sie die Aktion wiederholen.",
    "historical": "Verlauf: für neue Chats nicht verfügbar",
    "inherit": "Vom Profil erben",
    "none": "Keine",
    "jobTitle": "Position im Projekt",
    "instructions": "Projektanweisungen",
    "limitsHint": "Grenzen werden mit vorhandenen Berechtigungen kombiniert und gewähren keinen zusätzlichen Zugriff."
  },
  "agentsTab": {
    "teams": {
      "newTeamBtn": "Neues Team",
      "newTeamTitle": "Team erstellen",
      "editTeamTitle": "Team bearbeiten",
      "nameLabel": "Name",
      "namePlaceholder": "Z. B. Backend, Frontend, Design…",
      "descriptionLabel": "Beschreibung (optional)",
      "colorLabel": "Farbe",
      "createBtn": "Team erstellen",
      "saveBtn": "Speichern",
      "cancelBtn": "Abbrechen",
      "addAgentsBtn": "Agenten hinzufügen",
      "addAgentsTitle": "Agenten zum Team hinzufügen",
      "addAgentsEmpty": "Keine Agenten zum Hinzufügen verfügbar.",
      "addAgentsConfirm": "Hinzufügen",
      "alreadyInTeam": "in einem anderen Team",
      "removeFromTeamBtn": "Aus Team entfernen",
      "removeFromTeamConfirm": "Diesen Agenten aus dem Team entfernen? Der Agent wird nicht gelöscht.",
      "deleteTeamBtn": "Team löschen",
      "deleteTeamConfirm": "Dieses Team löschen?",
      "deleteTeamKeepsAgentsNote": "Agenten werden NICHT gelöscht: Sie werden nur aus dem Team entfernt.",
      "teamSelectorLabel": "Team",
      "groupRequired": "Wähle oder erstelle eine Gruppe",
      "teamSelectorPlaceholder": "— Gruppe auswählen —",
      "noTeamOption": "Kein Team",
      "emptyTeamHint": "Leeres Team — füge Agenten über die Schaltfläche + hinzu.",
      "memberCount": "{count} Mitglied(er)"
    },
    "cancel": "Abbrechen",
    "saving": "Speichern…",
    "saveChanges": "Änderungen speichern",
    "noDescription": "Keine Beschreibung",
    "allTools": "alle Tools",
    "toolsCount": "{count} Tools",
    "noActiveModules": "Keine aktiven Module mit Tools.",
    "removeAll": "Alle entfernen",
    "selectAll": "Alle auswählen",
    "sensitiveTool": "sensible Aktion",
    "confirmDeleteAgent": "Agenten \"{name}\" löschen?",
    "confirmDeleteRole": "Rolle \"{name}\" löschen? Sie wird von den Agenten entfernt, die sie verwenden.",
    "duplicateName": "{name} (Kopie)",
    "editBtn": "Bearbeiten",
    "deleteTitle": "Löschen",
    "errorPrefix": "Fehler: {message}",
    "backToAgents": "Agenten",
    "createdBy": "Erstellt von {ownerName}",
    "diagram": {
      "empty": "Keine Agenten — erstelle einen, um ihn hier zu sehen",
      "connection": "Verbindung"
    },
    "archetypes": {
      "devops": "DevOps / SRE",
      "security": "Sicherheitsauditor",
      "dba": "Datenbankadministrator",
      "support": "Technischer Support",
      "nginx": "Web-Administrator / Nginx",
      "backups": "Backup-Spezialist",
      "logs": "Log-Analyst",
      "automation": "Automatisierung / Cron"
    },
    "editor": {
      "titleNew": "Neuer Agent",
      "titleEdit": "Agent bearbeiten",
      "headerTitleNew": "Neuer Agent",
      "headerDescNew": "Einen neuen KI-Agenten einrichten",
      "headerTitleEdit": "Agent bearbeiten",
      "headerDescEdit": "Konfiguration des Agenten ändern",
      "backToList": "Zurück zu den Agenten",
      "tabGeneral": "Allgemein",
      "tabModel": "Modell",
      "tabHierarchy": "Hierarchie",
      "tabTools": "Tools",
      "tabResources": "Ressourcen",
      "tabAccess": "Zugriffe",
      "aiHelpTitle": "KI-Hilfe",
      "aiHelpDesc": "Wähle ein Profil aus und die KI erstellt professionell Name, Beschreibung, Prompt und Tools.",
      "aiHelpSelect": "Profil auswählen…",
      "aiHelpFromDesc": "Aus meiner Beschreibung",
      "aiHelpFromDescTitle": "Aus aktueller Beschreibung verbessern",
      "aiHelpGenerating": "Agent wird mit KI generiert…",
      "fieldName": "Name",
      "namePlaceholder": "z. B. Sicherheitsauditor",
      "fieldDescription": "Beschreibung",
      "descPlaceholder": "Wofür dieser Agent zuständig ist",
      "fieldSystemPrompt": "System-Prompt",
      "systemPromptPlaceholder": "Anweisungen, Persönlichkeit und Ziele des Agenten…",
      "fieldAvatar": "Avatar",
      "avatarRandomize": "Zufällig",
      "avatarAuto": "Auto",
      "avatarAttrs": {
        "top": "Haare / Hut",
        "hairColor": "Haarfarbe",
        "eyes": "Augen",
        "eyebrows": "Augenbrauen",
        "mouth": "Mund",
        "skinColor": "Hautfarbe",
        "clothing": "Kleidung",
        "clothesColor": "Kleidungsfarbe",
        "accessories": "Accessoire",
        "facialHair": "Gesichtsbehaarung",
        "facialHairColor": "Bartfarbe"
      },
      "fieldProvider": "Anbieter",
      "fieldModel": "Modell",
      "modelPlaceholder": "(Standard des Anbieters)",
      "realtimeLabel": "Echtzeit-Kommunikation (Sitzung mit niedriger Latenz)",
      "realtimeDesc": "Bidirektionale Audio/Text-Streaming-Sitzung (je nach Anbieter: OpenAI Realtime oder Gemini Live).",
      "realtimeUnavailable": "Anbieter \"{providerId}\" bietet keine Echtzeitsitzung an. Nur verfügbar mit codex (OpenAI) oder gemini.",
      "multiAgentLabel": "Multi-Agenten-Modus: diesen Agenten mehrfach parallel replizieren",
      "multiAgentDescPre": "Der Agent wird ",
      "multiAgentDescBold": "mit X multipliziert",
      "multiAgentDescPost": ": Die Aufgabe wird in X Teile aufgeteilt und jede Kopie (gleicher Prompt, Tools und Anbieter) löst einen Teil parallel; anschließend wird eine einzige Antwort synthetisiert.",
      "multiAgentCopies": "Anzahl der Kopien (X)",
      "multiAgentCopiesHint": "Kopien des Agenten (2–8)",
      "multiAgentProvidersPre": "Optional — Kopien auf mehrere Anbieter verteilen (der primäre ",
      "multiAgentProvidersPost": " nimmt immer teil; weitere markieren, um sie zu verteilen):",
      "multiAgentApiHint": "Es werden nur Anbieter im API-Modus mit API-Key verwendet. Multi-Agenten erfordern den API-Modus.",
      "roleHeading": "Rolle und Hierarchie",
      "roleAssigned": "Zugewiesene Rolle",
      "roleNone": "Keine Rolle",
      "roleHint": "Die Rolle liefert einen Basis-Prompt und Standard-Tools; der Agent verfeinert sie. Rollen in der Agentenliste verwalten.",
      "parentAgent": "Übergeordneter Agent (Unterordnung)",
      "parentNone": "Keiner (oberste Ebene)",
      "parentHintPre": "Sein Vorgesetzter kann ihm ",
      "parentHintBold": "delegieren",
      "parentHintPost": ": Aufgaben während der Ausführung zuweisen und seine Antwort verwenden.",
      "connectionsLabel": "Verbindungen mit anderen Agenten",
      "connectionsEmpty": "Keine weiteren Agenten.",
      "connectionsHint": "Bidirektionaler Kanal: Jeder der beiden kann vom anderen Informationen anfordern oder liefern (Delegierungs-Tool).",
      "supervisorLabel": "Supervisor: kann Chats für seine Untergebenen erstellen",
      "supervisorDesc": "Öffnet echte Chats im Chat-Tab und setzt seine Untergebenen an die Arbeit (jeder Chat dient als Protokoll des jeweiligen Agenten). Wird auch über die Rolle erteilt.",
      "allowAllTools": "Alle verfügbaren Tools erlauben",
      "toolsDesc": "Wähle die Teilmenge der Tools aus, die dieser Agent verwenden darf. Die Liste wird mit den Modulberechtigungen verschnitten, erweitert also niemals Rechte.",
      "associatedServers": "Zugeordnete Server",
      "serversEmpty": "Keine registrierten Server.",
      "attachedProjects": "Angehängte Projekte",
      "attachedProjectsDesc": "Wähle ein oder mehrere Projekte aus dem Baum. Das Markieren eines übergeordneten Projekts wählt alle verschachtelten Ordner aus; der Agent nutzt die Arbeitspfade der ausgewählten Projekte.",
      "noParentProjects": "Keine Projekte.",
      "graphIndexesTitle": "Code-Graph-Indizes",
      "graphIndexesDesc": "Der Agent nutzt diese Indizes, um den Code über den Graphen zu erkunden (Symbole, Aufrufe und Architektur), statt ganze Dateien zu lesen — das senkt den Token-Verbrauch.",
      "graphIndexesEmpty": "Keine Graph-Indizes verfügbar. Indexiere ein Projekt im Tab Projekte.",
      "credentialTitle": "Zugangsdaten",
      "saveObsidian": "Zusammenfassungen im Obsidian-Vault des angehängten Projekts speichern",
      "agentSkills": "Agent-Skills",
      "createAgent": "Agent erstellen",
      "snippetsSection": "Terminal-Snippets",
      "snippetsCategoryLabel": "Snippet-Kategorie",
      "snippetsCategoryNone": "(keine)",
      "snippetsTagsLabel": "Tags der Kategorie",
      "snippetsHelp": "Filtert die Terminal-Snippets vor, die diesem Agenten zur Verfügung stehen: Wähle eine Kategorie und optional Tags dieser Kategorie. Keine Kategorie = kein Filter.",
      "snippetsNoAccess": "Terminal-Snippets konnten nicht geladen werden (Terminal-Berechtigung erforderlich).",
      "snippetsNoTags": "Diese Kategorie hat keine Tags."
    },
    "roleEditor": {
      "titleNew": "Neue Rolle",
      "titleEdit": "Rolle bearbeiten",
      "fieldName": "Name der Rolle",
      "namePlaceholder": "z. B. Koordinator, Auditor, DB-Spezialist",
      "fieldDesc": "Beschreibung",
      "descPlaceholder": "Was diese Rolle darstellt",
      "fieldBasePrompt": "Basis-Prompt der Rolle",
      "basePromptPlaceholder": "Richtlinien, Verantwortlichkeiten und Ton für alle Agenten mit dieser Rolle…",
      "basePromptHint": "Wird als Basis eingefügt, vor dem eigenen Prompt des Agenten.",
      "noToolLimit": "Keine Tool-Beschränkung durch die Rolle",
      "toolsDesc": "Die Tools der Rolle begrenzen, was die zugehörigen Agenten verwenden dürfen (wird verschnitten, niemals erweitert).",
      "supervisorLabel": "Supervisor-Funktion: Agenten mit dieser Rolle können Chats für ihre Untergebenen erstellen",
      "supervisorDesc": "Erteilt jedem Agenten mit dieser Rolle die Berechtigung, als Supervisor zu handeln (Tool zum Öffnen von Chats und Zuweisen von Aufgaben).",
      "createRole": "Rolle erstellen"
    },
    "treeView": {
      "title": "Agentenhierarchie",
      "reloadTitle": "Agenten neu laden und Baum neu generieren",
      "regenerating": "Wird neu generiert…",
      "regenerate": "Neu generieren",
      "description": "Diagramm des Unterordnungsbaums (durchgezogene Linie = übergeordnet → untergeordnet) und Verbindungen zwischen Peers (gestrichelte Linie). Weise im Editor jedes Agenten den «Übergeordneten Agenten» zu, um den Baum aufzubauen."
    },
    "rolesList": {
      "newRole": "Neue Rolle",
      "description": "Wiederverwendbare Rollen (Profil mit Basis-Prompt und Tools), die einem oder mehreren Agenten zugewiesen werden.",
      "emptyTitle": "Noch keine Rollen",
      "emptyDesc": "Erstelle eine Rolle, um das Verhalten mehrerer Agenten zu standardisieren.",
      "agentsCount": "{count} Agent(en)"
    },
    "list": {
      "description": "Benutzerdefinierte KI-Agenten: eigener Prompt, Tools und Anbieter/Modell. Im Chat verwenden oder per Cron planen.",
      "treeBtn": "Baum",
      "treeBtnTitle": "Agentenhierarchiebaum anzeigen",
      "rolesBtn": "Rollen",
      "rolesBtnTitle": "Agentenrollen erstellen und verwalten",
      "newAgent": "Neuer Agent",
      "loading": "Agenten werden geladen…",
      "emptyTitle": "Noch keine Agenten",
      "emptyDesc": "Erstelle einen, um mit einem maßgeschneiderten Prompt und Tool-Set zu chatten.",
      "multiAgentTitle": "Multi-Agent: {count} Kopien",
      "roleAssignedTitle": "Zugewiesene Rolle",
      "subordinateTitle": "Untergeordnet von",
      "connectionsTitle": "Verbindungen mit anderen Agenten",
      "supervisorTitle": "Supervisor: kann Chats für Untergebene erstellen",
      "supervisorBadge": "Supervisor",
      "realtimeTitle": "Echtzeit-Kommunikation",
      "realtimeBadge": "Echtzeit",
      "startChat": "Chat starten",
      "duplicateTitle": "Duplizieren",
      "noRoleGroupTitle": "Ohne Arbeitsgruppe",
      "groupAria": "Arbeitsgruppe: {name}",
      "groupCount": "{count} Agenten",
      "noRoleGroupDesc": "Agenten ohne zugewiesene Rolle. Weisen Sie eine im Editor zu."
    },
    "resync": {
      "applying": "Erstelle…",
      "close": "Schließen",
      "btn": "Mit Vorlage synchronisieren",
      "btnTitle": "Dieses Team mit seiner Vorlage vergleichen und fehlende Agenten erstellen",
      "modalTitle": "«{name}» mit seiner Vorlage synchronisieren",
      "loading": "Vergleich mit der Vorlage…",
      "markersMissing": "Dieses Team hat seine Herkunftsmarkierungen aus der Vorlage verloren und kann nicht automatisch verglichen werden. Fehlende Agenten können manuell erstellt werden.",
      "missingHeading": "Fehlend",
      "presentHeading": "Vorhanden",
      "extraHeading": "Manuell hinzugefügt",
      "extraNote": "Sie werden nicht geändert.",
      "nothingMissing": "Das Team ist vollständig: Es fehlen keine Agenten aus der Vorlage.",
      "confirm": "Ausgewählte erstellen"
    }
  },
  "accessTab": {
    "all": "Alle",
    "permissionsTitle": "Zugriffe und Berechtigungen",
    "permissionsDescription": "Die Sichtbarkeit des Assistenten wird heute durch die Berechtigung des assistant-Moduls in Ihrem Profil geregelt. Die rollenbasierte Detailansicht (assistant.use / assistant.configure / assistant.module.<id>) ist für die nächste Iteration geplant.",
    "recentInvocations": "Letzte Tool-Aufrufe",
    "refreshAriaLabel": "Zugriffe aktualisieren",
    "loading": "Lädt...",
    "emptyRecent": "Keine neuere Aktivität.",
    "emptyProvider": "Keine Aktivität für diesen Anbieter.",
    "byUser": "von",
    "crossServerTitle": "Zugriff auf verknüpften Server",
    "autoApproveTitle": "Automatische Genehmigung",
    "autoApproveDescription": "Tools, die nicht mehr nach einer Bestätigung fragen (genehmigt mit «Genehmigen und nicht mehr fragen»). Änderungen gelten ab dem nächsten Lauf.",
    "autoApproveEmpty": "Keine Tools mit automatischer Genehmigung. Diese Liste füllt sich, wenn Sie beim Genehmigen einer Agentenaktion «Genehmigen und nicht mehr fragen» wählen.",
    "autoApproveRevoke": "Widerrufen",
    "autoApproveModeAuto": "Auto-Modus: diese Liste gilt nicht",
    "cmdPrefix": "$ ",
    "passwordLabel": "Passwort: ",
    "passphraseLabel": "Passphrase: ",
    "privateKeyLabel": "privater Schlüssel"
  },
  "directoryPicker": {
    "title": "Ordner auswählen",
    "goUp": "Nach oben",
    "loading": "Wird geladen…",
    "emptyDirs": "(keine Unterordner)",
    "cancel": "Abbrechen",
    "select": "Diesen Ordner verwenden",
    "readError": "Verzeichnis konnte nicht gelesen werden"
  },
  "skillsSettings": {
    "title": "Skills und Methoden des Assistenten",
    "helper": "Aktiviere oder deaktiviere Bibliotheken, Skills und Methoden, die das Verhalten des Assistenten verfeinern.",
    "tokenNote": "Die Anweisungen jedes Skills werden im gecachten Prompt übermittelt (~0.1× in den Folgerunden). Ponytail reduziert Code und Ausgabe-Tokens; bei UI/UX Pro Max nutze die Stufe «Kurz», um weniger zu verbrauchen.",
    "search": "Skill suchen…",
    "allCategories": "Alle Kategorien",
    "loading": "Skills werden geladen...",
    "empty": "Keine Skills verfügbar.",
    "noMatch": "Kein Skill entspricht dem Filter.",
    "sourcePrefix": "Quelle:",
    "errorGeneric": "Skill konnte nicht aktualisiert werden. Erneut versuchen.",
    "activeShown": "{count} aktiv · {shown} angezeigt."
  },
  "skillsPicker": {
    "searchPlaceholder": "Skill suchen…",
    "resetTitle": "Anpassung entfernen (globale Skills verwenden)",
    "reset": "Zurücksetzen ({count})",
    "loading": "Skills werden geladen…",
    "empty": "Keine Skills.",
    "globalNote": "Gelten NUR in Ihren Chats, zusätzlich zu den globalen Skills des Anbieters."
  },
  "skillCategories": {
    "methods": "Assistentenmethoden",
    "code-quality": "Code-Qualität",
    "web-quality": "Webqualität (Lighthouse / CWV)",
    "ui-ux": "UI / UX / Design",
    "web-fullstack": "Web / Full-Stack-KI-Entwicklung",
    "mobile": "Mobile Apps",
    "code-agents": "Code-Agenten",
    "reusable-skills": "Wiederverwendbare KI-Skills",
    "security": "KI- / Web- / App-Sicherheit",
    "token-savings": "Token-Einsparungen / KI-Kosten",
    "ai-prod": "KI-Agenten in der Produktion",
    "devops": "DevOps / Bereitstellung",
    "testing": "Testing / Code-Qualität",
    "data-rag": "Datenbanken / RAG / Suche",
    "automation": "Automatisierung / Workflows",
    "other": "Sonstiges"
  },
  "skillCatalog": {
    "ask-protocol": {
      "name": "Vor dem Entscheiden fragen",
      "description": "Ermöglicht dem Assistenten, anzuhalten und Sie zu einer Schlüsselentscheidung zu fragen, statt zu vermuten (lxp_ask-Tool + Fragenprotokoll)."
    },
    "project-context-vault": {
      "name": "Projektkontext (Obsidian)",
      "description": "Injiziert Projektkontext-Notizen (Contexto.md / Errores.md) und ermöglicht weitere Suche mit obsidian.search_notes."
    },
    "ponytail": {
      "name": "Ponytail (minimalistischer Code)",
      "description": "Minimalistische Entwicklungsmethode: Schreiben Sie den minimal erforderlichen Code (Entscheidungsleiter + Schutzmaßnahmen)."
    },
    "ui-ux-pro-max": {
      "name": "UI/UX Pro Max (Schnittstellenqualität)",
      "description": "Professionelle UI/UX-Standards (Barrierefreiheit, Touch, Typografie, Status) in den Prompt injiziert; kurze oder umfassende Stufe."
    },
    "openai-agents-sdk": {
      "name": "OpenAI Agents SDK",
      "description": "OpenAI-Agenten mit Tools, Handoffs, Schutzmaßnahmen, Sessions und Tracing."
    },
    "openai-agents-python": {
      "name": "OpenAI Agents Python SDK",
      "description": "Python SDK für Agenten: Agent, Runner, @function_tool, Handoffs und Tracing."
    },
    "openai-agents-js": {
      "name": "OpenAI Agents JS SDK",
      "description": "TypeScript/JS SDK für OpenAI-Agenten: Agent, run, Tools (Zod), Handoffs."
    },
    "mcp-docs": {
      "name": "Model Context Protocol",
      "description": "Offener Standard (das 'USB-C der KI'), um LLMs mit Tools, Ressourcen und Prompts zu verbinden."
    },
    "mcp-github": {
      "name": "MCP (GitHub)",
      "description": "MCP-GitHub-Org: Offizielle SDKs (10 Sprachen), Referenzserver und Inspector."
    },
    "anthropic-mcp-intro": {
      "name": "Anthropic MCP Intro",
      "description": "Anthropic-Ankündigung: MCP als offener Standard, der N×M-Integrationen löst."
    },
    "n8n": {
      "name": "n8n",
      "description": "Fair-Code, selbst-gehostete Workflow-Automatisierung."
    },
    "make": {
      "name": "Make",
      "description": "Visuelle No-Code-Automatisierung nach Szenarien (ehemals Integromat)."
    },
    "zapier": {
      "name": "Zapier",
      "description": "SaaS-Automatisierung via Trigger und Aktionen (Zaps)."
    },
    "temporal": {
      "name": "Temporal",
      "description": "Orchestrierung dauerhafter, fehlertoleranter Workflows."
    },
    "bullmq": {
      "name": "BullMQ",
      "description": "Redis-basierte Job-Queues für Node.js."
    },
    "langgraph": {
      "name": "LangGraph",
      "description": "Orchestrierung von LLM-Agenten als stateful Graphs."
    },
    "codex-cli": {
      "name": "OpenAI Codex CLI",
      "description": "Leitet den Agenten zur Nutzung von OpenAI's Codex CLI an (Terminal-Code-Agent)."
    },
    "codex-cli-features": {
      "name": "Codex CLI Features",
      "description": "Detailliert die Möglichkeiten der Codex CLI für den Agenten (Sandbox, Genehmigungen, MCP, Config)."
    },
    "codex-cloud": {
      "name": "Codex Cloud",
      "description": "Leitet den Agenten an, Aufgaben an Codex Cloud zu delegieren (Remote-Umgebungen, parallele Ausführung, PRs)."
    },
    "claude-code-skills": {
      "name": "Claude Code Skills",
      "description": "Leitet den Agenten an, Claude Code Skills zu erstellen und zu nutzen (Ordner mit SKILL.md, Agent Skills Standard)."
    },
    "copilot-cloud-agent": {
      "name": "GitHub Copilot Cloud Agent",
      "description": "Leitet den Agenten an, Issues an GitHub Copilot Coding Agent zu delegieren, der in der Cloud läuft und PRs öffnet."
    },
    "cursor": {
      "name": "Cursor",
      "description": "Leitet den Agenten an, im Cursor-Editor zu arbeiten (Agent, Repo-Kontext, Regeln)."
    },
    "agents-md": {
      "name": "AGENTS.md",
      "description": "Leitet den Agenten an, AGENTS.md zu verfassen und zu befolgen, die Standard-Anleisungsdatei für Code-Agenten."
    },
    "open-design-contribute": {
      "name": "Open Design — beitragen (No-Code)",
      "description": "Geführter No-Code-Workflow zum Beitragen zu Open Design (nexu-io): einen Skill oder Design System einreichen, Docs übersetzen, Copy korrigieren oder einen Bug berichten, und die PR/Issue wird für Sie geöffnet."
    },
    "supabase": {
      "name": "Supabase",
      "description": "Verwaltetes Postgres-Backend mit Auth, Storage und Realtime."
    },
    "postgresql": {
      "name": "PostgreSQL",
      "description": "Robuste relationale Datenbank mit umfangreichen Datentypen."
    },
    "pgvector": {
      "name": "pgvector",
      "description": "Vektorähnlichkeitssuche innerhalb von Postgres."
    },
    "pinecone": {
      "name": "Pinecone",
      "description": "Verwaltete Vektordatenbank für RAG im großen Maßstab."
    },
    "qdrant": {
      "name": "Qdrant",
      "description": "Open-Source Vektor-Engine mit Payload-Filterung."
    },
    "weaviate": {
      "name": "Weaviate",
      "description": "Vektordatenbank mit Schema und Vektorisierungsmodulen."
    },
    "github-actions": {
      "name": "GitHub Actions",
      "description": "CI/CD auf GitHub mit YAML-Workflows (.github/workflows) ausgelöst durch Events."
    },
    "vercel": {
      "name": "Vercel",
      "description": "Bereitstellung von Frontends und serverlosen Funktionen mit Pro-Commit/PR-Vorschau."
    },
    "docker": {
      "name": "Docker",
      "description": "Verpackt Apps in flüchtige Container mit leichten, reproduzierbaren Images."
    },
    "nginx": {
      "name": "Nginx",
      "description": "Hochperformanter Webserver und Reverse Proxy."
    },
    "pm2": {
      "name": "PM2",
      "description": "Node-Prozess-Manager mit Cluster, Neustart und Logs."
    },
    "redis": {
      "name": "Redis",
      "description": "In-Memory-Store für Caching, Queues und Datenstrukturen."
    },
    "expo": {
      "name": "Expo",
      "description": "Leitet den Agenten an, React Native Apps mit Expo zu entwickeln (expo-router, Module, Config Plugins)."
    },
    "eas-build": {
      "name": "EAS Build",
      "description": "Leitet den Agenten an, iOS/Android-Binärdateien in der Cloud mit EAS Build und eas.json Profilen zu erstellen."
    },
    "eas-services": {
      "name": "EAS Services",
      "description": "Unterstützt den Agenten, das EAS-Ökosystem (Submit, Update/OTA, Workflows) End-to-End zu nutzen."
    },
    "react-native": {
      "name": "React Native",
      "description": "Leitet den Agenten an, native UIs mit React Native zu erstellen (Core Components, Styles, Platform)."
    },
    "firebase-auth": {
      "name": "Firebase Auth",
      "description": "Leitet den Agenten an, Authentifizierung mit Firebase Auth zu implementieren (Provider, Tokens, Session)."
    },
    "claude-agent-skills": {
      "name": "Claude Agent Skills",
      "description": "Verpackt wiederverwendbare Funktionen als Agent Skills (SKILL.md), die bei Bedarf geladen werden."
    },
    "claude-skills-github": {
      "name": "Claude Skills (GitHub)",
      "description": "Offizielles anthropics/skills Repository: Beispiele, Spezifikation und Template als Basis und Muster."
    },
    "codex-agents-md-guide": {
      "name": "Codex AGENTS.md Guide",
      "description": "Codex's AGENTS.md Konvention zum Geben von Projektanweisungen an Code-Agenten."
    },
    "owasp-llm-top10": {
      "name": "OWASP Top 10 LLM",
      "description": "Top 10 Risiken in LLM Apps: Prompt Injection, unsichere Ausgabe, exzessive Agency."
    },
    "owasp-asvs": {
      "name": "OWASP ASVS",
      "description": "ASVS v5.0: Standard verifizierter Sicherheitsanforderungen nach Stufen."
    },
    "codeql": {
      "name": "CodeQL",
      "description": "CodeQL: Fragt Code als Daten ab (Data-Flow/Taint), um Sicherheitslücken zu finden."
    },
    "semgrep": {
      "name": "Semgrep",
      "description": "Semgrep: Code-ähnliche SAST-Regeln + Supply Chain (SCA) und Secrets, hohes Signal."
    },
    "snyk": {
      "name": "Snyk",
      "description": "Snyk: SCA, Code (SAST), Container, IaC und API/Web (DAST) mit geführter Behebung."
    },
    "owasp-zap": {
      "name": "OWASP ZAP",
      "description": "OWASP ZAP: Führender Open-Source Web-Scanner für DAST (passive/active scan)."
    },
    "skillspector": {
      "name": "SkillSpector (KI-Skills audieren)",
      "description": "Prüft KI-Agenten-Skills (SKILL.md + Skripte) auf Sicherheitslücken und böse Absichten, bevor sie installiert werden (NVIDIA, Apache-2.0)."
    },
    "playwright": {
      "name": "Playwright",
      "description": "Cross-Browser E2E Testing mit Auto-Waiting und Traces."
    },
    "cypress": {
      "name": "Cypress",
      "description": "Komponenten- und E2E-Tests im Browser mit Wiederholungen."
    },
    "vitest": {
      "name": "Vitest",
      "description": "Schneller Test-Runner nativ für Vite/ESM."
    },
    "jest": {
      "name": "Jest",
      "description": "Test-Framework mit integrierten Mocks und Snapshots."
    },
    "testing-library": {
      "name": "Testing Library",
      "description": "Benutzerzentrerte Abfragen zum Testen barrierefreier UI."
    },
    "storybook": {
      "name": "Storybook",
      "description": "Isolierte Entwicklung und Tests von UI-Komponenten."
    },
    "openai-prompt-caching": {
      "name": "OpenAI Prompt Caching",
      "description": "Reduziert Kosten automatisch durch Wiederverwendung des gecachten Prompt-Präfix in OpenAI."
    },
    "openai-prompt-engineering": {
      "name": "OpenAI Prompt Engineering",
      "description": "Schreiben Sie präzise Prompts für weniger Iterationen und weniger Tokens."
    },
    "gemini-context-caching": {
      "name": "Gemini Context Caching",
      "description": "Cache großen wiederholten Kontext in Gemini (explizit oder implizit), um Input billiger zu machen."
    },
    "gemini-caching-api": {
      "name": "Gemini Caching API",
      "description": "Gemini cachedContents API: Erstellen, Wiederverwenden, TTL aktualisieren und Caches löschen."
    },
    "litellm-cost-tracking": {
      "name": "LiteLLM Cost Tracking",
      "description": "Messen und Zuordnen von Kosten pro Schlüssel/Benutzer/Team mit dem LiteLLM Proxy."
    },
    "litellm": {
      "name": "LiteLLM",
      "description": "Einheitliches Gateway zu 100+ LLMs (OpenAI-Format) mit Caching, Failovers und Routing."
    },
    "figma-ai": {
      "name": "Figma AI",
      "description": "Figma KI: Canvas-Agent, Bildgenerierung und Design-to-Code."
    },
    "figma-make": {
      "name": "Figma Make",
      "description": "Figma Make: Von Prompt oder Frame zu funktionalen Prototyp/App mit echtem Code."
    },
    "figma-ai-tools": {
      "name": "Figma AI Tools",
      "description": "KI-Tools in Figma Design: First Draft, Layer umbenennen, Bilder, Text."
    },
    "framer": {
      "name": "Framer",
      "description": "Framer: No-Code-Sites mit visueller Canvas, KI-Agenten, CMS und Publishing."
    },
    "relume": {
      "name": "Relume",
      "description": "Relume: Von Brief zu Sitemap, Wireframes und Style Guide mit KI + Bibliothek."
    },
    "design-md-tokens": {
      "name": "DESIGN.md (Token-basiertes System)",
      "description": "Generieren Sie markengetreue UI mit strukturiertem DESIGN.md: Farbe/Typografie/Abstands-Tokens, Komponenten-Specs und Do/Don't-Regeln (voltagent, MIT)."
    },
    "nextjs-app-router": {
      "name": "Next.js App Router",
      "description": "Leitet den Agenten an, Next.js Apps mit App Router zu erstellen (Server Components, Route Handlers, Layouts)."
    },
    "vercel-ai-sdk": {
      "name": "Vercel AI SDK",
      "description": "Unterstützt den Agenten, LLMs mit AI SDK zu integrieren (generateText, streamText, Tools, Structured Output)."
    },
    "vercel-ai-gateway": {
      "name": "Vercel AI Gateway",
      "description": "Leitet den Agenten an, Requests über AI Gateway zu mehreren Modellen zu routen (ein Endpoint, Failover, Beobachtbarkeit)."
    },
    "openai-sdk-cli": {
      "name": "OpenAI SDKs und CLI",
      "description": "Leitet den Agenten an, OpenAI's offizielle SDKs (Python/Node) und die API idiomatisch zu nutzen."
    },
    "v0-vercel": {
      "name": "v0 by Vercel",
      "description": "Unterstützt den Agenten, React/Tailwind/shadcn UI mit v0 aus Prompts zu generieren und zu verfeinern."
    },
    "web-quality-audit": {
      "name": "Web-Qualitätsprüfung",
      "description": "Umfassende Web-Qualitätsprüfung (Leistung, Barrierefreiheit, SEO, Sicherheit) mit Schweregradklassifizierung."
    },
    "web-performance": {
      "name": "Web-Leistung",
      "description": "Optimieren Sie Ladegeschwindigkeit und Laufzeiteffizienz (Ressourcenbudget + Lighthouse)."
    },
    "core-web-vitals": {
      "name": "Core Web Vitals (LCP/INP/CLS)",
      "description": "Verbessern Sie LCP, INP und CLS (Schwellenwerte beim 75. Perzentil)."
    },
    "web-accessibility": {
      "name": "Web-Barrierefreiheit (WCAG 2.2)",
      "description": "Prüfen und verbessern Sie die Barrierefreiheit nach WCAG 2.2 (Ziel AA)."
    },
    "web-seo": {
      "name": "SEO (technisch + auf der Seite)",
      "description": "Optimieren Sie Suchmaschinen-Sichtbarkeit: technische SEO, On-Page und strukturierte Daten."
    },
    "web-best-practices": {
      "name": "Web-Best-Practices (Sicherheit)",
      "description": "Moderne Muster für Sicherheit, Kompatibilität und Code-Qualität."
    }
  }
} as const;

export default assistantPart2;
