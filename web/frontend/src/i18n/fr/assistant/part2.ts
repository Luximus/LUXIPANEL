const assistantPart2 = {
  "cliUsageBars": {
    "sourceReal": "quota restant du compte",
    "sourceEstimated": "tokens restants estimés",
    "sourceTokens": "tokens restants",
    "cliUsage": "CLI disponible",
    "session5h": "Session (5h)",
    "week": "Semaine",
    "sessionHours": "Session ({hours}h)",
    "resetSameDay": "réinitialisation {time}",
    "resetOtherDay": "réinitialisation {day}, {time}",
    "unavailable": "Impossible de charger le quota de {provider}",
    "retry": "Réessayer"
  },
  "notifySettings": {
    "title": "Notifications de l'assistant",
    "description": "Prévenez-moi sur mes appareils (web, app et bureau) lorsqu'une conversation se termine et que je ne la regarde pas.",
    "saveError": "Impossible d'enregistrer."
  },
  "voiceSettings": {
    "title": "Voix (audio)",
    "description": "Parlez à l’assistant et écoutez ses réponses avec OpenAI.",
    "missingCapabilities": "Configurez une clé API OpenAI dans le fournisseur Codex pour activer l’audio.",
    "inputLabel": "Entrée (STT)",
    "outputLabel": "Sortie (TTS)",
    "notAvailable": "non disponible",
    "voiceLabel": "Voix",
    "autoSpeak": "Lire automatiquement les réponses à la fin",
    "audioProvider": "Fournisseur audio",
    "providerApi": "API (OpenAI/Gemini)",
    "providerPiper": "Piper (local)",
    "providerMinimax": "MiniMax",
    "providerApiHint": "Utilise la clé API déjà configurée.",
    "piperReady": "Piper installé",
    "piperMissing": "Piper non installé",
    "minimaxReady": "MiniMax prêt",
    "minimaxMissing": "MiniMax indisponible",
    "minimaxAuthMissing": "Clé MiniMax manquante",
    "minimaxVoiceHint": "Voix MiniMax à utiliser."
  },
  "agentMarket": {
    "overrideHint": "L’enregistrement remplace la configuration héritée dans ce projet par ces paramètres.",
    "title": "Market",
    "description": "Profils réutilisables pour les projets de ce serveur.",
    "search": "Rechercher par nom, description, spécialité ou technologie",
    "project": "Projet actif",
    "chooseProject": "Sélectionner un projet",
    "allProviders": "Tous les fournisseurs",
    "allRoles": "Tous les rôles",
    "allAssignments": "Toutes les affectations",
    "assigned": "Affecté",
    "unassigned": "Non affecté",
    "inherited": "Hérité",
    "removed": "Retiré",
    "empty": "Aucun profil d’agent pour le moment.",
    "noMatches": "Aucun profil ne correspond aux filtres.",
    "loading": "Chargement du catalogue…",
    "retry": "Réessayer",
    "error": "Impossible de charger ou de mettre à jour le catalogue.",
    "pending": "Opération en cours…",
    "add": "Ajouter au projet",
    "remove": "Retirer du projet",
    "configure": "Configurer l’affectation",
    "editProfile": "Modifier le profil global",
    "profileHint": "Les modifications du profil s’appliquent à tous ses projets.",
    "assignmentHint": "Cette configuration s’applique uniquement au projet sélectionné.",
    "removeConfirm": "Retirer {name} de ce projet ? Son profil et son historique seront conservés.",
    "saved": "Modifications enregistrées.",
    "specialty": "Spécialité",
    "technologies": "Technologies (séparées par des virgules)",
    "newProfile": "Créer un profil",
    "back": "Retour au chat",
    "inheritedHint": "Hérité de {project}. Gérez le retrait dans le projet d’origine.",
    "readOnly": "Lecture seule",
    "busy": "Des travaux ou approbations sont en attente. Terminez-les avant de modifier l’affectation.",
    "forbidden": "Vous n’avez pas l’autorisation d’effectuer cette action.",
    "contextChanged": "Le serveur ou la session a changé. Rechargez le catalogue.",
    "uncertain": "Le résultat n’a pas pu être confirmé. Consultez le catalogue avant de répéter l’action.",
    "historical": "Historique : indisponible pour de nouveaux chats",
    "inherit": "Hériter du profil",
    "none": "Aucun",
    "jobTitle": "Poste dans le projet",
    "instructions": "Instructions du projet",
    "limitsHint": "Les limites se combinent aux autorisations existantes sans accorder d’accès supplémentaire."
  },
  "agentsTab": {
    "teams": {
      "newTeamBtn": "Nouvelle équipe",
      "newTeamTitle": "Créer une équipe",
      "editTeamTitle": "Modifier l'équipe",
      "nameLabel": "Nom",
      "namePlaceholder": "Ex. Backend, Frontend, Design…",
      "descriptionLabel": "Description (facultatif)",
      "colorLabel": "Couleur",
      "createBtn": "Créer l'équipe",
      "saveBtn": "Enregistrer",
      "cancelBtn": "Annuler",
      "addAgentsBtn": "Ajouter des agents",
      "addAgentsTitle": "Ajouter des agents à l'équipe",
      "addAgentsEmpty": "Aucun agent disponible à ajouter.",
      "addAgentsConfirm": "Ajouter",
      "alreadyInTeam": "dans une autre équipe",
      "removeFromTeamBtn": "Retirer de l'équipe",
      "removeFromTeamConfirm": "Retirer cet agent de l'équipe ? L'agent n'est pas supprimé.",
      "deleteTeamBtn": "Supprimer l'équipe",
      "deleteTeamConfirm": "Supprimer cette équipe ?",
      "deleteTeamKeepsAgentsNote": "Les agents ne sont PAS supprimés : ils sont seulement retirés de l'équipe.",
      "teamSelectorLabel": "Équipe",
      "groupRequired": "Sélectionnez ou créez un groupe",
      "teamSelectorPlaceholder": "— Sélectionnez un groupe —",
      "noTeamOption": "Aucune équipe",
      "emptyTeamHint": "Équipe vide — ajoutez des agents avec le bouton +.",
      "memberCount": "{count} membre(s)"
    },
    "cancel": "Annuler",
    "saving": "Enregistrement…",
    "saveChanges": "Enregistrer les modifications",
    "noDescription": "Sans description",
    "allTools": "tous les outils",
    "toolsCount": "{count} outils",
    "noActiveModules": "Aucun module actif avec des outils.",
    "removeAll": "Tout retirer",
    "selectAll": "Tout sélectionner",
    "sensitiveTool": "action sensible",
    "confirmDeleteAgent": "Supprimer l'agent \"{name}\" ?",
    "confirmDeleteRole": "Supprimer le rôle \"{name}\" ? Il sera retiré des agents qui l'utilisent.",
    "duplicateName": "{name} (copie)",
    "editBtn": "Modifier",
    "deleteTitle": "Supprimer",
    "errorPrefix": "Erreur : {message}",
    "backToAgents": "Agents",
    "createdBy": "Créé par {ownerName}",
    "diagram": {
      "empty": "Aucun agent — créez-en un pour l'afficher ici",
      "connection": "connexion"
    },
    "archetypes": {
      "devops": "DevOps / SRE",
      "security": "Auditeur de sécurité",
      "dba": "Administrateur de bases de données",
      "support": "Support technique",
      "nginx": "Administrateur web / Nginx",
      "backups": "Spécialiste en sauvegardes",
      "logs": "Analyste de journaux",
      "automation": "Automatisation / Cron"
    },
    "editor": {
      "titleNew": "Nouvel agent",
      "titleEdit": "Modifier l'agent",
      "headerTitleNew": "Nouvel agent",
      "headerDescNew": "Configurer un nouvel agent IA",
      "headerTitleEdit": "Modification de l'agent",
      "headerDescEdit": "Modifier la configuration de l'agent",
      "backToList": "Retour aux agents",
      "tabGeneral": "Général",
      "tabModel": "Modèle",
      "tabHierarchy": "Hiérarchie",
      "tabTools": "Outils",
      "tabResources": "Ressources",
      "tabAccess": "Accès",
      "aiHelpTitle": "Aide IA",
      "aiHelpDesc": "Choisissez un profil et l'IA rédigera le nom, la description, le prompt et les outils de façon professionnelle.",
      "aiHelpSelect": "Sélectionnez un profil…",
      "aiHelpFromDesc": "Depuis ma description",
      "aiHelpFromDescTitle": "Améliorer à partir de la description actuelle",
      "aiHelpGenerating": "Génération de l'agent avec IA…",
      "fieldName": "Nom",
      "namePlaceholder": "Ex. Auditeur de sécurité",
      "fieldDescription": "Description",
      "descPlaceholder": "À quoi sert cet agent",
      "fieldSystemPrompt": "Prompt système",
      "systemPromptPlaceholder": "Instructions, personnalité et objectifs de l'agent…",
      "fieldAvatar": "Avatar",
      "avatarRandomize": "Aléatoire",
      "avatarAuto": "Auto",
      "avatarAttrs": {
        "top": "Cheveux / chapeau",
        "hairColor": "Couleur de cheveux",
        "eyes": "Yeux",
        "eyebrows": "Sourcils",
        "mouth": "Bouche",
        "skinColor": "Couleur de peau",
        "clothing": "Vêtements",
        "clothesColor": "Couleur des vêtements",
        "accessories": "Accessoire",
        "facialHair": "Pilosité faciale",
        "facialHairColor": "Couleur de la barbe"
      },
      "fieldProvider": "Fournisseur",
      "fieldModel": "Modèle",
      "modelPlaceholder": "(par défaut du fournisseur)",
      "realtimeLabel": "Communication en temps réel (session à faible latence)",
      "realtimeDesc": "Session bidirectionnelle audio/texte en streaming (selon le fournisseur : OpenAI Realtime ou Gemini Live).",
      "realtimeUnavailable": "Le fournisseur \"{providerId}\" ne propose pas de session en temps réel. Disponible uniquement avec codex (OpenAI) ou gemini.",
      "multiAgentLabel": "Mode multi-agent : réplique cet agent plusieurs fois en parallèle",
      "multiAgentDescPre": "L'agent se ",
      "multiAgentDescBold": "multiplie par X",
      "multiAgentDescPost": " : la tâche est divisée en X parties et chaque copie (même prompt, outils et fournisseur) en résout une en parallèle ; puis une seule réponse est synthétisée.",
      "multiAgentCopies": "Nombre de copies (X)",
      "multiAgentCopiesHint": "copies de l'agent (2–8)",
      "multiAgentProvidersPre": "Facultatif — répartir les copies entre plusieurs fournisseurs (le principal ",
      "multiAgentProvidersPost": " participe toujours ; cochez-en d'autres pour les distribuer) :",
      "multiAgentApiHint": "Seuls les fournisseurs en mode API avec une clé API sont utilisés. Le multi-agent requiert le mode API.",
      "roleHeading": "Rôle et hiérarchie",
      "roleAssigned": "Rôle assigné",
      "roleNone": "Sans rôle",
      "roleHint": "Le rôle apporte un prompt de base et des outils par défaut ; l'agent le raffine. Gérez les rôles depuis la liste des agents.",
      "parentAgent": "Agent supérieur (subordination)",
      "parentNone": "Aucun (niveau supérieur)",
      "parentHintPre": "Son supérieur pourra ",
      "parentHintBold": "lui déléguer",
      "parentHintPost": " des tâches pendant l'exécution et utiliser sa réponse.",
      "connectionsLabel": "Connexions avec d'autres agents",
      "connectionsEmpty": "Aucun autre agent.",
      "connectionsHint": "Canal bidirectionnel : l'un ou l'autre peut demander ou transmettre des informations à l'autre en cours d'exécution (outil de délégation).",
      "supervisorLabel": "Superviseur : peut créer des chats pour ses subordonnés",
      "supervisorDesc": "Ouvre de vrais chats dans l'onglet Chat et met au travail ses subordonnés (chaque chat reste comme journal de bord de cet agent). Accordé également via le rôle.",
      "allowAllTools": "Autoriser tous les outils disponibles",
      "toolsDesc": "Sélectionnez le sous-ensemble d'outils que cet agent peut utiliser. La liste est croisée avec ce que chaque module permet, donc les permissions ne sont jamais élargies.",
      "associatedServers": "Serveurs associés",
      "serversEmpty": "Aucun serveur enregistré.",
      "attachedProjects": "Projets attachés",
      "attachedProjectsDesc": "Sélectionnez un ou plusieurs projets de l'arborescence. Cocher un projet parent sélectionne tous ses dossiers imbriqués ; l'agent utilise les chemins de travail des projets sélectionnés.",
      "noParentProjects": "Aucun projet.",
      "graphIndexesTitle": "Index du graphe de code",
      "graphIndexesDesc": "L'agent utilisera ces index pour explorer le code via le graphe (symboles, appels et architecture) au lieu de lire des fichiers entiers — cela réduit la consommation de tokens.",
      "graphIndexesEmpty": "Aucun index de graphe disponible. Indexez un projet depuis l'onglet Projets.",
      "credentialTitle": "Identifiants d'accès",
      "saveObsidian": "Enregistrer les résumés dans le vault Obsidian du projet attaché",
      "agentSkills": "Skills de l'agent",
      "createAgent": "Créer l'agent",
      "snippetsSection": "Snippets de terminal",
      "snippetsCategoryLabel": "Catégorie de snippets",
      "snippetsCategoryNone": "(aucune)",
      "snippetsTagsLabel": "Étiquettes de la catégorie",
      "snippetsHelp": "Préfiltre les snippets de terminal disponibles pour cet agent : choisissez une catégorie et, éventuellement, des étiquettes de cette catégorie. Sans catégorie = sans filtre.",
      "snippetsNoAccess": "Impossible de charger les snippets de terminal (permission de terminal requise).",
      "snippetsNoTags": "Cette catégorie n'a pas d'étiquettes."
    },
    "roleEditor": {
      "titleNew": "Nouveau rôle",
      "titleEdit": "Modifier le rôle",
      "fieldName": "Nom du rôle",
      "namePlaceholder": "Ex. Coordinateur, Auditeur, Spécialiste BDD",
      "fieldDesc": "Description",
      "descPlaceholder": "Ce que représente ce rôle",
      "fieldBasePrompt": "Prompt de base du rôle",
      "basePromptPlaceholder": "Politiques, responsabilités et ton communs à tous les agents ayant ce rôle…",
      "basePromptHint": "Injecté comme base, avant le prompt propre de l'agent.",
      "noToolLimit": "Sans limite d'outils depuis le rôle",
      "toolsDesc": "Les outils du rôle limitent ce que ses agents peuvent utiliser (croisement, jamais d'élargissement).",
      "supervisorLabel": "Poste superviseur : les agents avec ce rôle peuvent créer des chats pour leurs subordonnés",
      "supervisorDesc": "Accorde la permission d'agir en tant que superviseur (outil pour ouvrir des chats et attribuer du travail) à tout agent ayant ce rôle.",
      "createRole": "Créer le rôle"
    },
    "treeView": {
      "title": "Hiérarchie des agents",
      "reloadTitle": "Recharger les agents et régénérer l'arbre",
      "regenerating": "Régénération…",
      "regenerate": "Régénérer",
      "description": "Diagramme de l'arbre de subordination (ligne pleine = supérieur → subordonné) et connexions entre pairs (ligne pointillée). Assignez l'«Agent supérieur» dans l'éditeur de chaque agent pour construire l'arbre."
    },
    "rolesList": {
      "newRole": "Nouveau rôle",
      "description": "Rôles réutilisables (profil avec prompt de base et outils) que vous assignez à un ou plusieurs agents.",
      "emptyTitle": "Aucun rôle pour l'instant",
      "emptyDesc": "Créez un rôle pour standardiser le comportement de plusieurs agents.",
      "agentsCount": "{count} agent(s)"
    },
    "list": {
      "description": "Agents IA personnalisés : prompt propre, outils et fournisseur/modèle. Utilisez-les dans le chat ou programmez-les dans Cron.",
      "treeBtn": "Arbre",
      "treeBtnTitle": "Voir l'arbre de hiérarchie des agents",
      "rolesBtn": "Rôles",
      "rolesBtnTitle": "Créer et gérer les rôles d'agent",
      "newAgent": "Nouvel agent",
      "loading": "Chargement des agents…",
      "emptyTitle": "Vous n'avez pas encore d'agents",
      "emptyDesc": "Créez-en un pour discuter avec un prompt et un ensemble d'outils sur mesure.",
      "multiAgentTitle": "Multi-agent : {count} copies",
      "roleAssignedTitle": "Rôle assigné",
      "subordinateTitle": "Subordonné de",
      "connectionsTitle": "Connexions avec d'autres agents",
      "supervisorTitle": "Superviseur : peut créer des chats pour les subordonnés",
      "supervisorBadge": "superviseur",
      "realtimeTitle": "Communication en temps réel",
      "realtimeBadge": "temps réel",
      "startChat": "Démarrer le chat",
      "duplicateTitle": "Dupliquer",
      "noRoleGroupTitle": "Sans groupe de travail",
      "groupAria": "Groupe de travail : {name}",
      "groupCount": "{count} agents",
      "noRoleGroupDesc": "Agents sans rôle attribué. Attribuez-leur-en un depuis l'éditeur."
    },
    "resync": {
      "applying": "Création en cours…",
      "close": "Fermer",
      "btn": "Synchroniser avec le modèle",
      "btnTitle": "Comparer cette équipe à son modèle et créer les agents manquants",
      "modalTitle": "Synchroniser «{name}» avec son modèle",
      "loading": "Comparaison avec le modèle…",
      "markersMissing": "Cette équipe a perdu les marqueurs d'origine du modèle ; la comparaison automatique est impossible. Vous pouvez créer les agents manquants manuellement.",
      "missingHeading": "Manquants",
      "presentHeading": "Présents",
      "extraHeading": "Ajoutés manuellement",
      "extraNote": "Ils ne seront pas modifiés.",
      "nothingMissing": "L'équipe est complète : aucun agent du modèle ne manque.",
      "confirm": "Créer la sélection"
    }
  },
  "accessTab": {
    "all": "Tous",
    "permissionsTitle": "Accès et permissions",
    "permissionsDescription": "Aujourd'hui, la visibilité de l'assistant est régie par la permission du module assistant dans votre profil. Le détail par rôle (assistant.use / assistant.configure / assistant.module.<id>) est prévu pour la prochaine itération.",
    "recentInvocations": "Dernières invocations d'outils",
    "refreshAriaLabel": "Actualiser les accès",
    "loading": "Chargement...",
    "emptyRecent": "Aucune activité récente.",
    "emptyProvider": "Aucune activité pour ce fournisseur.",
    "byUser": "par",
    "crossServerTitle": "Accès au serveur associé",
    "autoApproveTitle": "Approbation automatique",
    "autoApproveDescription": "Outils qui ne demandent plus de confirmation (approuvés avec « Approuver et ne plus demander »). Les modifications s'appliquent à partir de la prochaine exécution.",
    "autoApproveEmpty": "Aucun outil avec approbation automatique. Cette liste se remplit lorsque vous choisissez « Approuver et ne plus demander » en approuvant une action de l'agent.",
    "autoApproveRevoke": "Révoquer",
    "autoApproveModeAuto": "mode automatique : cette liste ne s'applique pas",
    "cmdPrefix": "$ ",
    "passwordLabel": "mot de passe : ",
    "passphraseLabel": "phrase secrète : ",
    "privateKeyLabel": "clé privée"
  },
  "directoryPicker": {
    "title": "Sélectionner un dossier",
    "goUp": "Monter",
    "loading": "Chargement…",
    "emptyDirs": "(sans sous-dossiers)",
    "cancel": "Annuler",
    "select": "Utiliser ce dossier",
    "readError": "Impossible de lire le répertoire"
  },
  "skillsSettings": {
    "title": "Skills et méthodes de l'assistant",
    "helper": "Activez ou désactivez les bibliothèques, skills et méthodes qui affinent le comportement de l'assistant.",
    "tokenNote": "Les instructions de chaque skill voyagent dans le prompt mis en cache (~0.1× pour les tours suivants). Ponytail réduit le code et les tokens de sortie ; avec UI/UX Pro Max, utilisez le niveau «Bref» pour économiser.",
    "search": "Rechercher une skill…",
    "allCategories": "Toutes les catégories",
    "loading": "Chargement des skills...",
    "empty": "Aucune skill disponible.",
    "noMatch": "Aucune skill ne correspond au filtre.",
    "sourcePrefix": "Source :",
    "errorGeneric": "Impossible de mettre à jour la skill. Réessayez.",
    "activeShown": "{count} actives · {shown} affichées."
  },
  "skillsPicker": {
    "searchPlaceholder": "Rechercher une skill…",
    "resetTitle": "Supprimer la personnalisation (utiliser les skills globales)",
    "reset": "Réinitialiser ({count})",
    "loading": "Chargement des skills…",
    "empty": "Aucune skill.",
    "globalNote": "S'appliquent UNIQUEMENT dans vos chats, en plus des skills globales du fournisseur."
  },
  "skillCategories": {
    "methods": "Méthodes de l'assistant",
    "code-quality": "Qualité du code",
    "web-quality": "Qualité web (Lighthouse / CWV)",
    "ui-ux": "UI / UX / design",
    "web-fullstack": "Développement web / full-stack IA",
    "mobile": "Applications mobiles",
    "code-agents": "Agents de code",
    "reusable-skills": "Skills réutilisables pour l'IA",
    "security": "Sécurité IA / web / apps",
    "token-savings": "Économies de jetons / coûts IA",
    "ai-prod": "Agents IA en production",
    "devops": "DevOps / déploiement",
    "testing": "Tests / qualité du code",
    "data-rag": "Bases de données / RAG / recherche",
    "automation": "Automatisation / workflows",
    "other": "Autres"
  },
  "skillCatalog": {
    "ask-protocol": {
      "name": "Demander avant de décider",
      "description": "Permet à l'assistant de s'arrêter et de vous poser une décision clé au lieu de supposer (outil lxp_ask + protocole de questions)."
    },
    "project-context-vault": {
      "name": "Contexte du projet (Obsidian)",
      "description": "Injecte des notes de contexte du projet (Contexto.md / Errores.md) et vous permet de rechercher davantage avec obsidian.search_notes."
    },
    "ponytail": {
      "name": "Ponytail (code minimaliste)",
      "description": "Mode de développement minimaliste : écrire le code minimum nécessaire (échelle de décision + garde-fous)."
    },
    "ui-ux-pro-max": {
      "name": "UI/UX Pro Max (qualité d'interface)",
      "description": "Normes professionnelles de UI/UX (accessibilité, tactile, typographie, états) injectées dans la requête ; niveau court ou complet."
    },
    "openai-agents-sdk": {
      "name": "OpenAI Agents SDK",
      "description": "Agents OpenAI avec tools, handoffs, guardrails, sessions et tracing."
    },
    "openai-agents-python": {
      "name": "OpenAI Agents Python SDK",
      "description": "SDK Python pour agents : Agent, Runner, @function_tool, handoffs et tracing."
    },
    "openai-agents-js": {
      "name": "OpenAI Agents JS SDK",
      "description": "SDK TypeScript/JS pour agents OpenAI : Agent, run, tools (Zod), handoffs."
    },
    "mcp-docs": {
      "name": "Model Context Protocol",
      "description": "Norme ouverte (le 'USB-C de l'IA') pour connecter les LLMs à des outils, ressources et requêtes."
    },
    "mcp-github": {
      "name": "MCP (GitHub)",
      "description": "Org GitHub de MCP : SDKs officiels (10 langages), serveurs de référence et inspecteur."
    },
    "anthropic-mcp-intro": {
      "name": "Anthropic MCP Intro",
      "description": "Annonce d'Anthropic : MCP comme norme ouverte qui résout les intégrations N×M."
    },
    "n8n": {
      "name": "n8n",
      "description": "Automatisation de workflows fair-code, auto-hébergeable."
    },
    "make": {
      "name": "Make",
      "description": "Automatisation visuelle no-code par scénarios (anciennement Integromat)."
    },
    "zapier": {
      "name": "Zapier",
      "description": "Automatisation SaaS via triggers et actions (Zaps)."
    },
    "temporal": {
      "name": "Temporal",
      "description": "Orchestration de workflows durables et tolérants aux pannes."
    },
    "bullmq": {
      "name": "BullMQ",
      "description": "Files d'attente de jobs basées sur Redis pour Node.js."
    },
    "langgraph": {
      "name": "LangGraph",
      "description": "Orchestration d'agents LLM comme graphes avec état."
    },
    "codex-cli": {
      "name": "OpenAI Codex CLI",
      "description": "Guide l'agent pour utiliser Codex CLI d'OpenAI (agent de code terminal)."
    },
    "codex-cli-features": {
      "name": "Codex CLI Features",
      "description": "Détaille les capacités de Codex CLI (sandbox, approbations, MCP, config)."
    },
    "codex-cloud": {
      "name": "Codex Cloud",
      "description": "Guide l'agent à déléguer les tâches à Codex Cloud (environnements distants, exécution parallèle, PRs)."
    },
    "claude-code-skills": {
      "name": "Claude Code Skills",
      "description": "Guide l'agent à créer et utiliser Skills Claude Code (dossier avec SKILL.md, norme Agent Skills)."
    },
    "copilot-cloud-agent": {
      "name": "GitHub Copilot Cloud Agent",
      "description": "Guide l'agent à déléguer les issues à l'agent de code GitHub Copilot, qui travaille dans le cloud et ouvre des PRs."
    },
    "cursor": {
      "name": "Cursor",
      "description": "Guide l'agent à travailler dans l'éditeur Cursor (Agent, contexte du repo, règles)."
    },
    "agents-md": {
      "name": "AGENTS.md",
      "description": "Guide l'agent à rédiger et respecter AGENTS.md, le fichier d'instructions standard pour les agents de code."
    },
    "open-design-contribute": {
      "name": "Open Design — contribuer (no-code)",
      "description": "Flux guidé sans code pour contribuer à Open Design (nexu-io) : soumettre un Skill ou Design System, traduire les docs, corriger le texte ou signaler un bug, et il ouvre la PR/issue pour vous."
    },
    "supabase": {
      "name": "Supabase",
      "description": "Backend Postgres géré avec auth, storage et realtime."
    },
    "postgresql": {
      "name": "PostgreSQL",
      "description": "Base de données relationnelle robuste avec types riches."
    },
    "pgvector": {
      "name": "pgvector",
      "description": "Recherche de similarité vectorielle dans Postgres."
    },
    "pinecone": {
      "name": "Pinecone",
      "description": "Base de données vectorielle gérée pour RAG à grande échelle."
    },
    "qdrant": {
      "name": "Qdrant",
      "description": "Moteur vectoriel open-source avec filtrage par payload."
    },
    "weaviate": {
      "name": "Weaviate",
      "description": "Base de données vectorielle avec schéma et modules de vectorisation."
    },
    "github-actions": {
      "name": "GitHub Actions",
      "description": "CI/CD sur GitHub avec workflows YAML (.github/workflows) déclenchés par des événements."
    },
    "vercel": {
      "name": "Vercel",
      "description": "Déploiement de frontends et de fonctions serverless avec aperçu par commit/PR."
    },
    "docker": {
      "name": "Docker",
      "description": "Empaquette les apps dans des conteneurs éphémères avec des images légères et reproductibles."
    },
    "nginx": {
      "name": "Nginx",
      "description": "Serveur web haute performance et reverse proxy."
    },
    "pm2": {
      "name": "PM2",
      "description": "Gestionnaire de processus Node avec cluster, redémarrage et logs."
    },
    "redis": {
      "name": "Redis",
      "description": "Magasin en mémoire pour cache, files d'attente et structures de données."
    },
    "expo": {
      "name": "Expo",
      "description": "Guide l'agent à développer des apps React Native avec Expo (expo-router, modules, config plugins)."
    },
    "eas-build": {
      "name": "EAS Build",
      "description": "Guide l'agent à compiler des binaires iOS/Android dans le cloud avec EAS Build et profils eas.json."
    },
    "eas-services": {
      "name": "EAS Services",
      "description": "Aide l'agent à utiliser l'écosystème EAS (Submit, Update/OTA, Workflows) end-to-end."
    },
    "react-native": {
      "name": "React Native",
      "description": "Guide l'agent à construire des UIs natives avec React Native (composants core, styles, plateforme)."
    },
    "firebase-auth": {
      "name": "Firebase Auth",
      "description": "Guide l'agent à implémenter l'authentification avec Firebase Auth (providers, tokens, session)."
    },
    "claude-agent-skills": {
      "name": "Claude Agent Skills",
      "description": "Empaquette des capacités réutilisables comme Agent Skills (SKILL.md) chargées à la demande."
    },
    "claude-skills-github": {
      "name": "Claude Skills (GitHub)",
      "description": "Dépôt officiel anthropics/skills : exemples, spec et template comme base et motif."
    },
    "codex-agents-md-guide": {
      "name": "Codex AGENTS.md Guide",
      "description": "Convention AGENTS.md de Codex pour donner des instructions de projet aux agents de code."
    },
    "owasp-llm-top10": {
      "name": "OWASP Top 10 LLM",
      "description": "Top 10 des risques dans les apps LLM : injection de requête, sortie non sécurisée, excessive agency."
    },
    "owasp-asvs": {
      "name": "OWASP ASVS",
      "description": "ASVS v5.0 : norme d'exigences de sécurité vérifiables par niveaux."
    },
    "codeql": {
      "name": "CodeQL",
      "description": "CodeQL : interroger le code comme des données (data-flow/taint) pour trouver les vulnérabilités."
    },
    "semgrep": {
      "name": "Semgrep",
      "description": "Semgrep : SAST par règles style-code + Supply Chain (SCA) et Secrets, haut signal."
    },
    "snyk": {
      "name": "Snyk",
      "description": "Snyk : SCA, Code (SAST), Container, IaC et API/Web (DAST) avec remédiation guidée."
    },
    "owasp-zap": {
      "name": "OWASP ZAP",
      "description": "OWASP ZAP : scanner web open source leader pour DAST (passive/active scan)."
    },
    "skillspector": {
      "name": "SkillSpector (auditer les Skills IA)",
      "description": "Audite les Skills des agents IA (SKILL.md + scripts) pour les vulnérabilités et les intentions malveillantes avant installation (NVIDIA, Apache-2.0)."
    },
    "playwright": {
      "name": "Playwright",
      "description": "Tests E2E multi-navigateur avec auto-attente et traces."
    },
    "cypress": {
      "name": "Cypress",
      "description": "Tests de composants et E2E dans le navigateur avec tentatives."
    },
    "vitest": {
      "name": "Vitest",
      "description": "Runner de tests rapide natif de Vite/ESM."
    },
    "jest": {
      "name": "Jest",
      "description": "Framework de tests avec mocks intégrés et snapshots."
    },
    "testing-library": {
      "name": "Testing Library",
      "description": "Requêtes centrées sur l'utilisateur pour tester l'UI accessible."
    },
    "storybook": {
      "name": "Storybook",
      "description": "Développement et tests isolés des composants UI."
    },
    "openai-prompt-caching": {
      "name": "OpenAI Prompt Caching",
      "description": "Réduit automatiquement les coûts en réutilisant le préfixe de requête mis en cache dans OpenAI."
    },
    "openai-prompt-engineering": {
      "name": "OpenAI Prompt Engineering",
      "description": "Écrivez des requêtes précises pour moins d'itérations et moins de jetons."
    },
    "gemini-context-caching": {
      "name": "Gemini Context Caching",
      "description": "Cache le contexte volumineux répété dans Gemini (explicite ou implicite) pour réduire les entrées."
    },
    "gemini-caching-api": {
      "name": "Gemini Caching API",
      "description": "API cachedContents de Gemini : créer, réutiliser, mettre à jour TTL et supprimer les caches."
    },
    "litellm-cost-tracking": {
      "name": "LiteLLM Cost Tracking",
      "description": "Mesurez et attribuez le coût par clé/utilisateur/équipe avec le proxy LiteLLM."
    },
    "litellm": {
      "name": "LiteLLM",
      "description": "Passerelle unifiée vers 100+ LLMs (format OpenAI) avec cache, fallbacks et routing."
    },
    "figma-ai": {
      "name": "Figma AI",
      "description": "IA Figma : agent de canvas, génération d'images et design-to-code."
    },
    "figma-make": {
      "name": "Figma Make",
      "description": "Figma Make : de requête ou frame à prototype/app fonctionnel avec code réel."
    },
    "figma-ai-tools": {
      "name": "Figma AI Tools",
      "description": "Outils IA dans Figma Design : First Draft, renommer les calques, images, texte."
    },
    "framer": {
      "name": "Framer",
      "description": "Framer : sites no-code avec canvas visuel, agents IA, CMS et publication."
    },
    "relume": {
      "name": "Relume",
      "description": "Relume : de brief à sitemap, wireframes et style guide avec IA + librerie."
    },
    "design-md-tokens": {
      "name": "DESIGN.md (système basé sur jetons)",
      "description": "Générez une UI fidèle à une marque avec un DESIGN.md structuré : jetons couleur/typographie/espacement, specs de composants et règles do/don't (voltagent, MIT)."
    },
    "nextjs-app-router": {
      "name": "Next.js App Router",
      "description": "Guide l'agent à construire des apps Next.js avec l'App Router (Server Components, route handlers, layouts)."
    },
    "vercel-ai-sdk": {
      "name": "Vercel AI SDK",
      "description": "Aide l'agent à intégrer les LLMs avec le AI SDK (generateText, streamText, tools, structured output)."
    },
    "vercel-ai-gateway": {
      "name": "Vercel AI Gateway",
      "description": "Guide l'agent à router les requêtes vers plusieurs modèles via AI Gateway (un endpoint, fallback, observabilité)."
    },
    "openai-sdk-cli": {
      "name": "OpenAI SDKs et CLI",
      "description": "Guide l'agent à utiliser les SDKs officiels d'OpenAI (Python/Node) et l'API de manière idiomatique."
    },
    "v0-vercel": {
      "name": "v0 by Vercel",
      "description": "Aide l'agent à générer et affiner l'UI React/Tailwind/shadcn avec v0 à partir de requêtes."
    },
    "web-quality-audit": {
      "name": "Audit de qualité web",
      "description": "Audit complet de qualité web (performance, accessibilité, SEO, sécurité) avec classification par sévérité."
    },
    "web-performance": {
      "name": "Performance web",
      "description": "Optimisez la vitesse de chargement et l'efficacité à l'exécution (budget de ressources + Lighthouse)."
    },
    "core-web-vitals": {
      "name": "Core Web Vitals (LCP/INP/CLS)",
      "description": "Améliorez LCP, INP et CLS (seuils au 75e percentile)."
    },
    "web-accessibility": {
      "name": "Accessibilité web (WCAG 2.2)",
      "description": "Auditez et améliorez l'accessibilité selon WCAG 2.2 (cible AA)."
    },
    "web-seo": {
      "name": "SEO (technique + on-page)",
      "description": "Optimisez la visibilité dans les moteurs de recherche : SEO technique, on-page et données structurées."
    },
    "web-best-practices": {
      "name": "Bonnes pratiques web (sécurité)",
      "description": "Motifs modernes de sécurité, compatibilité et qualité du code."
    }
  }
} as const;

export default assistantPart2;
