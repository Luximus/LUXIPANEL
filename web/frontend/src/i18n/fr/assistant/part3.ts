const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "Intensité",
        "choices": {
          "off": "Désactivé",
          "lite": "Lite — suggérer l'alternative la plus simple",
          "full": "Full — appliquer l'échelle",
          "ultra": "Ultra — extrémiste YAGNI"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "Détail",
        "choices": {
          "breve": "Bref (jetons minimums)",
          "completo": "Complet (plus de détail)"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "Exécuter commande bash"
    },
    "admin.restart_service": {
      "title": "Redémarrer service systemd"
    },
    "backup.list_jobs": {
      "title": "Lister les backups configurés"
    },
    "bitninja.status": {
      "title": "Statut BitNinja"
    },
    "cloudflare.status": {
      "title": "Statut Cloudflare"
    },
    "cloudflare.list_zones": {
      "title": "Lister les zones Cloudflare"
    },
    "cloudflare.list_dns_records": {
      "title": "Lister les enregistrements DNS"
    },
    "cloudflare.create_dns_record": {
      "title": "Créer enregistrement DNS"
    },
    "cloudflare.update_dns_record": {
      "title": "Mettre à jour enregistrement DNS"
    },
    "cloudflare.delete_dns_record": {
      "title": "Supprimer enregistrement DNS"
    },
    "cloudflare.purge_cache": {
      "title": "Purger le cache Cloudflare"
    },
    "cloudflare.get_zone_settings": {
      "title": "Voir les paramètres de zone"
    },
    "cloudflare.set_zone_setting": {
      "title": "Modifier paramètre de zone"
    },
    "cloudflare.list_access_rules": {
      "title": "Lister les règles d'accès IP"
    },
    "cloudflare.block_ip": {
      "title": "Bloquer IP dans Cloudflare"
    },
    "cron.list": {
      "title": "Lister les tâches cron"
    },
    "cron.add": {
      "title": "Créer tâche cron"
    },
    "cron.update": {
      "title": "Éditer tâche cron"
    },
    "cron.toggle": {
      "title": "Pause/Reprendre tâche cron"
    },
    "cron.remove": {
      "title": "Supprimer tâche cron"
    },
    "cron.ai_list": {
      "title": "Lister les agents IA planifiés"
    },
    "cron.ai_logs": {
      "title": "Lister les exécutions d'un agent IA"
    },
    "cron.ai_read_log": {
      "title": "Lire l'exécution d'un agent IA"
    },
    "cron.ai_run": {
      "title": "Exécuter un agent IA planifié maintenant"
    },
    "cron.ai_toggle": {
      "title": "Pause/Reprendre un agent IA planifié"
    },
    "cron.ai_add": {
      "title": "Créer agent IA planifié"
    },
    "cron.ai_update": {
      "title": "Éditer agent IA planifié"
    },
    "cron.ai_remove": {
      "title": "Supprimer agent IA planifié"
    },
    "cron.presets_get": {
      "title": "Lire la configuration d'agents (presets)"
    },
    "cron.presets_set": {
      "title": "Enregistrer configuration d'agents (presets)"
    },
    "dashboard.overview": {
      "title": "Aperçu du serveur"
    },
    "databases.list_engines": {
      "title": "Détecter les moteurs de base de données"
    },
    "databases.list_databases": {
      "title": "Lister les bases de données"
    },
    "databases.list_tables": {
      "title": "Lister les tables"
    },
    "databases.run_query": {
      "title": "Exécuter requête SQL"
    },
    "expo.status": {
      "title": "Statut Expo"
    },
    "expo.account": {
      "title": "Compte Expo"
    },
    "expo.list_projects": {
      "title": "Lister les projets Expo"
    },
    "expo.project_info": {
      "title": "Infos du projet"
    },
    "expo.init_project": {
      "title": "Créer projet Expo"
    },
    "expo.link_project": {
      "title": "Lier le projet à EAS"
    },
    "expo.build": {
      "title": "Démarrer la compilation EAS"
    },
    "expo.build_list": {
      "title": "Historique des compilations"
    },
    "expo.build_view": {
      "title": "Statut de la compilation"
    },
    "expo.build_cancel": {
      "title": "Annuler la compilation"
    },
    "expo.submit": {
      "title": "Soumettre à la boutique"
    },
    "expo.dev_client": {
      "title": "Démarrer dev-client (QR)"
    },
    "expo.quota": {
      "title": "Quota de compilations"
    },
    "expo.update": {
      "title": "Publier mise à jour OTA"
    },
    "expo.env_list": {
      "title": "Lister les variables EAS"
    },
    "expo.env_set": {
      "title": "Créer variable EAS"
    },
    "expo.set_google_credential": {
      "title": "Identifiant Play Store"
    },
    "expo.set_apple_credential": {
      "title": "Identifiant App Store"
    },
    "expo.webhook_create": {
      "title": "Enregistrer webhook EAS"
    },
    "expo.device_create": {
      "title": "Enregistrer dispositif iOS"
    },
    "files.read": {
      "title": "Lire fichier"
    },
    "files.list_dir": {
      "title": "Lister répertoire"
    },
    "files.grep": {
      "title": "Rechercher dans les fichiers"
    },
    "files.project_info": {
      "title": "Détecter type de projet"
    },
    "files.security_scan": {
      "title": "Scan de sécurité heuristique"
    },
    "files.write": {
      "title": "Écrire fichier"
    },
    "files.mkdir": {
      "title": "Créer dossier"
    },
    "files.delete": {
      "title": "Supprimer fichier ou dossier"
    },
    "files.rename": {
      "title": "Renommer ou déplacer"
    },
    "files.copy": {
      "title": "Copier fichier"
    },
    "files.chmod": {
      "title": "Modifier permissions (chmod)"
    },
    "files.chown": {
      "title": "Modifier propriétaire (chown)"
    },
    "firewall.ufw_status": {
      "title": "Statut UFW"
    },
    "firewall.fail2ban_status": {
      "title": "Statut fail2ban (jails)"
    },
    "hosting.list_accounts": {
      "title": "Lister les comptes d'hébergement"
    },
    "hosting.list_audit": {
      "title": "Voir le journal d'audit d'un compte d'hébergement"
    },
    "hosting.account_stats": {
      "title": "Stats d'utilisation d'un compte d'hébergement"
    },
    "mail.list_domains": {
      "title": "Domaines disponibles"
    },
    "mail.list_messages": {
      "title": "Lister les messages de la boîte de réception"
    },
    "mail.fetch_message": {
      "title": "Lire le message complet"
    },
    "mail.move_messages": {
      "title": "Déplacer les messages en quarantaine"
    },
    "mail.flag_messages": {
      "title": "Marquer les messages"
    },
    "mail.delete_messages": {
      "title": "Supprimer les messages (permanent)"
    },
    "module-dev.validate_manifest": {
      "title": "Valider le manifeste"
    },
    "module-dev.run_checks": {
      "title": "Vérifications statiques du module"
    },
    "module-dev.run_tests": {
      "title": "Exécuter les tests du module"
    },
    "module-dev.list_modules": {
      "title": "Mes modules de la marketplace"
    },
    "module-dev.module_status": {
      "title": "Statut du module"
    },
    "module-dev.submit_module": {
      "title": "Soumettre le module pour révision"
    },
    "module-dev.resubmit_module": {
      "title": "Renvoyer le module corrigé"
    },
    "module-dev.unpublish_module": {
      "title": "Dépublier le module"
    },
    "module-dev.republish_module": {
      "title": "Republier le module"
    },
    "module-dev.preview_install": {
      "title": "Installer l'aperçu (Mode B)"
    },
    "module-dev.preview_uninstall": {
      "title": "Désinstaller l'aperçu"
    },
    "module-dev.link_project": {
      "title": "Lier le projet ↔ module"
    },
    "monitor.cpu_top": {
      "title": "Processus avec le plus de CPU"
    },
    "monitor.watchdog_status": {
      "title": "Statut du redémarrage automatique"
    },
    "monitor.watchdog_configure": {
      "title": "Configurer le redémarrage automatique"
    },
    "nginx.list_sites": {
      "title": "Lister les sites nginx"
    },
    "nginx.tail_access_log": {
      "title": "Queue du access.log"
    },
    "obsidian.list_vaults": {
      "title": "Lister les vaults"
    },
    "obsidian.list_notes": {
      "title": "Lister les notes"
    },
    "obsidian.read_note": {
      "title": "Lire une note"
    },
    "obsidian.search_notes": {
      "title": "Rechercher dans les notes"
    },
    "obsidian.backlinks": {
      "title": "Backlinks d'une note"
    },
    "obsidian.write_note": {
      "title": "Écrire une note"
    },
    "obsidian.append_note": {
      "title": "Ajouter à une note"
    },
    "obsidian.daily_note": {
      "title": "Note quotidienne"
    },
    "obsidian.delete_note": {
      "title": "Supprimer une note"
    },
    "obsidian.list_containers": {
      "title": "Lister les conteneurs de contexte"
    },
    "obsidian.sync_containers": {
      "title": "Synchroniser les conteneurs de contexte"
    },
    "openclaw.config": {
      "title": "Configuration OpenClaw"
    },
    "openclaw.test_connection": {
      "title": "Tester la connexion OpenClaw"
    },
    "security-audit.last_report": {
      "title": "Dernier rapport d'audit"
    },
    "security-audit.ssh_posture": {
      "title": "Posture SSH du serveur"
    },
    "server-alerts.send": {
      "title": "Envoyer notification au serveur"
    },
    "server-alerts.list_rules": {
      "title": "Lister les règles d'alerte"
    },
    "server-alerts.create_rule": {
      "title": "Créer règle d'alerte"
    },
    "users.list": {
      "title": "Lister les utilisateurs du panel"
    },
    "users.create": {
      "title": "Créer utilisateur"
    },
    "users.update": {
      "title": "Éditer utilisateur"
    },
    "users.delete": {
      "title": "Supprimer utilisateur"
    },
    "users.groups_list": {
      "title": "Lister les groupes avec permissions"
    },
    "users.group_create": {
      "title": "Créer groupe"
    },
    "users.group_update": {
      "title": "Éditer groupe"
    },
    "users.group_delete": {
      "title": "Supprimer groupe"
    },
    "webhooks.list": {
      "title": "Lister les webhooks configurés"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "Santé du serveur",
      "description": "Sonde rapide de la disponibilité / charge du serveur cible connecté — utile comme contexte de requête système avant de répondre aux questions opérationnelles."
    },
    "dashboard.snapshot": {
      "title": "Aperçu compact",
      "description": "Résumé pré-requête compact du serveur cible connecté : charge, %RAM, %disque racine, et combien de services clés fonctionnent."
    },
    "monitor.snapshot": {
      "title": "Snapshot du système",
      "description": "Résumé des ressources actuelles pour le serveur cible connecté : %utilisation CPU, moyenne de charge, mémoire utilisée / totale, utilisation du système de fichiers racine."
    },
    "obsidian.vaults_summary": {
      "title": "Résumé des vaults",
      "description": "Vaults Obsidian enregistrés sur le serveur connecté avec leur chemin, existence et nombre de notes markdown."
    }
  },
  "structurePanel": {
    "editorLoading": "Chargement de l'éditeur...",
    "loading": "Chargement...",
    "createdNotice": "Créé {count} élément(s).",
    "nothingToCreate": "Rien à créer (déjà existant).",
    "savedNotice": "Enregistré {rel}.",
    "noActiveProviders": "Aucun fournisseur d'IA actif. Activez-en un dans Fournisseurs.",
    "improvedNotice": "Amélioré avec l'IA. Révisez le diff et cliquez sur Enregistrer si cela vous convient.",
    "noAiChanges": "L'IA n'a proposé aucune modification.",
    "structureLoading": "Analyse de la structure...",
    "retry": "Réessayer",
    "copyAllContent": "Copier tout le contenu",
    "copied": "Copié",
    "copy": "Copier",
    "downloadFile": "Télécharger fichier",
    "download": "Télécharger",
    "diff": "Diff",
    "originalDiffTitle": "Voir les différences par rapport au contenu original",
    "back": "Retour",
    "improveContentTitle": "Améliorer le contenu avec l'IA en utilisant le contexte du projet",
    "improving": "Amélioration...",
    "improveWithAi": "Améliorer avec l'IA",
    "cancel": "Annuler",
    "saving": "Enregistrement...",
    "save": "Enregistrer",
    "chooseProvider": "Choisir le fournisseur d'IA",
    "close": "Fermer",
    "noModel": "(pas de modèle)",
    "directory": "Répertoire",
    "structureCount": "Structure · {count} à créer",
    "markMissing": "Marquer comme manquant",
    "creating": "Création...",
    "create": "Créer ({count})",
    "expand": "Développer",
    "collapse": "Réduire",
    "edit": "Éditer",
    "exists": "Existe",
    "createLabel": "créer",
    "fallbackFilename": "fichier.txt",
    "structureHints": {
      "claude": "Instructions, configuration, règles, commandes, skills, agents et hooks que Claude Code lit depuis le répertoire du projet.",
      "codex": "Codex CLI lit AGENTS.md comme guide du projet et .codex/ pour la configuration et les prompts.",
      "gemini": "Gemini CLI lit GEMINI.md comme contexte du projet et .gemini/ pour la configuration et les commandes."
    },
    "structureNodes": {
      "CLAUDE.md": "Instructions du projet (contexte, commandes, conventions)",
      "CLAUDE.local.md": "Instructions locales (ne pas committer ; préférences personnelles)",
      ".mcp.json": "Serveurs MCP du projet",
      ".claude/settings.json": "Configuration du projet (versionnée)",
      ".claude/settings.local.json": "Configuration locale (non versionnée)",
      ".claude/rules": "Règles réutilisables",
      ".claude/rules/code-style.md": "Règle : style de code",
      ".claude/rules/testing.md": "Règle : tests",
      ".claude/rules/api-conventions.md": "Règle : conventions d'API",
      ".claude/commands": "Commandes slash personnalisées",
      ".claude/commands/review.md": "Commande /review",
      ".claude/commands/fix-issue.md": "Commande /fix-issue",
      ".claude/skills": "Skills du projet",
      ".claude/skills/deploy": "Skill : deploy",
      ".claude/skills/deploy/SKILL.md": "Définition du skill deploy",
      ".claude/skills/deploy/deploy-config.md": "Configuration du skill deploy",
      ".claude/agents": "Sous-agents spécialisés",
      ".claude/agents/code-reviewer.md": "Agent : relecteur de code",
      ".claude/agents/security-auditor.md": "Agent : auditeur de sécurité",
      ".claude/hooks": "Hooks (scripts de cycle de vie)",
      ".claude/hooks/validate-bash.sh": "Hook : valider les commandes bash",
      "AGENTS.md": "Guide du projet pour Codex/agents",
      ".codex": "Configuration Codex",
      ".codex/config.toml": "Configuration du projet Codex",
      ".codex/prompts": "Prompts/modèles réutilisables",
      ".codex/prompts/review.md": "Prompt : relecture de code",
      "GEMINI.md": "Contexte du projet pour Gemini",
      ".gemini": "Configuration Gemini",
      ".gemini/settings.json": "Configuration du projet Gemini",
      ".gemini/commands": "Commandes personnalisées",
      ".gemini/commands/review.toml": "Commande : review",
      "modules/*": "Racine du module marketplace",
      "modules/*/module.manifest.json": "Manifeste brouillon (les champs AUTO sont définis par la plateforme)",
      "modules/*/backend/index.js": "Backend du module — squelette SDK defineModule()",
      "modules/*/frontend": "Frontend du module (Astro, optionnel)",
      "modules/*/README.md": "README du module",
      ".claude/rules/marketplace.md": "Règle : architecture du marketplace (manifeste, SDK, capacités)",
      "MARKETPLACE.md": "Règles d'architecture du marketplace (manifeste, SDK, capacités)"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "Pas de réponse d'installation",
    "summaryTitle": "Exposer les capacités du panel au CLI (MCP)",
    "optional": "optionnel",
    "description": "Connectez le CLI de {providerId} aux outils du panel. Le panel écrit la configuration directement sur le serveur cible ; vous n'avez rien à copier.",
    "configuredTitle": "Configuré sur la cible",
    "tokenValidUntil": "Jeton valide jusqu'au {date}.",
    "restartCli": "Redémarrez le CLI dans le terminal pour qu'il charge le nouveau serveur MCP.",
    "configuring": "Configuration...",
    "configureAutomatically": "Configurer automatiquement",
    "regenerate": "Régénérer le jeton et reconfigurer",
    "manualTitle": "Configuration manuelle (avancé)",
    "generating": "Génération...",
    "generateManualSnippet": "Générer un snippet manuel",
    "fileLabel": "Fichier",
    "snippetLabel": "Snippet ({format})",
    "copy": "Copier",
    "mcpUrlLabel": "URL MCP"
  },
  "conversationMedia": {
    "download": "Télécharger",
    "close": "Fermer",
    "previous": "Précédent",
    "next": "Suivant",
    "all": "Tous",
    "images": "Images",
    "documents": "Documents",
    "attachmentsTitle": "Pièces jointes de la conversation",
    "emptyConversation": "Aucune pièce jointe dans cette conversation.",
    "imagesSection": "Images",
    "documentsSection": "Documents",
    "clickToExpand": "cliquer pour agrandir",
    "emptyImages": "Pas d'images.",
    "emptyDocuments": "Pas de documents.",
    "mediaTitle": "Multimédia",
    "attachToChat": "Joindre au chat",
    "uploadToChat": "Téléverser des fichiers dans la conversation",
    "attachFailed": "Impossible de joindre le fichier à la conversation."
  },
  "teamBoard": {
    "title": "Équipe au travail",
    "progressOf": "{done} sur {total} tâches terminées",
    "statusPending": "En attente",
    "statusRunning": "En cours",
    "statusDone": "Terminée",
    "statusFailed": "Échouée",
    "statusCanceled": "Annulée",
    "pendingPermission": "En attente de votre approbation",
    "openChat": "Ouvrir le chat",
    "cancel": "Annuler la tâche",
    "cancelConfirm": "Annuler cette tâche ? L'agent cessera d'y travailler.",
    "assignedTo": "Assignée à {agent}",
    "autoTurn": "Message automatique de l'équipe",
    "dashboardTitle": "Équipes au travail",
    "tokensSummary": "Jetons : {total} (chef {leader} · équipe {workers})",
    "lessThan1s": "<1 s",
    "insertions": "+{count}",
    "deletions": "-{count}",
    "viewDiff": "Voir le diff",
    "close": "Fermer",
    "loading": "Chargement…",
    "statusQueued": "En file d'attente",
    "verifyRunning": "Vérification…",
    "addTaskSubmit": "Attribuer",
    "verifyPassed": "Vérifié",
    "verifyFailed": "Échec de la vérification ({attempts})",
    "filesChanged": "{count} fichier(s)",
    "diffTitle": "Modifications de la tâche",
    "diffUnavailable": "Aucune différence disponible pour cette tâche (pas de worktree ou aucune modification).",
    "diffTruncated": "Différence tronquée : la tâche a modifié plus de contenu que ce qui est affiché.",
    "branchIntegrated": "Branche intégrée",
    "cancelAll": "Tout annuler",
    "cancelAllConfirm": "Annuler TOUTES les tâches en cours ? Le plan actif sera marqué comme échoué.",
    "addTask": "Ajouter une tâche",
    "addTaskTitle": "Attribuer une tâche à un subordonné",
    "addTaskWorker": "Subordonné",
    "addTaskWorkerPlaceholder": "— Choisir un agent —",
    "addTaskNoWorkers": "Ce responsable n'a aucun subordonné direct.",
    "addTaskInstruction": "Instruction",
    "addTaskInstructionHint": "L'agent ne voit pas cette conversation ; incluez TOUT le contexte nécessaire.",
    "addTaskTitleField": "Titre (facultatif)",
    "addTaskProject": "Projet (facultatif)",
    "addTaskProjectNone": "— Aucun projet —",
    "addTaskSubmitting": "Attribution…",
    "feedbackUp": "Bon résultat",
    "feedbackDown": "Mauvais résultat",
    "orgChart": "Organigramme",
    "tokensChipTitle": "Jetons utilisés par cette tâche"
  },
  "agentInfo": {
    "roleLabel": "Rôle",
    "roleTooltip": "Rôle de l'agent : {role}",
    "providerLabel": "Fournisseur",
    "providerModelTooltip": "Fournisseur {provider} · Modèle {model}",
    "projectLabel": "Projet",
    "projectTooltip": "Projet : {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "Zoom arrière",
    "zoomIn": "Zoom avant",
    "zoomReset": "Réinitialiser le zoom"
  },
  "assistantErrorBoundary": {
    "errorMessage": "L'assistant a rencontré une erreur au chargement.",
    "retry": "Réessayer"
  }
} as const;

export default assistantPart3;
